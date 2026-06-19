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

async function loadAdminMiddleware() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-admin-'));
  fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(__dirname, '..', 'functions', 'admin', 'feedback', '_middleware.js'), path.join(tmpDir, '_middleware.js'));
  return import(pathToFileURL(path.join(tmpDir, '_middleware.js')).href);
}

function basicAuth(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

function authRequest(authorization) {
  const headers = authorization ? { authorization } : {};
  return new Request('https://perfusiontools.com/api/feedback', { headers });
}

async function assertAdminAccepted(endpoint, authorization, env, label) {
  const response = await endpoint.onRequestGet({ request: authRequest(authorization), env });
  assert.strictEqual(response.status, 200, label);
}

async function assertAdminRejected(endpoint, authorization, env, label) {
  const response = await endpoint.onRequestGet({ request: authRequest(authorization), env });
  assert.strictEqual(response.status, 401, label);
}

async function assertMiddlewareAccepted(middleware, authorization, env, label) {
  const response = await middleware.onRequest({
    request: authRequest(authorization),
    env,
    next: async () => new Response('ok', { status: 200 }),
  });
  assert.strictEqual(response.status, 200, label);
}

async function assertMiddlewareRejected(middleware, authorization, env, label) {
  const response = await middleware.onRequest({
    request: authRequest(authorization),
    env,
    next: async () => new Response('ok', { status: 200 }),
  });
  assert.strictEqual(response.status, 401, label);
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
  const middleware = await loadAdminMiddleware();
  const adminDb = createMockDb();
  await assertAdminAccepted(endpoint, basicAuth('admin', 'secret'), { FEEDBACK_DB: adminDb, FEEDBACK_ADMIN_USER: 'admin', FEEDBACK_ADMIN_PASSWORD: 'secret' }, 'Basic Auth should work when only Basic credentials are configured');
  await assertAdminAccepted(endpoint, 'Bearer token123', { FEEDBACK_DB: adminDb, FEEDBACK_ADMIN_TOKEN: 'token123' }, 'Bearer token should work when only token is configured');
  await assertAdminAccepted(endpoint, basicAuth('admin', 'secret'), { FEEDBACK_DB: adminDb, FEEDBACK_ADMIN_TOKEN: 'token123', FEEDBACK_ADMIN_USER: 'admin', FEEDBACK_ADMIN_PASSWORD: 'secret' }, 'Basic Auth should work when both auth methods are configured');
  await assertAdminRejected(endpoint, 'Bearer wrong', { FEEDBACK_DB: adminDb, FEEDBACK_ADMIN_TOKEN: 'token123', FEEDBACK_ADMIN_USER: 'admin', FEEDBACK_ADMIN_PASSWORD: 'secret' }, 'Invalid Bearer token should be rejected even when Basic fallback is configured');
  await assertAdminRejected(endpoint, null, { FEEDBACK_DB: adminDb, FEEDBACK_ADMIN_TOKEN: 'token123', FEEDBACK_ADMIN_USER: 'admin', FEEDBACK_ADMIN_PASSWORD: 'secret' }, 'Unauthenticated API requests should remain rejected');
  await assertMiddlewareAccepted(middleware, basicAuth('admin', 'secret'), { FEEDBACK_ADMIN_TOKEN: 'token123', FEEDBACK_ADMIN_USER: 'admin', FEEDBACK_ADMIN_PASSWORD: 'secret' }, 'Admin middleware should accept Basic Auth when token is also configured');
  await assertMiddlewareRejected(middleware, null, { FEEDBACK_ADMIN_TOKEN: 'token123', FEEDBACK_ADMIN_USER: 'admin', FEEDBACK_ADMIN_PASSWORD: 'secret' }, 'Unauthenticated admin page requests should remain rejected');
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
    assert(mainJs.includes('Please do not include patient-identifiable information.'), 'feedback details step should warn against patient-identifiable information');

    console.log('All feedback API tests passed.');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
