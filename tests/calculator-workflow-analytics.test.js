'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
function sourceBetween(start, end) {
  const startIndex = mainJs.indexOf(start);
  const endIndex = mainJs.indexOf(end, startIndex);
  assert(startIndex >= 0 && endIndex > startIndex, `Unable to extract ${start}`);
  return mainJs.slice(startIndex, endIndex);
}

const pressureSource = sourceBetween('function hasValidPressureDropEstimate', 'function createPressureDropComparisonChart');
const pressureRuntime = vm.runInNewContext(`${pressureSource}; ({ hasValidPressureDropEstimate, isPressureDropAnalyticsReady })`, { isElementVisible: element => Boolean(element?.visible) });
assert.strictEqual(pressureRuntime.hasValidPressureDropEstimate([{ state: 'invalid' }]), false, 'Filter/reference-only state must not complete.');
assert.strictEqual(pressureRuntime.hasValidPressureDropEstimate([{ state: 'out_of_range' }]), false, 'Out-of-range state must not complete.');
assert.strictEqual(pressureRuntime.hasValidPressureDropEstimate([{ state: 'exact' }]), true, 'Exact pressure estimate must complete.');
assert.strictEqual(pressureRuntime.hasValidPressureDropEstimate([{ state: 'interpolated' }]), true, 'Interpolated pressure estimate must complete.');
const readySingle = { visible: true, dataset: { analyticsReady: 'true' } };
const readyCompare = { visible: true, dataset: { analyticsReady: 'true' } };
assert.strictEqual(pressureRuntime.isPressureDropAnalyticsReady('single', readySingle, { visible: false, dataset: { analyticsReady: 'true' } }), true);
assert.strictEqual(pressureRuntime.isPressureDropAnalyticsReady('compare', { visible: false, dataset: { analyticsReady: 'true' } }, readyCompare), true, 'Active comparison result must complete independently of hidden single results.');
assert.strictEqual(pressureRuntime.isPressureDropAnalyticsReady('compare', readySingle, { visible: false, dataset: { analyticsReady: 'true' } }), false, 'Hidden inactive result views must not complete.');

const transplantSource = sourceBetween('function createDefaultTransplantState', 'function transplantClockIcon');
const transplantRuntime = vm.runInNewContext(`${transplantSource}; ({ createDefaultTransplantState, hasCompletedTransplantInterval })`, {});
const transplant = transplantRuntime.createDefaultTransplantState();
transplant.heart.donorAcc = '08:00';
assert.strictEqual(transplantRuntime.hasCompletedTransplantInterval(transplant, 'heart'), false, 'One timestamp is not a completed interval.');
transplant.heart.iceOut = 'incomplete';
assert.strictEqual(transplantRuntime.hasCompletedTransplantInterval(transplant, 'heart'), false, 'An invalid pair is not a completed interval.');
transplant.heart.iceOut = '09:00';
assert.strictEqual(transplantRuntime.hasCompletedTransplantInterval(transplant, 'heart'), true, 'A valid calculated interval completes transplant analytics.');

async function verifyCopyOutcomes() {
  const copySource = sourceBetween('async function copyTextWithFallback', 'async function copyTimeCaseSummary');
  let primaryCalls = 0;
  let fallbackCalls = 0;
  const runtime = vm.runInNewContext(`${copySource}; copyTextWithFallback`, { navigator: { clipboard: { async writeText() { primaryCalls += 1; } } } });
  assert.strictEqual(await runtime('private result', () => { fallbackCalls += 1; return true; }), true);
  assert.strictEqual(primaryCalls, 1);
  assert.strictEqual(fallbackCalls, 0, 'Successful primary copy must not also invoke fallback.');
  const fallbackRuntime = vm.runInNewContext(`${copySource}; copyTextWithFallback`, { navigator: { clipboard: { async writeText() { throw new Error('denied'); } } } });
  assert.strictEqual(await fallbackRuntime('private result', () => true), true, 'Successful fallback must count as copy success.');
  assert.strictEqual(await fallbackRuntime('private result', () => false), false, 'Primary and fallback failure must not count as success.');
  assert.strictEqual(await fallbackRuntime('private result', () => { throw new Error('failed'); }), false, 'A throwing fallback must fail safely.');
}

assert(mainJs.includes("'[data-tubing-inch]'"), 'Tubing preset must be a narrowly allowlisted calculator action.');
assert(!mainJs.includes('analytics.copy(calculatorSlug'), 'Document-level click attempts must not emit result_copy.');
verifyCopyOutcomes().then(() => console.log('Route-specific calculator analytics semantics verified.'));
