'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const phn = require('../lib/phn.js');

function loadPhnRuntimeFromMainJs() {
  const mainJsSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
  const start = mainJsSource.indexOf('const PHN_STRUCTURE_ORDER =');
  const end = mainJsSource.indexOf('// PHN Pediatric Echo Z-score Calculator');
  assert(start >= 0 && end > start, 'PHN bundled runtime should be extractable from main.js');
  const context = {
    module: { exports: {} },
    require: (mod) => require(path.join(__dirname, '..', mod.replace(/^\.\.\//, ''))),
    Math,
    Number,
    Boolean,
    Error,
    RangeError
  };
  vm.runInNewContext(mainJsSource.slice(start, end), context, { filename: 'main.js:phn-runtime' });
  return context.module.exports;
}

const mainJsApi = loadPhnRuntimeFromMainJs();

function nearlyEqual(a, b, tolerance = 1e-9) {
  return Math.abs(a - b) <= tolerance;
}

// Independent scientific reference fixture for all 25 PHN structures
const PHN_INDEPENDENT_FIXTURE = {
  // Heart valves
  ANN: { alpha: 0.50, mean: 1.48, sd: 0.14, unit: 'cm', group: 'Heart valves' },
  MV_AP: { alpha: 0.50, mean: 2.31, sd: 0.24, unit: 'cm', group: 'Heart valves' },
  MV_LAT: { alpha: 0.50, mean: 2.23, sd: 0.22, unit: 'cm', group: 'Heart valves' },
  TV_AP: { alpha: 0.50, mean: 2.36, sd: 0.28, unit: 'cm', group: 'Heart valves' },
  TV_LAT: { alpha: 0.50, mean: 2.36, sd: 0.29, unit: 'cm', group: 'Heart valves' },
  PV_SAX: { alpha: 0.50, mean: 1.91, sd: 0.24, unit: 'cm', group: 'Heart valves' },
  PV_LAX: { alpha: 0.50, mean: 2.01, sd: 0.28, unit: 'cm', group: 'Heart valves' },

  // Aorta and aortic arch
  ROOT: { alpha: 0.50, mean: 2.06, sd: 0.18, unit: 'cm', group: 'Aorta and aortic arch' },
  STJ: { alpha: 0.50, mean: 1.69, sd: 0.16, unit: 'cm', group: 'Aorta and aortic arch' },
  AAO: { alpha: 0.50, mean: 1.79, sd: 0.18, unit: 'cm', group: 'Aorta and aortic arch' },
  ARCH_PROX: { alpha: 0.50, mean: 1.53, sd: 0.23, unit: 'cm', group: 'Aorta and aortic arch' },
  ARCH_DIST: { alpha: 0.50, mean: 1.36, sd: 0.19, unit: 'cm', group: 'Aorta and aortic arch' },
  ISTH: { alpha: 0.50, mean: 1.25, sd: 0.18, unit: 'cm', group: 'Aorta and aortic arch' },

  // Coronary arteries (native unit: mm)
  LMCA: { alpha: 0.45, mean: 2.95, sd: 0.57, unit: 'mm', group: 'Coronary arteries' },
  LAD: { alpha: 0.45, mean: 1.90, sd: 0.34, unit: 'mm', group: 'Coronary arteries' },
  RCA: { alpha: 0.45, mean: 2.32, sd: 0.55, unit: 'mm', group: 'Coronary arteries' },

  // Pulmonary arteries
  MPA: { alpha: 0.50, mean: 1.82, sd: 0.24, unit: 'cm', group: 'Pulmonary arteries' },
  LPA: { alpha: 0.50, mean: 1.10, sd: 0.18, unit: 'cm', group: 'Pulmonary arteries' },
  RPA: { alpha: 0.50, mean: 1.07, sd: 0.18, unit: 'cm', group: 'Pulmonary arteries' },

  // Left ventricular dimensions
  LVEDD: { alpha: 0.45, mean: 3.89, sd: 0.33, unit: 'cm', group: 'Left ventricular dimensions' },
  LVESD: { alpha: 0.50, mean: 2.675, sd: 0.352, unit: 'cm', group: 'Left ventricular dimensions' },
  LVPWT: { alpha: 0.40, mean: 0.57, sd: 0.09, unit: 'cm', group: 'Left ventricular dimensions' },
  LVST: { alpha: 0.40, mean: 0.58, sd: 0.09, unit: 'cm', group: 'Left ventricular dimensions' },
  LVEDL: { alpha: 0.45, mean: 6.31, sd: 0.46, unit: 'cm', group: 'Left ventricular dimensions' },
  LVEDL_EPI: { alpha: 0.45, mean: 6.87, sd: 0.45, unit: 'cm', group: 'Left ventricular dimensions' }
};

const PETTERSEN_TABLE_2 = {
  RVDD: { b0: -0.317, b1: 1.850, b2: -1.274, b3: 0.335, mse: 0.058 },
  IVSD: { b0: -1.242, b1: 1.272, b2: -0.762, b3: 0.208, mse: 0.046 },
  IVSS: { b0: -1.048, b1: 1.751, b2: -1.177, b3: 0.318, mse: 0.034 },
  LVIDD: { b0: 0.105, b1: 2.859, b2: -2.119, b3: 0.552, mse: 0.010 },
  LVIDS: { b0: -0.371, b1: 2.833, b2: -2.081, b3: 0.538, mse: 0.016 },
  LVPWD: { b0: -1.586, b1: 1.849, b2: -1.188, b3: 0.313, mse: 0.037 },
  LVPWS: { b0: -0.947, b1: 1.907, b2: -1.259, b3: 0.330, mse: 0.023 },
  AOV_ANN: { b0: -0.874, b1: 2.708, b2: -1.841, b3: 0.452, mse: 0.010 },
  SOV: { b0: -0.500, b1: 2.537, b2: -1.707, b3: 0.420, mse: 0.012 },
  STJ: { b0: -0.759, b1: 2.643, b2: -1.797, b3: 0.442, mse: 0.018 },
  TRANSVERSE_ARCH: { b0: -0.790, b1: 3.020, b2: -2.484, b3: 0.712, mse: 0.023 },
  AORTIC_ISTHMUS: { b0: -1.072, b1: 2.539, b2: -1.627, b3: 0.368, mse: 0.027 },
  DISTAL_ARCH: { b0: -0.976, b1: 2.469, b2: -1.746, b3: 0.445, mse: 0.026 },
  AORTA_DIAPHRAGM: { b0: -0.922, b1: 2.100, b2: -1.411, b3: 0.371, mse: 0.018 },
  PV_ANN: { b0: -0.761, b1: 2.774, b2: -1.808, b3: 0.436, mse: 0.023 },
  MPA: { b0: -0.707, b1: 2.746, b2: -1.807, b3: 0.424, mse: 0.024 },
  RPA: { b0: -1.360, b1: 3.394, b2: -2.508, b3: 0.660, mse: 0.027 },
  LPA: { b0: -1.348, b1: 2.884, b2: -1.954, b3: 0.466, mse: 0.028 },
  MV_ANN: { b0: -0.271, b1: 2.446, b2: -1.700, b3: 0.425, mse: 0.022 },
  TV_ANN: { b0: -0.164, b1: 2.341, b2: -1.596, b3: 0.387, mse: 0.036 },
  LA: { b0: -0.208, b1: 2.164, b2: -1.597, b3: 0.429, mse: 0.020 }
};

function referencePettersenMeanLn(bsa, coeff) {
  return coeff.b0 + coeff.b1 * bsa + coeff.b2 * Math.pow(bsa, 2) + coeff.b3 * Math.pow(bsa, 3);
}

function referencePettersenTargetMm(bsa, targetZ, coeff) {
  return Math.exp(referencePettersenMeanLn(bsa, coeff) + targetZ * Math.sqrt(coeff.mse)) * 10;
}

function referencePettersenZScore(measuredMm, bsa, coeff) {
  return (Math.log(measuredMm / 10) - referencePettersenMeanLn(bsa, coeff)) / Math.sqrt(coeff.mse);
}

function run() {
  // 1) Structure count and default structure preservation
  assert.strictEqual(phn.PHN_STRUCTURE_ORDER.length, 25, 'PHN should have exactly 25 structures in Phase 1');
  assert.strictEqual(phn.PHN_STRUCTURE_ORDER[0], 'ANN', 'First structure in PHN_STRUCTURE_ORDER must remain default ANN');

  // 2) Independent fixture parity for all 25 structures
  assert.deepStrictEqual(Object.keys(PHN_INDEPENDENT_FIXTURE), phn.PHN_STRUCTURE_ORDER);
  phn.PHN_STRUCTURE_ORDER.forEach((key) => {
    const actual = phn.PHN_STRUCTURES[key];
    const expected = PHN_INDEPENDENT_FIXTURE[key];
    assert(actual, `Structure ${key} should exist in PHN_STRUCTURES`);
    assert.strictEqual(actual.alpha, expected.alpha, `${key} alpha mismatch`);
    assert.strictEqual(actual.mean, expected.mean, `${key} mean mismatch`);
    assert.strictEqual(actual.sd, expected.sd, `${key} sd mismatch`);
    assert.strictEqual(actual.unit, expected.unit, `${key} unit mismatch`);
    assert.strictEqual(actual.group, expected.group, `${key} group mismatch`);
    assert.strictEqual(actual.displayUnit, 'mm', `${key} displayUnit must be mm`);
    assert(actual.referenceNote && actual.referenceNote.length > 10, `${key} must have detailed referenceNote`);
  });

  // 3) Clinical grouping distribution
  const expectedGroups = {
    'Heart valves': 7,
    'Aorta and aortic arch': 6,
    'Coronary arteries': 3,
    'Pulmonary arteries': 3,
    'Left ventricular dimensions': 6
  };
  const actualGroupCounts = {};
  phn.PHN_STRUCTURE_ORDER.forEach((key) => {
    const g = phn.PHN_STRUCTURES[key].group;
    actualGroupCounts[g] = (actualGroupCounts[g] || 0) + 1;
  });
  assert.deepStrictEqual(actualGroupCounts, expectedGroups, 'Structure distribution across the 5 clinical groups must match');

  // 4) Inverse formula checks for snapshots (handling cm vs mm native units)
  const bsaSnapshots = [0.5, 1.0, 1.5, 2.0];
  const snapshots = {};

  bsaSnapshots.forEach((bsa) => {
    snapshots[bsa.toFixed(2)] = phn.PHN_STRUCTURE_ORDER.map((key) => {
      const coeff = phn.PHN_STRUCTURES[key];
      const range = phn.calculateInverseRange(bsa, coeff);
      const factor = coeff.unit === 'mm' ? 1 : 10;
      assert(nearlyEqual(range.z0Mm, coeff.mean * Math.pow(bsa, coeff.alpha) * factor, 1e-9));
      assert(nearlyEqual(range.zNeg2Mm, (coeff.mean - 2 * coeff.sd) * Math.pow(bsa, coeff.alpha) * factor, 1e-9));
      assert(nearlyEqual(range.zPos2Mm, (coeff.mean + 2 * coeff.sd) * Math.pow(bsa, coeff.alpha) * factor, 1e-9));
      return {
        key,
        zNeg2Mm: Number(range.zNeg2Mm.toFixed(4)),
        z0Mm: Number(range.z0Mm.toFixed(4)),
        zPos2Mm: Number(range.zPos2Mm.toFixed(4))
      };
    });
  });

  // 5) Forward/inverse round-trip tests with native units
  const bsaForRoundTrip = 1.2;
  phn.PHN_STRUCTURE_ORDER.forEach((key) => {
    const coeff = phn.PHN_STRUCTURES[key];
    const range = phn.calculateInverseRange(bsaForRoundTrip, coeff);

    const z0 = phn.calculateForwardZScore(range.z0Native, bsaForRoundTrip, coeff);
    const zPos2 = phn.calculateForwardZScore(range.zPos2Native, bsaForRoundTrip, coeff);
    const zNeg2 = phn.calculateForwardZScore(range.zNeg2Native, bsaForRoundTrip, coeff);

    assert(nearlyEqual(z0, 0, 1e-12));
    assert(nearlyEqual(zPos2, 2, 1e-12));
    assert(nearlyEqual(zNeg2, -2, 1e-12));
  });

  // 6) Explicit unit conversion safety: Coronary (mm) vs Non-coronary (cm)
  // Coronary arteries (native mm) must NOT be divided or multiplied by 10
  ['LMCA', 'LAD', 'RCA'].forEach((coronaryKey) => {
    const coeff = phn.PHN_STRUCTURES[coronaryKey];
    assert.strictEqual(coeff.unit, 'mm');

    const range = phn.calculateInverseRange(1.0, coeff);
    assert.strictEqual(range.z0Mm, coeff.mean, `${coronaryKey} z0Mm at BSA 1.0 must equal mean in mm`);
    assert.strictEqual(range.z0Native, coeff.mean);
    assert.strictEqual(range.z0Cm, coeff.mean / 10);

    // Measured value of mean in mm should give Z = 0
    const z = phn.calculateModelMeasuredZScore('phnLopez', coronaryKey, coeff.mean, 1.0);
    assert(nearlyEqual(z, 0, 1e-9), `${coronaryKey} measured mean in mm must produce Z=0`);

    // Target mm calculation
    const targetMm = phn.calculatePhnTargetMm(1.0, 0, coeff);
    assert.strictEqual(targetMm, coeff.mean, `${coronaryKey} targetMm must not be multiplied by 10`);
  });

  // Non-coronary linear structures (native cm) must convert to mm correctly
  ['ROOT', 'STJ', 'AAO', 'LVEDD', 'LVESD', 'ANN'].forEach((cmKey) => {
    const coeff = phn.PHN_STRUCTURES[cmKey];
    assert.strictEqual(coeff.unit, 'cm');

    const range = phn.calculateInverseRange(1.0, coeff);
    assert.strictEqual(range.z0Native, coeff.mean);
    assert(nearlyEqual(range.z0Mm, coeff.mean * 10, 1e-9), `${cmKey} z0Mm at BSA 1.0 must equal mean * 10`);

    // Measured value in mm (mean * 10) should give Z = 0
    const z = phn.calculateModelMeasuredZScore('phnLopez', cmKey, coeff.mean * 10, 1.0);
    assert(nearlyEqual(z, 0, 1e-9), `${cmKey} measured (mean*10) mm must produce Z=0`);

    const targetMm = phn.calculatePhnTargetMm(1.0, 0, coeff);
    assert(nearlyEqual(targetMm, coeff.mean * 10, 1e-9), `${cmKey} targetMm must equal mean * 10`);
  });

  // 7) STJ cross-model equivalence test
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.STJ.phnKey, 'STJ');
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.STJ.pettersenKey, 'STJ');
  assert.strictEqual(phn.getEquivalentStructureKey('STJ', 'phnLopez'), 'STJ');
  assert.strictEqual(phn.getEquivalentStructureKey('STJ', 'detroitPettersen2008'), 'STJ');

  // Review P1: TV_AP acquisition must use the published PHN parasternal long-axis view.
  const correctTvApNote = 'Tricuspid valve anteroposterior diameter measured in parasternal long-axis view at maximal diastolic opening.';
  assert.strictEqual(phn.PHN_STRUCTURES.TV_AP.referenceNote, correctTvApNote);
  assert.strictEqual(mainJsApi.PHN_STRUCTURES.TV_AP.referenceNote, correctTvApNote);
  assert(!phn.PHN_STRUCTURES.TV_AP.referenceNote.includes('RV inflow'));

  // Review P2: keep anatomy stable when changing reference models.
  // These map only structures with clearly corresponding anatomy; coefficients stay separate.
  const newCrossModelEquivalences = [
    ['SOV', 'ROOT'],
    ['AORTIC_ISTHMUS', 'ISTH'],
    ['DISTAL_ARCH', 'ARCH_DIST'],
    ['LVIDD', 'LVEDD'],
    ['LVIDS', 'LVESD'],
    ['LVPWD', 'LVPWT'],
    ['IVSD', 'LVST']
  ];
  for (const [detroitKey, phnKey] of newCrossModelEquivalences) {
    assert.strictEqual(phn.PEDIATRIC_STRUCTURES[detroitKey].phnKey, phnKey,
      `Cross-model anatomical mapping missing for ${detroitKey}.`);
    assert.strictEqual(phn.getEquivalentStructureKey(phnKey, 'detroitPettersen2008'), detroitKey,
      `PHN to Detroit must retain equivalent anatomy ${phnKey}.`);
    assert.strictEqual(phn.getEquivalentStructureKey(detroitKey, 'phnLopez'), phnKey,
      `Detroit to PHN must retain equivalent anatomy ${detroitKey}.`);
    assert.strictEqual(mainJsApi.PEDIATRIC_STRUCTURES[detroitKey].phnKey, phnKey);
    assert.strictEqual(mainJsApi.getEquivalentStructureKey(phnKey, 'detroitPettersen2008'), detroitKey);
    assert.strictEqual(mainJsApi.getEquivalentStructureKey(detroitKey, 'phnLopez'), phnKey);
  }

  // 8) Browser bundle (main.js) parity with lib/phn.js
  assert.strictEqual(mainJsApi.PHN_STRUCTURE_ORDER.length, 25);
  phn.PHN_STRUCTURE_ORDER.forEach((key) => {
    const libCoeff = phn.PHN_STRUCTURES[key];
    const mainCoeff = mainJsApi.PHN_STRUCTURES[key];
    assert.strictEqual(mainCoeff.alpha, libCoeff.alpha);
    assert.strictEqual(mainCoeff.mean, libCoeff.mean);
    assert.strictEqual(mainCoeff.sd, libCoeff.sd);
    assert.strictEqual(mainCoeff.unit, libCoeff.unit);
    assert.strictEqual(mainCoeff.group, libCoeff.group);

    const libExpected = phn.calculateModelExpectedSizes('phnLopez', key, 1.25, 1.5);
    const mainExpected = mainJsApi.calculateModelExpectedSizes('phnLopez', key, 1.25, 1.5);
    assert(nearlyEqual(mainExpected.targetMm, libExpected.targetMm, 1e-9), `${key} main.js expected size parity`);

    const measuredInput = libCoeff.unit === 'mm' ? libCoeff.mean : libCoeff.mean * 10;
    const libZ = phn.calculateModelMeasuredZScore('phnLopez', key, measuredInput, 1.0);
    const mainZ = mainJsApi.calculateModelMeasuredZScore('phnLopez', key, measuredInput, 1.0);
    assert(nearlyEqual(mainZ, libZ, 1e-9), `${key} main.js measured Z-score parity`);
  });

  // 9) Input and warning handling
  assert.throws(() => phn.calculateInverseRange(NaN, phn.PHN_STRUCTURES.ANN));
  assert.throws(() => phn.calculateInverseRange(-1, phn.PHN_STRUCTURES.ANN));
  assert.throws(() => phn.calculateHaycockBSA('', 10));
  assert.throws(() => phn.calculateHaycockBSA(100, 0));

  const lowWarning = phn.getBsaWarnings(0.1);
  const highWarning = phn.getBsaWarnings(2.6);
  const extrapWarning = phn.getBsaWarnings(2.1);
  assert(lowWarning.some((text) => text.includes('outside the reference range')));
  assert(highWarning.some((text) => text.includes('outside the reference range')));
  assert(extrapWarning.some((text) => text.includes('extrapolation')));

  // 10) Haycock BSA deterministic example
  const haycockExample = phn.calculateHaycockBSA(110, 18);
  assert(nearlyEqual(haycockExample, 0.024265 * Math.pow(110, 0.3964) * Math.pow(18, 0.5378), 1e-12));

  // 11) Detroit / Pettersen 2008 deterministic example from the paper
  const pettersenIvsd = phn.PETTERSEN_STRUCTURES.IVSD;
  const pettersenZ = phn.calculatePettersenZScore(4, 1.4, pettersenIvsd);
  assert(nearlyEqual(pettersenZ, -2.48, 0.01));

  // 12) Pettersen uses cm internally but accepts/displays mm wrappers in this app
  const pettersenMeanMm = phn.calculatePettersenTargetMm(1.4, 0, pettersenIvsd);
  const pettersenMeanLn = phn.calculatePettersenMeanLn(1.4, pettersenIvsd);
  assert(nearlyEqual(pettersenMeanMm, Math.exp(pettersenMeanLn) * 10, 1e-9));

  // 13) PHN target reverse calculation remains the existing inverse range at Z = 0
  const phnAnnTarget0 = phn.calculatePhnTargetMm(1.2, 0, phn.PHN_STRUCTURES.ANN);
  const phnAnnRange = phn.calculateInverseRange(1.2, phn.PHN_STRUCTURES.ANN);
  assert(nearlyEqual(phnAnnTarget0, phnAnnRange.z0Mm, 1e-9));

  // 14) Higher target Z-scores produce larger expected Pettersen sizes
  const pettersenNeg1 = phn.calculatePettersenTargetMm(1.4, -1, pettersenIvsd);
  const pettersenPos1 = phn.calculatePettersenTargetMm(1.4, 1, pettersenIvsd);
  assert(pettersenPos1 > pettersenMeanMm);
  assert(pettersenMeanMm > pettersenNeg1);

  // 15) Missing model availability is explicit in the shared structure map
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.RVDD.phnKey, null);
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.AOV_ANN.pettersenKey, 'AOV_ANN');

  // 16) Selected-model data only exposes supported structures per model
  const phnModelKeys = phn.zScoreModels.phnLopez.structures.map((item) => item.key);
  const detroitModelKeys = phn.zScoreModels.detroitPettersen2008.structures.map((item) => item.key);
  assert.deepStrictEqual(phnModelKeys, phn.PHN_STRUCTURE_ORDER);
  assert(!phnModelKeys.includes('IVSD'));
  assert(detroitModelKeys.includes('IVSD'));
  assert(phn.zScoreModels.detroitPettersen2008.structures.every((item) => item.coefficients && Number.isFinite(item.coefficients.mse)));

  // 17) Selected-model target sizing preserves PHN math and Pettersen monotonic behavior
  const phnModelMpa = phn.calculateModelExpectedSizes('phnLopez', 'MPA', 1.2, 0);
  const phnMpaRange = phn.calculateInverseRange(1.2, phn.PHN_STRUCTURES.MPA);
  assert(nearlyEqual(phnModelMpa.z0Mm, phnMpaRange.z0Mm, 1e-9));
  const detroitIvsdExpected = phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', 1.4, 0);
  assert(detroitIvsdExpected.zPos2Mm > detroitIvsdExpected.z0Mm);
  assert(detroitIvsdExpected.z0Mm > detroitIvsdExpected.zNeg2Mm);

  // 18) Selected-model measured Z-score uses the selected model only
  assert(nearlyEqual(phn.calculateModelMeasuredZScore('detroitPettersen2008', 'IVSD', 4, 1.4), -2.48, 0.01));
  assert.throws(() => phn.calculateModelMeasuredZScore('phnLopez', 'IVSD', 4, 1.4));

  // 19) Model range notes and Detroit BSA guard rules are model-specific and blocking only for Detroit.
  assert(phn.selectedModelRangeNote.phnLopez.includes('healthy, non-obese pediatric subjects up to 18 years'));
  assert(phn.selectedModelRangeNote.detroitPettersen2008.includes('BSA ≤2.0 m²'));
  assert.strictEqual(phn.isDetroitPettersenOutOfRange('detroitPettersen2008', 2.0), false);
  assert.strictEqual(phn.isDetroitPettersenOutOfRange('detroitPettersen2008', 2.0001), true);
  assert.strictEqual(phn.isDetroitPettersenOutOfRange('phnLopez', 2.5), false);
  assert.strictEqual(phn.shouldShowDetroitBsaWarning('detroitPettersen2008', 2.0), false);
  assert.strictEqual(phn.shouldShowDetroitBsaWarning('detroitPettersen2008', 2.0001), true);
  assert.strictEqual(phn.shouldShowDetroitBsaWarning('phnLopez', 2.5), false);
  const detroitModelWarnings = phn.getModelBsaWarnings('detroitPettersen2008', 2.1);
  assert(detroitModelWarnings.some((text) => text.includes('not calculated above BSA 2.0 m²')));
  assert(!detroitModelWarnings.some((text) => text.includes('PHN')));
  assert.deepStrictEqual(phn.getModelBsaWarnings('detroitPettersen2008', 2.0), []);
  const phnModelWarnings = phn.getModelBsaWarnings('phnLopez', 2.1);
  assert(phnModelWarnings.some((text) => text.includes('PHN / Lopez was developed')));
  assert(!phnModelWarnings.some((text) => text.includes('Detroit')));
  assert.deepStrictEqual(phn.getModelBsaWarnings('', 2.1), []);
  assert(Number.isFinite(phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', 2.0, 0).z0Mm));
  assert.throws(() => phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', 2.0001, 0), /not calculated above BSA 2.0/);
  assert.throws(() => phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', 2.5, 0), /not calculated above BSA 2.0/);
  assert.throws(() => phn.calculateModelMeasuredZScore('detroitPettersen2008', 'IVSD', 4, 2.0001), /not calculated above BSA 2.0/);
  assert(Number.isFinite(phn.calculateModelExpectedSizes('phnLopez', 'MPA', 2.5, 0).z0Mm));

  // 20) Model switching preserves anatomically equivalent mapped structures when keys differ
  assert.strictEqual(phn.getEquivalentStructureKey('ANN', 'detroitPettersen2008'), 'AOV_ANN');
  assert.strictEqual(phn.getEquivalentStructureKey('AOV_ANN', 'phnLopez'), 'ANN');
  assert.strictEqual(phn.getEquivalentStructureKey('MPA', 'detroitPettersen2008'), 'MPA');
  assert.strictEqual(phn.getEquivalentStructureKey('IVSD', 'phnLopez'), 'LVST');
  assert.strictEqual(phn.getEquivalentStructureKey('RVDD', 'phnLopez'), phn.PHN_STRUCTURE_ORDER[0]);
  const mappedAnnKey = phn.getEquivalentStructureKey('ANN', 'detroitPettersen2008');
  const mappedAnnStructure = phn.zScoreModels.detroitPettersen2008.structures.find((item) => item.key === mappedAnnKey);
  assert.strictEqual(mappedAnnStructure.label, 'Aortic valve annulus');
  assert(Number.isFinite(phn.calculateModelExpectedSizes('detroitPettersen2008', mappedAnnKey, 1.0, 0).z0Mm));

  // 21) Pettersen Table 2 coefficient parity, including signs.
  assert.deepStrictEqual(Object.keys(PETTERSEN_TABLE_2), phn.PEDIATRIC_STRUCTURE_ORDER);
  phn.PEDIATRIC_STRUCTURE_ORDER.forEach((key) => {
    const actual = phn.PETTERSEN_STRUCTURES[key];
    const expected = PETTERSEN_TABLE_2[key];
    ['b0', 'b1', 'b2', 'b3', 'mse'].forEach((field) => {
      assert.strictEqual(actual[field], expected[field], `${key} ${field} should match Pettersen Table 2`);
    });
  });

  // 22) Pettersen canonical example from the paper: IVSd, BSA 1.4, observed 4 mm.
  const canonicalMeanLn = phn.calculatePettersenMeanLn(1.4, phn.PETTERSEN_STRUCTURES.IVSD);
  const canonicalZ = phn.calculatePettersenZScore(4, 1.4, phn.PETTERSEN_STRUCTURES.IVSD);
  assert(nearlyEqual(canonicalMeanLn, -0.383968, 1e-12));
  assert(nearlyEqual(canonicalZ, -2.4819675350413433, 1e-12));
  assert.strictEqual(canonicalZ.toFixed(2), '-2.48');

  // 23) Pettersen roundtrip invariants from an independent reference function.
  phn.PEDIATRIC_STRUCTURE_ORDER.forEach((key) => {
    [0.2, 1.0, 2.0].forEach((bsa) => {
      const coeff = PETTERSEN_TABLE_2[key];
      const zNeg2Mm = referencePettersenTargetMm(bsa, -2, coeff);
      const z0Mm = referencePettersenTargetMm(bsa, 0, coeff);
      const zPos2Mm = referencePettersenTargetMm(bsa, 2, coeff);
      assert(Number.isFinite(zNeg2Mm) && zNeg2Mm > 0, `${key} z=-2 expected size should be positive finite`);
      assert(Number.isFinite(z0Mm) && z0Mm > 0, `${key} z=0 expected size should be positive finite`);
      assert(Number.isFinite(zPos2Mm) && zPos2Mm > 0, `${key} z=+2 expected size should be positive finite`);
      assert(zNeg2Mm < z0Mm && z0Mm < zPos2Mm, `${key} expected sizes should be ordered at BSA ${bsa}`);
      [-2, -1, 0, 1, 2].forEach((targetZ) => {
        const targetMm = referencePettersenTargetMm(bsa, targetZ, coeff);
        assert(nearlyEqual(referencePettersenZScore(targetMm, bsa, coeff), targetZ, 1e-12), `${key} should roundtrip z=${targetZ} at BSA ${bsa}`);
      });
    });
  });

  // 24) Pettersen low-level formula remains available for audited math, but selected model guards extrapolation.
  assert(Number.isFinite(phn.calculatePettersenTargetMm(2.0001, 0, phn.PETTERSEN_STRUCTURES.IVSD)));
  assert.throws(() => phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', 0, 0));
  assert.throws(() => phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', -1, 0));
  assert.throws(() => phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', NaN, 0));
  assert.throws(() => phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', Infinity, 0));

  // 25) Clinical measurement notes & citation provenance
  ['ROOT', 'STJ', 'AAO'].forEach((aortaKey) => {
    const note = phn.PHN_STRUCTURES[aortaKey].referenceNote;
    assert(note.includes('mid-systole'), `${aortaKey} note must specify mid-systole per PHN protocol`);
    assert(note.includes('inner-edge to inner-edge'), `${aortaKey} note must specify inner-edge to inner-edge`);
    assert(!note.includes('end-diastole'), `${aortaKey} note must not claim adult end-diastole convention`);
  });
  ['ARCH_PROX', 'ARCH_DIST', 'ISTH'].forEach((archKey) => {
    const note = phn.PHN_STRUCTURES[archKey].referenceNote;
    assert(note.includes('inner-edge to inner-edge'), `${archKey} note must specify inner-edge to inner-edge`);
  });
  assert(phn.PHN_STRUCTURES.LVESD.referenceNote.includes('Lopez et al. JASE 2021 Table 3'), 'LVESD note must attribute 2021 PHN model');
  ['LMCA', 'LAD', 'RCA'].forEach((coronaryKey) => {
    const note = phn.PHN_STRUCTURES[coronaryKey].referenceNote;
    assert(note.includes('native unit: mm'), `${coronaryKey} note must state native unit: mm`);
  });

  // 26) Regression coefficients & provenance (published Lopez 2017 Table 2 vs Lopez 2021 Table 3)
  assert.strictEqual(phn.PHN_REGRESSION.LVESD, null, 'LVESD in PHN_REGRESSION must be null because Lopez 2021 Table 3 published only the indexed Z-score model');
  assert.strictEqual(mainJsApi.PHN_REGRESSION.LVESD, null, 'main.js LVESD in PHN_REGRESSION must be null');
  assert.strictEqual(phn.calculateRegressionReferenceCm(1.0, phn.PHN_REGRESSION.LVESD), null, 'calculateRegressionReferenceCm must return null when regressionCoeff is null');
  assert.strictEqual(phn.calculateRegressionReferenceCm(1.0, null), null, 'calculateRegressionReferenceCm must return null on null input');
  assert.strictEqual(mainJsApi.calculateRegressionReferenceCm(1.0, null), null, 'main.js calculateRegressionReferenceCm must return null on null input');

  // Verify that all other 24 structures in PHN_REGRESSION have valid numeric coefficients
  phn.PHN_STRUCTURE_ORDER.filter((k) => k !== 'LVESD').forEach((key) => {
    const reg = phn.PHN_REGRESSION[key];
    assert(reg, `PHN_REGRESSION should have entry for ${key}`);
    assert(Number.isFinite(reg.alpha), `${key} regression alpha must be finite`);
    assert(Number.isFinite(reg.intercept), `${key} regression intercept must be finite`);
    assert(Number.isFinite(reg.slope), `${key} regression slope must be finite`);
    const regVal = phn.calculateRegressionReferenceCm(1.0, reg);
    assert(Number.isFinite(regVal), `${key} calculateRegressionReferenceCm must return finite number`);
  });

  // 27) Nonphysical predicted size rejection
  // LVPWT at BSA 1.0 m2 with target Z = -10 produces (0.57 + (-10 * 0.09)) * 10 = -3.3 mm
  assert.throws(
    () => phn.calculatePhnTargetMm(1.0, -10, phn.PHN_STRUCTURES.LVPWT),
    (err) => err instanceof RangeError && err.message.includes('non-positive or out of physical range'),
    'calculatePhnTargetMm must throw RangeError when predicted dimension is non-positive'
  );
  assert.throws(
    () => mainJsApi.calculatePhnTargetMm(1.0, -10, mainJsApi.PHN_STRUCTURES.LVPWT),
    (err) => err instanceof RangeError && err.message.includes('non-positive or out of physical range'),
    'mainJsApi.calculatePhnTargetMm must throw RangeError when predicted dimension is non-positive'
  );

  const lvpwtExpected = phn.calculateModelExpectedSizes('phnLopez', 'LVPWT', 1.0, -10);
  assert.strictEqual(lvpwtExpected.targetMm, null, 'calculateModelExpectedSizes should set targetMm to null on RangeError');
  assert.strictEqual(lvpwtExpected.targetOutOfRange, true, 'calculateModelExpectedSizes should flag targetOutOfRange');
  assert.strictEqual(lvpwtExpected.zNeg2OutOfRange, false, 'zNeg2 is within physical range for LVPWT');
  assert(nearlyEqual(lvpwtExpected.zNeg2Mm, 3.9, 1e-9), 'zNeg2Mm remains valid for LVPWT');
  assert(nearlyEqual(lvpwtExpected.z0Mm, 5.7, 1e-9), 'z0Mm remains valid for LVPWT');
  assert(nearlyEqual(lvpwtExpected.zPos2Mm, 7.5, 1e-9), 'zPos2Mm remains valid for LVPWT');

  // Valid negative Z-score must calculate properly without throwing
  const lvpwtValidNeg = phn.calculatePhnTargetMm(1.0, -1.5, phn.PHN_STRUCTURES.LVPWT);
  assert(nearlyEqual(lvpwtValidNeg, (0.57 - 1.5 * 0.09) * 10, 1e-9), 'Valid negative Z-score produces correct positive dimension');
  assert(lvpwtValidNeg > 0, 'Predicted size must be positive');

  // clampToDisplayMm checks
  assert.strictEqual(phn.clampToDisplayMm(5.0), 5.0);
  assert.strictEqual(phn.clampToDisplayMm(-2.0), 0);

  // 28) DOM & runtime browser interaction tests
  testPhnBrowserDomInteraction();

  console.log('PHN snapshots (mm):');
  console.log(JSON.stringify(snapshots, null, 2));
  console.log('All PHN tests passed.');
}

function testPhnBrowserDomInteraction() {
  const mainJsSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

  const elements = {};
  function makeEl(id, tagName = 'div') {
    const listeners = {};
    const el = {
      id,
      tagName: tagName.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        toggle(c, force) {
          if (force !== undefined) {
            force ? this.add(c) : this.remove(c);
          } else {
            this._classes.has(c) ? this.remove(c) : this.add(c);
          }
        },
        contains(c) { return this._classes.has(c); }
      },
      children: [],
      appendChild(child) { this.children.push(child); return child; },
      addEventListener(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      dispatch(event) {
        (listeners[event] || []).forEach((fn) => fn({ target: el }));
      }
    };
    elements[id] = el;
    return el;
  }

  [
    'phn-error', 'phn-warnings', 'phn-results', 'phn-results-wrapper', 'phn-debug-panel', 'phn-debug-output',
    'phn-bsa-display', 'phn-bsa-input', 'phn-model-range-note', 'phn-model-consistency-note',
    'phn-model-bsa-warning', 'phn-structure-definition', 'phn-result-model', 'phn-result-structure',
    'phn-result-bsa', 'phn-target-z-label', 'phn-expected-neg2', 'phn-expected-zero', 'phn-expected-pos2',
    'phn-expected-target', 'phn-measured-z', 'phn-measured-help', 'phn-height-cm', 'phn-weight-kg',
    'phn-bsa-method', 'phn-calculated-bsa', 'phn-calc-bsa-btn', 'phn-use-bsa-btn'
  ].forEach((id) => makeEl(id));

  makeEl('phn-model-select', 'select');
  makeEl('phn-structure-select', 'select');
  makeEl('phn-target-z', 'input');
  makeEl('phn-measured-mm', 'input');

  const context = {
    window: { location: { hostname: 'localhost' } },
    document: {
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => makeEl('anon_' + Math.random(), tag),
      addEventListener: () => {}
    },
    el: (id) => elements[id] || null,
    hasPhnEchoCalculator: true,
    computeBSA: () => 1.0,
    Math, Number, String, Boolean, Error, RangeError, console
  };
  context.window.window = context.window;
  context.window.document = context.document;

  const start = mainJsSource.indexOf('const PHN_STRUCTURE_ORDER =');
  const end = mainJsSource.indexOf('function getActivePath()');
  const regStart = mainJsSource.indexOf('if (hasPhnEchoCalculator) {');
  const regEnd = mainJsSource.indexOf('if (hasHctCalculator) {');
  assert(start >= 0 && end > start && regStart > 0 && regEnd > regStart, 'PHN blocks must be extractable');

  vm.runInNewContext(
    mainJsSource.slice(start, end) + '\n' + mainJsSource.slice(regStart, regEnd),
    context
  );

  // A. Option population check: exactly 25 structures grouped into 5 groups
  assert.strictEqual(elements['phn-model-select'].children.length, 2, 'Should populate 2 reference models');
  assert.strictEqual(elements['phn-structure-select'].children.length, 5, 'PHN should have 5 optgroups');
  const totalOptions = elements['phn-structure-select'].children.reduce((acc, grp) => acc + grp.children.length, 0);
  assert.strictEqual(totalOptions, 25, 'Total PHN options across groups must be exactly 25');

  // B. Structure selection and definition updates
  elements['phn-bsa-input'].value = '1.0';
  elements['phn-bsa-input'].dispatch('input');

  elements['phn-structure-select'].value = 'ROOT';
  elements['phn-structure-select'].dispatch('input');
  assert(elements['phn-structure-definition'].textContent.includes('mid-systole (inner-edge to inner-edge)'), 'ROOT definition note in DOM must specify mid-systole');

  elements['phn-structure-select'].value = 'LMCA';
  elements['phn-structure-select'].dispatch('input');
  assert(elements['phn-structure-definition'].textContent.includes('native unit: mm'), 'LMCA definition note in DOM must specify native mm');

  elements['phn-structure-select'].value = 'LVESD';
  elements['phn-structure-select'].dispatch('input');
  assert(elements['phn-structure-definition'].textContent.includes('2021 PHN model (Lopez et al. JASE 2021 Table 3)'), 'LVESD definition note in DOM must cite 2021 paper');

  // C. Nonphysical target Z UI behavior
  elements['phn-structure-select'].value = 'LVPWT';
  elements['phn-target-z'].value = '-10';
  elements['phn-target-z'].dispatch('input');
  assert.strictEqual(elements['phn-expected-target'].textContent, 'Out of range', 'Nonphysical predicted dimension must display Out of range');
  assert.strictEqual(elements['phn-expected-zero'].textContent, '5.7 mm', 'Z=0 expected size remains valid');
  assert.strictEqual(elements['phn-error'].textContent, '', 'Expected size out-of-range should not throw unhandled error');

  // D. Model switching: clears measured value input to prevent cross-model contamination
  elements['phn-measured-mm'].value = '15.0';
  elements['phn-measured-mm'].dispatch('input');
  assert(elements['phn-measured-z'].innerHTML.includes('Calculated Z-score:'), 'Measured Z must be calculated before model switch');
  assert(!elements['phn-measured-z'].innerHTML.includes('—'), 'Measured Z must have a value before switch');

  // Switch to Detroit model
  elements['phn-model-select'].value = 'detroitPettersen2008';
  elements['phn-model-select'].dispatch('change');
  assert.strictEqual(elements['phn-measured-mm'].value, '', 'phn-measured-mm input must be cleared on model switch');
  assert(elements['phn-measured-z'].innerHTML.includes('—'), 'phn-measured-z must reset to — after model switch');
  assert.strictEqual(elements['phn-result-model'].textContent, 'Detroit / Pettersen 2008');

  // E. Debug panel output in localhost dev mode
  assert(!elements['phn-debug-panel'].classList.contains('hidden'), 'Debug panel must be visible in localhost dev mode');
  assert(elements['phn-debug-output'].textContent.includes('N/A (indexed model only)'), 'LVESD regression must be labeled as N/A (indexed model only)');
  assert(elements['phn-debug-output'].textContent.includes('inverse z0 (mm): 2.950000'), 'LMCA must be labeled with native mm in debug panel');
  assert(elements['phn-debug-output'].textContent.includes('regression ref: 2.930792 mm'), 'LMCA regression reference must have mm unit');

  // F. Structure changes clear measured value and Z-score while preserving BSA and target Z (LMCA -> ROOT and LVEDD -> LVESD)
  // Switch back to PHN model
  elements['phn-model-select'].value = 'phnLopez';
  elements['phn-model-select'].dispatch('change');

  // Setup LMCA with BSA 1.0, targetZ 1.5, measured 3.5 mm
  elements['phn-bsa-input'].value = '1.0';
  elements['phn-bsa-input'].dispatch('input');
  elements['phn-target-z'].value = '1.5';
  elements['phn-target-z'].dispatch('input');
  elements['phn-structure-select'].value = 'LMCA';
  elements['phn-structure-select'].dispatch('change');
  elements['phn-measured-mm'].value = '3.5';
  elements['phn-measured-mm'].dispatch('input');
  assert(elements['phn-measured-z'].innerHTML.includes('0.96'), 'LMCA measured Z must be calculated');

  // BSA change must NOT clear measured input
  elements['phn-bsa-input'].value = '1.2';
  elements['phn-bsa-input'].dispatch('input');
  assert.strictEqual(elements['phn-measured-mm'].value, '3.5', 'BSA change must preserve measured value');
  assert(!elements['phn-measured-z'].innerHTML.includes('—'), 'Measured Z must recalculate for new BSA');

  // Target Z change must NOT clear measured input
  elements['phn-target-z'].value = '2.0';
  elements['phn-target-z'].dispatch('input');
  assert.strictEqual(elements['phn-measured-mm'].value, '3.5', 'Target Z change must preserve measured value');

  // Transition 1: LMCA -> ROOT
  elements['phn-structure-select'].value = 'ROOT';
  elements['phn-structure-select'].dispatch('change');
  assert.strictEqual(elements['phn-measured-mm'].value, '', 'Changing from LMCA to ROOT must clear measured-value input');
  assert(elements['phn-measured-z'].innerHTML.includes('—'), 'Changing from LMCA to ROOT must clear calculated Z-score to —');
  assert(elements['phn-structure-definition'].textContent.includes('mid-systole (inner-edge to inner-edge)'), 'ROOT reference note must update');
  assert.strictEqual(elements['phn-expected-zero'].textContent, '22.6 mm', 'Expected z0 must update for ROOT at BSA 1.2');
  assert.strictEqual(elements['phn-bsa-input'].value, '1.2', 'BSA input must be preserved across structure change');
  assert.strictEqual(elements['phn-target-z'].value, '2.0', 'Target Z input must be preserved across structure change');

  // Enter measurement for LVEDD
  elements['phn-structure-select'].value = 'LVEDD';
  elements['phn-structure-select'].dispatch('change');
  assert.strictEqual(elements['phn-measured-mm'].value, '', 'Selecting LVEDD must clear measured input');
  elements['phn-measured-mm'].value = '42.0';
  elements['phn-measured-mm'].dispatch('input');
  assert(!elements['phn-measured-z'].innerHTML.includes('—'), 'LVEDD Z-score must be calculated');

  // Transition 2: LVEDD -> LVESD
  elements['phn-structure-select'].value = 'LVESD';
  elements['phn-structure-select'].dispatch('change');
  assert.strictEqual(elements['phn-measured-mm'].value, '', 'Changing from LVEDD to LVESD must clear measured-value input');
  assert(elements['phn-measured-z'].innerHTML.includes('—'), 'Changing from LVEDD to LVESD must clear calculated Z-score to —');
  assert(elements['phn-structure-definition'].textContent.includes('Lopez et al. JASE 2021 Table 3'), 'LVESD 2021 reference note must update');
  assert.strictEqual(elements['phn-bsa-input'].value, '1.2', 'BSA input must be preserved across LVEDD->LVESD');
  assert.strictEqual(elements['phn-target-z'].value, '2.0', 'Target Z input must be preserved across LVEDD->LVESD');
}

run();
