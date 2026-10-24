'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

function sliceBetween(start, end) {
  const startIndex = mainJs.indexOf(start);
  const endIndex = mainJs.indexOf(end, startIndex);
  assert(startIndex >= 0 && endIndex > startIndex, `Unable to extract ${start}`);
  return mainJs.slice(startIndex, endIndex);
}

function createElement(id, value = '') {
  const classes = new Set();
  const listeners = {};
  return {
    id,
    value: String(value),
    innerHTML: '',
    textContent: '',
    className: '',
    dataset: {},
    style: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name)
    },
    addEventListener(type, callback) { (listeners[type] ||= []).push(callback); },
    dispatch(type) { (listeners[type] || []).forEach(callback => callback()); }
  };
}

const requiredGdpIds = [
  'view-do2i', 'h_cm', 'w_kg', 'bsa-method', 'bsa', 'flow', 'hb', 'sao2', 'pao2',
  'gdp-warning', 'cao2-result', 'required-flow', 'current-do2i', 'gdp-status-text',
  'gdp-status-detail'
];

const optionalGdpIds = [
  'bsa-hint', 'cao2', 'gdp-temp-c', 'gdp-temp-slider', 'gdp-temp-display',
  'gdp-vo2-fraction', 'corrected-flow-label', 'temp-reference-flow',
  'normothermia-flow', 'normothermia-do2-floor', 'corrected-row-label',
  'corrected-flow-table', 'corrected-do2-floor', 'gdp-adequacy-bar'
];

function loadRuntime(initialElements = {}) {
  const elements = { ...initialElements };
  const document = {
    activeElement: null,
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => []
  };
  const context = { console, document };
  vm.createContext(context);
  const sharedMath = `${sliceBetween('function clamp(n, min, max)', 'function parseTimeToMinutes')}
${sliceBetween('const BSA =', 'const BSA_UNIT')}
${sliceBetween('function calcCaO2', 'const UNIT_LABELS')}`;
  const domAndGdp = sliceBetween('// -----------------------------\n// DOM Helpers', '// -----------------------------\n// Predicted Hct Interaction');
  vm.runInContext(`${sharedMath}\n${domAndGdp}\nthis.api = {
    updateBSA, updateGDP, computeBSA, computeGdpResults, hasGdpCalculatorDom,
    setManualOverride(value) { bsaManualOverride = value; },
    setLastChangedId(value) { lastChangedId = value; },
    bindGdpInputs() {
      ${sliceBetween('    // GDP event listeners', "    ['target-260', 'target-280', 'target-300', 'target-360'].forEach")}
    }
  };`, context);
  return { api: context.api, elements };
}

function makeValidGdpElements() {
  const elements = {};
  [...requiredGdpIds, ...optionalGdpIds].forEach((id) => { elements[id] = createElement(id); });
  elements.h_cm.value = '170';
  elements.w_kg.value = '70';
  elements['bsa-method'].value = 'Mosteller';
  elements.hb.value = '10';
  elements.sao2.value = '100';
  elements.pao2.value = '100';
  elements.flow.value = '4.5';
  elements['gdp-temp-c'].value = '37';
  return elements;
}

// Every required BSA reference is validated before any value is read or output is written.
for (const missingId of ['bsa-method', 'h_cm', 'w_kg', 'bsa']) {
  const elements = makeValidGdpElements();
  delete elements[missingId];
  elements.unrelated = createElement('unrelated', 'unchanged');
  const { api } = loadRuntime(elements);
  assert.doesNotThrow(() => api.updateBSA(), `updateBSA should no-op without #${missingId}`);
  assert.strictEqual(elements.unrelated.value, 'unchanged', 'missing BSA DOM must not modify unrelated DOM');
  if (missingId === 'bsa-method') {
    assert.strictEqual(elements.bsa.value, '', 'a missing method must not fall back to an arbitrary formula');
  }
}

{
  const elements = makeValidGdpElements();
  const { api } = loadRuntime(elements);
  api.updateBSA();
  assert.strictEqual(elements.bsa.value, '1.82', 'Mosteller BSA and two-decimal rounding must remain unchanged');
  assert.strictEqual(elements['bsa-hint'].innerHTML, 'calculated');

  elements.bsa.value = '2.34';
  api.setManualOverride(true);
  api.setLastChangedId('bsa');
  api.updateBSA();
  assert.strictEqual(elements.bsa.value, '2.34', 'manual BSA override must remain unchanged');
  assert.strictEqual(elements['bsa-hint'].innerHTML, 'manual');
}

// GDP requires its complete calculation/rendering contract, not only the shared placeholder view.
for (const missingId of requiredGdpIds) {
  const elements = makeValidGdpElements();
  delete elements[missingId];
  const { api } = loadRuntime(elements);
  assert.strictEqual(api.hasGdpCalculatorDom(), false, `GDP guard should reject missing #${missingId}`);
  assert.doesNotThrow(() => api.updateGDP(), `updateGDP should no-op without #${missingId}`);
}

{
  const elements = makeValidGdpElements();
  const { api } = loadRuntime(elements);
  assert.strictEqual(api.hasGdpCalculatorDom(), true);
  assert.doesNotThrow(() => api.updateGDP());
  assert.strictEqual(elements.bsa.value, '1.82', 'GDP should retain shared automatic BSA calculation');
  assert.strictEqual(elements['cao2-result'].innerHTML, '13.71 <span class="text-xs font-medium text-slate-300">mL O₂/dL</span>');
  assert.strictEqual(elements['required-flow'].innerHTML, '3.72 <span class="text-xs font-medium text-slate-300">L/min</span>');
  assert.strictEqual(elements['current-do2i'].innerHTML, '339 <span class="text-xs font-medium text-slate-300">mL/min/m²</span>');
}

// Exercise the production input/change listeners, including manual-to-auto transitions.
{
  const elements = makeValidGdpElements();
  elements.h_cm.value = '';
  elements.w_kg.value = '';
  const { api } = loadRuntime(elements);
  api.bindGdpInputs();
  elements.h_cm.value = '170'; elements.h_cm.dispatch('input');
  assert.strictEqual(elements.bsa.value, '', 'One dimension alone must not produce a BSA.');
  elements.w_kg.value = '70'; elements.w_kg.dispatch('input');
  assert.strictEqual(elements.bsa.value, '1.82', 'Height and weight automatically fill BSA.');
  for (const [method, expected] of [['DuBois', '1.81'], ['Haycock', '1.83'], ['Boyd', '1.83'], ['Mosteller', '1.82']]) {
    elements['bsa-method'].value = method;
    elements['bsa-method'].dispatch('change');
    assert.strictEqual(elements.bsa.value, expected, `Changing to ${method} must refresh BSA.`);
  }
  elements.bsa.value = '2.10'; elements.bsa.dispatch('input');
  assert.strictEqual(elements['current-do2i'].innerHTML, '294 <span class="text-xs font-medium text-slate-300">mL/min/m²</span>',
    'DO2i uses the latest manual BSA of 2.10, not the 1.82 from height and weight.');
  elements.bsa.value = '1.50'; elements.bsa.dispatch('change');
  assert.strictEqual(elements['current-do2i'].innerHTML, '411 <span class="text-xs font-medium text-slate-300">mL/min/m²</span>',
    'A committed manual BSA change refreshes DO2i immediately.');
  elements.hb.dispatch('input');
  assert.strictEqual(elements.bsa.value, '1.50', 'Other GDP inputs preserve a manually entered BSA.');
  elements.bsa.value = ''; elements.bsa.dispatch('input');
  assert.strictEqual(elements.bsa.value, '', 'An intentionally cleared BSA stays blank even with height and weight.');
  assert.strictEqual(elements['current-do2i'].innerHTML, '—', 'Blank manual BSA must not reuse a previous value or height/weight estimate.');
  assert(elements['gdp-warning'].textContent.includes('BSA'));
  elements.flow.dispatch('change');
  assert.strictEqual(elements.bsa.value, '', 'Other input changes must not silently refill a cleared manual BSA.');
  elements.h_cm.value = '180'; elements.h_cm.dispatch('change');
  assert.strictEqual(elements.bsa.value, '1.87', 'Committed dimension changes also refresh BSA.');
  elements.w_kg.value = ''; elements.w_kg.dispatch('change');
  assert.strictEqual(elements.bsa.value, '', 'Removing a dimension clears the stale automatic estimate.');
  elements.h_cm.value = '';
  elements.bsa.value = '1.90'; elements.bsa.dispatch('input');
  assert.strictEqual(elements.bsa.value, '1.90', 'Manual BSA remains usable without height and weight.');
}

function idsFromHtml(relativePath) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const elements = {};
  for (const match of html.matchAll(/\bid="([^"]+)"/g)) elements[match[1]] = createElement(match[1]);
  return elements;
}

// Representative shared-script startup capability smoke fixtures.
for (const [name, fixture] of [
  ['Home / informational views', idsFromHtml('index.html')],
  ['BSA-only', idsFromHtml('bsa/index.html')],
  ['unrelated Heparin calculator', idsFromHtml('heparin/index.html')]
]) {
  const { api } = loadRuntime(fixture);
  assert.strictEqual(api.hasGdpCalculatorDom(), false, `${name} must not initialize GDP`);
  assert.doesNotThrow(() => { if (api.hasGdpCalculatorDom()) api.updateGDP(); }, `${name} startup must not throw`);
}

{
  const { api } = loadRuntime(idsFromHtml('gdp/index.html'));
  assert.strictEqual(api.hasGdpCalculatorDom(), true, 'GDP page must follow the GDP initialization path');
  assert.doesNotThrow(() => { if (api.hasGdpCalculatorDom()) api.updateGDP(); });
}

const updateBsaSource = sliceBetween('function updateBSA()', 'function calcRequiredFlowLmin');
assert(
  updateBsaSource.indexOf("if (!heightInput || !weightInput || !methodInput || !bsaOutput) return;") < updateBsaSource.indexOf('methodInput.value'),
  'updateBSA must guard required elements before reading the BSA method value'
);
assert(!updateBsaSource.includes("el('bsa-method').value"), 'unsafe direct BSA method access must not regress');
assert(mainJs.includes('const hasGdpCalculator = hasGdpCalculatorDom();'), 'shared startup must use the GDP DOM capability guard');

console.log('All GDP/BSA initialization regression tests passed.');
