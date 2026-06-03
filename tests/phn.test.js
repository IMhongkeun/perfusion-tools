'use strict';

const assert = require('assert');
const phn = require('../lib/phn.js');

function nearlyEqual(a, b, tolerance = 1e-9) {
  return Math.abs(a - b) <= tolerance;
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

  console.log('PHN snapshots (mm):');
  console.log(JSON.stringify(snapshots, null, 2));
  console.log('All PHN tests passed.');
}

run();
