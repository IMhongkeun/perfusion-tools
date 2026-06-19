'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

function createMockDb() {
  const state = {
    inserts: [],
    counts: new Map(),
    updates: [],
  };

  return {
    state,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes('SELECT COUNT(*)')) {
                return { count: state.counts.get(params[0]) || 0 };
              }
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO feedback')) state.inserts.push(params);
              if (sql.includes('UPDATE feedback')) state.updates.push(params);
              return { success: true };
            },
            async all() {
              return { results: [] };
            },
          };
        },
        async run() {
          return { success: true };
        },
      };
    },
  };
}

async function loadFeedbackEndpoint() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-api-'));
  const apiDir = path.join(tmpDir, 'feedback');
  fs.mkdirSync(apiDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}');
  ['_shared.js', 'index.js'].forEach((file) => {
    fs.copyFileSync(path.join(__dirname, '..', 'functions', 'api', 'feedback', file), path.join(apiDir, file));
  });
  return import(pathToFileURL(path.join(apiDir, 'index.js')).href);
}

function makeRequest(payload) {
  return new Request('https://perfusiontools.com/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function postFeedback(endpoint, payload, env) {
  return endpoint.onRequestPost({ request: makeRequest(payload), env });
}

function basePayload(overrides = {}) {
  return {
    visitor_id: 'pt_validVisitor_12345',
    page_path: '/bsa/',
    calculator_key: 'bsa',
    rating: 'needs_improvement',
    category: 'general_feedback',
    message: 'Optional comment',
    language: 'en-US',
    device_type: 'desktop',
    ...overrides,
  };
}

async function run() {
  const endpoint = await loadFeedbackEndpoint();
  const originalFetch = global.fetch;
  const webhookCalls = [];
  global.fetch = async (url, options) => {
    webhookCalls.push({ url, options });
    return new Response('{}', { status: 200 });
  };

  try {
    for (const visitor_id of [undefined, null, '', 'visitor_without_prefix', 'pt_bad space']) {
      const db = createMockDb();
      const payload = basePayload({ visitor_id });
      if (visitor_id === undefined) delete payload.visitor_id;
      const response = await postFeedback(endpoint, payload, { FEEDBACK_DB: db, FEEDBACK_WEBHOOK_URL: 'https://example.test/hook' });
      const body = await response.json();
      assert.strictEqual(response.status, 400, `${visitor_id} should be rejected`);
      assert.strictEqual(body.error, 'Invalid visitor_id.');
      assert.strictEqual(db.state.inserts.length, 0, 'invalid visitor_id must not insert feedback');
    }
    assert.strictEqual(webhookCalls.length, 0, 'invalid visitor_id requests must not trigger webhooks');

    const normalDb = createMockDb();
    const normalResponse = await postFeedback(endpoint, basePayload({ rating: 'useful', category: 'general_feedback', message: '' }), { FEEDBACK_DB: normalDb });
    assert.strictEqual(normalResponse.status, 200);
    assert.strictEqual(normalDb.state.inserts.length, 1, 'valid visitor_id should insert normal feedback');
    assert.strictEqual(normalDb.state.inserts[0][6], 'general_feedback');
    assert.strictEqual(normalDb.state.inserts[0][13], 'normal');

    const urgentDb = createMockDb();
    const urgentResponse = await postFeedback(endpoint, basePayload({ category: 'calculation_issue' }), { FEEDBACK_DB: urgentDb, FEEDBACK_WEBHOOK_URL: 'https://example.test/hook' });
    assert.strictEqual(urgentResponse.status, 200);
    assert.strictEqual(urgentDb.state.inserts.length, 1, 'valid urgent feedback should insert');
    assert.strictEqual(urgentDb.state.inserts[0][6], 'calculation_issue');
    assert.strictEqual(urgentDb.state.inserts[0][13], 'urgent');
    assert.strictEqual(webhookCalls.length, 1, 'valid calculation_issue should trigger one webhook');

    const limitedDb = createMockDb();
    limitedDb.state.counts.set('pt_validVisitor_12345', 3);
    const limitedResponse = await postFeedback(endpoint, basePayload(), { FEEDBACK_DB: limitedDb, FEEDBACK_WEBHOOK_URL: 'https://example.test/hook' });
    const limitedBody = await limitedResponse.json();
    assert.strictEqual(limitedResponse.status, 429);
    assert.strictEqual(limitedBody.error, 'Too many feedback submissions. Please try again later.');
    assert.strictEqual(limitedDb.state.inserts.length, 0, 'rate limited feedback must not insert');
    assert.strictEqual(webhookCalls.length, 1, 'rate limited feedback must not trigger extra webhook');

    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    assert(mainJs.includes('visitorId = `pt_${randomPart.replace(/[^a-zA-Z0-9_-]/g, \'\')}`'), 'frontend visitor_id should use pt_ prefix and allowed characters');

    console.log('All feedback API tests passed.');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
