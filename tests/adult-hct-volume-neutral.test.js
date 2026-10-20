'use strict';
const assert = require('assert');
const { calculatePreCpb, calculateOnPump } = require('../adult-hct/core');
const close = (actual, expected, label) => assert(Math.abs(actual - expected) < 1e-7, label + ': ' + actual + ' != ' + expected);

// Priming replacement, NOT additive transfusion: circuit volume stays 1200 mL.
const pre = calculatePreCpb({
  weightKg: 70, ebvMlPerKg: 70, preHctPercent: 35, primeMl: 1200,
  rbcHctPercent: 60, rbcUnitMl: 350, targetHctPercent: 30
});
close(pre.totalMl, 6100, 'fixed total volume');
close(pre.predictedBeforePercent, (4900 * 0.35 / 6100) * 100, 'predicted Hct without RBC');
close(pre.neededRbcMl, (6100 * 0.30 - 4900 * 0.35) / 0.60, 'priming substitution mL');
close(pre.neededRbcUnits, pre.neededRbcMl / 350, 'RBC equivalent units');
close(pre.predictedAfterPercent, 30, 'reached target');
assert(pre.feasible);

const beyond = calculatePreCpb({
  weightKg: 70, ebvMlPerKg: 70, preHctPercent: 35, primeMl: 1200,
  rbcHctPercent: 60, rbcUnitMl: 350, targetHctPercent: 50
});
assert.strictEqual(beyond.feasible, false);
assert.strictEqual(beyond.predictedAfterPercent, null);
assert(beyond.neededRbcMl > beyond.primeMl);

const already = calculatePreCpb({
  weightKg: 70, ebvMlPerKg: 70, preHctPercent: 35, primeMl: 1200,
  rbcHctPercent: 60, rbcUnitMl: 350, targetHctPercent: 25
});
close(already.neededRbcMl, 0, 'already meets target');

const on = calculateOnPump({
  currentVolumeMl: 6100, currentHctPercent: 24, rbcMl: 350,
  rbcHctPercent: 60, rbcUnitMl: 350, targetHctPercent: 30
});
close(on.matchedUfMl, 350, 'matched HF/UF removal');
close(on.finalVolumeMl, 6100, 'volume neutral on pump');
close(on.predictedPercent, (6100 * 0.24 + 350 * 0.6) / 6100 * 100, 'on pump Hct');
close(on.neededToTargetMl, (0.30 - 0.24) * 6100 / 0.6, 'target RBC mL');
close(on.unitsAdded, 1, 'one RBC unit');
assert(on.targetReachable);

// HF removal alone must NOT remove erythrocytes; unlike discarding whole blood.
const none = calculateOnPump({
  currentVolumeMl: 6100, currentHctPercent: 24, rbcMl: 0,
  rbcHctPercent: 60, rbcUnitMl: 350
});
close(none.predictedPercent, 24, 'no change');

assert.throws(() => calculatePreCpb({
  weightKg: 0, ebvMlPerKg: 70, preHctPercent: 35, primeMl: 1200,
  rbcHctPercent: 60, rbcUnitMl: 350
}), RangeError);
assert.throws(() => calculateOnPump({
  currentVolumeMl: 6100, currentHctPercent: 24, rbcMl: -1,
  rbcHctPercent: 60, rbcUnitMl: 350
}), RangeError);
console.log('Adult volume-neutral Hct calculation tests passed.');
