'use strict';

// Volume-neutral RBC replacement estimates. All volumes are mL; Hct inputs are %.
// Models an ideally mixed, closed compartment. Actual clinical Hct must be measured.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AdultHctCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  function positive(value, label) {
    if (!Number.isFinite(value) || value <= 0) throw new RangeError(label + ' must be positive.');
    return value;
  }
  function fraction(percent, label) {
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
      throw new RangeError(label + ' must be > 0 and <= 100%.');
    }
    return percent / 100;
  }
  function zeroOrPositive(value, label) {
    if (!Number.isFinite(value) || value < 0) throw new RangeError(label + ' cannot be negative.');
    return value;
  }

  function calculatePreCpb({ weightKg, ebvMlPerKg, preHctPercent, primeMl,
    rbcHctPercent, rbcUnitMl, targetHctPercent }) {
    const ebv = positive(weightKg, 'Weight') * positive(ebvMlPerKg, 'EBV coefficient');
    const startingHct = fraction(preHctPercent, 'Pre-CPB Hct');
    const prime = zeroOrPositive(primeMl, 'Priming volume');
    const productHct = fraction(rbcHctPercent, 'RBC product Hct');
    const unitMl = positive(rbcUnitMl, 'RBC unit volume');
    const totalMl = ebv + prime;
    const patientRedCellMl = ebv * startingHct;
    const predictedBeforePercent = patientRedCellMl / totalMl * 100;
    const maxPossiblePercent = (patientRedCellMl + prime * productHct) / totalMl * 100;
    let neededRbcMl = null;
    let feasible = null;
    let predictedAfterPercent = null;
    if (targetHctPercent !== null && targetHctPercent !== undefined) {
      const target = fraction(targetHctPercent, 'Desired Hct');
      neededRbcMl = Math.max(0, (target * totalMl - patientRedCellMl) / productHct);
      feasible = neededRbcMl <= prime + 1e-8;
      if (feasible) predictedAfterPercent = (patientRedCellMl + neededRbcMl * productHct) / totalMl * 100;
    }
    return {
      ebvMl: ebv, primeMl: prime, totalMl, predictedBeforePercent, maxPossiblePercent,
      neededRbcMl, neededRbcUnits: neededRbcMl === null ? null : neededRbcMl / unitMl,
      feasible, predictedAfterPercent
    };
  }

  function calculateOnPump({ currentVolumeMl, currentHctPercent, rbcMl,
    rbcHctPercent, rbcUnitMl, targetHctPercent }) {
    const volume = positive(currentVolumeMl, 'Current circulating volume');
    const currentFraction = fraction(currentHctPercent, 'Current Hct');
    const productFraction = fraction(rbcHctPercent, 'RBC product Hct');
    const unitMl = positive(rbcUnitMl, 'RBC unit volume');
    const addedMl = zeroOrPositive(rbcMl, 'RBC volume added');
    // HF/UF removes plasma water, not whole blood. It is volume-matched to RBC product.
    const matchedUfMl = addedMl;
    const startingRedCellsMl = volume * currentFraction;
    const resultingRedCellsMl = startingRedCellsMl + addedMl * productFraction;
    const predictedPercent = resultingRedCellsMl / volume * 100;
    let neededToTargetMl = null;
    let targetReachable = null;
    if (targetHctPercent !== null && targetHctPercent !== undefined) {
      const target = fraction(targetHctPercent, 'Desired Hct');
      neededToTargetMl = Math.max(0, (target - currentFraction) * volume / productFraction);
      // The amount of HF required must not exceed the estimated available plasma.
      // This is a necessary, not sufficient, feasibility check.
      targetReachable = neededToTargetMl * productFraction <= volume * (1 - currentFraction) + 1e-8;
    }
    if (predictedPercent > 100 + 1e-8) throw new RangeError('RBC addition is inconsistent with the estimated total volume.');
    return {
      currentVolumeMl: volume, matchedUfMl, finalVolumeMl: volume, predictedPercent,
      hctIncreasePoints: predictedPercent - currentHctPercent,
      unitsAdded: addedMl / unitMl,
      neededToTargetMl,
      targetUnits: neededToTargetMl === null ? null : neededToTargetMl / unitMl,
      targetReachable
    };
  }

  return Object.freeze({ calculatePreCpb, calculateOnPump });
});
