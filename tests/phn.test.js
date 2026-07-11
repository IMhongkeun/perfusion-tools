'use strict';

const assert = require('assert');
const phn = require('../lib/phn.js');

function nearlyEqual(a, b, tolerance = 1e-9) {
  return Math.abs(a - b) <= tolerance;
}

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
  // 1) Inverse formula checks for snapshots
  const bsaSnapshots = [0.5, 1.0, 1.5, 2.0];
  const snapshots = {};

  bsaSnapshots.forEach((bsa) => {
    snapshots[bsa.toFixed(2)] = phn.PHN_STRUCTURE_ORDER.map((key) => {
      const coeff = phn.PHN_STRUCTURES[key];
      const range = phn.calculateInverseRange(bsa, coeff);
      assert(nearlyEqual(range.z0Mm, coeff.mean * Math.pow(bsa, coeff.alpha) * 10, 1e-9));
      assert(nearlyEqual(range.zNeg2Mm, (coeff.mean - 2 * coeff.sd) * Math.pow(bsa, coeff.alpha) * 10, 1e-9));
      assert(nearlyEqual(range.zPos2Mm, (coeff.mean + 2 * coeff.sd) * Math.pow(bsa, coeff.alpha) * 10, 1e-9));
      return {
        key,
        zNeg2Mm: Number(range.zNeg2Mm.toFixed(4)),
        z0Mm: Number(range.z0Mm.toFixed(4)),
        zPos2Mm: Number(range.zPos2Mm.toFixed(4))
      };
    });
  });

  // 2) Forward/inverse round-trip tests
  const bsaForRoundTrip = 1.2;
  phn.PHN_STRUCTURE_ORDER.forEach((key) => {
    const coeff = phn.PHN_STRUCTURES[key];
    const range = phn.calculateInverseRange(bsaForRoundTrip, coeff);

    const z0 = phn.calculateForwardZScore(range.z0Cm, bsaForRoundTrip, coeff);
    const zPos2 = phn.calculateForwardZScore(range.zPos2Cm, bsaForRoundTrip, coeff);
    const zNeg2 = phn.calculateForwardZScore(range.zNeg2Cm, bsaForRoundTrip, coeff);

    assert(nearlyEqual(z0, 0, 1e-12));
    assert(nearlyEqual(zPos2, 2, 1e-12));
    assert(nearlyEqual(zNeg2, -2, 1e-12));
  });

  // 3) Input and warning handling
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

  // 4) Haycock BSA deterministic example
  const haycockExample = phn.calculateHaycockBSA(110, 18);
  assert(nearlyEqual(haycockExample, 0.024265 * Math.pow(110, 0.3964) * Math.pow(18, 0.5378), 1e-12));

  // 5) Detroit / Pettersen 2008 deterministic example from the paper
  const pettersenIvsd = phn.PETTERSEN_STRUCTURES.IVSD;
  const pettersenZ = phn.calculatePettersenZScore(4, 1.4, pettersenIvsd);
  assert(nearlyEqual(pettersenZ, -2.48, 0.01));

  // 6) Pettersen uses cm internally but accepts/displays mm wrappers in this app
  const pettersenMeanMm = phn.calculatePettersenTargetMm(1.4, 0, pettersenIvsd);
  const pettersenMeanLn = phn.calculatePettersenMeanLn(1.4, pettersenIvsd);
  assert(nearlyEqual(pettersenMeanMm, Math.exp(pettersenMeanLn) * 10, 1e-9));

  // 7) PHN target reverse calculation remains the existing inverse range at Z = 0
  const phnAnnTarget0 = phn.calculatePhnTargetMm(1.2, 0, phn.PHN_STRUCTURES.ANN);
  const phnAnnRange = phn.calculateInverseRange(1.2, phn.PHN_STRUCTURES.ANN);
  assert(nearlyEqual(phnAnnTarget0, phnAnnRange.z0Mm, 1e-9));

  // 8) Higher target Z-scores produce larger expected Pettersen sizes
  const pettersenNeg1 = phn.calculatePettersenTargetMm(1.4, -1, pettersenIvsd);
  const pettersenPos1 = phn.calculatePettersenTargetMm(1.4, 1, pettersenIvsd);
  assert(pettersenPos1 > pettersenMeanMm);
  assert(pettersenMeanMm > pettersenNeg1);

  // 9) Missing model availability is explicit in the shared structure map
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.IVSD.phnKey, null);
  assert.strictEqual(phn.PEDIATRIC_STRUCTURES.AOV_ANN.pettersenKey, 'AOV_ANN');

  // 10) Selected-model data only exposes supported structures per model
  const phnModelKeys = phn.zScoreModels.phnLopez.structures.map((item) => item.key);
  const detroitModelKeys = phn.zScoreModels.detroitPettersen2008.structures.map((item) => item.key);
  assert.deepStrictEqual(phnModelKeys, phn.PHN_STRUCTURE_ORDER);
  assert(!phnModelKeys.includes('IVSD'));
  assert(detroitModelKeys.includes('IVSD'));
  assert(phn.zScoreModels.detroitPettersen2008.structures.every((item) => item.coefficients && Number.isFinite(item.coefficients.mse)));

  // 11) Selected-model target sizing preserves PHN math and Pettersen monotonic behavior
  const phnModelMpa = phn.calculateModelExpectedSizes('phnLopez', 'MPA', 1.2, 0);
  const phnMpaRange = phn.calculateInverseRange(1.2, phn.PHN_STRUCTURES.MPA);
  assert(nearlyEqual(phnModelMpa.z0Mm, phnMpaRange.z0Mm, 1e-9));
  const detroitIvsdExpected = phn.calculateModelExpectedSizes('detroitPettersen2008', 'IVSD', 1.4, 0);
  assert(detroitIvsdExpected.zPos2Mm > detroitIvsdExpected.z0Mm);
  assert(detroitIvsdExpected.z0Mm > detroitIvsdExpected.zNeg2Mm);

  // 12) Selected-model measured Z-score uses the selected model only
  assert(nearlyEqual(phn.calculateModelMeasuredZScore('detroitPettersen2008', 'IVSD', 4, 1.4), -2.48, 0.01));
  assert.throws(() => phn.calculateModelMeasuredZScore('phnLopez', 'IVSD', 4, 1.4));

  // 13) Model range notes and Detroit BSA guard rules are model-specific and blocking only for Detroit.
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

  // 14) Model switching preserves anatomically equivalent mapped structures when keys differ
  assert.strictEqual(phn.getEquivalentStructureKey('ANN', 'detroitPettersen2008'), 'AOV_ANN');
  assert.strictEqual(phn.getEquivalentStructureKey('AOV_ANN', 'phnLopez'), 'ANN');
  assert.strictEqual(phn.getEquivalentStructureKey('MPA', 'detroitPettersen2008'), 'MPA');
  assert.strictEqual(phn.getEquivalentStructureKey('IVSD', 'phnLopez'), phn.PHN_STRUCTURE_ORDER[0]);
  const mappedAnnKey = phn.getEquivalentStructureKey('ANN', 'detroitPettersen2008');
  const mappedAnnStructure = phn.zScoreModels.detroitPettersen2008.structures.find((item) => item.key === mappedAnnKey);
  assert.strictEqual(mappedAnnStructure.label, 'Aortic valve annulus');
  assert(Number.isFinite(phn.calculateModelExpectedSizes('detroitPettersen2008', mappedAnnKey, 1.0, 0).z0Mm));



  // 15) Pettersen Table 2 coefficient parity, including signs.
  assert.deepStrictEqual(Object.keys(PETTERSEN_TABLE_2), phn.PEDIATRIC_STRUCTURE_ORDER);
  phn.PEDIATRIC_STRUCTURE_ORDER.forEach((key) => {
    const actual = phn.PETTERSEN_STRUCTURES[key];
    const expected = PETTERSEN_TABLE_2[key];
    ['b0', 'b1', 'b2', 'b3', 'mse'].forEach((field) => {
      assert.strictEqual(actual[field], expected[field], `${key} ${field} should match Pettersen Table 2`);
    });
  });

  // 16) Pettersen canonical example from the paper: IVSd, BSA 1.4, observed 4 mm.
  const canonicalMeanLn = phn.calculatePettersenMeanLn(1.4, phn.PETTERSEN_STRUCTURES.IVSD);
  const canonicalZ = phn.calculatePettersenZScore(4, 1.4, phn.PETTERSEN_STRUCTURES.IVSD);
  assert(nearlyEqual(canonicalMeanLn, -0.383968, 1e-12));
  assert(nearlyEqual(canonicalZ, -2.4819675350413433, 1e-12));
  assert.strictEqual(canonicalZ.toFixed(2), '-2.48');

  // 17) Pettersen roundtrip invariants from an independent reference function.
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

  // 18) Pettersen low-level formula remains available for audited math, but selected model guards extrapolation.
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
