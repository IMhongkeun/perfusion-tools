'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const mainJsPath = path.join(repoRoot, 'main.js');
const distMainJsPath = path.join(repoRoot, 'dist', 'main.js');
const bsaHtmlPath = path.join(repoRoot, 'bsa', 'index.html');
const distBsaHtmlPath = path.join(repoRoot, 'dist', 'bsa', 'index.html');

const mainJs = fs.readFileSync(mainJsPath, 'utf8');
const distMainJs = fs.readFileSync(distMainJsPath, 'utf8');
const bsaHtml = fs.readFileSync(bsaHtmlPath, 'utf8');
const distBsaHtml = fs.readFileSync(distBsaHtmlPath, 'utf8');

const TOLERANCE = 1e-12;
const CANONICAL_PATIENT = Object.freeze({ heightCm: 170, weightKg: 70 });
const CANONICAL_IMPERIAL_PATIENT = Object.freeze({
  heightIn: 66.92913385826772,
  weightLb: 154.32358352941176
});

const CM_PER_INCH_REFERENCE = 2.54;
const KG_PER_LB_REFERENCE = 0.45359237;

const CANONICAL_EXPECTED = Object.freeze({
  Mosteller: 1.818118685772619,
  DuBois: 1.809707801753247,
  Haycock: 1.8256771247769754,
  Boyd: 1.8346702898274039,
  GehanGeorge: 1.8312893134221293
});

function nearlyEqual(actual, expected, tolerance = TOLERANCE) {
  return Math.abs(actual - expected) <= tolerance;
}

function assertNearlyEqual(actual, expected, message, tolerance = TOLERANCE) {
  assert(
    nearlyEqual(actual, expected, tolerance),
    `${message}: expected ${expected}, got ${actual}`
  );
}

function independentMosteller(heightCm, weightKg) {
  // Mosteller: BSA = sqrt(height(cm) × weight(kg) / 3600).
  return Math.sqrt((heightCm * weightKg) / 3600);
}

function independentDuBois(heightCm, weightKg) {
  // Du Bois: BSA = 0.007184 × height(cm)^0.725 × weight(kg)^0.425.
  return 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
}

function independentHaycock(heightCm, weightKg) {
  // Haycock: BSA = 0.024265 × height(cm)^0.3964 × weight(kg)^0.5378.
  return 0.024265 * Math.pow(heightCm, 0.3964) * Math.pow(weightKg, 0.5378);
}

function independentBoyd(heightCm, weightKg) {
  // Boyd: BSA = 0.0003207 × height(cm)^0.3 × weight(g)^(0.7285 - 0.0188 × log10(weight(g))).
  const weightGrams = weightKg * 1000;
  const exponent = 0.7285 - (0.0188 * Math.log10(weightGrams));
  return 0.0003207 * Math.pow(heightCm, 0.3) * Math.pow(weightGrams, exponent);
}

function independentGehanGeorge(heightCm, weightKg) {
  // Gehan-George: BSA = 0.0235 × height(cm)^0.42246 × weight(kg)^0.51456.
  return 0.0235 * Math.pow(heightCm, 0.42246) * Math.pow(weightKg, 0.51456);
}

const INDEPENDENT_FORMULAS = Object.freeze({
  Mosteller: independentMosteller,
  DuBois: independentDuBois,
  Haycock: independentHaycock,
  Boyd: independentBoyd,
  GehanGeorge: independentGehanGeorge
});

function loadBsaRuntime(source) {
  const start = source.indexOf('const BSA =');
  const end = source.indexOf('function updateBsaUnitUi');
  assert(start >= 0 && end > start, 'BSA runtime block should be extractable from main.js.');
  const context = { module: { exports: {} } };
  vm.runInNewContext(
    `${source.slice(start, end)}\nmodule.exports = { BSA, BSA_UNIT, CM_PER_INCH, KG_PER_LB, computeBSA, toMetricBsaInputs, convertBsaInputValue };`,
    context,
    { filename: 'main.js:bsa-runtime' }
  );
  return context.module.exports;
}

function extractStandaloneSelectorValues(html) {
  const selectMatch = html.match(/<select[^>]*id="bsa-method-standalone"[\s\S]*?<\/select>/);
  assert(selectMatch, 'BSA formula selector should exist.');
  return Array.from(selectMatch[0].matchAll(/<option\s+value="([^"]+)"/g)).map(match => match[1]);
}

function getRuntimeFormulaKeys(runtime) {
  return Object.keys(runtime.BSA);
}

function simulateStandaloneBsaState({ heightValue, weightValue, method = 'Mosteller', inputUnit = 'metric', previousLeanFlowVisible = false }) {
  const metricInput = inputUnit === 'imperial'
    ? {
        heightCm: heightValue * CM_PER_INCH_REFERENCE,
        weightKg: weightValue * KG_PER_LB_REFERENCE
      }
    : { heightCm: heightValue, weightKg: weightValue };
  const h = metricInput.heightCm;
  const w = metricInput.weightKg;
  const bsa = runtime.computeBSA(h, w, method);
  const hasDisplayableBsa = Boolean(bsa);
  const heightMeters = h > 0 ? h / 100 : 0;
  const bmi = h > 0 && w > 0 ? w / (heightMeters * heightMeters) : 0;
  const flowListState = Number.isFinite(bsa) && bsa > 0 ? 'rows' : 'empty-message';
  const obesityBadgeVisible = bmi >= 30;
  const leanFlowVisible = bmi >= 30 ? true : false;

  return {
    metricInput,
    bsa,
    primaryResultText: hasDisplayableBsa ? bsa.toFixed(2) : '0.00',
    resultDisplayText: hasDisplayableBsa ? `${bsa.toFixed(2)} m²` : '—',
    bmiText: bmi ? `BMI: ${bmi.toFixed(1)} kg/m²` : 'BMI: —',
    flowListState,
    methodLabel: {
      Mosteller: 'Mosteller',
      DuBois: 'Du Bois',
      Haycock: 'Haycock',
      GehanGeorge: 'Gehan-George',
      Boyd: 'Boyd'
    }[method] || method,
    obesityBadgeVisible,
    leanFlowVisible,
    previousLeanFlowVisible
  };
}

const runtime = loadBsaRuntime(mainJs);
const distRuntime = loadBsaRuntime(distMainJs);
const runtimeFormulaKeys = getRuntimeFormulaKeys(runtime);
const sourceSelectorValues = extractStandaloneSelectorValues(bsaHtml);
const distSelectorValues = extractStandaloneSelectorValues(distBsaHtml);

// Source/dist parity must protect deployed BSA code and markup from stale build artifacts.
assert.strictEqual(distMainJs, mainJs, 'dist/main.js should exactly match source main.js.');
assert.strictEqual(distBsaHtml, bsaHtml, 'dist/bsa/index.html should exactly match source bsa/index.html.');
assert.deepStrictEqual(getRuntimeFormulaKeys(distRuntime), runtimeFormulaKeys, 'Source and dist BSA runtime formula keys should match.');
assert.deepStrictEqual(distSelectorValues, sourceSelectorValues, 'Source and dist BSA formula selector values should match.');

// Existing UI regression: the flow list should be tall enough for the CI table.
assert(
  bsaHtml.includes('id="bsa-flow-list"') && bsaHtml.includes('max-h-[22rem] min-h-[18rem] overflow-y-auto'),
  'BSA flow sheet should be tall enough to show CI 1.0–3.0 without requiring one-row scrolling.'
);

// Runtime contract: all implemented formulas should remain present. This intentionally includes
// GehanGeorge even though the current standalone selector/methodology copy does not expose it.
assert.deepStrictEqual(runtimeFormulaKeys, ['Mosteller', 'DuBois', 'Haycock', 'Boyd', 'GehanGeorge']);
const requiredSelectorValues = ['Mosteller', 'DuBois', 'Haycock', 'Boyd'];
requiredSelectorValues.forEach((method) => {
  assert(
    sourceSelectorValues.includes(method),
    `Standalone BSA selector should include required method: ${method}`
  );
});
assert.strictEqual(
  new Set(sourceSelectorValues).size,
  sourceSelectorValues.length,
  'Standalone BSA selector values should be unique'
);
sourceSelectorValues.forEach((method) => {
  assert(
    runtimeFormulaKeys.includes(method),
    `Standalone selector method must be supported by runtime: ${method}`
  );
});

// Numeric oracle: fixed expected values and independently written formula functions.
Object.entries(CANONICAL_EXPECTED).forEach(([formulaKey, expected]) => {
  const independentValue = INDEPENDENT_FORMULAS[formulaKey](CANONICAL_PATIENT.heightCm, CANONICAL_PATIENT.weightKg);
  assertNearlyEqual(independentValue, expected, `${formulaKey} independent formula should match fixed canonical value`);

  const runtimeValue = runtime.computeBSA(CANONICAL_PATIENT.heightCm, CANONICAL_PATIENT.weightKg, formulaKey);
  assertNearlyEqual(runtimeValue, expected, `${formulaKey} runtime computeBSA should match independent canonical value`);

  const state = simulateStandaloneBsaState({
    heightValue: CANONICAL_PATIENT.heightCm,
    weightValue: CANONICAL_PATIENT.weightKg,
    method: formulaKey
  });
  assert.strictEqual(state.primaryResultText, expected.toFixed(2), `${formulaKey} primary BSA display should use current toFixed(2) policy.`);
  assert.strictEqual(state.resultDisplayText, `${expected.toFixed(2)} m²`, `${formulaKey} formatted BSA display should use current toFixed(2) policy.`);
});

assert.strictEqual(new Set(Object.values(CANONICAL_EXPECTED).map(value => value.toFixed(12))).size, Object.keys(CANONICAL_EXPECTED).length, 'Canonical formula results should not collapse to one shared value.');

// Mosteller canonical example should fail if the 3600 denominator or sqrt behavior regresses.
const mostellerCanonical = Math.sqrt((170 * 70) / 3600);
assert.strictEqual(mostellerCanonical, CANONICAL_EXPECTED.Mosteller);
assertNearlyEqual(runtime.computeBSA(170, 70, 'Mosteller'), mostellerCanonical, 'Mosteller runtime should match sqrt(height × weight / 3600)');
assert.notStrictEqual((170 * 70) / 3600, mostellerCanonical, 'Mosteller canonical should specifically require sqrt, not a linear division result.');
assert.notStrictEqual(Math.sqrt((170 * 70) / 360), mostellerCanonical, 'Mosteller canonical should specifically require denominator 3600.');

// Metric/imperial equivalence uses independent conversion constants, not runtime constants.
const independentlyConvertedHeightCm = CANONICAL_IMPERIAL_PATIENT.heightIn * CM_PER_INCH_REFERENCE;
const independentlyConvertedWeightKg = CANONICAL_IMPERIAL_PATIENT.weightLb * KG_PER_LB_REFERENCE;
assertNearlyEqual(independentlyConvertedHeightCm, CANONICAL_PATIENT.heightCm, 'Imperial height should convert back to 170 cm');
assertNearlyEqual(independentlyConvertedWeightKg, CANONICAL_PATIENT.weightKg, 'Imperial weight should convert back to 70 kg', 1e-11);

Object.keys(CANONICAL_EXPECTED).forEach((formulaKey) => {
  const metricValue = runtime.computeBSA(CANONICAL_PATIENT.heightCm, CANONICAL_PATIENT.weightKg, formulaKey);
  const imperialValue = runtime.computeBSA(independentlyConvertedHeightCm, independentlyConvertedWeightKg, formulaKey);
  assertNearlyEqual(imperialValue, metricValue, `${formulaKey} metric and independently converted imperial inputs should match`, 1e-11);
});

assert.strictEqual(runtime.CM_PER_INCH, CM_PER_INCH_REFERENCE, 'Runtime inch-to-cm conversion constant should remain 2.54.');
assert.strictEqual(runtime.KG_PER_LB, KG_PER_LB_REFERENCE, 'Runtime lb-to-kg conversion constant should remain 0.45359237.');
assertNearlyEqual(runtime.convertBsaInputValue(170, runtime.BSA_UNIT.metric, runtime.BSA_UNIT.imperial, 'height'), CANONICAL_IMPERIAL_PATIENT.heightIn, 'Metric-to-imperial height conversion should match canonical inches');
assertNearlyEqual(runtime.convertBsaInputValue(70, runtime.BSA_UNIT.metric, runtime.BSA_UNIT.imperial, 'weight'), CANONICAL_IMPERIAL_PATIENT.weightLb, 'Metric-to-imperial weight conversion should match canonical pounds', 1e-11);
assertNearlyEqual(runtime.convertBsaInputValue(CANONICAL_IMPERIAL_PATIENT.heightIn, runtime.BSA_UNIT.imperial, runtime.BSA_UNIT.metric, 'height'), 170, 'Imperial-to-metric height conversion should restore cm');
assertNearlyEqual(runtime.convertBsaInputValue(CANONICAL_IMPERIAL_PATIENT.weightLb, runtime.BSA_UNIT.imperial, runtime.BSA_UNIT.metric, 'weight'), 70, 'Imperial-to-metric weight conversion should restore kg', 1e-11);
assert(mainJs.includes("heightUnit.textContent = isMetric ? 'cm' : 'inches'"), 'Unit toggle should update height unit label.');
assert(mainJs.includes("weightUnit.textContent = isMetric ? 'kg' : 'lb'"), 'Unit toggle should update weight unit label.');
assert(mainJs.includes("heightInput.placeholder = isMetric ? '170' : '66.9'"), 'Unit toggle should update height placeholder.');
assert(mainJs.includes("weightInput.placeholder = isMetric ? '70' : '154.3'"), 'Unit toggle should update weight placeholder.');

// Validation behavior: safe invalid values should not keep previous BSA/BMI/flow/lean-flow state.
[
  { label: 'empty height', heightValue: 0, weightValue: 70 },
  { label: 'empty weight', heightValue: 170, weightValue: 0 },
  { label: 'height 0', heightValue: 0, weightValue: 70 },
  { label: 'weight 0', heightValue: 170, weightValue: 0 },
  { label: 'negative height', heightValue: -170, weightValue: 70 },
  { label: 'negative weight', heightValue: 170, weightValue: -70 },
  { label: 'NaN height', heightValue: NaN, weightValue: 70 },
  { label: 'NaN weight', heightValue: 170, weightValue: NaN }
].forEach((scenario) => {
  const state = simulateStandaloneBsaState({ ...scenario, previousLeanFlowVisible: true });
  assert(!Number.isFinite(state.bsa) || state.bsa === 0, `${scenario.label} should not produce a positive finite BSA.`);
  assert.strictEqual(state.primaryResultText, '0.00', `${scenario.label} should clear the primary BSA text.`);
  assert.strictEqual(state.resultDisplayText, '—', `${scenario.label} should clear the formatted BSA display.`);
  assert.strictEqual(state.bmiText, 'BMI: —', `${scenario.label} should clear BMI display.`);
  assert.strictEqual(state.flowListState, 'empty-message', `${scenario.label} should clear patient-specific flow rows.`);
  assert.strictEqual(state.obesityBadgeVisible, false, `${scenario.label} should not leave obesity badge visible.`);
  assert.strictEqual(state.leanFlowVisible, false, `${scenario.label} should not leave lean-flow warning/card visible.`);
  assert(!/NaN|Infinity/.test(`${state.primaryResultText} ${state.resultDisplayText} ${state.bmiText}`), `${scenario.label} should not display NaN or Infinity.`);
});

const decimalState = simulateStandaloneBsaState({ heightValue: 170.5, weightValue: 70.25, method: 'Mosteller' });
assert(Number.isFinite(decimalState.bsa) && decimalState.bsa > 0, 'Decimal height/weight should produce a finite positive BSA.');
assert.strictEqual(decimalState.primaryResultText, independentMosteller(170.5, 70.25).toFixed(2), 'Decimal input should follow current display rounding.');

[
  ['Infinity height', Infinity, 70],
  ['Infinity weight', 170, Infinity],
  ['negative Infinity height', -Infinity, 70],
  ['negative Infinity weight', 170, -Infinity],
  ['NaN height', NaN, 70],
  ['NaN weight', 170, NaN],
  ['numeric string height', '170', 70],
  ['numeric string weight', 170, '70'],
  ['non-numeric string height', 'abc', 70],
  ['non-numeric string weight', 170, 'abc'],
  ['zero height', 0, 70],
  ['zero weight', 170, 0],
  ['negative height', -170, 70],
  ['negative weight', 170, -70]
].forEach(([label, heightValue, weightValue]) => {
  assert.strictEqual(runtime.computeBSA(heightValue, weightValue, 'Mosteller'), 0, `${label} should return 0 from pure computeBSA.`);
});

// Formula state transition, simulated from the current pure formula and display policy.
const transitionMosteller = simulateStandaloneBsaState({ heightValue: 170, weightValue: 70, method: 'Mosteller' });
assert.strictEqual(transitionMosteller.primaryResultText, CANONICAL_EXPECTED.Mosteller.toFixed(2));
assert.strictEqual(transitionMosteller.methodLabel, 'Mosteller');
assert.strictEqual(transitionMosteller.bmiText, 'BMI: 24.2 kg/m²');
assert.strictEqual(transitionMosteller.flowListState, 'rows');
assert.strictEqual(transitionMosteller.obesityBadgeVisible, false);

const transitionDuBois = simulateStandaloneBsaState({ heightValue: 170, weightValue: 70, method: 'DuBois' });
assert.strictEqual(transitionDuBois.primaryResultText, CANONICAL_EXPECTED.DuBois.toFixed(2));
assert.strictEqual(transitionDuBois.methodLabel, 'Du Bois');
assert.strictEqual(transitionDuBois.bmiText, 'BMI: 24.2 kg/m²');

const transitionHaycock = simulateStandaloneBsaState({ heightValue: 170, weightValue: 70, method: 'Haycock' });
assert.strictEqual(transitionHaycock.primaryResultText, CANONICAL_EXPECTED.Haycock.toFixed(2));
assert.strictEqual(transitionHaycock.methodLabel, 'Haycock');

const transitionBackToMosteller = simulateStandaloneBsaState({ heightValue: 170, weightValue: 70, method: 'Mosteller' });
assert.strictEqual(transitionBackToMosteller.primaryResultText, transitionMosteller.primaryResultText, 'Returning to Mosteller should restore the original rounded result.');
assertNearlyEqual(transitionBackToMosteller.bsa, transitionMosteller.bsa, 'Returning to Mosteller should restore the original numeric result.');

const emptyWeightState = simulateStandaloneBsaState({ heightValue: 170, weightValue: 0, method: 'Mosteller' });
assert.strictEqual(emptyWeightState.resultDisplayText, '—', 'Normal weight -> empty weight should clear formatted BSA output.');
assert.strictEqual(emptyWeightState.bmiText, 'BMI: —', 'Normal weight -> empty weight should clear BMI.');
assert.strictEqual(emptyWeightState.flowListState, 'empty-message', 'Normal weight -> empty weight should clear flow rows.');
const restoredWeightState = simulateStandaloneBsaState({ heightValue: 170, weightValue: 70, method: 'Mosteller' });
assert.strictEqual(restoredWeightState.primaryResultText, transitionMosteller.primaryResultText, 'Empty weight -> 70 kg should restore Mosteller result.');

let toggledHeight = runtime.convertBsaInputValue(170, runtime.BSA_UNIT.metric, runtime.BSA_UNIT.imperial, 'height');
let toggledWeight = runtime.convertBsaInputValue(70, runtime.BSA_UNIT.metric, runtime.BSA_UNIT.imperial, 'weight');
toggledHeight = runtime.convertBsaInputValue(toggledHeight, runtime.BSA_UNIT.imperial, runtime.BSA_UNIT.metric, 'height');
toggledWeight = runtime.convertBsaInputValue(toggledWeight, runtime.BSA_UNIT.imperial, runtime.BSA_UNIT.metric, 'weight');
assertNearlyEqual(toggledHeight, 170, 'Metric -> imperial -> metric height should restore original value.');
assertNearlyEqual(toggledWeight, 70, 'Metric -> imperial -> metric weight should restore original value.', 1e-11);

// Wiring contract. These are static source checks, not DOM execution tests.
[
  'id="bsa_height"',
  'id="bsa_weight"',
  'id="bsa-method-standalone"',
  'id="bsa-unit-metric"',
  'id="bsa-unit-imperial"',
  'id="bsa-result"',
  'id="bsa-result-display"'
].forEach(fragment => assert(bsaHtml.includes(fragment), `BSA HTML should include ${fragment}.`));
assert(mainJs.includes("['bsa_height', 'bsa_weight'].forEach"), 'BSA height/weight input listener contract should remain wired.');
assert(mainJs.includes("x.addEventListener('input', updateStandaloneBsa)"), 'BSA height/weight inputs should call updateStandaloneBsa on input.');
assert(mainJs.includes("bsaMethodStandalone.addEventListener('change', updateStandaloneBsa)"), 'BSA formula selector should call updateStandaloneBsa on change.');
assert(mainJs.includes("metricBtn.addEventListener('click', () => setBsaUnit(BSA_UNIT.metric))"), 'Metric unit toggle should call setBsaUnit(metric).');
assert(mainJs.includes("imperialBtn.addEventListener('click', () => setBsaUnit(BSA_UNIT.imperial))"), 'Imperial unit toggle should call setBsaUnit(imperial).');
assert(mainJs.includes('updateStandaloneBsa();'), 'BSA initialization should call updateStandaloneBsa.');

// Methodology/static copy consistency checks for formulas that are currently exposed by the standalone selector.
[
  ['Mosteller', ['BSA = √((H × W) / 3600)']],
  ['DuBois', ['0.007184', '0.725', '0.425']],
  ['Haycock', ['0.024265', '0.3964', '0.5378']],
  ['Boyd', ['0.0003207', '0.3', '0.7285', '0.0188', 'logW']]
].forEach(([label, formulaFragments]) => {
  assert(bsaHtml.includes(label === 'DuBois' ? 'Du Bois' : label), `Methodology should mention ${label}.`);
  formulaFragments.forEach((fragment) => {
    assert(bsaHtml.includes(fragment), `Methodology should include formula fragment for ${label}: ${fragment}`);
  });
});

const methodologyFindings = [];
if (runtimeFormulaKeys.includes('GehanGeorge') && !sourceSelectorValues.includes('GehanGeorge')) {
  methodologyFindings.push('Runtime supports GehanGeorge, but the standalone BSA selector does not expose it.');
}
if (runtimeFormulaKeys.includes('GehanGeorge') && !/Gehan/i.test(bsaHtml)) {
  methodologyFindings.push('Runtime supports GehanGeorge, but BSA methodology copy does not document it.');
}
if (methodologyFindings.length) {
  console.warn(`BSA methodology/selector finding (not changed by this test-only patch): ${methodologyFindings.join(' ')}`);
}

console.log('All BSA regression tests passed.');
