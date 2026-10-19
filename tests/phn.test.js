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
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.IVSD.phnKey, null);
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
  assert.strictEqual(phn.getEquivalentStructureKey('IVSD', 'phnLopez'), phn.PHN_STRUCTURE_ORDER[0]);
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

  console.log('PHN snapshots (mm):');
  console.log(JSON.stringify(snapshots, null, 2));
  console.log('All PHN tests passed.');
}

run();
