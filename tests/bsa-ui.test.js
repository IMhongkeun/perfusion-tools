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
const heparinHtmlPath = path.join(repoRoot, 'heparin', 'index.html');

const mainJs = fs.readFileSync(mainJsPath, 'utf8');
const distMainJs = fs.readFileSync(distMainJsPath, 'utf8');
const bsaHtml = fs.readFileSync(bsaHtmlPath, 'utf8');
const distBsaHtml = fs.readFileSync(distBsaHtmlPath, 'utf8');
const heparinHtml = fs.readFileSync(heparinHtmlPath, 'utf8');

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

const EMPTY_STANDALONE_BSA_STATE = Object.freeze({
  bsa: 0,
  primaryResultText: '0.00',
  resultDisplayText: '—',
  bmiText: 'BMI: —',
  flowListState: 'empty-message',
  methodLabel: 'Mosteller',
  obesityBadgeVisible: false,
  obesityBadgeText: 'Obese BMI —',
  bmi25ReferenceVisible: false,
  bmi25ReferenceBsaText: '—',
  bmi25ReferenceWeightText: '—'
});

function simulateStandaloneBsaState({ heightValue, weightValue, method = 'Mosteller', inputUnit = 'metric', previousState = EMPTY_STANDALONE_BSA_STATE }) {
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
  const nextState = {
    ...previousState,
    metricInput,
    bsa,
    primaryResultText: hasDisplayableBsa ? bsa.toFixed(2) : '0.00',
    resultDisplayText: hasDisplayableBsa ? `${bsa.toFixed(2)} m²` : '—',
    methodLabel: {
      Mosteller: 'Mosteller',
      DuBois: 'Du Bois',
      Haycock: 'Haycock',
      GehanGeorge: 'Gehan-George',
      Boyd: 'Boyd'
    }[method] || method,
    previousBmi25ReferenceVisible: previousState.bmi25ReferenceVisible,
    previousObesityBadgeVisible: previousState.obesityBadgeVisible,
    previousFlowListState: previousState.flowListState,
    previousResultDisplayText: previousState.resultDisplayText,
    previousBmiText: previousState.bmiText
  };

  if (h > 0 && w > 0) {
    const heightMeters = h / 100;
    const bmi = w / (heightMeters * heightMeters);
    const isObese = bmi >= 30;
    nextState.bmiText = `BMI: ${bmi.toFixed(1)} kg/m²`;
    nextState.flowListState = Number.isFinite(bsa) && bsa > 0 ? 'rows' : 'empty-message';
    nextState.obesityBadgeVisible = isObese;
    nextState.obesityBadgeText = isObese ? `Obese BMI ${bmi.toFixed(1)}` : 'Obese BMI —';
    nextState.bmi25ReferenceVisible = isObese;
    if (isObese) {
      const bmi25ReferenceWeightKg = 25 * Math.pow(heightMeters, 2);
      const bmi25ReferenceBsa = runtime.computeBSA(h, bmi25ReferenceWeightKg, method);
      nextState.bmi25ReferenceBsaText = `${bmi25ReferenceBsa.toFixed(2)} m²`;
      nextState.bmi25ReferenceWeightText = `${bmi25ReferenceWeightKg.toFixed(1)} kg`;
    } else {
      nextState.bmi25ReferenceBsaText = '—';
      nextState.bmi25ReferenceWeightText = '—';
    }
    return nextState;
  }

  // Mirrors updateStandaloneBsa() invalid-input clear contract: prior visible BMI 25 reference
  // state is explicitly hidden and stale BSA/BMI/BMI 25 reference text is reset.
  nextState.bmiText = 'BMI: —';
  nextState.flowListState = 'empty-message';
  nextState.obesityBadgeVisible = false;
  nextState.obesityBadgeText = 'Obese BMI —';
  nextState.bmi25ReferenceVisible = false;
  nextState.bmi25ReferenceBsaText = '—';
  nextState.bmi25ReferenceWeightText = '—';
  return nextState;
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

// BSA stays focused on height, weight, formula, BMI, and CPB flow.
const removedBsaHeparinFeatures = [
  'bsa-sex-male', 'bsa-sex-female', 'bsa-sex-info-container', 'bsa-sex-info-button',
  'bsa-sex-info', 'bsaPatientSex', 'updateBsaSexUi', 'initBsaSexInfo',
  'bsa-heparin-alert', 'bsa-open-heparin', 'Obese Patient Heparin Alert',
  'Open Heparin Management Calculator', 'patientDataFromBSA', 'openHeparinFromBsa',
  'preloadHeparinFromBsa', 'Why does this BSA calculator include a male/female selection?',
  'Used for Heparin Calculator IBW/ABW estimates only'
];
removedBsaHeparinFeatures.forEach((fragment) => {
  assert(!bsaHtml.includes(fragment), `BSA HTML should not retain obsolete integration text: ${fragment}`);
  assert(!mainJs.includes(fragment), `Shared runtime should not retain obsolete BSA integration code: ${fragment}`);
});
assert(!bsaHtml.includes('Formula set'), 'BSA should not duplicate the formula set label.');
assert(!bsaHtml.includes('Mosteller default; Du Bois, Haycock, Boyd available'), 'BSA should not duplicate available formula copy.');
assert(!bsaHtml.includes('Other formulas'), 'Formula Comparison should not imply that the selected formula is excluded.');
assert(!bsaHtml.includes('>Key info</h3>'), 'The redundant BSA Key info section should remain removed.');
assert(bsaHtml.includes('BMI 25 Reference Flow'), 'Obesity comparison should use accurate BMI 25 reference terminology.');
assert(bsaHtml.includes('Comparison reference only; not an automatic flow target.'), 'BMI 25 reference should be labeled comparison-only.');
['Lean Blood Flow', 'Lean BSA', 'Lean Weight'].forEach((fragment) => {
  assert(!bsaHtml.includes(fragment), `BSA flow comparison should not use misleading terminology: ${fragment}`);
});
assert(bsaHtml.includes('TBW-based BSA may overestimate indexed pump-flow targets in obesity.'), 'Conditional obesity-related CPB flow guidance should remain.');
const flowLayoutIndex = bsaHtml.indexOf('id="bsa-flow-layout"');
const bmi25FlowIndex = bsaHtml.indexOf('id="bsa-bmi25-flow-card"');
const practicalNoteIndex = bsaHtml.indexOf('>Practical note</h3>');
const faqIndex = bsaHtml.indexOf('>BSA and CPB flow FAQ</h2>');
const relatedToolsIndex = bsaHtml.indexOf('>Related tools</h3>');
const referencesIndex = bsaHtml.indexOf('id="bsa-references-heading"');
assert(flowLayoutIndex < bmi25FlowIndex && bmi25FlowIndex < practicalNoteIndex, 'Practical note should follow both total-body and BMI 25 reference flow tables.');
assert(practicalNoteIndex < faqIndex, 'Practical note should remain ahead of the extended FAQ.');
assert(faqIndex < referencesIndex && referencesIndex < relatedToolsIndex, 'Selected references should remain immediately above Related tools.');
[
  'Should a patient with obesity automatically receive the full TBW-based BSA flow?',
  'How do body fat, blood volume, and metabolic demand relate?'
].forEach(question => assert(bsaHtml.includes(question), `BSA FAQ should include: ${question}`));
assert(bsaHtml.includes("does not calculate blood volume"), 'FAQ should distinguish the weight-indexed flow conversion from blood volume.');
assert(bsaHtml.includes('pubmed.ncbi.nlm.nih.gov/9688626'), 'FAQ evidence should include the body-composition metabolism reference.');
assert(bsaHtml.includes('pubmed.ncbi.nlm.nih.gov/16756741'), 'FAQ evidence should include the obesity blood-volume reference.');

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
assert.strictEqual(runtime.computeBSA.length, 3, 'BSA should accept only height, weight, and formula inputs.');
assert.notStrictEqual((170 * 70) / 3600, mostellerCanonical, 'Mosteller canonical should specifically require sqrt, not a linear division result.');
assert.notStrictEqual(Math.sqrt((170 * 70) / 360), mostellerCanonical, 'Mosteller canonical should specifically require denominator 3600.');

// Metric/imperial equivalence uses independent conversion constants, not runtime constants.
const independentlyConvertedHeightCm = CANONICAL_IMPERIAL_PATIENT.heightIn * CM_PER_INCH_REFERENCE;
const independentlyConvertedWeightKg = CANONICAL_IMPERIAL_PATIENT.weightLb * KG_PER_LB_REFERENCE;
assertNearlyEqual(independentlyConvertedHeightCm, CANONICAL_PATIENT.heightCm, 'Imperial height should convert back to 170 cm');
assertNearlyEqual(independentlyConvertedWeightKg, CANONICAL_PATIENT.weightKg, 'Imperial weight should convert back to 70 kg', 1e-11);

const runtimeConvertedImperial = runtime.toMetricBsaInputs(
  CANONICAL_IMPERIAL_PATIENT.heightIn,
  CANONICAL_IMPERIAL_PATIENT.weightLb,
  runtime.BSA_UNIT.imperial
);
assert(Number.isFinite(runtimeConvertedImperial.heightCm) && runtimeConvertedImperial.heightCm > 0, 'Runtime imperial height conversion should produce a positive finite heightCm.');
assert(Number.isFinite(runtimeConvertedImperial.weightKg) && runtimeConvertedImperial.weightKg > 0, 'Runtime imperial weight conversion should produce a positive finite weightKg.');
assertNearlyEqual(runtimeConvertedImperial.heightCm, independentlyConvertedHeightCm, 'Runtime imperial height conversion should match independent cm oracle');
assertNearlyEqual(runtimeConvertedImperial.weightKg, independentlyConvertedWeightKg, 'Runtime imperial weight conversion should match independent kg oracle', 1e-11);

const runtimeMetricPassthrough = runtime.toMetricBsaInputs(
  CANONICAL_PATIENT.heightCm,
  CANONICAL_PATIENT.weightKg,
  runtime.BSA_UNIT.metric
);
assert.strictEqual(runtimeMetricPassthrough.heightCm, CANONICAL_PATIENT.heightCm, 'Runtime metric height should pass through unchanged.');
assert.strictEqual(runtimeMetricPassthrough.weightKg, CANONICAL_PATIENT.weightKg, 'Runtime metric weight should pass through unchanged.');

Object.keys(CANONICAL_EXPECTED).forEach((formulaKey) => {
  const directMetricValue = runtime.computeBSA(CANONICAL_PATIENT.heightCm, CANONICAL_PATIENT.weightKg, formulaKey);
  const runtimeMetricValue = runtime.computeBSA(runtimeMetricPassthrough.heightCm, runtimeMetricPassthrough.weightKg, formulaKey);
  const runtimeImperialValue = runtime.computeBSA(runtimeConvertedImperial.heightCm, runtimeConvertedImperial.weightKg, formulaKey);
  assertNearlyEqual(runtimeMetricValue, directMetricValue, `${formulaKey} runtime metric conversion path should match direct metric result`);
  assertNearlyEqual(runtimeImperialValue, directMetricValue, `${formulaKey} runtime imperial conversion path should match direct metric result`, 1e-11);
  assertNearlyEqual(runtimeImperialValue, CANONICAL_EXPECTED[formulaKey], `${formulaKey} runtime imperial conversion path should match canonical BSA`, 1e-11);
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

// Validation behavior: safe invalid values should not keep previous BSA/BMI/flow/BMI 25 reference state.
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
  const obesePriorState = simulateStandaloneBsaState({ heightValue: 170, weightValue: 100, method: 'Mosteller' });
  assert.strictEqual(obesePriorState.bmi25ReferenceVisible, true, `${scenario.label} prior obese state should start with visible BMI 25 reference card.`);
  const state = simulateStandaloneBsaState({ ...scenario, previousState: obesePriorState });
  assert(!Number.isFinite(state.bsa) || state.bsa === 0, `${scenario.label} should not produce a positive finite BSA.`);
  assert.strictEqual(state.primaryResultText, '0.00', `${scenario.label} should clear the primary BSA text.`);
  assert.strictEqual(state.resultDisplayText, '—', `${scenario.label} should clear the formatted BSA display.`);
  assert.strictEqual(state.bmiText, 'BMI: —', `${scenario.label} should clear BMI display.`);
  assert.strictEqual(state.flowListState, 'empty-message', `${scenario.label} should clear patient-specific flow rows.`);
  assert.strictEqual(state.obesityBadgeVisible, false, `${scenario.label} should not leave obesity badge visible.`);
  assert.strictEqual(state.bmi25ReferenceVisible, false, `${scenario.label} should not leave BMI 25 reference warning/card visible.`);
  assert(!/NaN|Infinity/.test(`${state.primaryResultText} ${state.resultDisplayText} ${state.bmiText}`), `${scenario.label} should not display NaN or Infinity.`);
  assert.strictEqual(state.previousBmi25ReferenceVisible, true, `${scenario.label} transition should carry the prior visible BMI 25 reference state.`);
  assert.notStrictEqual(state.bmi25ReferenceBsaText, obesePriorState.bmi25ReferenceBsaText, `${scenario.label} should clear stale BMI 25 reference BSA text from the prior obese state.`);
  assert.notStrictEqual(state.bmi25ReferenceWeightText, obesePriorState.bmi25ReferenceWeightText, `${scenario.label} should clear stale BMI 25 reference weight text from the prior obese state.`);
});


const obeseValidState = simulateStandaloneBsaState({ heightValue: 170, weightValue: 100, method: 'Mosteller' });
assert.strictEqual(obeseValidState.bmi25ReferenceVisible, true, 'Obese valid patient should show the BMI 25 reference card.');
assert.strictEqual(obeseValidState.obesityBadgeVisible, true, 'Obese valid patient should show the obesity badge.');
assert.notStrictEqual(obeseValidState.resultDisplayText, '—', 'Obese valid patient should show a formatted BSA result.');
assert.notStrictEqual(obeseValidState.bmiText, 'BMI: —', 'Obese valid patient should show BMI.');
assert.strictEqual(obeseValidState.flowListState, 'rows', 'Obese valid patient should show flow rows.');
assert.notStrictEqual(obeseValidState.bmi25ReferenceBsaText, '—', 'Obese valid patient should show BMI 25 reference BSA text.');

const invalidAfterObeseState = simulateStandaloneBsaState({ heightValue: 0, weightValue: 100, method: 'Mosteller', previousState: obeseValidState });
assert.strictEqual(invalidAfterObeseState.previousBmi25ReferenceVisible, true, 'Invalid transition should start from a prior visible BMI 25 reference card.');
assert.strictEqual(invalidAfterObeseState.bmi25ReferenceVisible, false, 'Invalid transition should explicitly hide the prior BMI 25 reference card.');
assert.strictEqual(invalidAfterObeseState.obesityBadgeVisible, false, 'Invalid transition should hide the obesity badge.');
assert.strictEqual(invalidAfterObeseState.resultDisplayText, '—', 'Invalid transition should clear formatted BSA output.');
assert.strictEqual(invalidAfterObeseState.bmiText, 'BMI: —', 'Invalid transition should clear BMI output.');
assert.strictEqual(invalidAfterObeseState.flowListState, 'empty-message', 'Invalid transition should clear flow rows.');
assert.strictEqual(invalidAfterObeseState.bmi25ReferenceBsaText, '—', 'Invalid transition should clear prior BMI 25 reference BSA text.');
assert.strictEqual(invalidAfterObeseState.bmi25ReferenceWeightText, '—', 'Invalid transition should clear prior BMI 25 reference weight text.');
assert.notStrictEqual(invalidAfterObeseState.previousResultDisplayText, invalidAfterObeseState.resultDisplayText, 'Invalid transition should replace prior BSA output.');
assert.notStrictEqual(invalidAfterObeseState.previousBmiText, invalidAfterObeseState.bmiText, 'Invalid transition should replace prior BMI output.');

const nonObeseAfterInvalidState = simulateStandaloneBsaState({ heightValue: 170, weightValue: 70, method: 'Mosteller', previousState: invalidAfterObeseState });
assert.strictEqual(nonObeseAfterInvalidState.bmi25ReferenceVisible, false, 'Valid non-obese transition should keep BMI 25 reference hidden.');
assert.strictEqual(nonObeseAfterInvalidState.obesityBadgeVisible, false, 'Valid non-obese transition should keep obesity badge hidden.');
assert.strictEqual(nonObeseAfterInvalidState.resultDisplayText, `${CANONICAL_EXPECTED.Mosteller.toFixed(2)} m²`, 'Valid non-obese transition should restore BSA output.');
assert.strictEqual(nonObeseAfterInvalidState.bmiText, 'BMI: 24.2 kg/m²', 'Valid non-obese transition should restore BMI output.');
assert.strictEqual(nonObeseAfterInvalidState.flowListState, 'rows', 'Valid non-obese transition should restore flow rows.');

const obeseAgainState = simulateStandaloneBsaState({ heightValue: 170, weightValue: 100, method: 'Mosteller', previousState: nonObeseAfterInvalidState });
assert.strictEqual(obeseAgainState.bmi25ReferenceVisible, true, 'Returning to an obese valid patient should show BMI 25 reference card again.');
assert.strictEqual(obeseAgainState.obesityBadgeVisible, true, 'Returning to an obese valid patient should show obesity badge again.');
assert.strictEqual(obeseAgainState.flowListState, 'rows', 'Returning to an obese valid patient should keep flow rows visible.');

const updateStandaloneBsaSource = mainJs.slice(mainJs.indexOf('function updateStandaloneBsa()'), mainJs.indexOf('function setBsaUnit'));
const standaloneInvalidBranchStart = updateStandaloneBsaSource.indexOf("} else {\n      bmiDisplay.textContent = 'BMI: —';");
assert(standaloneInvalidBranchStart >= 0, 'updateStandaloneBsa invalid branch should be locatable for static stale-state contract checks.');
const standaloneInvalidBranch = updateStandaloneBsaSource.slice(standaloneInvalidBranchStart, updateStandaloneBsaSource.indexOf('if (formulaCompareEl)', standaloneInvalidBranchStart));
assert(standaloneInvalidBranch.includes("bmiDisplay.textContent = 'BMI: —';"), 'updateStandaloneBsa invalid branch should clear BMI text.');
assert(standaloneInvalidBranch.includes("obesityBadge.classList.add('hidden');"), 'updateStandaloneBsa invalid branch should hide obesity badge.');
assert(standaloneInvalidBranch.includes("obesityBadge.textContent = 'Obese BMI —';"), 'updateStandaloneBsa invalid branch should reset obesity badge text.');
assert(standaloneInvalidBranch.includes("if (bmi25FlowCard) bmi25FlowCard.classList.add('hidden');"), 'updateStandaloneBsa invalid branch should hide BMI 25 reference card.');
assert(standaloneInvalidBranch.includes("if (bmi25ReferenceBsaEl) bmi25ReferenceBsaEl.textContent = '—';"), 'updateStandaloneBsa invalid branch should clear BMI 25 reference BSA text.');
assert(standaloneInvalidBranch.includes("if (bmi25ReferenceWeightEl) bmi25ReferenceWeightEl.textContent = '—';"), 'updateStandaloneBsa invalid branch should clear BMI 25 reference weight text.');
assert(updateStandaloneBsaSource.includes("resultEl.textContent = v ? v.toFixed(2) : '0.00';"), 'updateStandaloneBsa should clear primary BSA output when computeBSA returns 0.');
assert(updateStandaloneBsaSource.includes("resultDisplay.textContent = v ? `${v.toFixed(2)} m²` : '—';"), 'updateStandaloneBsa should clear formatted BSA output when computeBSA returns 0.');
assert(updateStandaloneBsaSource.includes('updateBsaFlowList(v, w);'), 'updateStandaloneBsa should always delegate flow-list refresh after invalid input.');
const updateBsaFlowListSource = mainJs.slice(mainJs.indexOf('function updateBsaFlowList'), mainJs.indexOf('function updateStandaloneBsa'));
assert(updateBsaFlowListSource.includes(`list.innerHTML = '<p class="text-xs text-slate-500 dark:text-slate-400">Enter height and weight to populate the flow table.</p>';`), 'updateBsaFlowList invalid branch should replace stale flow rows with the empty message.');

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
assert(heparinHtml.includes('id="hep2-height"') && heparinHtml.includes('id="hep2-weight"') && heparinHtml.includes('id="hep2-sex"'), 'Standalone Heparin calculator should retain its own patient inputs.');
assert(mainJs.includes('function computeDevineIbw(heightCm, sex)'), 'Standalone Heparin calculator should retain Devine IBW logic.');
assert(mainJs.includes('const abwStandard = ibw + 0.4 * excess;'), 'Standalone Heparin calculator should retain adjusted-body-weight logic.');
const relatedToolsSection = bsaHtml.slice(bsaHtml.indexOf('>Related tools</h3>'));
assert(relatedToolsSection.includes('href="/heparin/"') && relatedToolsSection.includes('>Heparin Calculator</a>'), 'Normal related-tools navigation to the standalone Heparin calculator should remain available.');

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
