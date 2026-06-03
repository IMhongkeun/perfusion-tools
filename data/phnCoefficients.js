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

const PEDIATRIC_STRUCTURE_ORDER = [
  'RVDD',
  'IVSD',
  'IVSS',
  'LVIDD',
  'LVIDS',
  'LVPWD',
  'LVPWS',
  'AOV_ANN',
  'SOV',
  'STJ',
  'TRANSVERSE_ARCH',
  'AORTIC_ISTHMUS',
  'DISTAL_ARCH',
  'AORTA_DIAPHRAGM',
  'PV_ANN',
  'MPA',
  'RPA',
  'LPA',
  'MV_ANN',
  'TV_ANN',
  'LA'
];

const PEDIATRIC_STRUCTURES = {
  RVDD: { label: 'RVDd', phnKey: null, pettersenKey: 'RVDD' },
  IVSD: { label: 'IVSd', phnKey: null, pettersenKey: 'IVSD' },
  IVSS: { label: 'IVSs', phnKey: null, pettersenKey: 'IVSS' },
  LVIDD: { label: 'LVIDd', phnKey: null, pettersenKey: 'LVIDD' },
  LVIDS: { label: 'LVIDs', phnKey: null, pettersenKey: 'LVIDS' },
  LVPWD: { label: 'LVPWd', phnKey: null, pettersenKey: 'LVPWD' },
  LVPWS: { label: 'LVPWs', phnKey: null, pettersenKey: 'LVPWS' },
  AOV_ANN: { label: 'Aortic valve annulus', phnKey: 'ANN', pettersenKey: 'AOV_ANN' },
  SOV: { label: 'Sinuses of Valsalva', phnKey: null, pettersenKey: 'SOV' },
  STJ: { label: 'Sinotubular junction', phnKey: null, pettersenKey: 'STJ' },
  TRANSVERSE_ARCH: { label: 'Transverse aortic arch', phnKey: null, pettersenKey: 'TRANSVERSE_ARCH' },
  AORTIC_ISTHMUS: { label: 'Aortic isthmus', phnKey: null, pettersenKey: 'AORTIC_ISTHMUS' },
  DISTAL_ARCH: { label: 'Distal aortic arch', phnKey: null, pettersenKey: 'DISTAL_ARCH' },
  AORTA_DIAPHRAGM: { label: 'Aorta at diaphragm', phnKey: null, pettersenKey: 'AORTA_DIAPHRAGM' },
  PV_ANN: { label: 'Pulmonary valve annulus', phnKey: null, pettersenKey: 'PV_ANN' },
  MPA: { label: 'Main pulmonary artery', phnKey: 'MPA', pettersenKey: 'MPA' },
  RPA: { label: 'Right pulmonary artery', phnKey: 'RPA', pettersenKey: 'RPA' },
  LPA: { label: 'Left pulmonary artery', phnKey: 'LPA', pettersenKey: 'LPA' },
  MV_ANN: { label: 'Mitral valve annulus', phnKey: 'MV_LAT', pettersenKey: 'MV_ANN' },
  TV_ANN: { label: 'Tricuspid valve annulus', phnKey: 'TV_LAT', pettersenKey: 'TV_ANN' },
  LA: { label: 'Left atrium', phnKey: null, pettersenKey: 'LA' }
};

// Detroit / Pettersen 2008 Table 2 coefficients for ln(measurement_cm) vs. BSA.
const PETTERSEN_STRUCTURES = {
  RVDD: { label: 'RVDd', b0: -0.317, b1: 1.850, b2: -1.274, b3: 0.335, mse: 0.058 },
  IVSD: { label: 'IVSd', b0: -1.242, b1: 1.272, b2: -0.762, b3: 0.208, mse: 0.046 },
  IVSS: { label: 'IVSs', b0: -1.048, b1: 1.751, b2: -1.177, b3: 0.318, mse: 0.034 },
  LVIDD: { label: 'LVIDd', b0: 0.105, b1: 2.859, b2: -2.119, b3: 0.552, mse: 0.010 },
  LVIDS: { label: 'LVIDs', b0: -0.371, b1: 2.833, b2: -2.081, b3: 0.538, mse: 0.016 },
  LVPWD: { label: 'LVPWd', b0: -1.586, b1: 1.849, b2: -1.188, b3: 0.313, mse: 0.037 },
  LVPWS: { label: 'LVPWs', b0: -0.947, b1: 1.907, b2: -1.259, b3: 0.330, mse: 0.023 },
  AOV_ANN: { label: 'Aortic valve annulus', b0: -0.874, b1: 2.708, b2: -1.841, b3: 0.452, mse: 0.010 },
  SOV: { label: 'Sinuses of Valsalva', b0: -0.500, b1: 2.537, b2: -1.707, b3: 0.420, mse: 0.012 },
  STJ: { label: 'Sinotubular junction', b0: -0.759, b1: 2.643, b2: -1.797, b3: 0.442, mse: 0.018 },
  TRANSVERSE_ARCH: { label: 'Transverse aortic arch', b0: -0.790, b1: 3.020, b2: -2.484, b3: 0.712, mse: 0.023 },
  AORTIC_ISTHMUS: { label: 'Aortic isthmus', b0: -1.072, b1: 2.539, b2: -1.627, b3: 0.368, mse: 0.027 },
  DISTAL_ARCH: { label: 'Distal aortic arch', b0: -0.976, b1: 2.469, b2: -1.746, b3: 0.445, mse: 0.026 },
  AORTA_DIAPHRAGM: { label: 'Aorta at diaphragm', b0: -0.922, b1: 2.100, b2: -1.411, b3: 0.371, mse: 0.018 },
  PV_ANN: { label: 'Pulmonary valve annulus', b0: -0.761, b1: 2.774, b2: -1.808, b3: 0.436, mse: 0.023 },
  MPA: { label: 'Main pulmonary artery', b0: -0.707, b1: 2.746, b2: -1.807, b3: 0.424, mse: 0.024 },
  RPA: { label: 'Right pulmonary artery', b0: -1.360, b1: 3.394, b2: -2.508, b3: 0.660, mse: 0.027 },
  LPA: { label: 'Left pulmonary artery', b0: -1.348, b1: 2.884, b2: -1.954, b3: 0.466, mse: 0.028 },
  MV_ANN: { label: 'Mitral valve annulus', b0: -0.271, b1: 2.446, b2: -1.700, b3: 0.425, mse: 0.022 },
  TV_ANN: { label: 'Tricuspid valve annulus', b0: -0.164, b1: 2.341, b2: -1.596, b3: 0.387, mse: 0.036 },
  LA: { label: 'Left atrium', b0: -0.208, b1: 2.164, b2: -1.597, b3: 0.429, mse: 0.020 }
};


const PHN_COEFFICIENTS = {
  PHN_STRUCTURE_ORDER,
  PHN_STRUCTURES,
  PHN_REGRESSION,
  PHN_BSA_LIMITS,
  PEDIATRIC_STRUCTURE_ORDER,
  PEDIATRIC_STRUCTURES,
  PETTERSEN_STRUCTURES
};

if (typeof window !== 'undefined') {
  window.PHN_COEFFICIENTS = PHN_COEFFICIENTS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PHN_COEFFICIENTS;
}
