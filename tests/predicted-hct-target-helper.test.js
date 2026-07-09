'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function nearlyEqual(actual, expected, tolerance = 0.15) {
  return Math.abs(actual - expected) <= tolerance;
}

function computeOnPumpHctAdjustment({ weightKg, ebvCoefValue, primeVolume, netIoChange = 0, currentHct, addedCrystalloid = 0, rbcUnits = 0, rbcUnitVol = 300, rbcUnitHct = 60, ultrafiltrationRemoved = 0 }) {
  const ebv = weightKg * ebvCoefValue;
  const baseCpbVolume = ebv + primeVolume;
  const currentTotalVolume = baseCpbVolume + netIoChange;
  const totalRbcProductVolume = rbcUnits * rbcUnitVol;
  const currentRbcVolume = currentTotalVolume * (currentHct / 100);
  const addedRbcVolume = totalRbcProductVolume * (rbcUnitHct / 100);
  const finalTotalVolume = currentTotalVolume + addedCrystalloid + totalRbcProductVolume - ultrafiltrationRemoved;
  const predictedHct = ((currentRbcVolume + addedRbcVolume) / finalTotalVolume) * 100;
  return { ebv, baseCpbVolume, currentTotalVolume, currentRbcVolume, addedRbcVolume, finalTotalVolume, predictedHct };
}

function computeTargetHctScenarios({ currentTotalVolume, currentRbcVolume, currentHct, targetHct, rbcVolPerUnit, rbcProductHctPercent }) {
  const V = currentTotalVolume || 0;
  const R = currentRbcVolume || 0;
  const T = (targetHct || 0) / 100;
  const P = (rbcProductHctPercent || 0) / 100;
  const U = rbcVolPerUnit || 0;
  const result = { message: '', dilution: null, rbcOnly: null, rbcNeutral: null, hfUfOnly: null };
  const withUnits = (requiredRbcMl) => ({ requiredRbcMl, requiredUnits: U > 0 ? requiredRbcMl / U : null });

  if (!(targetHct > 0)) {
    result.message = 'Enter a target Hct to compare adjustment scenarios.';
    return result;
  }
  if (!(V > 0) || !(currentHct > 0) || !(R > 0)) return result;
  if (targetHct <= currentHct) {
    result.message = 'Target is at or below current Hct.';
    const crystalloidToAdd = R / T - V;
    if (targetHct < currentHct && crystalloidToAdd > 0) {
      result.dilution = { crystalloidToAdd, finalVolume: V + crystalloidToAdd, expectedHct: (R / (V + crystalloidToAdd)) * 100 };
    }
    return result;
  }

  if (P > 0) {
    if (targetHct < rbcProductHctPercent) {
      const requiredRbcMl = (T * V - R) / (P - T);
      if (requiredRbcMl >= 0) {
        const finalVolume = V + requiredRbcMl;
        result.rbcOnly = { ...withUnits(requiredRbcMl), finalVolume, expectedHct: ((R + P * requiredRbcMl) / finalVolume) * 100 };
      }
    } else {
      result.rbcOnly = { notApplicable: 'Target Hct must be lower than RBC product Hct for RBC-only calculation.' };
    }

    const requiredRbcMl = (T * V - R) / P;
    if (requiredRbcMl >= 0) {
      result.rbcNeutral = { ...withUnits(requiredRbcMl), requiredHfUfMl: requiredRbcMl, finalVolume: V, expectedHct: ((R + P * requiredRbcMl) / V) * 100 };
    }
  }

  const requiredRemovalMl = V - (R / T);
  if (requiredRemovalMl >= 0) {
    const finalVolume = V - requiredRemovalMl;
    result.hfUfOnly = { requiredRemovalMl, finalVolume, expectedHct: (R / finalVolume) * 100 };
  }
  return result;
}

function run() {
  const onPump = computeOnPumpHctAdjustment({
    weightKg: 70,
    ebvCoefValue: 70,
    primeVolume: 1200,
    netIoChange: -1050,
    currentHct: 25,
    addedCrystalloid: 100,
    rbcUnits: 1,
    rbcUnitVol: 300,
    rbcUnitHct: 60,
    ultrafiltrationRemoved: 200
  });
  assert.strictEqual(onPump.currentTotalVolume, 5050);
  assert.strictEqual(onPump.currentRbcVolume, 1262.5);
  assert.strictEqual(onPump.finalTotalVolume, 5250);
  assert(nearlyEqual(onPump.predictedHct, 27.48, 0.01), `Planned on-pump Hct expected 27.48%, got ${onPump.predictedHct}`);

  const result = computeTargetHctScenarios({
    currentTotalVolume: 5050,
    currentRbcVolume: 1262.5,
    currentHct: 25,
    targetHct: 27,
    rbcVolPerUnit: 300,
    rbcProductHctPercent: 60
  });

  assert(nearlyEqual(result.rbcOnly.requiredRbcMl, 306.1), `RBC only mL expected 306.1, got ${result.rbcOnly.requiredRbcMl}`);
  assert(nearlyEqual(result.rbcOnly.requiredUnits, 1.02, 0.02), `RBC only units expected 1.02, got ${result.rbcOnly.requiredUnits}`);
  assert(nearlyEqual(result.rbcOnly.expectedHct, 27, 0.05), `RBC only Hct expected 27%, got ${result.rbcOnly.expectedHct}`);
  assert(nearlyEqual(result.rbcNeutral.requiredRbcMl, 168.3), `Neutral RBC mL expected 168.3, got ${result.rbcNeutral.requiredRbcMl}`);
  assert(nearlyEqual(result.rbcNeutral.requiredHfUfMl, 168.3), `Neutral HF/UF expected 168.3, got ${result.rbcNeutral.requiredHfUfMl}`);
  assert(nearlyEqual(result.rbcNeutral.requiredUnits, 0.56, 0.02), `Neutral units expected 0.56, got ${result.rbcNeutral.requiredUnits}`);
  assert(nearlyEqual(result.rbcNeutral.expectedHct, 27, 0.05), `Neutral Hct expected 27%, got ${result.rbcNeutral.expectedHct}`);
  assert(nearlyEqual(result.hfUfOnly.requiredRemovalMl, 374.1), `HF/UF only removal expected 374.1, got ${result.hfUfOnly.requiredRemovalMl}`);
  assert(nearlyEqual(result.hfUfOnly.expectedHct, 27, 0.05), `HF/UF only Hct expected 27%, got ${result.hfUfOnly.expectedHct}`);

  const customProduct = computeTargetHctScenarios({ currentTotalVolume: 5050, currentRbcVolume: 1262.5, currentHct: 25, targetHct: 27, rbcVolPerUnit: 250, rbcProductHctPercent: 50 });
  assert(nearlyEqual(customProduct.rbcOnly.requiredRbcMl, 439.1), `Custom RBC Hct should change required mL, got ${customProduct.rbcOnly.requiredRbcMl}`);
  assert(nearlyEqual(customProduct.rbcOnly.requiredUnits, 1.8, 0.05), `Custom Vol/unit should change units, got ${customProduct.rbcOnly.requiredUnits}`);

  const emptyTarget = computeTargetHctScenarios({ currentTotalVolume: 5050, currentRbcVolume: 1262.5, currentHct: 25, targetHct: 0, rbcVolPerUnit: 300, rbcProductHctPercent: 60 });
  assert.strictEqual(emptyTarget.message, 'Enter a target Hct to compare adjustment scenarios.');
  assert.strictEqual(emptyTarget.rbcOnly, null);
  assert.strictEqual(emptyTarget.rbcNeutral, null);
  assert.strictEqual(emptyTarget.hfUfOnly, null);

  const impossibleRbcOnly = computeTargetHctScenarios({ currentTotalVolume: 5050, currentRbcVolume: 1262.5, currentHct: 25, targetHct: 60, rbcVolPerUnit: 300, rbcProductHctPercent: 60 });
  assert(impossibleRbcOnly.rbcOnly.notApplicable.includes('Target Hct must be lower than RBC product Hct'));

  const html = fs.readFileSync(path.join(__dirname, '..', 'predicted-hct', 'index.html'), 'utf8');
  assert(html.includes('Alternative scenarios to reach the target Hct from the current on-pump state. These scenarios are alternatives, not additive doses.'));
  assert(html.includes('RBC product assumptions are taken from the RBC addition fields above.'));
  assert(html.includes('id="onpump-extra-results"'), 'On-pump summary container should exist');
  assert(html.includes('id="current_volume_result"'), 'Planned summary should include current volume');
  assert(html.includes('id="final_volume_result"'), 'Planned summary should include final volume');
  assert(html.includes('id="target_rbc_only_secondary"'), 'Target helper should render compact row secondary text');
  assert(html.includes('divide-y divide-slate-200 dark:divide-primary-700'), 'Target rows should use subtle dividers');
  assert(!html.includes('bg-red-50/70'), 'Target rows should not use warning-style red backgrounds');
  assert(!html.includes('bg-purple-50/70'), 'Target rows should not use unrelated purple backgrounds');
  assert(!html.includes('border border-slate-200 dark:border-primary-700 bg-slate-50 dark:bg-primary-900/40 p-5 space-y-4'), 'RBC addition should not be a nested card');

  console.log('All predicted Hct target helper tests passed.');
}

run();
