'use strict';

const phnCoeffSource = (typeof window !== 'undefined' && window.PHN_COEFFICIENTS)
  ? window.PHN_COEFFICIENTS
  : require('../data/phnCoefficients.js');

const CM_TO_MM = 10;

function validatePositiveNumber(value, fieldName) {
  if (value == null || value === '') throw new Error(`${fieldName} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${fieldName} must be a positive number.`);
  return parsed;
}

function cmToMm(valueCm) {
  return valueCm * CM_TO_MM;
}

function clampToDisplayMm(valueMm) {
  return Math.max(0, valueMm);
}

function formatMm(valueMm) {
  return `${valueMm.toFixed(2)} mm`;
}

function calculateHaycockBSA(heightCm, weightKg) {
  const h = validatePositiveNumber(heightCm, 'Height');
  const w = validatePositiveNumber(weightKg, 'Weight');
  return 0.024265 * Math.pow(h, 0.3964) * Math.pow(w, 0.5378);
}

function calculateInverseRange(bsa, coeff) {
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  const bsaPowAlpha = Math.pow(bsaValue, coeff.alpha);

  // PHN indexed inverse formula (cm): raw_cm(z) = (mean + z*sd) * (BSA^alpha)
  const zNeg2Cm = (coeff.mean - 2 * coeff.sd) * bsaPowAlpha;
  const z0Cm = coeff.mean * bsaPowAlpha;
  const zPos2Cm = (coeff.mean + 2 * coeff.sd) * bsaPowAlpha;

  return {
    bsaPowAlpha,
    zNeg2Cm,
    z0Cm,
    zPos2Cm,
    zNeg2Mm: cmToMm(zNeg2Cm),
    z0Mm: cmToMm(z0Cm),
    zPos2Mm: cmToMm(zPos2Cm)
  };
}

function calculateForwardZScore(measuredCm, bsa, coeff) {
  const measured = validatePositiveNumber(measuredCm, 'Measured value');
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  const bsaPowAlpha = Math.pow(bsaValue, coeff.alpha);
  // PHN forward z-score formula: z = ((measured_cm / BSA^alpha) - mean) / sd
  return ((measured / bsaPowAlpha) - coeff.mean) / coeff.sd;
}

function calculatePhnTargetMm(bsa, targetZ, coeff) {
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  const zValue = Number(targetZ);
  if (!Number.isFinite(zValue)) throw new Error('Target Z-score must be a number.');
  const bsaPowAlpha = Math.pow(bsaValue, coeff.alpha);
  // PHN reverse formula (mm): target = (mean + targetZ × sd) × BSA^alpha × 10.
  return cmToMm((coeff.mean + zValue * coeff.sd) * bsaPowAlpha);
}

function calculatePettersenMeanLn(bsa, coeff) {
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  ['b0', 'b1', 'b2', 'b3', 'mse'].forEach((key) => {
    if (!Number.isFinite(coeff[key])) throw new Error('Coefficient missing');
  });
  return coeff.b0 + coeff.b1 * bsaValue + coeff.b2 * Math.pow(bsaValue, 2) + coeff.b3 * Math.pow(bsaValue, 3);
}

function calculatePettersenZScore(measuredMm, bsa, coeff) {
  const measured = validatePositiveNumber(measuredMm, 'Measured value');
  const meanLn = calculatePettersenMeanLn(bsa, coeff);
  // Detroit/Pettersen 2008 uses ln(measurement in cm) and sqrt(MSE) as the denominator.
  return (Math.log(measured / CM_TO_MM) - meanLn) / Math.sqrt(coeff.mse);
}

function calculatePettersenTargetMm(bsa, targetZ, coeff) {
  const zValue = Number(targetZ);
  if (!Number.isFinite(zValue)) throw new Error('Target Z-score must be a number.');
  const meanLn = calculatePettersenMeanLn(bsa, coeff);
  return cmToMm(Math.exp(meanLn + zValue * Math.sqrt(coeff.mse)));
}

function hasCompletePettersenCoefficients(coeff) {
  return Boolean(coeff) && ['b0', 'b1', 'b2', 'b3', 'mse'].every((key) => Number.isFinite(coeff[key]));
}

function buildZScoreModels() {
  const phnStructures = phnCoeffSource.PHN_STRUCTURE_ORDER.map((key) => ({
    key,
    label: phnCoeffSource.PHN_STRUCTURES[key].label,
    calculationType: 'phn',
    coefficients: phnCoeffSource.PHN_STRUCTURES[key]
  }));

  const detroitStructures = phnCoeffSource.PEDIATRIC_STRUCTURE_ORDER
    .map((key) => {
      const structure = phnCoeffSource.PEDIATRIC_STRUCTURES[key];
      const coeff = structure && structure.pettersenKey ? phnCoeffSource.PETTERSEN_STRUCTURES[structure.pettersenKey] : null;
      if (!hasCompletePettersenCoefficients(coeff)) return null;
      return {
        key,
        label: structure.label,
        calculationType: 'pettersen',
        coefficients: coeff
      };
    })
    .filter(Boolean);

  return {
    phnLopez: {
      label: 'PHN / Lopez',
      unit: 'cm-internal-mm-display',
      structures: phnStructures
    },
    detroitPettersen2008: {
      label: 'Detroit / Pettersen 2008',
      unit: 'cm-internal-mm-display',
      structures: detroitStructures
    }
  };
}

const zScoreModels = buildZScoreModels();

const selectedModelRangeNote = {
  phnLopez: 'PHN / Lopez: Developed from healthy, non-obese pediatric subjects up to 18 years. Use caution when applying to patients outside typical pediatric body size ranges.',
  detroitPettersen2008: 'Detroit / Pettersen 2008: Developed from patients aged 1 day to 18 years. Recommended calculator range: BSA up to approximately 2.0 m². Use caution above this range.'
};

const MODEL_CONSISTENCY_NOTE = 'Z-scores and expected sizes may differ between models. Use the same model consistently for serial follow-up.';

function shouldShowDetroitBsaWarning(modelKey, bsa) {
  return modelKey === 'detroitPettersen2008' && Number(bsa) > 2.0;
}

function getEquivalentStructureKey(currentKey, targetModelKey) {
  const targetModel = zScoreModels[targetModelKey];
  const targetStructures = targetModel?.structures || [];
  const firstTargetKey = targetStructures[0]?.key || '';
  if (!currentKey || !targetModel) return firstTargetKey;

  const targetSupports = (key) => targetStructures.some((structure) => structure.key === key);
  if (targetSupports(currentKey)) return currentKey;

  const targetMapKey = targetModelKey === 'phnLopez'
    ? 'phnKey'
    : (targetModelKey === 'detroitPettersen2008' ? 'pettersenKey' : null);
  if (!targetMapKey) return firstTargetKey;

  const pediatricStructures = phnCoeffSource.PEDIATRIC_STRUCTURES || {};
  const mappedStructure = Object.values(pediatricStructures).find((structure) => (
    structure.phnKey === currentKey || structure.pettersenKey === currentKey
  ));
  const mappedTargetKey = mappedStructure?.[targetMapKey];
  return mappedTargetKey && targetSupports(mappedTargetKey) ? mappedTargetKey : firstTargetKey;
}

function calculateModelTargetMm(modelKey, structureKey, bsa, targetZ) {
  const model = zScoreModels[modelKey];
  if (!model) throw new Error('Select a supported reference model.');
  const structure = model.structures.find((item) => item.key === structureKey);
  if (!structure) throw new Error('Select a structure supported by the selected model.');
  if (structure.calculationType === 'phn') return calculatePhnTargetMm(bsa, targetZ, structure.coefficients);
  if (structure.calculationType === 'pettersen') return calculatePettersenTargetMm(bsa, targetZ, structure.coefficients);
  throw new Error('Unsupported calculation type.');
}

function calculateModelExpectedSizes(modelKey, structureKey, bsa, targetZ) {
  return {
    zNeg2Mm: calculateModelTargetMm(modelKey, structureKey, bsa, -2),
    z0Mm: calculateModelTargetMm(modelKey, structureKey, bsa, 0),
    zPos2Mm: calculateModelTargetMm(modelKey, structureKey, bsa, 2),
    targetMm: calculateModelTargetMm(modelKey, structureKey, bsa, targetZ)
  };
}

function calculateModelMeasuredZScore(modelKey, structureKey, measuredMm, bsa) {
  const measured = validatePositiveNumber(measuredMm, 'Measured value');
  const model = zScoreModels[modelKey];
  if (!model) throw new Error('Select a supported reference model.');
  const structure = model.structures.find((item) => item.key === structureKey);
  if (!structure) throw new Error('Select a structure supported by the selected model.');
  if (structure.calculationType === 'phn') return calculateForwardZScore(measured / CM_TO_MM, bsa, structure.coefficients);
  if (structure.calculationType === 'pettersen') return calculatePettersenZScore(measured, bsa, structure.coefficients);
  throw new Error('Unsupported calculation type.');
}

function calculateRegressionReferenceCm(bsa, regressionCoeff) {
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  return regressionCoeff.intercept + regressionCoeff.slope * Math.pow(bsaValue, regressionCoeff.alpha);
}

function getBsaWarnings(bsa) {
  const val = validatePositiveNumber(bsa, 'BSA');
  const limits = phnCoeffSource.PHN_BSA_LIMITS;
  const warnings = [];
  if (val < limits.min || val > limits.max) {
    warnings.push(`BSA ${val.toFixed(2)} m² is outside the reference range (${limits.min.toFixed(2)}–${limits.max.toFixed(2)} m²).`);
  }
  if (val > limits.extrapolationFlag) {
    warnings.push('Caution: PHN pediatric model extrapolation for BSA > 2.0 m².');
  }
  return warnings;
}

function createRowsForBsa(bsa) {
  return phnCoeffSource.PHN_STRUCTURE_ORDER.map((key) => {
    const coeff = phnCoeffSource.PHN_STRUCTURES[key];
    const range = calculateInverseRange(bsa, coeff);
    return { key, coeff, range };
  });
}

const api = {
  PHN_STRUCTURE_ORDER: phnCoeffSource.PHN_STRUCTURE_ORDER,
  PHN_STRUCTURES: phnCoeffSource.PHN_STRUCTURES,
  PHN_REGRESSION: phnCoeffSource.PHN_REGRESSION,
  PHN_BSA_LIMITS: phnCoeffSource.PHN_BSA_LIMITS,
  PEDIATRIC_STRUCTURE_ORDER: phnCoeffSource.PEDIATRIC_STRUCTURE_ORDER,
  PEDIATRIC_STRUCTURES: phnCoeffSource.PEDIATRIC_STRUCTURES,
  PETTERSEN_STRUCTURES: phnCoeffSource.PETTERSEN_STRUCTURES,
  zScoreModels,
  selectedModelRangeNote,
  MODEL_CONSISTENCY_NOTE,
  shouldShowDetroitBsaWarning,
  getEquivalentStructureKey,
  calculateHaycockBSA,
  calculateInverseRange,
  calculateForwardZScore,
  calculatePhnTargetMm,
  calculatePettersenMeanLn,
  calculatePettersenZScore,
  calculatePettersenTargetMm,
  calculateModelTargetMm,
  calculateModelExpectedSizes,
  calculateModelMeasuredZScore,
  calculateRegressionReferenceCm,
  getBsaWarnings,
  cmToMm,
  clampToDisplayMm,
  formatMm,
  createRowsForBsa
};

if (typeof window !== 'undefined') {
  window.PhnCalculator = api;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
}
