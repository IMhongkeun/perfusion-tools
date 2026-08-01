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
    addEventListener() {}
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
    setLastChangedId(value) { lastChangedId = value; }
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
