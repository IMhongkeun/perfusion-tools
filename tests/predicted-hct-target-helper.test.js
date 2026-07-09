'use strict';

const assert = require('assert');

function nearlyEqual(actual, expected, tolerance = 0.15) {
  return Math.abs(actual - expected) <= tolerance;
}

function computeTargetHctScenarios({ currentTotalVolume, currentRbcVolume, targetHct, rbcVolPerUnit, rbcProductHctPercent }) {
  const V = currentTotalVolume;
  const R = currentRbcVolume;
  const T = targetHct / 100;
  const P = rbcProductHctPercent / 100;
  const U = rbcVolPerUnit;

  const rbcOnlyMl = (T * V - R) / (P - T);
  const neutralRbcMl = (T * V - R) / P;
  const hfUfOnlyMl = V - (R / T);

  return {
    rbcOnly: {
      requiredRbcMl: rbcOnlyMl,
      requiredUnits: rbcOnlyMl / U,
      expectedHct: ((R + P * rbcOnlyMl) / (V + rbcOnlyMl)) * 100
    },
    neutral: {
      requiredRbcMl: neutralRbcMl,
      requiredHfUfMl: neutralRbcMl,
      requiredUnits: neutralRbcMl / U,
      expectedHct: ((R + P * neutralRbcMl) / V) * 100
    },
    hfUfOnly: {
      requiredRemovalMl: hfUfOnlyMl,
      expectedHct: (R / (V - hfUfOnlyMl)) * 100
    }
  };
}

function run() {
  const result = computeTargetHctScenarios({
    currentTotalVolume: 5050,
    currentRbcVolume: 1262.5,
    targetHct: 27,
    rbcVolPerUnit: 300,
    rbcProductHctPercent: 60
  });

  assert(nearlyEqual(result.rbcOnly.requiredRbcMl, 306.1), `RBC only mL expected 306.1, got ${result.rbcOnly.requiredRbcMl}`);
  assert(nearlyEqual(result.rbcOnly.requiredUnits, 1.02, 0.02), `RBC only units expected 1.02, got ${result.rbcOnly.requiredUnits}`);
  assert(nearlyEqual(result.rbcOnly.expectedHct, 27, 0.05), `RBC only Hct expected 27%, got ${result.rbcOnly.expectedHct}`);

  assert(nearlyEqual(result.neutral.requiredRbcMl, 168.3), `Neutral RBC mL expected 168.3, got ${result.neutral.requiredRbcMl}`);
  assert(nearlyEqual(result.neutral.requiredHfUfMl, 168.3), `Neutral HF/UF expected 168.3, got ${result.neutral.requiredHfUfMl}`);
  assert(nearlyEqual(result.neutral.requiredUnits, 0.56, 0.02), `Neutral units expected 0.56, got ${result.neutral.requiredUnits}`);
  assert(nearlyEqual(result.neutral.expectedHct, 27, 0.05), `Neutral Hct expected 27%, got ${result.neutral.expectedHct}`);

  assert(nearlyEqual(result.hfUfOnly.requiredRemovalMl, 374.1), `HF/UF only removal expected 374.1, got ${result.hfUfOnly.requiredRemovalMl}`);
  assert(nearlyEqual(result.hfUfOnly.expectedHct, 27, 0.05), `HF/UF only Hct expected 27%, got ${result.hfUfOnly.expectedHct}`);

  console.log('All predicted Hct target helper tests passed.');
}

run();
