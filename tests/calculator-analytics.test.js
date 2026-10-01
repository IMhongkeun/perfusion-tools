'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(repoRoot, 'analytics.js'), 'utf8');
const calls = [];
const scripts = [];
const window = { dataLayer: [], location: { href: 'https://perfusiontools.com/predicted-hct/', pathname: '/predicted-hct/', search: '' }, gtag(...args) { calls.push(args); } };
const document = {
  title: 'Predicted Hct',
  head: { appendChild(script) { scripts.push(script); } },
  createElement() { return { getAttribute(attribute) { return this[attribute] || null; } }; },
  getElementsByTagName(tagName) { return tagName === 'script' ? scripts : []; }
};
vm.runInNewContext(source, { window, document, Set, Object, Date });
assert.strictEqual(scripts.filter(script => script.src === 'https://www.clarity.ms/tag/v9kiiq48nz').length, 1, 'Clarity must load from the shared analytics script.');
assert.strictEqual(typeof window.clarity, 'function', 'Clarity queue must be available before the remote script loads.');
window.clarity('event', 'safe-structural-event');
assert.strictEqual(window.clarity.q.length, 1, 'Pre-load Clarity calls must be queued.');
vm.runInNewContext(source, { window, document, Set, Object, Date });
assert.strictEqual(scripts.filter(script => script.src === 'https://www.clarity.ms/tag/v9kiiq48nz').length, 1, 'Repeated analytics evaluation must not duplicate Clarity.');

const fallbackScripts = [];
const fallbackWindow = { location: window.location, gtag() {} };
const fallbackDocument = {
  title: document.title,
  head: { appendChild(script) { fallbackScripts.push(script); } },
  createElement() { return {}; },
  getElementsByTagName() { throw new Error('Clarity blocked'); }
};
assert.doesNotThrow(
  () => vm.runInNewContext(source, { window: fallbackWindow, document: fallbackDocument, Set, Object, Date }),
  'A blocked Clarity setup must not interrupt shared analytics initialization.'
);
assert.strictEqual(fallbackScripts.filter(script => script.src?.includes('googletagmanager.com')).length, 1, 'GA4 must still load when Clarity setup fails.');
calls.length = 0;

const analytics = window.perfusionCalculatorAnalytics;
assert(analytics, 'Shared calculator analytics API must be available.');
assert.strictEqual(analytics.complete('predicted_hct', 'pre'), false, 'Completion must not precede start.');
assert.strictEqual(analytics.start('predicted_hct', 'pre', false), false, 'Programmatic interaction must not start analytics.');
assert.strictEqual(calls.length, 0, 'Initialization alone must not emit calculator events.');
assert.strictEqual(analytics.start('predicted_hct', 'pre', true), true);
assert.strictEqual(analytics.start('predicted_hct', 'onpump', true), false, 'Start must be deduplicated.');
assert.strictEqual(analytics.complete('predicted_hct', 'pre'), true);
assert.strictEqual(analytics.complete('predicted_hct', 'pre'), false, 'Automatic recalculation must be deduplicated.');
assert.strictEqual(analytics.complete('predicted_hct', 'onpump'), true, 'A distinct valid mode may complete once.');
assert.strictEqual(analytics.copy('predicted_hct', 'pre', true), true);
assert.strictEqual(analytics.copy('predicted_hct', 'pre', false), false, 'Copy requires a trusted action.');
assert.strictEqual(analytics.start('not-a-calculator', 'secret-value', true), false, 'Unknown slugs must be rejected.');

const eventCalls = calls.filter((call) => call[0] === 'event');
assert.deepStrictEqual(eventCalls.map((call) => call[1]), ['calculator_start', 'calculation_complete', 'calculation_complete', 'result_copy']);
for (const call of eventCalls) {
  assert.deepStrictEqual(Object.keys(call[2]).sort(), ['calculator_mode', 'calculator_slug'], 'Only allowlisted properties may be sent.');
  assert.strictEqual(call[2].calculator_slug, 'predicted_hct');
  assert(['pre', 'onpump'].includes(call[2].calculator_mode));
  assert(!JSON.stringify(call[2]).includes('secret-value'));
}

window.gtag = undefined;
assert.doesNotThrow(() => analytics.start('bsa', undefined, true), 'Missing analytics must never break calculators.');
assert.strictEqual(analytics.start('bsa', undefined, true), false);

const mainSource = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
assert(mainSource.includes('if (!event.isTrusted) return;'), 'DOM instrumentation must reject untrusted events.');
assert(mainSource.includes('resolveFeedbackResultContext(pagePath)'), 'Analytics must reuse established result readiness resolution.');
assert(mainSource.includes("new Set(['time-summary-copy', 'transplant-summary-copy'])"), 'Only existing result-copy controls should be tracked.');

console.log('Privacy-safe calculator analytics contract verified.');
