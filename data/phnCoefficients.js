'use strict';

const PHN_STRUCTURE_ORDER = [
  // Heart valves
  'ANN',
  'MV_AP',
  'MV_LAT',
  'TV_AP',
  'TV_LAT',
  'PV_SAX',
  'PV_LAX',
  // Aorta and aortic arch
  'ROOT',
  'STJ',
  'AAO',
  'ARCH_PROX',
  'ARCH_DIST',
  'ISTH',
  // Coronary arteries
  'LMCA',
  'LAD',
  'RCA',
  // Pulmonary arteries
  'MPA',
  'LPA',
  'RPA',
  // Left ventricular dimensions
  'LVEDD',
  'LVESD',
  'LVPWT',
  'LVST',
  'LVEDL',
  'LVEDL_EPI'
];

const PHN_STRUCTURES = {
  // Existing 6 structures (parameters and clinical behavior preserved)
  ANN: {
    label: 'Aortic annulus',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 1.48,
    sd: 0.14,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Aortic valve annulus measured in parasternal long-axis view at hinge points during peak systole.'
  },
  TV_LAT: {
    label: 'Tricuspid valve (lateral)',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 2.36,
    sd: 0.29,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Tricuspid valve lateral diameter measured in apical 4-chamber view at maximal diastolic opening.'
  },
  MV_LAT: {
    label: 'Mitral valve (lateral)',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 2.23,
    sd: 0.22,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Mitral valve lateral diameter measured in apical 4-chamber view at maximal diastolic opening.'
  },
  MPA: {
    label: 'Main pulmonary artery',
    group: 'Pulmonary arteries',
    alpha: 0.5,
    mean: 1.82,
    sd: 0.24,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Main pulmonary artery diameter measured midway between pulmonary valve and bifurcation.'
  },
  LPA: {
    label: 'Left pulmonary artery',
    group: 'Pulmonary arteries',
    alpha: 0.5,
    mean: 1.1,
    sd: 0.18,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left pulmonary artery diameter measured proximal to first branching.'
  },
  RPA: {
    label: 'Right pulmonary artery',
    group: 'Pulmonary arteries',
    alpha: 0.5,
    mean: 1.07,
    sd: 0.18,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Right pulmonary artery diameter measured proximal to branching.'
  },

  // 19 New Linear Structures
  // A. Atrioventricular valve linear dimensions
  MV_AP: {
    label: 'Mitral valve (AP)',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 2.31,
    sd: 0.24,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Mitral valve anteroposterior diameter measured in parasternal long-axis view at maximal diastolic opening.'
  },
  TV_AP: {
    label: 'Tricuspid valve (AP)',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 2.36,
    sd: 0.28,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Tricuspid valve anteroposterior diameter measured in parasternal long-axis view at maximal diastolic opening.'
  },

  // B. Aorta and aortic arch
  ROOT: {
    label: 'Aortic root',
    group: 'Aorta and aortic arch',
    alpha: 0.5,
    mean: 2.06,
    sd: 0.18,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Aortic root maximal sinuses of Valsalva diameter measured in parasternal long-axis view in mid-systole (inner-edge to inner-edge).'
  },
  STJ: {
    label: 'Sinotubular junction',
    group: 'Aorta and aortic arch',
    alpha: 0.5,
    mean: 1.69,
    sd: 0.16,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Sinotubular junction diameter measured at transition between sinuses and tubular ascending aorta in mid-systole (inner-edge to inner-edge).'
  },
  AAO: {
    label: 'Ascending aorta',
    group: 'Aorta and aortic arch',
    alpha: 0.5,
    mean: 1.79,
    sd: 0.18,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Ascending aortic tubular diameter measured distal to STJ from high parasternal or suprasternal view in mid-systole (inner-edge to inner-edge).'
  },
  ARCH_PROX: {
    label: 'Proximal aortic arch',
    group: 'Aorta and aortic arch',
    alpha: 0.5,
    mean: 1.53,
    sd: 0.23,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Proximal transverse aortic arch diameter measured between innominate and left common carotid artery branches (inner-edge to inner-edge).'
  },
  ARCH_DIST: {
    label: 'Distal aortic arch',
    group: 'Aorta and aortic arch',
    alpha: 0.5,
    mean: 1.36,
    sd: 0.19,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Distal transverse aortic arch diameter measured between left common carotid and left subclavian artery branches (inner-edge to inner-edge).'
  },
  ISTH: {
    label: 'Aortic isthmus',
    group: 'Aorta and aortic arch',
    alpha: 0.5,
    mean: 1.25,
    sd: 0.18,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Aortic isthmus diameter measured immediately distal to the origin of the left subclavian artery (inner-edge to inner-edge).'
  },

  // C. Coronary arteries (native unit mm)
  LMCA: {
    label: 'Left main coronary artery (LMCA)',
    group: 'Coronary arteries',
    alpha: 0.45,
    mean: 2.95,
    sd: 0.57,
    unit: 'mm',
    displayUnit: 'mm',
    referenceNote: 'Left main coronary artery internal diameter measured in high parasternal short-axis view (native unit: mm).'
  },
  LAD: {
    label: 'Left anterior descending artery (LAD)',
    group: 'Coronary arteries',
    alpha: 0.45,
    mean: 1.9,
    sd: 0.34,
    unit: 'mm',
    displayUnit: 'mm',
    referenceNote: 'Proximal left anterior descending coronary artery internal diameter measured distal to bifurcation (native unit: mm).'
  },
  RCA: {
    label: 'Right coronary artery (RCA)',
    group: 'Coronary arteries',
    alpha: 0.45,
    mean: 2.32,
    sd: 0.55,
    unit: 'mm',
    displayUnit: 'mm',
    referenceNote: 'Proximal right coronary artery internal diameter measured within first centimeter from origin (native unit: mm).'
  },

  // D. Pulmonary valve annulus
  PV_SAX: {
    label: 'Pulmonary valve (short-axis)',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 1.91,
    sd: 0.24,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Pulmonary valve annulus diameter measured in parasternal short-axis view at hinge points during peak systole.'
  },
  PV_LAX: {
    label: 'Pulmonary valve (long-axis)',
    group: 'Heart valves',
    alpha: 0.5,
    mean: 2.01,
    sd: 0.28,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Pulmonary valve annulus diameter measured in RV outflow long-axis view at hinge points during peak systole.'
  },

  // E. Left ventricular linear dimensions
  LVEDD: {
    label: 'LV end-diastolic dimension (LVEDD)',
    group: 'Left ventricular dimensions',
    alpha: 0.45,
    mean: 3.89,
    sd: 0.33,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left ventricular short-axis end-diastolic internal endocardial diameter at chordal/papillary tips level.'
  },
  LVPWT: {
    label: 'LV posterior wall thickness (LVPWT)',
    group: 'Left ventricular dimensions',
    alpha: 0.4,
    mean: 0.57,
    sd: 0.09,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left ventricular end-diastolic posterior wall thickness measured in short-axis view at end-diastole.'
  },
  LVST: {
    label: 'LV septal thickness (LVST)',
    group: 'Left ventricular dimensions',
    alpha: 0.4,
    mean: 0.58,
    sd: 0.09,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left ventricular end-diastolic ventricular septal thickness measured in short-axis view at end-diastole.'
  },
  LVEDL: {
    label: 'LV end-diastolic length (endocardial)',
    group: 'Left ventricular dimensions',
    alpha: 0.45,
    mean: 6.31,
    sd: 0.46,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left ventricular long-axis end-diastolic endocardial length measured from apical 4-chamber view.'
  },
  LVEDL_EPI: {
    label: 'LV end-diastolic length (epicardial)',
    group: 'Left ventricular dimensions',
    alpha: 0.45,
    mean: 6.87,
    sd: 0.45,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left ventricular long-axis end-diastolic epicardial length measured from apical 4-chamber view.'
  },

  // F. Additional PHN 2021 measurement
  LVESD: {
    label: 'LV end-systolic dimension (LVESD)',
    group: 'Left ventricular dimensions',
    alpha: 0.5,
    mean: 2.675,
    sd: 0.352,
    unit: 'cm',
    displayUnit: 'mm',
    referenceNote: 'Left ventricular short-axis end-systolic internal diameter derived from 2021 PHN model (Lopez et al. JASE 2021 Table 3).'
  }
};

const PHN_REGRESSION = {
  ANN: { alpha: 0.5, intercept: -0.016599775, slope: 1.506884773, unit: 'cm' },
  TV_LAT: { alpha: 0.5, intercept: 0.249147894, slope: 2.064415385, unit: 'cm' },
  MV_LAT: { alpha: 0.5, intercept: 0.142783317, slope: 2.058261615, unit: 'cm' },
  MPA: { alpha: 0.5, intercept: 0.117718176, slope: 1.682071763, unit: 'cm' },
  LPA: { alpha: 0.5, intercept: 0.001348966, slope: 1.109745289, unit: 'cm' },
  RPA: { alpha: 0.5, intercept: -0.008988176, slope: 1.0887785, unit: 'cm' },
  MV_AP: { alpha: 0.5, intercept: 0.082924814, slope: 2.208397289, unit: 'cm' },
  TV_AP: { alpha: 0.5, intercept: -0.060825454, slope: 2.431341306, unit: 'cm' },
  ROOT: { alpha: 0.5, intercept: 0.025841881, slope: 2.034421612, unit: 'cm' },
  STJ: { alpha: 0.5, intercept: -0.010501014, slope: 1.706720717, unit: 'cm' },
  AAO: { alpha: 0.5, intercept: 0.037633274, slope: 1.742197392, unit: 'cm' },
  ARCH_PROX: { alpha: 0.5, intercept: -0.164254288, slope: 1.729068410, unit: 'cm' },
  ARCH_DIST: { alpha: 0.5, intercept: -0.064930281, slope: 1.436019255, unit: 'cm' },
  ISTH: { alpha: 0.5, intercept: 0.060606576, slope: 1.182100289, unit: 'cm' },
  LMCA: { alpha: 0.45, intercept: 0.110674881, slope: 2.820117190, unit: 'mm' },
  LAD: { alpha: 0.45, intercept: 0.052951441, slope: 1.839996768, unit: 'mm' },
  RCA: { alpha: 0.45, intercept: 0.012047694, slope: 2.301336377, unit: 'mm' },
  PV_SAX: { alpha: 0.5, intercept: 0.009528205, slope: 1.907058780, unit: 'cm' },
  PV_LAX: { alpha: 0.5, intercept: -0.220768333, slope: 2.286834232, unit: 'cm' },
  LVEDD: { alpha: 0.45, intercept: 0.045047560, slope: 3.843553561, unit: 'cm' },
  LVPWT: { alpha: 0.4, intercept: -0.006805387, slope: 0.572766918, unit: 'cm' },
  LVST: { alpha: 0.4, intercept: 0.008416262, slope: 0.566410942, unit: 'cm' },
  LVEDL: { alpha: 0.45, intercept: -0.079863429, slope: 6.410199218, unit: 'cm' },
  LVEDL_EPI: { alpha: 0.45, intercept: -0.067593474, slope: 6.950057220, unit: 'cm' },
  LVESD: null
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
  IVSD: { label: 'IVSd', phnKey: 'LVST', pettersenKey: 'IVSD' },
  IVSS: { label: 'IVSs', phnKey: null, pettersenKey: 'IVSS' },
  LVIDD: { label: 'LVIDd', phnKey: 'LVEDD', pettersenKey: 'LVIDD' },
  LVIDS: { label: 'LVIDs', phnKey: 'LVESD', pettersenKey: 'LVIDS' },
  LVPWD: { label: 'LVPWd', phnKey: 'LVPWT', pettersenKey: 'LVPWD' },
  LVPWS: { label: 'LVPWs', phnKey: null, pettersenKey: 'LVPWS' },
  AOV_ANN: { label: 'Aortic valve annulus', phnKey: 'ANN', pettersenKey: 'AOV_ANN' },
  SOV: { label: 'Sinuses of Valsalva', phnKey: 'ROOT', pettersenKey: 'SOV' },
  STJ: { label: 'Sinotubular junction', phnKey: 'STJ', pettersenKey: 'STJ' },
  TRANSVERSE_ARCH: { label: 'Transverse aortic arch', phnKey: null, pettersenKey: 'TRANSVERSE_ARCH' },
  AORTIC_ISTHMUS: { label: 'Aortic isthmus', phnKey: 'ISTH', pettersenKey: 'AORTIC_ISTHMUS' },
  DISTAL_ARCH: { label: 'Distal aortic arch', phnKey: 'ARCH_DIST', pettersenKey: 'DISTAL_ARCH' },
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
