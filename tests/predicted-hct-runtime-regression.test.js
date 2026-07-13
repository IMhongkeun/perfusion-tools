const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const mainJsPath = path.join(repoRoot, 'main.js');
const mainJs = fs.readFileSync(mainJsPath, 'utf8');

function sliceBetween(start, end) {
  const startIndex = mainJs.indexOf(start);
  const endIndex = mainJs.indexOf(end, startIndex);
  assert(startIndex >= 0, `Missing start marker: ${start}`);
  assert(endIndex > startIndex, `Missing end marker: ${end}`);
  return mainJs.slice(startIndex, endIndex);
}

function createClassList() {
  const values = new Set();
  return {
    add: (...classes) => classes.forEach((name) => values.add(name)),
    remove: (...classes) => classes.forEach((name) => values.delete(name)),
    toggle: (name, force) => {
      const shouldAdd = force === undefined ? !values.has(name) : !!force;
      if (shouldAdd) values.add(name);
      else values.delete(name);
      return shouldAdd;
    },
    contains: (name) => values.has(name),
    toString: () => Array.from(values).join(' ')
  };
}

function createElement(id, value = '') {
  return {
    id,
    value: String(value),
    innerHTML: '',
    textContent: '',
    dataset: {},
    classList: createClassList(),
    setAttribute(name, value) { this[name] = String(value); },
    addEventListener() {},
    focus() {}
  };
}

const elementIds = [
  'hct_mode', 'hct-pre-mode', 'hct-onpump-mode', 'hct-left-label', 'hct-right-label', 'onpump-extra-results', 'hct-primary-results', 'hct-mode-help',
  'pttype', 'ebv_coef', 'wt_hct', 'pre_hct', 'prime', 'rbc_units', 'rbc_unit_vol', 'rbc_hct',
  'onpump_pttype', 'onpump_weight', 'onpump_ebv_coef', 'onpump_prime', 'current_hct', 'onpump_net_io_change', 'onpump_fluids', 'onpump_rbc_units', 'onpump_rbc_unit_vol', 'onpump_rbc_hct', 'onpump_removed',
  'ebv', 'total_vol', 'pred_hct', 'current_rbc_vol', 'added_rbc_vol', 'onpump_ebv', 'onpump_estimated_volume', 'onpump_ebv_auto', 'onpump_base_cpb_volume', 'onpump_estimated_auto', 'onpump_current_rbc_summary',
  'onpump_result_message', 'onpump_result_values', 'current_hct_result', 'pred_hct_result', 'hct_change', 'current_volume_result', 'final_volume_result',
  'target_hct', 'target-hct-message', 'target-hct-cards', 'target-dilution-card', 'target_rbc_only', 'target_rbc_only_secondary', 'target_rbc_neutral', 'target_rbc_neutral_secondary', 'target_hfuf_only', 'target_hfuf_only_secondary'
];

function loadRuntime() {
  const elements = Object.fromEntries(elementIds.map((id) => [id, createElement(id)]));
  elements.pttype.value = 'adult_m';
  elements.hct_mode.value = 'pre';
  elements.ebv_coef.value = '70';
  elements.prime.value = '1200';
  elements.rbc_units.value = '0';
  elements.rbc_unit_vol.value = '300';
  elements.rbc_hct.value = '60';
  elements.onpump_pttype.value = 'adult_m';
  elements.onpump_ebv_coef.value = '70';
  elements.onpump_prime.value = '1100';
  elements.onpump_net_io_change.value = '500';
  elements.onpump_fluids.value = '0';
  elements.onpump_rbc_units.value = '0';
  elements.onpump_rbc_unit_vol.value = '300';
  elements.onpump_rbc_hct.value = '60';
  elements.onpump_removed.value = '0';
  elements.target_hct.value = '35';

  const context = {
    console,
    document: { getElementById: (id) => elements[id] || null },
    Event: function Event() {},
    elements
  };
  vm.createContext(context);
  const hctCore = sliceBetween('const PATIENT_TYPE_COEFS = {', '// -----------------------------\n// Heparin management');
  const domHelpers = sliceBetween('// -----------------------------\n// DOM Helpers', '// -----------------------------\n// GDP Interaction');
  const hctInteraction = sliceBetween('// -----------------------------\n// Predicted Hct Interaction', '// -----------------------------\n// LBM Interaction');
  vm.runInContext(`${hctCore}\n${domHelpers}\n${hctInteraction}\nthis.__exports = { calculatePreCpbHct, computePredictedHct, computeOnPumpHctAdjustment, computeTargetHctScenarios, parseSignedNetIoValue, updateHct, elements };`, context);
  return context.__exports;
}

function nearlyEqual(actual, expected, tolerance = 1e-9) {
  assert(Number.isFinite(actual), `Expected finite value, got ${actual}`);
  assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}, got ${actual}`);
}

function referencePreCpb({ weightKg, ebvCoef, preHct, primeMl, rbcProductMl = 0, rbcProductHct = 60 }) {
  const patientBloodVolumeMl = weightKg * ebvCoef;
  const patientRedCellVolumeMl = patientBloodVolumeMl * (preHct / 100);
  const productRedCellVolumeMl = rbcProductMl * (rbcProductHct / 100);
  const finalRedCellVolumeMl = patientRedCellVolumeMl + productRedCellVolumeMl;
  const finalTotalVolumeMl = patientBloodVolumeMl + primeMl + rbcProductMl;
  return { patientBloodVolumeMl, patientRedCellVolumeMl, productRedCellVolumeMl, finalRedCellVolumeMl, finalTotalVolumeMl, predictedHct: finalRedCellVolumeMl / finalTotalVolumeMl * 100 };
}

function referenceOnPump({ baseCpbVolumeMl, netIoMl = 0, currentHct, crystalloidMl = 0, rbcProductMl = 0, rbcProductHct = 60, ufMl = 0 }) {
  const currentTotalVolumeMl = baseCpbVolumeMl + netIoMl;
  const currentRedCellVolumeMl = currentTotalVolumeMl * (currentHct / 100);
  const productRedCellVolumeMl = rbcProductMl * (rbcProductHct / 100);
  const finalRedCellVolumeMl = currentRedCellVolumeMl + productRedCellVolumeMl;
  const finalTotalVolumeMl = currentTotalVolumeMl + crystalloidMl + rbcProductMl - ufMl;
  return { currentTotalVolumeMl, currentRedCellVolumeMl, productRedCellVolumeMl, finalRedCellVolumeMl, finalTotalVolumeMl, predictedHct: finalRedCellVolumeMl / finalTotalVolumeMl * 100 };
}

function referenceTarget({ V, R, currentHct, targetHct, productHct = 60, unitMl = 300 }) {
  const T = targetHct / 100;
  const P = productHct / 100;
  const crystalloidToAdd = targetHct < currentHct ? R / T - V : null;
  const requiredRemovalMl = targetHct > currentHct ? V - R / T : null;
  const requiredRbcMl = targetHct > currentHct && productHct > targetHct ? (T * V - R) / (P - T) : null;
  return { crystalloidToAdd, requiredRemovalMl, requiredRbcMl, requiredUnits: requiredRbcMl == null ? null : requiredRbcMl / unitMl };
}

function assertNoInvalidTokens(exports) {
  for (const [id, element] of Object.entries(exports.elements)) {
    const text = `${element.innerHTML} ${element.textContent}`;
    assert(!text.includes('NaN'), `${id} displayed NaN`);
    assert(!text.includes('Infinity'), `${id} displayed Infinity`);
  }
}

function assertNoTargetOutputTokens(exports, forbiddenTokens = []) {
  ['target-hct-message', 'target-dilution-card', 'target-hct-cards', 'target_rbc_only', 'target_rbc_only_secondary', 'target_rbc_neutral', 'target_rbc_neutral_secondary', 'target_hfuf_only', 'target_hfuf_only_secondary'].forEach((id) => {
    const element = exports.elements[id];
    const text = `${element.innerHTML} ${element.textContent}`;
    assert(!text.includes('NaN'), `${id} displayed NaN`);
    assert(!text.includes('Infinity'), `${id} displayed Infinity`);
    forbiddenTokens.forEach((token) => assert(!text.includes(token), `${id} retained ${token}`));
  });
}

function assertTargetScenariosCleared(exports, messagePart, forbiddenTokens = []) {
  assert(exports.elements['target-hct-message'].textContent.includes(messagePart), exports.elements['target-hct-message'].textContent);
  assert(exports.elements['target-hct-cards'].classList.contains('hidden'), 'Target scenario cards should be hidden');
  assert(exports.elements['target-dilution-card'].classList.contains('hidden'), 'Target dilution card should be hidden');
  ['target_rbc_only', 'target_rbc_only_secondary', 'target_rbc_neutral', 'target_rbc_neutral_secondary', 'target_hfuf_only', 'target_hfuf_only_secondary'].forEach((id) => {
    assert.strictEqual(exports.elements[id].innerHTML, '', `${id} innerHTML should be cleared`);
    assert.strictEqual(exports.elements[id].textContent, '', `${id} textContent should be cleared`);
  });
  assertNoTargetOutputTokens(exports, forbiddenTokens);
}

function assertInvalidTargetResult(result, messagePart) {
  assert.strictEqual(result.invalidTargetHct, true);
  assert(result.message.includes(messagePart), result.message);
  ['dilution', 'rbcOnly', 'rbcNeutral', 'hfUfOnly', 'noAdjustment'].forEach((key) => assert.strictEqual(result[key], null, `${key} should be null`));
  const serialized = JSON.stringify(result);
  assert(!serialized.includes('NaN'), 'Invalid target result should not contain NaN');
  assert(!serialized.includes('Infinity'), 'Invalid target result should not contain Infinity');
}

function setValues(exports, values) {
  for (const [id, value] of Object.entries(values)) exports.elements[id].value = String(value);
}

function runNumericOracleTests(exports) {
  const case1 = referencePreCpb({ weightKg: 70, ebvCoef: 70, preHct: 40, primeMl: 1200 });
  const actual1 = exports.calculatePreCpbHct({ ebvCoef: 70, weightKg: 70, preCpbHct: 40, primeVolumeMl: 1200, additionalCrystalloidMl: 0, ultrafiltrationRemovedMl: 0, rbcUnits: 0, rbcVolumePerUnitMl: 300, rbcUnitHct: 60 });
  nearlyEqual(actual1.ebvMl, case1.patientBloodVolumeMl);
  nearlyEqual(actual1.patientRbcMl, case1.patientRedCellVolumeMl);
  nearlyEqual(actual1.totalVolumeMl, 6100);
  nearlyEqual(actual1.resultHctPercent, 32.131147540983605);

  [
    { rbcVolumePerUnitMl: 0, rbcUnitHct: 0 },
    { rbcVolumePerUnitMl: NaN, rbcUnitHct: NaN },
    { rbcVolumePerUnitMl: -1, rbcUnitHct: 101 }
  ].forEach((productFields) => {
    const noRbc = exports.calculatePreCpbHct({ ebvCoef: 70, weightKg: 70, preCpbHct: 40, primeVolumeMl: 1200, additionalCrystalloidMl: 0, ultrafiltrationRemovedMl: 0, rbcUnits: 0, ...productFields });
    nearlyEqual(noRbc.transfusedRbcVolumeMl, 0);
    nearlyEqual(noRbc.transfusedRbcCellVolumeMl, 0);
    nearlyEqual(noRbc.finalRbcVolumeMl, case1.patientRedCellVolumeMl);
    nearlyEqual(noRbc.totalVolumeMl, case1.finalTotalVolumeMl);
    nearlyEqual(noRbc.resultHctPercent, case1.predictedHct);
    const serialized = JSON.stringify(noRbc);
    assert(!serialized.includes('NaN'), 'No-RBC result should not contain NaN');
    assert(!serialized.includes('Infinity'), 'No-RBC result should not contain Infinity');
  });

  const case2 = referencePreCpb({ weightKg: 70, ebvCoef: 70, preHct: 40, primeMl: 1200, rbcProductMl: 300, rbcProductHct: 60 });
  const actual2 = exports.calculatePreCpbHct({ ebvCoef: 70, weightKg: 70, preCpbHct: 40, primeVolumeMl: 1200, additionalCrystalloidMl: 0, ultrafiltrationRemovedMl: 0, rbcUnits: 1, rbcVolumePerUnitMl: 300, rbcUnitHct: 60 });
  nearlyEqual(actual2.transfusedRbcCellVolumeMl, case2.productRedCellVolumeMl);
  nearlyEqual(actual2.finalRbcVolumeMl, 2140);
  nearlyEqual(actual2.totalVolumeMl, 6400);
  nearlyEqual(actual2.resultHctPercent, 33.4375);

  const onPumpFixtures = [
    { name: 'crystalloid', args: { baseCpbVolumeMl: 6000, netIoMl: 500, currentHct: 30, crystalloidMl: 500 }, expectedHct: 27.857142857142858, finalTotal: 7000 },
    { name: 'rbc', args: { baseCpbVolumeMl: 6000, netIoMl: 500, currentHct: 30, rbcProductMl: 300, rbcProductHct: 60 }, expectedHct: 31.323529411764707, finalTotal: 6800 },
    { name: 'uf', args: { baseCpbVolumeMl: 6000, netIoMl: 500, currentHct: 30, ufMl: 500 }, expectedHct: 32.5, finalTotal: 6000 },
    { name: 'combined', args: { baseCpbVolumeMl: 6000, netIoMl: 500, currentHct: 30, crystalloidMl: 200, rbcProductMl: 300, rbcProductHct: 60, ufMl: 500 }, expectedHct: 32.76923076923077, finalTotal: 6500 }
  ];
  for (const fixture of onPumpFixtures) {
    const expected = referenceOnPump(fixture.args);
    const actual = exports.computeOnPumpHctAdjustment({ weightKg: 70, ebvCoefValue: 70, primeVolume: 1100, netIoChange: fixture.args.netIoMl, currentHct: fixture.args.currentHct, addedCrystalloid: fixture.args.crystalloidMl || 0, rbcUnits: (fixture.args.rbcProductMl || 0) / 300, rbcUnitVol: 300, rbcUnitHct: fixture.args.rbcProductHct || 60, ultrafiltrationRemoved: fixture.args.ufMl || 0 });
    nearlyEqual(actual.baseCpbVolume, 6000);
    nearlyEqual(actual.currentTotalVolume, expected.currentTotalVolumeMl);
    nearlyEqual(actual.currentRbcVolume, expected.currentRedCellVolumeMl);
    nearlyEqual(actual.addedRbcVolume, expected.productRedCellVolumeMl);
    nearlyEqual(actual.finalTotalVolume, fixture.finalTotal);
    nearlyEqual(actual.predictedHct, fixture.expectedHct);
  }

  const targetExpected = referenceTarget({ V: 6500, R: 1950, currentHct: 30, targetHct: 35, productHct: 60 });
  const targetActual = exports.computeTargetHctScenarios({ currentTotalVolume: 6500, currentRbcVolume: 1950, currentHct: 30, targetHct: 35, rbcVolPerUnit: 300, rbcProductHctPercent: 60 });
  nearlyEqual(targetActual.hfUfOnly.requiredRemovalMl, targetExpected.requiredRemovalMl);
  nearlyEqual(targetActual.rbcOnly.requiredRbcMl, targetExpected.requiredRbcMl);
  nearlyEqual(targetActual.rbcOnly.requiredUnits, targetExpected.requiredUnits);

  const noRbcTarget = exports.computeTargetHctScenarios({ currentTotalVolume: 6500, currentRbcVolume: 1950, currentHct: 30, targetHct: 25, rbcVolPerUnit: 300, rbcProductHctPercent: 60 });
  nearlyEqual(noRbcTarget.dilution.crystalloidToAdd, 1300);
  assert.strictEqual(noRbcTarget.rbcOnly, null);

  const targetAt100 = exports.computeTargetHctScenarios({ currentTotalVolume: 6500, currentRbcVolume: 1950, currentHct: 30, targetHct: 100, rbcVolPerUnit: 300, rbcProductHctPercent: 60 });
  assert.strictEqual(targetAt100.invalidTargetHct, undefined);
  assert(targetAt100.hfUfOnly, 'Target Hct 100 should remain a valid boundary target');
  nearlyEqual(targetAt100.hfUfOnly.requiredRemovalMl, 4550);
  nearlyEqual(targetAt100.hfUfOnly.expectedHct, 100);

  [
    { targetHct: 100.0001, message: 'no more than 100%' },
    { targetHct: 101, message: 'no more than 100%' },
    { targetHct: 0, message: 'Enter a target Hct' },
    { targetHct: -1, message: 'no more than 100%' },
    { targetHct: NaN, message: 'finite number' },
    { targetHct: Infinity, message: 'finite number' },
    { targetHct: -Infinity, message: 'finite number' },
    { targetHct: '35', message: 'finite number' },
    { targetHct: undefined, message: 'finite number' }
  ].forEach(({ targetHct, message }) => {
    assertInvalidTargetResult(exports.computeTargetHctScenarios({ currentTotalVolume: 6500, currentRbcVolume: 1950, currentHct: 30, targetHct, rbcVolPerUnit: 300, rbcProductHctPercent: 60 }), message);
  });

  const customProduct = exports.computeTargetHctScenarios({ currentTotalVolume: 5050, currentRbcVolume: 1262.5, currentHct: 25, targetHct: 27, rbcVolPerUnit: 250, rbcProductHctPercent: 50 });
  const customExpected = referenceTarget({ V: 5050, R: 1262.5, currentHct: 25, targetHct: 27, productHct: 50, unitMl: 250 });
  nearlyEqual(customProduct.rbcOnly.requiredRbcMl, customExpected.requiredRbcMl);
  nearlyEqual(customProduct.rbcOnly.requiredUnits, customExpected.requiredUnits);

  assert.strictEqual(exports.parseSignedNetIoValue('500'), 500);
  assert.strictEqual(exports.parseSignedNetIoValue('-500'), -500);
  assert.strictEqual(exports.parseSignedNetIoValue('-'), null);
}

function assertInvalidPre(exports, args, messagePart) {
  const result = exports.calculatePreCpbHct({ ebvCoef: 70, weightKg: 70, preCpbHct: 40, primeVolumeMl: 1200, additionalCrystalloidMl: 0, ultrafiltrationRemovedMl: 0, rbcUnits: 0, rbcVolumePerUnitMl: 300, rbcUnitHct: 60, ...args });
  assert.strictEqual(result.resultHctPercent, null);
  assert(result.validationMessage.includes(messagePart), result.validationMessage);
}

function assertInvalidOnPump(exports, args, messagePart) {
  const result = exports.computeOnPumpHctAdjustment({ weightKg: 70, ebvCoefValue: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 0, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0, ...args });
  assert.strictEqual(result.predictedHct, null);
  assert(result.validationMessage.includes(messagePart), result.validationMessage);
}

function assertInvalidCoefficientResult(result) {
  assert.strictEqual(result.predictedHct, null);
  assert.strictEqual(result.ebv, null);
  assert.strictEqual(result.baseCpbVolume, null);
  assert.strictEqual(result.currentTotalVolume, null);
  assert.strictEqual(result.finalTotalVolume, null);
  assert(result.validationMessage.includes('EBV coefficient'), result.validationMessage);
  const serialized = JSON.stringify(result);
  assert(!serialized.includes('NaN'), 'Invalid coefficient result should not contain NaN');
  assert(!serialized.includes('Infinity'), 'Invalid coefficient result should not contain Infinity');
}

function runOnPumpEbvCoefficientContractTests(exports) {
  const canonical = exports.computeOnPumpHctAdjustment({ patientType: 'adult_m', weightKg: 70, ebvCoefValue: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(canonical.ebv, 4900);
  nearlyEqual(canonical.baseCpbVolume, 6000);
  nearlyEqual(canonical.currentTotalVolume, 6500);
  nearlyEqual(canonical.finalTotalVolume, 7000);
  nearlyEqual(canonical.predictedHct, 27.857142857142858);

  const customCoef = exports.computeOnPumpHctAdjustment({ patientType: 'adult_m', weightKg: 70, ebvCoefValue: 60, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(customCoef.ebv, 4200);
  nearlyEqual(customCoef.baseCpbVolume, 5300);
  nearlyEqual(customCoef.currentTotalVolume, 5800);
  nearlyEqual(customCoef.finalTotalVolume, 6300);
  assert(Math.abs(customCoef.predictedHct - canonical.predictedHct) > 0.01, 'Custom coefficient should not silently fall back to 70');

  [0, -1, NaN, Infinity, -Infinity, '70', 'abc', null].forEach((ebvCoefValue) => assertInvalidCoefficientResult(exports.computeOnPumpHctAdjustment({ patientType: 'adult_m', weightKg: 70, ebvCoefValue, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 })));

  const omittedAdultM = exports.computeOnPumpHctAdjustment({ patientType: 'adult_m', weightKg: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(omittedAdultM.ebv, 4900);
  nearlyEqual(omittedAdultM.predictedHct, canonical.predictedHct);
  const omittedAdultF = exports.computeOnPumpHctAdjustment({ patientType: 'adult_f', weightKg: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(omittedAdultF.ebv, 4550);
  const omittedChild = exports.computeOnPumpHctAdjustment({ patientType: 'child', weightKg: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(omittedChild.ebv, 5250);
  const omittedInfant = exports.computeOnPumpHctAdjustment({ patientType: 'infant', weightKg: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(omittedInfant.ebv, 5600);
  const omittedNeonate = exports.computeOnPumpHctAdjustment({ patientType: 'neonate', weightKg: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(omittedNeonate.ebv, 6300);
  const omittedUnknown = exports.computeOnPumpHctAdjustment({ patientType: 'unknown', weightKg: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, addedCrystalloid: 500, rbcUnits: 0, rbcUnitVol: 300, rbcUnitHct: 60, ultrafiltrationRemoved: 0 });
  nearlyEqual(omittedUnknown.ebv, 4900);
}

function runBoundaryTests(exports) {
  for (const bad of [NaN, Infinity, -Infinity, '70', undefined]) assertInvalidPre(exports, { weightKg: bad }, 'Weight');
  assertInvalidPre(exports, { weightKg: -1 }, 'Weight');
  assertInvalidPre(exports, { weightKg: 0 }, 'Weight');
  assertInvalidPre(exports, { preCpbHct: -1 }, 'Pre-CPB Hct');
  assertInvalidPre(exports, { preCpbHct: 0 }, 'Pre-CPB Hct');
  nearlyEqual(exports.calculatePreCpbHct({ ebvCoef: 70, weightKg: 70, preCpbHct: 100, primeVolumeMl: 1200, additionalCrystalloidMl: 0, ultrafiltrationRemovedMl: 0, rbcUnits: 0, rbcVolumePerUnitMl: 300, rbcUnitHct: 60 }).resultHctPercent, 80.32786885245902);
  assertInvalidPre(exports, { preCpbHct: 101 }, 'Pre-CPB Hct');
  assertInvalidPre(exports, { rbcUnits: 1, rbcUnitHct: -1 }, 'RBC product Hct');
  assertInvalidPre(exports, { rbcUnits: 1, rbcUnitHct: 0 }, 'RBC product Hct');
  assertInvalidPre(exports, { rbcUnits: 1, rbcUnitHct: 101 }, 'RBC product Hct');
  assertInvalidPre(exports, { primeVolumeMl: -1 }, 'Prime volume');
  assertInvalidPre(exports, { rbcUnits: -1 }, 'RBC units');
  assertInvalidPre(exports, { rbcUnits: '1' }, 'RBC units');
  assertInvalidPre(exports, { rbcUnits: 1, rbcVolumePerUnitMl: 0 }, 'RBC unit volume');
  assertInvalidPre(exports, { rbcUnits: 1, rbcVolumePerUnitMl: -1 }, 'RBC unit volume');
  assertInvalidPre(exports, { rbcUnits: 1, rbcVolumePerUnitMl: NaN }, 'RBC unit volume');
  assertInvalidPre(exports, { rbcUnits: 1, rbcVolumePerUnitMl: Infinity }, 'RBC unit volume');
  assertInvalidPre(exports, { rbcUnits: 1, rbcUnitHct: NaN }, 'RBC product Hct');
  assertInvalidPre(exports, { rbcUnits: 1, rbcUnitHct: Infinity }, 'RBC product Hct');
  nearlyEqual(exports.calculatePreCpbHct({ ebvCoef: 70, weightKg: 70, preCpbHct: 40, primeVolumeMl: 1200, additionalCrystalloidMl: 0, ultrafiltrationRemovedMl: 0, rbcUnits: 1, rbcVolumePerUnitMl: 300, rbcUnitHct: 100 }).transfusedRbcCellVolumeMl, 300);

  for (const bad of [NaN, Infinity, -Infinity, '70', undefined]) assertInvalidOnPump(exports, { weightKg: bad }, 'Weight');
  assertInvalidOnPump(exports, { currentHct: -1 }, 'Current Hct');
  assertInvalidOnPump(exports, { currentHct: 0 }, 'Current Hct');
  assertInvalidOnPump(exports, { currentHct: 101 }, 'Current Hct');
  assertInvalidOnPump(exports, { rbcUnitHct: -1 }, 'RBC product Hct');
  assertInvalidOnPump(exports, { rbcUnitHct: 0 }, 'RBC product Hct');
  assertInvalidOnPump(exports, { rbcUnitHct: 101 }, 'RBC product Hct');
  assertInvalidOnPump(exports, { primeVolume: -1 }, 'Initial prime volume');
  assertInvalidOnPump(exports, { rbcUnits: -1 }, 'RBC units');
  assert(exports.computeOnPumpHctAdjustment({ weightKg: 70, ebvCoefValue: 70, primeVolume: 1100, netIoChange: 500, currentHct: 30, rbcUnitHct: 100 }).predictedHct !== null);
  assertInvalidOnPump(exports, { ultrafiltrationRemoved: 6500 }, 'Final volume must be greater than 0');
  assertInvalidOnPump(exports, { ultrafiltrationRemoved: 6501 }, 'Final volume must be greater than 0');
  assertInvalidOnPump(exports, { addedCrystalloid: Infinity }, 'Crystalloid/colloid addition');
}

function runStateTransitionTests(exports) {
  setValues(exports, { hct_mode: 'pre', wt_hct: 70, pre_hct: 40, prime: 1200, rbc_units: 0, rbc_unit_vol: '', rbc_hct: '', ebv_coef: 70 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '32.1%');
  assert.strictEqual(exports.elements.total_vol.innerHTML, '6100');
  setValues(exports, { rbc_units: 1, rbc_unit_vol: 300, rbc_hct: 60 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '33.4%');
  assert.strictEqual(exports.elements.total_vol.innerHTML, '6400');
  setValues(exports, { rbc_hct: 0 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert(exports.elements['hct-mode-help'].textContent.includes('RBC product Hct'));
  assertNoInvalidTokens(exports);
  setValues(exports, { rbc_units: 0, rbc_unit_vol: '', rbc_hct: '' });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '32.1%');
  assert.strictEqual(exports.elements.total_vol.innerHTML, '6100');
  setValues(exports, { wt_hct: -1 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert.notStrictEqual(exports.elements.pred_hct.innerHTML, '0%');
  assert(exports.elements['hct-mode-help'].textContent.includes('Weight'));
  assertNoInvalidTokens(exports);
  setValues(exports, { wt_hct: 70 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '32.1%');

  setValues(exports, { pre_hct: 101 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert(exports.elements['hct-mode-help'].textContent.includes('Pre-CPB Hct'));
  setValues(exports, { pre_hct: 40 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '32.1%');

  setValues(exports, { hct_mode: 'onpump', onpump_weight: 70, onpump_ebv_coef: 70, onpump_prime: 1100, onpump_net_io_change: 500, current_hct: 30, onpump_fluids: 0, onpump_rbc_units: 0, onpump_rbc_unit_vol: 300, onpump_rbc_hct: 60, onpump_removed: 0, target_hct: 35 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '30.0%');
  assert(!exports.elements['target-hct-cards'].classList.contains('hidden'), 'Target scenario cards should be visible for target 35');
  assert(exports.elements.target_rbc_only.innerHTML.includes('Add RBC 1,300 mL'));
  assert(exports.elements.target_hfuf_only.innerHTML.includes('Remove HF/UF 929 mL'));
  setValues(exports, { onpump_ebv_coef: 0 });
  exports.updateHct();
  assert.strictEqual(exports.elements.ebv.innerHTML, '—');
  assert.strictEqual(exports.elements.total_vol.innerHTML, '—');
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '—');
  assert(exports.elements.onpump_result_message.textContent.includes('EBV coefficient'));
  assertTargetScenariosCleared(exports, 'EBV coefficient', ['1,300', '929', 'Add RBC', 'Remove HF/UF']);
  assertNoInvalidTokens(exports);
  setValues(exports, { onpump_ebv_coef: 70 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '30.0%');
  assert(exports.elements.target_rbc_only.innerHTML.includes('Add RBC 1,300 mL'));
  setValues(exports, { onpump_ebv_coef: -1 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assertTargetScenariosCleared(exports, 'EBV coefficient', ['1,300', '929', 'Add RBC', 'Remove HF/UF']);
  setValues(exports, { onpump_ebv_coef: 70 });
  exports.updateHct();
  setValues(exports, { onpump_ebv_coef: '' });
  exports.updateHct();
  assert.strictEqual(exports.elements.onpump_ebv.innerHTML, '4900 mL');
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '30.0%');
  setValues(exports, { onpump_ebv_coef: 60 });
  exports.updateHct();
  assert.strictEqual(exports.elements.onpump_ebv.innerHTML, '4200 mL');
  assert.strictEqual(exports.elements.onpump_base_cpb_volume.innerHTML, '5300 mL');
  assert.notStrictEqual(exports.elements.current_volume_result.innerHTML, '6,500 mL');
  setValues(exports, { onpump_ebv_coef: 70 });
  exports.updateHct();
  setValues(exports, { target_hct: 101 });
  exports.updateHct();
  assertTargetScenariosCleared(exports, 'no more than 100%', ['1,300', '929', 'Add RBC', 'Remove HF/UF']);
  setValues(exports, { target_hct: 35 });
  exports.updateHct();
  assert(!exports.elements['target-hct-cards'].classList.contains('hidden'), 'Target scenario cards should restore for target 35');
  assert(exports.elements.target_rbc_only.innerHTML.includes('Add RBC 1,300 mL'));
  setValues(exports, { onpump_removed: 6500 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert.strictEqual(exports.elements.total_vol.innerHTML, '—');
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '—');
  assert(exports.elements.onpump_result_message.textContent.includes('Final volume'));
  assertTargetScenariosCleared(exports, 'final volume', ['1,300', '929', 'Add RBC', 'Remove HF/UF']);
  assertNoInvalidTokens(exports);
  setValues(exports, { onpump_removed: 0 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '30.0%');
  assert(!exports.elements['target-hct-cards'].classList.contains('hidden'), 'Target scenario cards should restore after final volume becomes valid');
  assert(exports.elements.target_rbc_only.innerHTML.includes('Add RBC 1,300 mL'));

  setValues(exports, { current_hct: 101 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert(exports.elements.onpump_result_message.textContent.includes('Current Hct'));
  setValues(exports, { current_hct: 30 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '30.0%');

  setValues(exports, { onpump_rbc_hct: 0 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct.innerHTML, '—');
  assert(exports.elements.onpump_result_message.textContent.includes('RBC product Hct'));
  setValues(exports, { onpump_rbc_hct: 60 });
  exports.updateHct();
  assert.strictEqual(exports.elements.pred_hct_result.innerHTML, '30.0%');
}

function runParityTests() {
  assert.strictEqual(fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8'), fs.readFileSync(path.join(repoRoot, 'dist', 'main.js'), 'utf8'), 'main.js and dist/main.js must match');
  assert.strictEqual(fs.readFileSync(path.join(repoRoot, 'predicted-hct', 'index.html'), 'utf8'), fs.readFileSync(path.join(repoRoot, 'dist', 'predicted-hct', 'index.html'), 'utf8'), 'predicted-hct source and dist HTML must match');
}

function run() {
  const exports = loadRuntime();
  runNumericOracleTests(exports);
  runOnPumpEbvCoefficientContractTests(exports);
  runBoundaryTests(exports);
  runStateTransitionTests(exports);
  runParityTests();
  console.log('All predicted Hct runtime regression tests passed.');
}

run();
