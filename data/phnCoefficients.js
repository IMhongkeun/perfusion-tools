'use strict';

const PHN_STRUCTURE_ORDER = ['ANN', 'TV_LAT', 'MV_LAT', 'MPA', 'LPA', 'RPA'];

const PHN_STRUCTURES = {
  ANN: { label: 'Aortic annulus', alpha: 0.5, mean: 1.48, sd: 0.14, unit: 'cm' },
  TV_LAT: { label: 'Tricuspid valve (lateral)', alpha: 0.5, mean: 2.36, sd: 0.29, unit: 'cm' },
  MV_LAT: { label: 'Mitral valve (lateral)', alpha: 0.5, mean: 2.23, sd: 0.22, unit: 'cm' },
  MPA: { label: 'Main pulmonary artery', alpha: 0.5, mean: 1.82, sd: 0.24, unit: 'cm' },
  LPA: { label: 'Left pulmonary artery', alpha: 0.5, mean: 1.1, sd: 0.18, unit: 'cm' },
  RPA: { label: 'Right pulmonary artery', alpha: 0.5, mean: 1.07, sd: 0.18, unit: 'cm' }
};

const PHN_REGRESSION = {
  ANN: { alpha: 0.5, intercept: -0.016599775, slope: 1.506884773, unit: 'cm' },
  TV_LAT: { alpha: 0.5, intercept: 0.249147894, slope: 2.064415385, unit: 'cm' },
  MV_LAT: { alpha: 0.5, intercept: 0.142783317, slope: 2.058261615, unit: 'cm' },
  MPA: { alpha: 0.5, intercept: 0.117718176, slope: 1.682071763, unit: 'cm' },
  LPA: { alpha: 0.5, intercept: 0.001348966, slope: 1.109745289, unit: 'cm' },
  RPA: { alpha: 0.5, intercept: -0.008988176, slope: 1.0887785, unit: 'cm' }
};

const PHN_BSA_LIMITS = {
  min: 0.15,
  max: 2.5,
  extrapolationFlag: 2.0
};

const PHN_COEFFICIENTS = {
  PHN_STRUCTURE_ORDER,
  PHN_STRUCTURES,
  PHN_REGRESSION,
  PHN_BSA_LIMITS
};

if (typeof window !== 'undefined') {
  window.PHN_COEFFICIENTS = PHN_COEFFICIENTS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PHN_COEFFICIENTS;
}
