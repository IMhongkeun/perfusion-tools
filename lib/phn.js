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
  calculateHaycockBSA,
  calculateInverseRange,
  calculateForwardZScore,
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
