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
    eventInserts: [],
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
              if (sql.includes('INSERT INTO feedback_events')) state.eventInserts.push(params);
              else if (sql.includes('INSERT INTO feedback')) state.inserts.push(params);
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

async function loadFeedbackEventEndpoint() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-event-api-'));
  const apiDir = path.join(tmpDir, 'feedback');
  const eventDir = path.join(apiDir, 'event');
  fs.mkdirSync(eventDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(__dirname, '..', 'functions', 'api', 'feedback', '_shared.js'), path.join(apiDir, '_shared.js'));
  fs.copyFileSync(path.join(__dirname, '..', 'functions', 'api', 'feedback', 'event', 'index.js'), path.join(eventDir, 'index.js'));
  return import(pathToFileURL(path.join(eventDir, 'index.js')).href);
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

function makeEventRequest(payload, url = 'https://perfusiontools.com/api/feedback/event?bad=1#hash') {
  return new Request(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
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
  const eventEndpoint = await loadFeedbackEventEndpoint();
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


    const eventDb = createMockDb();
    const eventPayload = { visitor_id: 'pt_validVisitor_12345', prompt_id: 'prompt_12345678', page_path: '/bsa/?x=1#hash', calculator_key: 'bsa', event_type: 'viewed', rating: 'useful', language: 'en-US', device_type: 'desktop', patient_weight: 70, result: '1.8' };
    const eventResponse = await eventEndpoint.onRequestPost({ request: makeEventRequest(eventPayload), env: { FEEDBACK_DB: eventDb } });
    assert.strictEqual(eventResponse.status, 200, 'allowed feedback event should be stored');
    assert.strictEqual(eventDb.state.eventInserts.length, 1, 'feedback event should insert into separate table');
    assert.strictEqual(eventDb.state.eventInserts[0][4], '/bsa/', 'event page_path should strip query and hash');
    assert.strictEqual(eventDb.state.eventInserts[0].includes(70), false, 'event payload must not store calculator inputs');
    assert.strictEqual(eventDb.state.eventInserts[0].includes('1.8'), false, 'event payload must not store calculator results');

    for (const badPayload of [
      { ...eventPayload, event_type: 'opened' },
      { ...eventPayload, prompt_id: '' },
      { ...eventPayload, rating: 'bad_rating' },
      { ...eventPayload, visitor_id: undefined },
      { ...eventPayload, visitor_id: null },
      { ...eventPayload, visitor_id: '' },
      { ...eventPayload, visitor_id: 'badVisitor' },
    ]) {
      const badDb = createMockDb();
      const badResponse = await eventEndpoint.onRequestPost({ request: makeEventRequest(badPayload), env: { FEEDBACK_DB: badDb } });
      assert.strictEqual(badResponse.status, 400, 'invalid feedback event payload should be rejected');
      assert.strictEqual(badDb.state.eventInserts.length, 0, 'invalid event must not insert');
    }

    const eventLimitedDb = createMockDb();
    eventLimitedDb.state.counts.set('pt_validVisitor_12345', 120);
    const eventLimitedResponse = await eventEndpoint.onRequestPost({ request: makeEventRequest(eventPayload), env: { FEEDBACK_DB: eventLimitedDb } });
    assert.strictEqual(eventLimitedResponse.status, 429, 'event rate limit should be enforced by visitor_id');
    assert.strictEqual(eventLimitedDb.state.eventInserts.length, 0, 'rate limited event must not insert');

    const migrationSql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '0002_feedback_events.sql'), 'utf8');
    assert(migrationSql.includes('CREATE TABLE IF NOT EXISTS feedback_events'), 'feedback_events migration should create table');
    assert(migrationSql.includes('idx_feedback_events_prompt_id'), 'feedback_events migration should index prompt_id');

    const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    assert(mainJs.includes('visitorId = `pt_${randomPart.replace(/[^a-zA-Z0-9_-]/g, \'\')}`'), 'frontend visitor_id should use pt_ prefix and allowed characters');
    assert(mainJs.includes('Please do not include patient-identifiable information.'), 'feedback details step should warn against patient-identifiable information');
    assert(mainJs.includes('const FEEDBACK_RESULT_CONTEXTS = {'), 'frontend should define route-specific result context mapping');
    assert(!mainJs.includes("main.insertAdjacentHTML('beforeend'"), 'frontend should not append feedback to the end of main');
    assert(mainJs.includes('FEEDBACK_MIN_DWELL_MS = 15 * 1000'), 'frontend should require 15 seconds before showing feedback');
    assert(mainJs.includes('FEEDBACK_GLOBAL_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000'), 'frontend should enforce seven-day global cooldown');
    assert(mainJs.includes('FEEDBACK_CALCULATOR_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000'), 'frontend should enforce thirty-day calculator submission cooldown');
    assert(mainJs.includes('pt_feedback_last_viewed_at_v2'), 'frontend should use versioned viewed storage key');
    assert(mainJs.includes('pt_feedback_session_prompted_v2'), 'frontend should use versioned session storage key');
    assert(mainJs.includes('aria-label="Dismiss feedback prompt"'), 'dismiss button should have an accessible label');
    assert(mainJs.includes('IntersectionObserver') && mainJs.includes('FEEDBACK_VIEW_THRESHOLD = 0.5') && mainJs.includes('FEEDBACK_VIEW_DURATION_MS = 1000'), 'viewed event should require 50% intersection for 1 second');
    assert(mainJs.includes("logFeedbackEvent(card, 'rendered')") && mainJs.includes("logFeedbackEvent(card, 'viewed')"), 'rendered and viewed events should be distinct');
    assert(mainJs.includes("if (selectedRating === 'useful')"), 'Useful should remain one-click submission');
    assert(mainJs.includes("details.classList.remove('hidden')"), 'negative feedback should open details');
    assert(mainJs.includes('const FEEDBACK_RESULT_CONTEXTS = {'), 'frontend should use route-specific result contexts');
    assert(mainJs.includes('resolveFeedbackResultContext(pagePath)'), 'frontend should resolve dynamic result context at eligibility time');
    assert(mainJs.includes('isTimeFeedbackAction') && mainJs.includes('.time-live-start') && mainJs.includes('.time-start-now') && !mainJs.includes('#time-summary-copy') , 'time calculator should treat result-producing buttons, not copy, as feedback interactions');
    assert(mainJs.includes('resolveHctFeedbackContext') && mainJs.includes("el('hct_mode')?.value === 'onpump'") && mainJs.includes("el('onpump-extra-results')") && mainJs.includes("el('hct-primary-results')"), 'predicted Hct should resolve mode-specific anchors');
    assert(mainJs.includes('resolveUnitConverterFeedbackContext') && mainJs.includes("activeTab === 'pressure'") && mainJs.includes("activeTab === 'cannula'") && mainJs.includes("el('unit-flow-mlmin')"), 'unit converter should resolve active tab-specific readiness targets');
    assert(mainJs.includes('isZScoreFeedbackReady') && mainJs.includes("el('phn-expected-zero')") && mainJs.includes("el('phn-measured-z')") && !mainJs.includes("'/z-score/': '#phn-result-model'"), 'z-score readiness should use numeric outputs instead of model label');
    assert(mainJs.includes('isLbmFeedbackReady') && mainJs.includes("el('lbm_h_cm')") && mainJs.includes("el('lbm_w_kg')") && mainJs.includes('{ positive: true }'), 'LBM readiness should require valid inputs and a positive result');
    assert(mainJs.includes("context.insertAfter.insertAdjacentHTML('afterend'") && !mainJs.includes('getFeedbackInsertionAnchor'), 'feedback should insert after explicit context wrapper without generic class climbing');
    assert(mainJs.includes('[data-feedback-result-anchor=\"bsa-primary\"]') && mainJs.includes('[data-feedback-result-anchor=\"lbm-primary\"]'), 'static routes should prefer explicit feedback result wrapper anchors');



    console.log('All feedback API tests passed.');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
