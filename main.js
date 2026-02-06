'use strict';

//
// GDP Calculator summary
// - Allows selecting preset or custom target DO₂i values, then calculates required pump flow.
// - Computes CaO₂, current DO₂i (when flow is given), and classifies status vs. the chosen target.
// - Gauge visual centers around the target DO₂i and shows adequacy bands with inline messaging.
// Normothermic baseline only; DO₂i targets are anchored at 37 °C without temperature adjustments.

// -----------------------------
// Theme Management (Dark Mode)
// -----------------------------
const html = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');
const sunIcon = document.getElementById('icon-sun');
const moonIcon = document.getElementById('icon-moon');

function updateThemeUI(isDark) {
  if (isDark) {
    html.classList.add('dark');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
    localStorage.setItem('theme', 'dark');
  } else {
    html.classList.remove('dark');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
    localStorage.setItem('theme', 'light');
  }
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
updateThemeUI(savedTheme === 'dark' || (!savedTheme && prefersDark));

themeToggle.addEventListener('click', () => {
  const isDark = html.classList.contains('dark');
  updateThemeUI(!isDark);
});

// -----------------------------
// Utilities & Core Formulas
// -----------------------------
function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function parseTimeToMinutes(str) {
  if (!str) return null;
  const cleaned = str.trim();
  const numericOnly = cleaned.replace(/\D/g, '');
  if (numericOnly.length === 4) {
    const h = Number(numericOnly.slice(0, 2));
    const m = Number(numericOnly.slice(2, 4));
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(cleaned);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23) return null;
  return h * 60 + m;
}

function formatDuration(mins) {
  if (mins == null || mins < 0) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const mm = m.toString().padStart(2, '0');
  return `${mins} min (${h}:${mm})`;
}

function formatMinutesToHHMM(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = Math.max(totalMins % 60, 0);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function getCurrentTimeHHMM() {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

const CANONICAL_BASE = 'https://perfusiontools.com';
const FALLBACK_META = {
  title: 'Calculator – Perfusion Tools',
  description: 'Comprehensive perfusion calculators for CPB & ECMO including BSA, Heparin dosing, and more.',
  canonicalPath: '/'
};

function getRouteMeta(path) {
  const metaSource = window.routeMeta || {};
  const normalized = window.normalizeRoute ? window.normalizeRoute(path) : path;
  return metaSource[normalized] || metaSource['/'] || FALLBACK_META;
}

function updateMetaForRoute(path) {
  const meta = getRouteMeta(path);

  if (window.applyRouteMeta) window.applyRouteMeta(path);

  const setContent = (selector, attr, value) => {
    const tag = document.querySelector(selector);
    if (tag && value) tag.setAttribute(attr, value);
  };

  setContent('meta[name="description"]', 'content', meta.description || FALLBACK_META.description);
  setContent('meta[property="og:title"]', 'content', meta.title || FALLBACK_META.title);
  setContent('meta[property="og:description"]', 'content', meta.description || FALLBACK_META.description);
  setContent('meta[name="twitter:title"]', 'content', meta.title || FALLBACK_META.title);
  setContent('meta[name="twitter:description"]', 'content', meta.description || FALLBACK_META.description);

  const canonicalTag = document.querySelector('link[rel="canonical"]');
  if (canonicalTag) {
    const canonicalPath = meta.canonicalPath || FALLBACK_META.canonicalPath || '/';
    canonicalTag.setAttribute('href', `${CANONICAL_BASE}${canonicalPath}`);
  }
}

const BSA = {
  Mosteller(h, w) {
    return Math.sqrt((h * w) / 3600);
  },
  DuBois(h, w) {
    return 0.007184 * Math.pow(h, 0.725) * Math.pow(w, 0.425);
  },
  Haycock(h, w) {
    return 0.024265 * Math.pow(h, 0.3964) * Math.pow(w, 0.5378);
  },
  // Boyd formula uses weight in grams with an exponent adjustment for high BMI accuracy
  Boyd(h, w) {
    const wGrams = (w || 0) * 1000;
    const exponent = 0.7285 - (0.0188 * Math.log10(Math.max(wGrams, 1)));
    return 0.0003207 * Math.pow(h, 0.3) * Math.pow(wGrams, exponent);
  },
  GehanGeorge(h, w) {
    return 0.0235 * Math.pow(h, 0.42246) * Math.pow(w, 0.51456);
  },
};

function computeBSA(h, w, method) {
  if (!h || !w || h <= 0 || w <= 0) return 0;
  const fn = BSA[method] || BSA.Mosteller;
  return fn(h, w);
}

function updateBsaFlowList(bsaVal) {
  const list = el('bsa-flow-list');
  if (!list) return;

  list.innerHTML = '';
  if (!bsaVal) {
    list.innerHTML = '<p class="text-xs text-slate-500 dark:text-slate-400">Enter height and weight to populate the flow table.</p>';
    return;
  }

  for (let ciTenths = 10; ciTenths <= 30; ciTenths += 2) {
    const ci = ciTenths / 10;
    const flow = ci * bsaVal;
    const row = document.createElement('div');
    const highlight = Math.abs(ci - 2.4) < 0.05;
    row.className = 'grid grid-cols-[1fr_auto] items-center py-1.5 px-2 text-sm border-b border-slate-100 dark:border-primary-800 last:border-0 gap-3' + (highlight ? ' bg-amber-50 dark:bg-amber-900/20' : '');
    row.innerHTML = `<span class="font-mono text-xs text-slate-500 dark:text-slate-400">CI ${ci.toFixed(1)}</span><span class="font-mono font-semibold text-right text-primary-900 dark:text-white">${flow.toFixed(2)} l/min</span>`;
    list.appendChild(row);
  }
}

function updateStandaloneBsa() {
  const h = num('bsa_height');
  const w = num('bsa_weight');
  const method = el('bsa-method-standalone') ? el('bsa-method-standalone').value : 'Mosteller';

  const v = computeBSA(h, w, method);
  const resultEl = el('bsa-result');
  if (resultEl) {
    resultEl.textContent = v ? v.toFixed(2) : '0.00';
  }
  const resultDisplay = el('bsa-result-display');
  if (resultDisplay) {
    resultDisplay.textContent = v ? `${v.toFixed(2)} m²` : '—';
  }
  const methodActive = el('bsa-method-active');
  if (methodActive) methodActive.textContent = method;

  updateBsaFlowList(v);
}

function calcCaO2(hb, sao2pct, pao2) {
  const s = clamp((sao2pct || 0) / 100, 0, 1);
  return (1.34 * (hb || 0) * s) + (0.0031 * (pao2 || 0));
}

function calcDO2i(flowLmin, bsa, cao2) {
  if (!bsa || bsa <= 0) return 0;
  const fi = flowLmin / bsa;
  return fi * cao2 * 10;
}

const PATIENT_TYPE_COEFS = {
  adult_m: 70,
  adult_f: 65,
  child: 75,
  infant: 80,
  neonate: 90
};

function ebvCoef(pttype) {
  return PATIENT_TYPE_COEFS[pttype] || 70;
}

function computePredictedHct({ pttype, weight, pre, prime, fluids = 0, removed = 0, rbcUnits = 0, rbcUnitVol = 300, rbcHct = 60, ebvCoefValue }) {
  const coef = ebvCoefValue || ebvCoef(pttype);
  const ebv = (weight || 0) * coef;
  const rbcVolAdded = (rbcUnits || 0) * (rbcUnitVol || 0);
  const rbcVolume = (ebv * ((pre || 0) / 100)) + (rbcVolAdded * ((rbcHct || 0) / 100));
  const totalVol = ebv + (prime || 0) + (fluids || 0) + rbcVolAdded - (removed || 0);
  const hct = totalVol > 0 ? (rbcVolume / totalVol) * 100 : 0;
  return { ebv, totalVol, hct };
}

// -----------------------------
// Heparin management (new UI)
// -----------------------------
// Devine Ideal Body Weight (IBW) formula using metric inputs:
// Male: 50 + 0.91 × (height_cm − 152.4)
// Female: 45.5 + 0.91 × (height_cm − 152.4)
function computeDevineIbw(heightCm, sex) {
  if (!(heightCm > 0)) return null;
  const offset = heightCm - 152.4;
  if (sex === 'male') return 50 + 0.91 * offset;
  if (sex === 'female') return 45.5 + 0.91 * offset;
  return null;
}

let hepDoseUnit = 300;
let hepResistance = false;

function setHepDoseButtons(activeDose) {
  document.querySelectorAll('[data-hep-dose]').forEach(btn => {
    if (!btn.dataset.hepDose) return;
    const isActive = Number(btn.dataset.hepDose) === activeDose;
    btn.classList.toggle('active-dose', isActive);
  });
}

function computeHeparinPlan({ heightCm, weightKg, sex, doseUnit, weightStrategy }) {
  if (!(heightCm > 0) || !(weightKg > 0)) return null;
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const ibw = computeDevineIbw(heightCm, sex) || weightKg;
  const excess = weightKg - ibw;
  const abwStandard = ibw + 0.4 * excess;
  const abwSuperObese = ibw + 0.3 * excess;

  let dosingWeight = weightKg;
  let strategyLabel = 'TBW (Standard)';
  let alertLevel = 'low';

  if (weightStrategy === 'auto') {
    if (bmi < 30) {
      dosingWeight = weightKg;
      strategyLabel = 'TBW (Standard)';
    } else if (bmi < 40) {
      dosingWeight = abwStandard;
      strategyLabel = 'ABW (0.4 correction)';
      alertLevel = 'medium';
    } else {
      dosingWeight = abwSuperObese;
      strategyLabel = 'ABW (0.3 super-obese)';
      alertLevel = 'high';
    }
  } else if (weightStrategy === 'tbw') {
    dosingWeight = weightKg;
    strategyLabel = 'TBW (Manual)';
  } else if (weightStrategy === 'ibw') {
    dosingWeight = ibw;
    strategyLabel = 'IBW (Manual)';
  } else if (weightStrategy === 'abw') {
    dosingWeight = bmi >= 40 ? abwSuperObese : abwStandard;
    strategyLabel = 'ABW (Manual)';
  }

  const initialBolus = Math.round(dosingWeight * doseUnit);
  const tbwBolus = Math.round(weightKg * doseUnit);
  const difference = tbwBolus - initialBolus;
  const isHighDose = initialBolus > 40000;
  const additionalBolus = Math.round(dosingWeight * (hepResistance ? 100 : 50));

  // DuBois BSA approximation used here (0.007184 × H^0.725 × W^0.425)
  const bsaActual = 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
  let bsaCapped = false;
  if (bmi > 35 && bsaActual > 2.5) {
    bsaCapped = true;
  }

  return {
    bmi,
    ibw,
    abw: abwStandard,
    abwSuper: abwSuperObese,
    tbw: weightKg,
    dosingWeight,
    strategyLabel,
    alertLevel,
    initialBolus,
    tbwBolus,
    difference,
    isHighDose,
    additionalBolus,
    bsaActual,
    bsaCapped,
  };
}

function updateHeparinUI() {
  const heightInput = el('hep2-height');
  const weightInput = el('hep2-weight');
  const sex = el('hep2-sex')?.value || 'male';
  const weightStrategy = el('hep2-weight-strategy')?.value || 'auto';

  hepResistance = false;

  const height = parseFloat(heightInput?.value);
  const weight = parseFloat(weightInput?.value);

  const heightError = el('hep2-height-error');
  const weightError = el('hep2-weight-error');

  const hasHeight = heightInput && heightInput.value !== '';
  const hasWeight = weightInput && weightInput.value !== '';

  const heightValid = height > 50 && height < 250;
  const weightValid = weight > 20 && weight < 300;

  if (heightError) heightError.classList.toggle('hidden', !hasHeight || heightValid);
  if (weightError) weightError.classList.toggle('hidden', !hasWeight || weightValid);

  const placeholder = el('hep2-placeholder');
  const results = el('hep2-results');

  if (!(heightValid && weightValid)) {
    if (results) results.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }

  const plan = computeHeparinPlan({ heightCm: height, weightKg: weight, sex, doseUnit: hepDoseUnit, weightStrategy });
  if (!plan) {
    if (results) results.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }

  const setText = (id, text) => {
    const node = el(id);
    if (node) node.textContent = text;
  };

  setText('hep2-bmi', plan.bmi.toFixed(1));
  setText('hep2-ibw', plan.ibw.toFixed(1));
  setText('hep2-bsa', plan.bsaActual.toFixed(2));
  setText('hep2-dosing-weight', plan.dosingWeight.toFixed(1));
  setText('hep2-dosing-note', plan.strategyLabel);

  const capBadge = el('hep2-bsa-cap');
  if (capBadge) capBadge.classList.toggle('hidden', !plan.bsaCapped);

  setText('hep2-initial-bolus', plan.initialBolus.toLocaleString());
  setText('hep2-add-bolus', `${plan.additionalBolus.toLocaleString()} U`);

  const weightBreakdown = el('hep2-weight-breakdown');
  if (weightBreakdown) {
    const tbw = plan.tbw.toFixed(1);
    const ibw = plan.ibw.toFixed(1);
    const abw04 = plan.abw.toFixed(1);
    const abw03 = plan.abwSuper.toFixed(1);
    if (weightStrategy === 'auto') {
      if (plan.bmi < 30) {
        weightBreakdown.innerHTML = `Dosing weight = TBW = ${tbw} kg (BMI < 30 → TBW used).`;
      } else if (plan.bmi < 40) {
        weightBreakdown.innerHTML = `ABW (0.4 rule) = IBW + 0.4 × (TBW − IBW)<br>= ${ibw} kg + 0.4 × (${tbw} − ${ibw}) kg<br>= ${abw04} kg`;
      } else {
        weightBreakdown.innerHTML = `ABW (0.3 super-obese) = IBW + 0.3 × (TBW − IBW)<br>= ${ibw} kg + 0.3 × (${tbw} − ${ibw}) kg<br>= ${abw03} kg`;
      }
    } else if (weightStrategy === 'tbw') {
      weightBreakdown.innerHTML = `Dosing weight = TBW = ${tbw} kg (manual choice).`;
    } else if (weightStrategy === 'ibw') {
      weightBreakdown.innerHTML = `Dosing weight = IBW (Devine) = ${ibw} kg.`;
    } else {
      weightBreakdown.innerHTML = `Dosing weight = ABW (manual) = ${abw04} kg (BMI < 40) or ${abw03} kg (BMI ≥ 40).`;
    }
    weightBreakdown.classList.remove('hidden');
  }

  const highDose = el('hep2-high-dose');
  if (highDose) highDose.classList.toggle('hidden', !plan.isHighDose);

  const diffNote = el('hep2-diff-note');
  if (diffNote) {
    if (plan.difference !== 0) {
      const sign = plan.difference > 0 ? '+' : '';
      diffNote.textContent = `TBW would be ${plan.tbwBolus.toLocaleString()} U (${sign}${plan.difference.toLocaleString()})`;
      diffNote.classList.remove('hidden');
    } else {
      diffNote.textContent = '';
      diffNote.classList.add('hidden');
    }
  }

  const steps = el('hep2-quick-steps')?.querySelectorAll('li');
  if (steps && steps.length >= 4) {
    steps[0].textContent = `Bolus ${plan.initialBolus.toLocaleString()} U IV`;
    steps[1].textContent = 'Wait 3–5 min → Check ACT';
    steps[2].textContent = 'Monitor ACT q30min during CPB';
    steps[3].textContent = `If ACT low: +${plan.additionalBolus.toLocaleString()} U bolus`;
  }

  const sensAbwDose = Math.round(plan.abw * 300);
  const sensTbwDose = Math.round(plan.tbw * 300);
  const sensIbwDose = Math.round(plan.ibw * 300);
  setText('hep2-sens-abw-wt', `${plan.abw.toFixed(1)} kg`);
  setText('hep2-sens-abw-dose', `${sensAbwDose.toLocaleString()} U (reference)`);
  setText('hep2-sens-tbw-wt', `${plan.tbw.toFixed(1)} kg`);
  setText('hep2-sens-tbw-dose', `${sensTbwDose.toLocaleString()} U (${(sensTbwDose - sensAbwDose >= 0 ? '+' : '')}${(sensTbwDose - sensAbwDose).toLocaleString()} vs ABW)`);
  setText('hep2-sens-ibw-wt', `${plan.ibw.toFixed(1)} kg`);
  setText('hep2-sens-ibw-dose', `${sensIbwDose.toLocaleString()} U (${(sensIbwDose - sensAbwDose >= 0 ? '+' : '')}${(sensIbwDose - sensAbwDose).toLocaleString()} vs ABW)`);

  const pedsWarning = el('hep2-peds-warning');
  if (pedsWarning) pedsWarning.classList.toggle('hidden', !(weight < 20 || height < 120));

  const extremeObesity = el('hep2-extreme-obesity');
  if (extremeObesity) extremeObesity.classList.toggle('hidden', plan.bmi < 50);

  const obesityBlock = el('hep2-obesity-warning');
  if (obesityBlock) obesityBlock.classList.toggle('hidden', plan.alertLevel !== 'high');

  if (results) results.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');
}

function initHeparinManagement() {
  // Avoid double-binding listeners if this initializer runs more than once (e.g., repeated hash navigation)
  if (initHeparinManagement.initialized) {
    updateHeparinUI();
    return;
  }
  initHeparinManagement.initialized = true;

  setHepDoseButtons(hepDoseUnit);

  document.querySelectorAll('[data-hep-dose]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.hepDose);
      hepDoseUnit = Number.isFinite(val) ? val : hepDoseUnit;
      setHepDoseButtons(hepDoseUnit);
      updateHeparinUI();
    });
  });

  const weightInfoToggle = el('hep2-weight-info-toggle');
  const weightInfo = el('hep2-weight-info');
  if (weightInfoToggle && weightInfo) {
    weightInfoToggle.addEventListener('click', () => {
      weightInfo.classList.toggle('hidden');
    });
  }

  const resistanceToggle = el('hep2-resistance-toggle');
  const resistanceContent = el('hep2-resistance-content');
  if (resistanceToggle && resistanceContent) {
    resistanceToggle.setAttribute('aria-expanded', 'false');
    resistanceToggle.addEventListener('click', () => {
      const isExpanded = resistanceToggle.getAttribute('aria-expanded') === 'true';
      const nextState = !isExpanded;
      resistanceToggle.setAttribute('aria-expanded', String(nextState));
      resistanceContent.classList.toggle('hidden', !nextState);
      const chevron = resistanceToggle.querySelector('[data-chevron]');
      if (chevron) chevron.classList.toggle('rotate-180', nextState);
    });
  }

  ['hep2-height', 'hep2-weight', 'hep2-sex', 'hep2-weight-strategy', 'hep2-rf-sirs', 'hep2-rf-lmwh', 'hep2-rf-ecmo', 'hep2-rf-at3', 'hep2-rf-history'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('input', updateHeparinUI);
    if (node && node.tagName === 'SELECT') node.addEventListener('change', updateHeparinUI);
    if (node && node.type === 'checkbox') node.addEventListener('change', updateHeparinUI);
  });

  updateHeparinUI();
}
initHeparinManagement.initialized = false;

// -----------------------------
// LBM Calculation (NEW)
// -----------------------------
function computeLBM({ sex, h, w, formula }) {
  if (!h || !w) return 0;
  if (formula === 'Boer') {
    if (sex === 'male') return 0.407 * w + 0.267 * h - 19.2;
    else return 0.252 * w + 0.473 * h - 48.3;
  } else {
    if (sex === 'male') return 0.32810 * w + 0.33929 * h - 29.5336;
    else return 0.29569 * w + 0.41813 * h - 43.2933;
  }
}

function bmiCategory(bmi) {
  if (!bmi) return '—';
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal weight';
  if (bmi < 30) return 'Overweight';
  return 'Obesity';
}

// -----------------------------
// DOM Helpers
// -----------------------------
function el(id) {
  return document.getElementById(id);
}

function num(id) {
  const n = el(id);
  return n ? (parseFloat(n.value) || 0) : 0;
}

function setText(id, text) {
  const n = el(id);
  if (n) n.innerHTML = text;
}

// -----------------------------
// GDP Interaction
// -----------------------------
  const gdpIds = ['h_cm', 'w_kg', 'bsa', 'bsa-method', 'flow', 'hb', 'sao2', 'pao2'];
  let lastChangedId = null;
  let bsaManualOverride = false;
  let targetDO2i = 280;
  let targetMode = 'preset'; // 'preset' | 'custom'

  function getGdpInputs() {
    const bsaVal = el('bsa').value;
    const hbVal = el('hb').value;
    const sao2Val = el('sao2').value;
    const pao2Val = el('pao2').value;
    const flowVal = el('flow').value;

    return {
      bsaVal,
      hbVal,
      sao2Val,
      pao2Val,
      flowVal
    };
  }

  function computeGdpResults(inputs) {
    const bsa = parseFloat(inputs.bsaVal) || 0;
  const flow = parseFloat(inputs.flowVal) || 0;
  const hb = parseFloat(inputs.hbVal) || 0;
    const sao2 = parseFloat(inputs.sao2Val) || 0;
    const pao2 = parseFloat(inputs.pao2Val) || 0;
    const currentCI = bsa ? flow / bsa : 0;
    const cao2 = calcCaO2(hb, sao2, pao2);
    const currentDO2i = flow ? calcDO2i(flow, bsa, cao2) : 0;
    const baseTarget = targetDO2i;
    const normothermicMin = Math.round(baseTarget * 0.9);
    const normothermicMax = Math.round(baseTarget * 1.1);
    const flowTargetDo2i = (normothermicMin + normothermicMax) / 2;
    const requiredFlow = calcRequiredFlowLmin(flowTargetDo2i, bsa, cao2);

    return {
      bsa,
      hb,
      sao2,
      pao2,
      flow,
      currentCI,
      cao2,
      requiredFlow,
      currentDO2i,
      baseTarget,
      normothermicMin,
      normothermicMax,
      recommendedMin: normothermicMin,
      recommendedMax: normothermicMax
    };
  }

function updateBSA() {
  const autoFields = ['h_cm', 'w_kg', 'bsa-method'];
  if (bsaManualOverride && !autoFields.includes(lastChangedId)) {
    setText('bsa-hint', el('bsa').value ? 'manual' : 'auto-calc');
    return;
  }

  if (autoFields.includes(lastChangedId)) {
    bsaManualOverride = false;
  }

  const h = num('h_cm'), w = num('w_kg');
  const method = el('bsa-method').value;
  const v = computeBSA(h, w, method);
  const out = v ? v.toFixed(2) : '';
  el('bsa').value = out;
  setText('bsa-hint', out ? 'calculated' : 'auto-calc');
}

function calcRequiredFlowLmin(target, bsa, cao2) {
  if (!target || !bsa || !cao2) return 0;
  // DO2i = (Flow / BSA) * CaO2 * 10  →  Flow = DO2i * BSA / (CaO2 * 10)
  return (target * bsa) / (cao2 * 10);
}

function updateTargetDisplay() {
  ['target-260', 'target-280', 'target-300', 'target-360', 'target-custom-pill'].forEach(id => {
    const btn = el(id);
    if (!btn) return;
    const active =
      (id === 'target-260' && targetDO2i === 260 && targetMode === 'preset') ||
      (id === 'target-280' && targetDO2i === 280 && targetMode === 'preset') ||
      (id === 'target-300' && targetDO2i === 300 && targetMode === 'preset') ||
      (id === 'target-360' && targetDO2i === 360 && targetMode === 'preset') ||
      (id === 'target-custom-pill' && targetMode === 'custom');
    btn.className = 'px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors ' + (active
      ? 'bg-accent-500/10 border-accent-500 text-accent-600 dark:text-accent-400 shadow-sm'
      : 'bg-white dark:bg-primary-800 border-slate-200 dark:border-primary-700 text-slate-600 dark:text-slate-300 hover:border-accent-500/50');
  });
}

function updateGDP() {
  updateBSA();

  const inputs = getGdpInputs();
  const results = computeGdpResults(inputs);

  const warningEl = el('gdp-warning');
  const requiredMissing = [];
  if (!inputs.bsaVal) requiredMissing.push('BSA');
  if (!inputs.hbVal) requiredMissing.push('Hemoglobin');
  if (!inputs.sao2Val) requiredMissing.push('SaO₂');
  if (!inputs.pao2Val) requiredMissing.push('PaO₂');
  if (!targetDO2i) requiredMissing.push('Target DO₂i');

  const gauge = el('gdp-gauge');
  const gaugeMsg = el('gdp-gauge-msg');
  const statusText = el('gdp-status-text');
  const statusDetail = el('gdp-status-detail');
  const ciCommentEl = el('ci-comment');

  el('cao2').value = results.cao2 ? results.cao2.toFixed(2) : '';

  if (requiredMissing.length || !results.bsa || !results.hb || !results.sao2 || !results.pao2 || !targetDO2i) {
    if (warningEl) {
      warningEl.textContent = `Enter required fields: ${requiredMissing.join(', ')}`;
      warningEl.classList.remove('hidden');
    }
    setText('required-flow', '—');
    setText('current-do2i', '—');
    statusText.textContent = 'Awaiting data';
    statusDetail.textContent = 'Provide required inputs to evaluate target vs. current flow.';
    gauge.style.width = '0%';
    gauge.className = 'h-3 rounded-full bg-gradient-to-r from-slate-300 to-slate-200 dark:from-primary-800 dark:to-primary-700 transition-all duration-700 ease-out';
    gaugeMsg.textContent = 'Enter current flow to visualize DO₂i vs. target';
    return;
  }

  if (warningEl) warningEl.classList.add('hidden');

  setText('required-flow', results.requiredFlow ? `${results.requiredFlow.toFixed(2)} <span class="text-xs text-slate-500 dark:text-slate-400">l/min</span>` : '—');
  setText('current-do2i', results.currentDO2i ? `${Math.round(results.currentDO2i)} <span class="text-xs text-slate-500 dark:text-slate-400">ml/min/m²</span>` : '—');

  let statusLabel = 'Waiting for current flow';
  let detail = 'Enter current pump flow to compare against the target DO₂i.';
  let gaugeColor = 'from-slate-300 to-slate-200 dark:from-primary-800 dark:to-primary-700';
  let gaugeWidth = '0%';
  let ciComment = results.currentCI ? `Current CI ${results.currentCI.toFixed(2)} l/min/m².` : '';

  const lowerTarget = results.recommendedMin;
  const upperTarget = results.recommendedMax;

  if (results.currentDO2i > 0) {
    const denom = upperTarget > 0 ? upperTarget * 1.05 : targetDO2i || 1;
    const pct = clamp((results.currentDO2i / denom) * 100, 0, 100);
    gaugeWidth = `${pct}%`;

    if (results.currentDO2i < lowerTarget) {
      const deltaFlow = Math.max(results.requiredFlow - results.flow, 0);
      statusLabel = 'Below target';
      detail = deltaFlow > 0
        ? `Needs approximately +${deltaFlow.toFixed(2)} l/min to reach the target.`
        : 'Increase flow to approach the target.';
      gaugeColor = 'from-amber-500 to-red-500';
    } else if (results.currentDO2i > upperTarget) {
      statusLabel = 'Above target';
      detail = 'Above the goal—verify this is intentional and hemodynamically tolerated.';
      gaugeColor = 'from-sky-500 to-blue-500';
    } else {
      statusLabel = 'At / near target';
      detail = 'Current delivery is within ±10% of the selected DO₂i goal.';
      gaugeColor = 'from-emerald-500 to-emerald-400';
    }
  }

  statusText.textContent = statusLabel;
  statusDetail.textContent = detail;
  if (ciCommentEl) ciCommentEl.textContent = ciComment;
  gauge.style.width = gaugeWidth;
  gauge.className = `h-3 rounded-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,211,238,0.25)] ${gaugeColor}`;
  if (gaugeMsg) {
    const guidelineLine = '<p>Guideline DO₂i (37°C): 280–300 ml/min/m²</p>';
    const userAdjustedLine = `<p>Selected DO₂i target range: ${results.recommendedMin}–${results.recommendedMax} ml/min/m²</p>`;
    const flowLine = results.currentDO2i
      ? `<p class="text-[11px] text-slate-200/80">Current DO₂i: ${Math.round(results.currentDO2i)} ml/min/m²</p>`
      : '<p class="text-[11px] text-slate-200/70">Enter current flow to visualize DO₂i against targets.</p>';
    gaugeMsg.innerHTML = `${guidelineLine}${userAdjustedLine}${flowLine}`;
  }
}

function resetGDP() {
  ['h_cm', 'w_kg', 'bsa', 'flow', 'hb', 'sao2', 'pao2'].forEach(id => {
    const n = el(id);
    if (n) n.value = '';
  });
  const customInput = el('target-custom');
  if (customInput) customInput.value = '';
  targetDO2i = 280;
  targetMode = 'preset';
  bsaManualOverride = false;
  const cao2El = el('cao2');
  if (cao2El) cao2El.value = '';
  updateTargetDisplay();
  updateGDP();
}

// -----------------------------
// Predicted Hct Interaction
// -----------------------------
function updateHct() {
  const pttype = el('pttype').value;
  const payload = {
    pttype,
    weight: num('wt_hct'),
    pre: num('pre_hct'),
    prime: num('prime'),
    fluids: num('fluids'),
    removed: num('removed'),
    rbcUnits: num('rbc_units'),
    rbcUnitVol: num('rbc_unit_vol'),
    rbcHct: num('rbc_hct'),
    ebvCoefValue: num('ebv_coef')
  };
  const r = computePredictedHct(payload);
  setText('ebv', r.ebv ? r.ebv.toFixed(0) : '0');
  setText('total_vol', r.totalVol ? r.totalVol.toFixed(0) : '0');
  setText('pred_hct', r.hct ? r.hct.toFixed(1) + '%' : '0%');
}

function applyDefaultEbvCoef(pttype) {
  const coefInput = el('ebv_coef');
  if (!coefInput) return;
  coefInput.value = ebvCoef(pttype);
}

// -----------------------------
// LBM Interaction (NEW)
// -----------------------------
function renderLBMFlowTable(bsaActual, bsaLean) {
  const tbody = el('lbm-ci-tbody');
  const hint = el('lbm-ci-hint');
  if (!tbody || !hint) return;

  if (!bsaActual || bsaActual <= 0) {
    tbody.innerHTML = '';
    hint.textContent = 'Enter height and weight to view flow comparison.';
    return;
  }

  const hasLean = bsaLean && bsaLean > 0;
  const rows = [];

  for (let ciTenth = 10; ciTenth <= 30; ciTenth += 2) {
    const ci = ciTenth / 10;
    const flowActual = (ci * bsaActual).toFixed(2);
    const flowLean = hasLean ? (ci * bsaLean).toFixed(2) : null;
    const highlight = Math.abs(ci - 2.4) < 0.001;

    rows.push(`
      <tr class="${highlight ? 'bg-accent-500/5 dark:bg-accent-500/10' : ''}">
        <td class="py-1 pr-4">${ci.toFixed(1)}</td>
        <td class="py-1 pr-4">${flowActual}</td>
        <td class="py-1">${flowLean || '—'}</td>
      </tr>
    `);
  }

  tbody.innerHTML = rows.join('');
  hint.textContent = hasLean
    ? 'Flows scaled by Mosteller BSA (actual vs. lean).'
    : 'LBM unavailable — lean-based flow shows —.';
}

function updateLBM() {
  const h = num('lbm_h_cm');
  const w = num('lbm_w_kg');
  const sex = el('lbm_sex').value;
  const formula = el('lbm_formula').value;
  const bsaMethod = el('lbm_bsa_formula') ? el('lbm_bsa_formula').value : 'Mosteller';

  const bsaLabelMap = {
    Mosteller: 'Mosteller formula',
    DuBois: 'DuBois formula',
    Haycock: 'Haycock formula',
    GehanGeorge: 'Gehan–George formula'
  };

  const lbm = computeLBM({ sex, h, w, formula });
  setText(
    'lbm_result',
    lbm
      ? `${lbm.toFixed(1)} <span class="text-lg font-normal text-slate-400">kg</span>`
      : `0 <span class="text-lg font-normal text-slate-400">kg</span>`
  );

  const heightM = h ? h / 100 : 0;
  const bmi = h && w ? w / (heightM * heightM) : 0;
  setText('bmi_value', bmi ? bmi.toFixed(1) : '—');
  setText('bmi_badge', bmiCategory(bmi));

  const bsaActual = computeBSA(h, w, bsaMethod);
  const bsaLean = lbm ? computeBSA(h, lbm, bsaMethod) : 0;

  setText('bsa_actual_value', bsaActual ? `${bsaActual.toFixed(2)} m²` : '—');
  setText(
    'bsa_actual_note',
    bsaActual ? bsaLabelMap[bsaMethod] || 'Mosteller formula' : 'Enter height and weight to calculate BSA'
  );
  setText('bsa_lean_value', bsaLean ? `${bsaLean.toFixed(2)} m²` : '—');
  setText(
    'bsa_lean_note',
    lbm
      ? `${bsaLabelMap[bsaMethod] || 'Mosteller formula'} using ${formula} LBM ${lbm.toFixed(1)} kg`
      : 'Enter height and weight to calculate LBM'
  );

  const flowBody = el('lbm-flow-rows');
  if (flowBody) {
    flowBody.innerHTML = '';
    if (!bsaActual && !bsaLean) {
      const row = document.createElement('tr');
      row.innerHTML = '<td class="px-4 py-3 text-sm text-slate-500 dark:text-slate-400" colspan="3">Enter height and weight to populate flows.</td>';
      flowBody.appendChild(row);
    } else {
      for (let ci = 1.0; ci <= 3.0001; ci += 0.2) {
        const tr = document.createElement('tr');
        const isHighlight = ci >= 2.2 && ci <= 2.4;
        if (isHighlight) {
          tr.classList.add('bg-slate-50', 'dark:bg-primary-800/40');
        }
        const flowActual = bsaActual ? (ci * bsaActual).toFixed(2) : '—';
        const flowLean = bsaLean ? (ci * bsaLean).toFixed(2) : '—';
        tr.innerHTML = `
          <td class="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">${ci.toFixed(1)}</td>
          <td class="px-4 py-2 font-semibold text-primary-900 dark:text-white">${flowActual} l/min</td>
          <td class="px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">${flowLean} l/min</td>
        `;
        flowBody.appendChild(tr);
      }
    }
  }
}

// -----------------------------
// Priming Volume Calculator
// -----------------------------
const PRIMING_TUBE_IDS = [
  { key: '1/2', label: '1/2"', idInch: 0.5, idMm: 12.7 },
  { key: '3/8', label: '3/8"', idInch: 0.375, idMm: 9.525 },
  { key: '1/4', label: '1/4"', idInch: 0.25, idMm: 6.35 },
  { key: '3/16', label: '3/16"', idInch: 0.1875, idMm: 4.7625 },
  { key: '3/32', label: '3/32"', idInch: 0.09375, idMm: 2.38125 },
  { key: '1/16', label: '1/16"', idInch: 0.0625, idMm: 1.5875 }
];

function convertLengthToMeters(length, unit) {
  if (!length && length !== 0) return null;
  switch (unit) {
    case 'cm':
      return length / 100;
    case 'm':
      return length;
    case 'ft':
      return length * 0.3048;
    case 'in':
      return length * 0.0254;
    default:
      return length;
  }
}

function calculatePrimingVolumeMl(idMm, lengthM) {
  if (idMm == null || lengthM == null) return null;
  // Formula: V(mL) = (π/4) × ID(mm)^2 × Length(m)
  return (Math.PI / 4) * Math.pow(idMm, 2) * lengthM;
}

function updatePrimingVolume() {
  const idSelect = el('priming-id');
  const lengthInput = el('priming-length');
  const unitSelect = el('priming-length-unit');
  const idMmEl = el('priming-id-mm');
  const mlPerMEl = el('priming-ml-per-m');
  const mlPerCmEl = el('priming-ml-per-cm');
  const lengthMEl = el('priming-length-m');
  const volumeEl = el('priming-volume');
  const lengthError = el('priming-length-error');

  if (!idSelect || !lengthInput || !unitSelect) return;

  const tube = PRIMING_TUBE_IDS.find(item => item.key === idSelect.value);
  if (tube) {
    const mlPerM = (Math.PI / 4) * Math.pow(tube.idMm, 2);
    const mlPerCm = mlPerM / 100;
    if (idMmEl) idMmEl.textContent = tube.idMm.toFixed(4);
    if (mlPerMEl) mlPerMEl.textContent = mlPerM.toFixed(2);
    if (mlPerCmEl) mlPerCmEl.textContent = mlPerCm.toFixed(3);
  } else {
    if (idMmEl) idMmEl.textContent = '—';
    if (mlPerMEl) mlPerMEl.textContent = '—';
    if (mlPerCmEl) mlPerCmEl.textContent = '—';
  }

  const lengthRaw = lengthInput.value.trim();
  const lengthProvided = lengthRaw !== '';
  const lengthValue = lengthProvided ? parseFloat(lengthRaw) : null;
  const lengthInvalid = lengthProvided && (Number.isNaN(lengthValue) || lengthValue < 0);

  if (lengthError) lengthError.classList.toggle('hidden', !lengthInvalid);

  if (lengthInvalid || !lengthProvided) {
    if (lengthMEl) lengthMEl.textContent = '—';
    if (volumeEl) volumeEl.textContent = '—';
    return;
  }

  const lengthM = convertLengthToMeters(lengthValue, unitSelect.value);
  if (lengthMEl) lengthMEl.textContent = lengthM != null ? lengthM.toFixed(4) : '—';

  if (!tube || lengthM == null) {
    if (volumeEl) volumeEl.textContent = '—';
    return;
  }

  const volumeMl = calculatePrimingVolumeMl(tube.idMm, lengthM);
  if (volumeEl) volumeEl.textContent = volumeMl != null ? volumeMl.toFixed(1) : '—';
}

function setTimeError(inputEl, hasError) {
  if (!inputEl) return;
  ['ring-1', 'ring-rose-400', 'border-rose-400'].forEach(cls => inputEl.classList.toggle(cls, hasError));
}

function updateTimeRow(idx) {
  const startInput = document.getElementById(`time-start-${idx}`);
  const endInput = document.getElementById(`time-end-${idx}`);
  const resultEl = document.getElementById(`time-result-${idx}`);
  if (!startInput || !endInput || !resultEl) return;

  const startMin = parseTimeToMinutes(startInput.value);
  const endMin = parseTimeToMinutes(endInput.value);

  const startRaw = startInput.value.trim();
  const endRaw = endInput.value.trim();
  const startDigits = startRaw.replace(/\D/g, '');
  const endDigits = endRaw.replace(/\D/g, '');

  const startReady = startDigits.length >= 4 || /^\d{1,2}:[0-5]\d$/.test(startRaw);
  const endReady = endDigits.length >= 4 || /^\d{1,2}:[0-5]\d$/.test(endRaw);

  setTimeError(startInput, startReady && startMin == null);
  setTimeError(endInput, endReady && endMin == null);

  if (startMin == null || endMin == null) {
    resultEl.textContent = '-';
    return;
  }

  let adjustedEnd = endMin;
  if (endMin < startMin && endMin < 24 * 60 && startMin < 24 * 60) {
    adjustedEnd = endMin + 24 * 60;
    endInput.value = formatMinutesToHHMM(adjustedEnd);
  }

  let diff = adjustedEnd - startMin;
  if (diff < 0) diff += 24 * 60;

  resultEl.textContent = formatDuration(diff);
}

function autoFormatTimeInput(inputEl) {
  if (!inputEl) return;
  const raw = inputEl.value || '';
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 4) {
    const hoursNum = Number(digits.slice(0, 2));
    const minsNum = Number(digits.slice(2, 4));

    if (hoursNum > 23 || minsNum > 59) {
      inputEl.value = '';
      setTimeError(inputEl, true);
      return;
    }

    inputEl.value = `${hoursNum.toString().padStart(2, '0')}:${minsNum.toString().padStart(2, '0')}`;
    setTimeError(inputEl, false);
    return;
  }

  if (!raw.length) setTimeError(inputEl, false);
}

function initTimeCalculator() {
  document.querySelectorAll('input[list="time-suggestions"]').forEach(input => {
    input.dataset.listId = input.getAttribute('list');
    input.removeAttribute('list');
    input.addEventListener('blur', () => {
      if (input.dataset.listId) input.removeAttribute('list');
    });
  });

  for (let i = 1; i <= 5; i++) {
    const s = document.getElementById(`time-start-${i}`);
    const e = document.getElementById(`time-end-${i}`);
    const sNow = document.getElementById(`time-start-now-${i}`);
    const eNow = document.getElementById(`time-end-now-${i}`);
    [s, e, sNow, eNow].forEach(elRef => {
      if (elRef) elRef.removeAttribute('title');
    });
    if (s) {
      s.addEventListener('input', () => { autoFormatTimeInput(s); updateTimeRow(i); });
      s.addEventListener('blur', () => updateTimeRow(i));
    }
    if (e) {
      e.addEventListener('input', () => { autoFormatTimeInput(e); updateTimeRow(i); });
      e.addEventListener('blur', () => updateTimeRow(i));
    }
    if (s && sNow) {
      sNow.addEventListener('click', () => {
        s.value = getCurrentTimeHHMM();
        setTimeError(s, false);
        updateTimeRow(i);
      });
    }
    if (e && eNow) {
      eNow.addEventListener('click', () => {
        e.value = getCurrentTimeHHMM();
        setTimeError(e, false);
        updateTimeRow(i);
      });
    }
  }
}

// -----------------------------
// Contact actions
// -----------------------------
function setupContactActions() {
  const email = 'perfusiontools@gmail.com';
  const mailLink = el('contact-mailto');
  const copyBtn = el('contact-copy');
  const toast = el('contact-toast');
  const emailText = el('contact-email');

  if (mailLink) mailLink.href = `mailto:${email}`;
  if (emailText) emailText.textContent = email;

  const showToast = (message) => {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none', 'hidden');
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
      setTimeout(() => toast.classList.add('hidden'), 250);
    }, 2000);
  };

  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(email);
        } else {
          const ta = document.createElement('textarea');
          ta.value = email;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        showToast('Copied!');
      } catch (err) {
        showToast('Copy failed');
      }
    });
  }
}

// -----------------------------
// Quick Reference (tabs + cards)
// -----------------------------
let quickReferenceInitialized = false;

function getQuickReferenceData() {
  return window.quickReferenceData || { tabs: [] };
}

function getLatestReviewedDate(tabs) {
  const dates = [];
  tabs.forEach(tab => {
    (tab.cards || []).forEach(card => {
      if (card.lastReviewed) dates.push(card.lastReviewed);
    });
  });
  if (!dates.length) return '—';
  return dates.sort().slice(-1)[0];
}

function createQuickReferenceCard(card) {
  const cardEl = document.createElement('div');
  cardEl.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/70 p-4 shadow-sm flex flex-col gap-2';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between gap-2';

  const title = document.createElement('div');
  title.className = 'text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400';
  title.textContent = card.title;

  header.appendChild(title);

  if (card.info) {
    const infoWrap = document.createElement('div');
    infoWrap.className = 'relative';

    const infoButton = document.createElement('button');
    infoButton.type = 'button';
    infoButton.className = 'w-6 h-6 rounded-full border border-slate-200 dark:border-primary-700 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-accent-600 hover:border-accent-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-primary-900';
    infoButton.textContent = 'i';
    infoButton.setAttribute('aria-label', `More info for ${card.title}`);

    const infoPanel = document.createElement('div');
    infoPanel.className = 'hidden absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900 shadow-lg p-3 text-xs text-slate-600 dark:text-slate-300';
    infoPanel.textContent = card.info;

    infoButton.addEventListener('click', () => {
      const isHidden = infoPanel.classList.contains('hidden');
      document.querySelectorAll('.quick-ref-info-panel').forEach(panel => {
        panel.classList.add('hidden');
      });
      if (isHidden) {
        infoPanel.classList.remove('hidden');
      }
    });

    infoPanel.classList.add('quick-ref-info-panel');
    infoWrap.appendChild(infoButton);
    infoWrap.appendChild(infoPanel);
    header.appendChild(infoWrap);
  }

  const value = document.createElement('div');
  value.className = 'text-2xl font-bold text-primary-900 dark:text-white flex flex-wrap items-baseline gap-2';
  value.innerHTML = `<span>${card.value}</span>${card.unit ? `<span class=\"text-sm font-semibold text-slate-500 dark:text-slate-400\">${card.unit}</span>` : ''}`;

  const notes = document.createElement('div');
  notes.className = 'text-xs text-slate-500 dark:text-slate-400';
  notes.textContent = card.notes || '';

  cardEl.appendChild(header);
  cardEl.appendChild(value);
  if (card.notes) cardEl.appendChild(notes);

  return cardEl;
}

function createAcpFlowCalculator(flowRange) {
  const container = document.createElement('div');
  container.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-slate-50 dark:bg-primary-900/60 p-4 space-y-3';
  container.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-end gap-3">
      <div class="flex-1 space-y-1">
        <label for="quick-reference-weight" class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Weight (kg)</label>
        <input id="quick-reference-weight" type="number" min="0" step="0.1" placeholder="Enter weight" class="w-full rounded-xl border border-slate-200 dark:border-primary-700 bg-white dark:bg-primary-800 px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none dark:text-white" />
      </div>
      <div class="flex-1 space-y-1">
        <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">ACP Flow Range</div>
        <div id="quick-reference-flow-ml" class="text-lg font-semibold text-primary-900 dark:text-white">—</div>
        <div id="quick-reference-flow-l" class="text-xs text-slate-500 dark:text-slate-400">—</div>
      </div>
    </div>
    <p class="text-[11px] text-slate-500 dark:text-slate-400">Computed from the ACP flow range in the reference cards.</p>
  `;

  const weightInput = container.querySelector('#quick-reference-weight');
  const flowMl = container.querySelector('#quick-reference-flow-ml');
  const flowL = container.querySelector('#quick-reference-flow-l');

  const updateFlow = () => {
    const weight = parseFloat(weightInput.value);
    if (!flowRange || !(weight > 0)) {
      flowMl.textContent = '—';
      flowL.textContent = '—';
      return;
    }
    // ACP flow calculation: (mL/kg/min) × kg = mL/min; divide by 1000 for L/min.
    const minMl = flowRange.min * weight;
    const maxMl = flowRange.max * weight;
    const minL = minMl / 1000;
    const maxL = maxMl / 1000;
    flowMl.textContent = `${Math.round(minMl)}–${Math.round(maxMl)} mL/min`;
    flowL.textContent = `${minL.toFixed(2)}–${maxL.toFixed(2)} L/min`;
  };

  weightInput.addEventListener('input', updateFlow);
  updateFlow();

  return container;
}

function createAcpProfileToggle(activeProfile, onChange) {
  const toggle = document.createElement('div');
  toggle.className = 'flex flex-wrap gap-2';

  const profiles = [
    { id: 'adult', label: 'Adult' },
    { id: 'pediatric', label: 'Pediatric' }
  ];

  profiles.forEach(profile => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.profile = profile.id;
    button.className = 'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-primary-900';
    const isActive = profile.id === activeProfile;
    if (isActive) {
      button.classList.add('bg-primary-900', 'text-white', 'border-primary-900', 'dark:bg-accent-500', 'dark:text-slate-900', 'dark:border-accent-500');
    } else {
      button.classList.add('bg-white', 'text-slate-600', 'border-slate-200', 'dark:bg-primary-900', 'dark:text-slate-300', 'dark:border-primary-700');
    }
    button.textContent = profile.label;
    button.addEventListener('click', () => onChange(profile.id));
    toggle.appendChild(button);
  });

  return toggle;
}

function renderAcpProfile(panel, cards, activeProfile, onChangeProfile) {
  panel.innerHTML = '';
  const flowCard = cards.find(card => card.range);
  const flowRange = flowCard && flowCard.range ? flowCard.range : null;
  panel.appendChild(createAcpFlowCalculator(flowRange));

  const profileToggle = createAcpProfileToggle(activeProfile, onChangeProfile);
  panel.appendChild(profileToggle);

  const grid = document.createElement('div');
  grid.className = 'grid gap-4 md:grid-cols-2';
  cards.forEach(card => {
    grid.appendChild(createQuickReferenceCard(card));
  });
  panel.appendChild(grid);
}

function renderHcaTable(panel, tab) {
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'text-sm font-semibold text-primary-900 dark:text-white';
  header.textContent = tab.headerTitle || 'HCA Safety Time by Temperature';
  panel.appendChild(header);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'overflow-x-auto';

  const table = document.createElement('table');
  table.className = 'min-w-[640px] w-full text-xs border border-slate-200 dark:border-primary-800 rounded-xl overflow-hidden';
  table.innerHTML = `
    <thead class="bg-slate-50 dark:bg-primary-900/70 text-slate-600 dark:text-slate-300">
      <tr>
        <th class="text-left px-3 py-2">Temperature (°C)</th>
        <th class="text-left px-3 py-2">Safe Duration (min)</th>
        <th class="text-left px-3 py-2">Notes</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  (tab.tableRows || []).forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-100 dark:border-primary-800 hover:bg-slate-50/70 dark:hover:bg-primary-900/60';
    if (row.tooltip) tr.title = row.tooltip;

    const severityMap = {
      safe: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      caution: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      high: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
    };
    const severityClass = severityMap[row.severity] || 'bg-slate-100 text-slate-600 dark:bg-primary-800 dark:text-slate-300';

    tr.innerHTML = `
      <td class="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
        <span class="inline-flex items-center gap-2">
          <span class="w-2 h-2 rounded-full ${severityClass}"></span>
          <span>${row.temperature}</span>
        </span>
      </td>
      <td class="px-3 py-2 text-slate-700 dark:text-slate-200">${row.duration}</td>
      <td class="px-3 py-2 text-slate-600 dark:text-slate-300">${row.notes}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  panel.appendChild(tableWrap);

  const noteBlock = document.createElement('div');
  noteBlock.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-slate-50 dark:bg-primary-900/60 p-4 space-y-2';
  noteBlock.innerHTML = `
    <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Note</div>
  `;
  const noteList = document.createElement('ul');
  noteList.className = 'list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-1';
  (tab.noteLines || []).forEach(line => {
    const li = document.createElement('li');
    li.textContent = line;
    noteList.appendChild(li);
  });
  noteBlock.appendChild(noteList);
  panel.appendChild(noteBlock);
}

function initQuickReference() {
  if (quickReferenceInitialized) return;

  const data = getQuickReferenceData();
  const tabs = data.tabs || [];
  const tabList = el('quick-reference-tabs');
  const panelContainer = el('quick-reference-panels');
  const lastReviewedEl = el('quick-reference-last-reviewed');

  if (!tabList || !panelContainer || !tabs.length) return;

  tabList.innerHTML = '';
  panelContainer.innerHTML = '';

  const activeClasses = ['bg-primary-900', 'text-white', 'border-primary-900', 'dark:bg-accent-500', 'dark:text-slate-900', 'dark:border-accent-500'];
  const inactiveClasses = ['bg-white', 'text-slate-600', 'border-slate-200', 'dark:bg-primary-900', 'dark:text-slate-300', 'dark:border-primary-700'];

  const setActiveTab = (tabId, focusTab = false) => {
    const buttons = tabList.querySelectorAll('[role=\"tab\"]');
    const panels = panelContainer.querySelectorAll('[role=\"tabpanel\"]');
    buttons.forEach(button => {
      const isActive = button.dataset.tabId === tabId;
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.setAttribute('tabindex', isActive ? '0' : '-1');
      button.classList.remove(...activeClasses, ...inactiveClasses);
      button.classList.add(...(isActive ? activeClasses : inactiveClasses));
      if (isActive && focusTab) button.focus();
    });
    panels.forEach(panel => {
      if (panel.dataset.tabId === tabId) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });
  };

  tabs.forEach((tab, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = `quick-tab-${tab.id}`;
    button.dataset.tabId = tab.id;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', `quick-panel-${tab.id}`);
    button.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    button.setAttribute('tabindex', index === 0 ? '0' : '-1');
    button.className = 'px-4 py-2 rounded-full text-sm font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-primary-900';
    button.classList.add(...(index === 0 ? activeClasses : inactiveClasses));
    button.textContent = tab.label;

    tabList.appendChild(button);

    const panel = document.createElement('div');
    panel.id = `quick-panel-${tab.id}`;
    panel.dataset.tabId = tab.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    panel.className = 'space-y-4';
    if (index !== 0) panel.setAttribute('hidden', '');

    if (tab.id === 'acp') {
      const profiles = tab.profiles || {};
      let activeProfile = profiles.adult ? 'adult' : 'pediatric';
      const renderProfile = (profileId) => {
        activeProfile = profileId;
        const cards = profiles[profileId] || [];
        renderAcpProfile(panel, cards, activeProfile, renderProfile);
      };
      renderProfile(activeProfile);
      panelContainer.appendChild(panel);
      return;
    }

    if (tab.id === 'tca' && tab.tableRows) {
      renderHcaTable(panel, tab);
      panelContainer.appendChild(panel);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'grid gap-4 md:grid-cols-2';
    (tab.cards || []).forEach(card => {
      grid.appendChild(createQuickReferenceCard(card));
    });

    panel.appendChild(grid);
    panelContainer.appendChild(panel);
  });

  tabList.addEventListener('click', (event) => {
    const button = event.target.closest('[role=\"tab\"]');
    if (!button) return;
    setActiveTab(button.dataset.tabId);
  });

  tabList.addEventListener('keydown', (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    const buttons = Array.from(tabList.querySelectorAll('[role=\"tab\"]'));
    const currentIndex = buttons.findIndex(button => button.getAttribute('aria-selected') === 'true');
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % buttons.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = buttons.length - 1;
    event.preventDefault();
    const nextButton = buttons[nextIndex];
    if (nextButton) setActiveTab(nextButton.dataset.tabId, true);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('.quick-ref-info-panel')) return;
    if (event.target.closest('button')) return;
    document.querySelectorAll('.quick-ref-info-panel').forEach(panel => {
      panel.classList.add('hidden');
    });
  });

  if (lastReviewedEl) lastReviewedEl.textContent = getLatestReviewedDate(tabs);

  quickReferenceInitialized = true;
}

// -----------------------------
// Router & Navigation Styling
// -----------------------------
function getActivePath() {
  const rawPath = window.location.pathname || '/';
  const normalizedPath = window.normalizeRoute ? window.normalizeRoute(rawPath) : rawPath;

  if ((normalizedPath === '/' || normalizedPath === '/index.html') && window.location.hash) {
    const legacy = window.normalizeRoute ? window.normalizeRoute(window.location.hash) : window.location.hash.replace('#', '/');
    history.replaceState({}, '', legacy);
    return legacy;
  }

  if (normalizedPath === '/index.html') return '/';
  return normalizedPath || '/';
}

function navigateTo(path) {
  const target = window.normalizeRoute ? window.normalizeRoute(path) : (path || '/');
  const current = getActivePath();

  if (current !== target) {
    history.pushState({}, '', target);
  }
  route();
}

function route() {
  const path = getActivePath();

  const sections = ['view-home', 'view-bsa', 'view-do2i', 'view-hct', 'view-lbm', 'view-priming-volume', 'view-heparin', 'view-timecalc', 'view-quick-reference', 'faq', 'view-info', 'view-privacy', 'view-terms', 'view-contact'];
  sections.forEach(sid => {
    el(sid).classList.add('hidden');
  });

  let key = 'home';

  if (path.includes('bsa')) { el('view-bsa').classList.remove('hidden'); key = 'bsa'; }
  else if (path.includes('do2i') || path.includes('gdp')) { el('view-do2i').classList.remove('hidden'); key = 'do2i'; }
  else if (path.includes('predicted-hct')) { el('view-hct').classList.remove('hidden'); key = 'predicted-hct'; }
  else if (path.includes('lbm')) { el('view-lbm').classList.remove('hidden'); key = 'lbm'; }
  else if (path.includes('priming-volume')) { el('view-priming-volume').classList.remove('hidden'); key = 'priming-volume'; }
  else if (path.includes('heparin')) { el('view-heparin').classList.remove('hidden'); key = 'heparin'; }
  else if (path.includes('timecalc')) { el('view-timecalc').classList.remove('hidden'); key = 'timecalc'; }
  else if (path.includes('quick-reference')) { el('view-quick-reference').classList.remove('hidden'); key = 'quick-reference'; }
  else if (path.includes('faq')) { el('faq').classList.remove('hidden'); key = 'faq'; }
  else if (path.includes('info')) { el('view-info').classList.remove('hidden'); key = 'info'; }
  else if (path.includes('privacy')) { el('view-privacy').classList.remove('hidden'); key = 'privacy'; }
  else if (path.includes('terms')) { el('view-terms').classList.remove('hidden'); key = 'terms'; }
  else if (path.includes('contact')) { el('view-contact').classList.remove('hidden'); key = 'contact'; }
  else { el('view-home').classList.remove('hidden'); key = 'home'; }

  const navMap = {
    'home': ['nav-home', 'side-home', 'mob-home'],
    'do2i': ['nav-do2i', 'side-do2i', 'mob-do2i'],
    'predicted-hct': ['nav-hct', 'side-hct', 'mob-hct'],
    'bsa': ['nav-bsa', 'side-bsa', 'mob-bsa'],
    'lbm': ['nav-lbm', 'side-lbm', 'mob-lbm'],
    'heparin': ['nav-heparin', 'side-heparin', 'mob-heparin'],
    'priming-volume': ['nav-priming', 'side-priming', null],
    'timecalc': ['nav-time', 'side-time', 'mob-time'],
    'quick-reference': ['nav-quick-reference', 'side-quick-reference', 'mob-quick-reference'],
    'faq': ['nav-faq', 'side-faq', null],
    'info': ['nav-info', 'side-info', 'mob-info']
  };

  document.querySelectorAll('.nav-link, .sidebar-link').forEach(l => {
    l.classList.remove('bg-primary-800', 'text-accent-400', 'bg-slate-100', 'text-primary-900', 'bg-primary-700', 'dark:bg-primary-800', 'dark:text-accent-400');
  });
  document.querySelectorAll('[id^="mob-"]').forEach(l => {
    l.classList.remove('text-accent-600', 'dark:text-accent-400');
    l.classList.add('text-slate-400', 'dark:text-slate-500');
  });

  updateMetaForRoute(path || '/');

  if (key && navMap[key]) {
    const navEl = el(navMap[key][0]);
    if (navEl) navEl.classList.add('bg-primary-800', 'text-accent-400');

    const sideEl = el(navMap[key][1]);
    if (sideEl) sideEl.classList.add('bg-slate-100', 'text-primary-900', 'dark:bg-primary-800', 'dark:text-accent-400');

    const mobEl = el(navMap[key][2]);
    if (mobEl) {
      mobEl.classList.remove('text-slate-400', 'dark:text-slate-500');
      mobEl.classList.add('text-accent-600', 'dark:text-accent-400');
    }
  }

  if (key === 'heparin') {
    initHeparinManagement();
  }
  if (key === 'quick-reference') {
    initQuickReference();
  }
}

// -----------------------------
// Event Wiring
// -----------------------------
window.addEventListener('popstate', route);
window.addEventListener('DOMContentLoaded', () => {
  const brandHome = document.getElementById('brand-home');
  if (brandHome) {
    brandHome.addEventListener('click', (e) => {
      const href = brandHome.getAttribute('href');
      if (href && href.startsWith('/')) {
        e.preventDefault();
        navigateTo(href);
      }
    });
  }

  document.querySelectorAll('a[data-route]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('/')) {
        e.preventDefault();
        navigateTo(href);
      }
    });
  });

  const now = new Date();
  document.getElementById('year').textContent = now.getFullYear();

  route();

  // GDP event listeners
  gdpIds.forEach(id => {
    const x = el(id);
    if (x) {
      x.addEventListener('input', () => {
        lastChangedId = id;
        if (id === 'bsa') {
          bsaManualOverride = true;
          setText('bsa-hint', el('bsa').value ? 'manual' : 'auto-calc');
        }
        updateGDP();
      });

      if (id === 'bsa-method') x.addEventListener('change', () => {
        lastChangedId = id;
        updateGDP();
      });
    }
  });

  ['target-260', 'target-280', 'target-300', 'target-360'].forEach(id => {
    const btn = el(id);
    if (btn) {
      btn.addEventListener('click', () => {
        targetMode = 'preset';
        targetDO2i = parseInt(btn.dataset.value, 10) || 0;
        updateTargetDisplay();
        updateGDP();
      });
    }
  });

  const targetCustomPill = el('target-custom-pill');
  const targetCustomInput = el('target-custom');
  if (targetCustomPill && targetCustomInput) {
    targetCustomPill.addEventListener('click', () => {
      targetMode = 'custom';
      const v = parseFloat(targetCustomInput.value) || 0;
      targetDO2i = v > 0 ? v : 0;
      updateTargetDisplay();
      updateGDP();
    });
    targetCustomInput.addEventListener('input', () => {
      targetMode = 'custom';
      const v = parseFloat(targetCustomInput.value) || 0;
      targetDO2i = v > 0 ? v : 0;
      updateTargetDisplay();
      updateGDP();
    });
  }

  const resetBtn = el('do2i-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      lastChangedId = null;
      resetGDP();
    });
  }

  // Standalone BSA event listeners
  ['bsa_height', 'bsa_weight'].forEach(id => {
    const x = el(id);
    if (x) x.addEventListener('input', updateStandaloneBsa);
  });
  const bsaMethodStandalone = el('bsa-method-standalone');
  if (bsaMethodStandalone) bsaMethodStandalone.addEventListener('change', updateStandaloneBsa);

  updateStandaloneBsa();

  // Predicted Hct event listeners
  ['wt_hct', 'pre_hct', 'prime', 'fluids', 'removed', 'rbc_units', 'rbc_unit_vol', 'rbc_hct', 'ebv_coef'].forEach(id => {
    const x = el(id);
    if (x) x.addEventListener('input', updateHct);
  });

  const pttypeSelect = el('pttype');
  if (pttypeSelect) {
    pttypeSelect.addEventListener('change', () => {
      applyDefaultEbvCoef(pttypeSelect.value);
      updateHct();
    });
    applyDefaultEbvCoef(pttypeSelect.value);
  }

  // LBM event listeners (NEW)
  ['lbm_h_cm', 'lbm_w_kg', 'lbm_sex', 'lbm_formula', 'lbm_bsa_formula'].forEach(id => {
    const x = el(id);
    if (x) x.addEventListener('input', updateLBM);
  });
  ['lbm_sex', 'lbm_formula', 'lbm_bsa_formula'].forEach(id => {
    const x = el(id);
    if (x) x.addEventListener('change', updateLBM);
  });

  ['priming-id', 'priming-length', 'priming-length-unit'].forEach(id => {
    const x = el(id);
    if (x) {
      x.addEventListener('input', updatePrimingVolume);
      x.addEventListener('change', updatePrimingVolume);
    }
  });

  setupContactActions();

  initTimeCalculator();
  initHeparinManagement();

  updateTargetDisplay();
  updateGDP();
  updateHct();
  updateLBM();
  updatePrimingVolume();
});
