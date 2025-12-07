'use strict';

//
// GDP Calculator summary
// - Allows selecting preset or custom target DO₂i values, then calculates required pump flow.
// - Computes CaO₂, current DO₂i (when flow is given), and classifies status vs. the chosen target.
// - Gauge visual centers around the target DO₂i and shows adequacy bands with inline messaging.
//
// Temperature-aware GDP:
// - TEMP_PROFILES maps temperature bands to CI and DO2i ranges.
// - getTempProfile(tempC) picks the band.
// - updateGDP() uses these ranges to evaluate whether current DO2i/CI are adequate
//   at the given temperature, applying a dampened curve and a hard DO2i floor (200).

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

function getCurrentTimeHHMM() {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

const CANONICAL_BASE = 'https://perfusiontools.com/';
const DEFAULT_DESCRIPTION = 'Perfusion Tools is a CPB & ECMO perfusion calculator suite for perfusionists, including BSA, CI, DO2i, pump flow, heparin management, and more.';
const DEFAULT_OG_DESCRIPTION = 'Bedside perfusion calculators for CPB & ECMO: BSA, CI, DO2i, pump flow, heparin management, and more.';
const SEO_META = {
  'do2i': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/do2i'
  },
  'predicted-hct': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/predicted-hct'
  },
  'lbm': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/lbm'
  },
  'bsa': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/bsa'
  },
  'heparin': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/heparin'
  },
  'timecalc': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/timecalc'
  },
  'faq': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/faq'
  },
  'privacy': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/privacy'
  },
  'terms': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/terms'
  },
  'contact': {
    title: 'Perfusion Tools – CPB & ECMO Perfusion Calculators',
    description: DEFAULT_DESCRIPTION,
    ogDescription: DEFAULT_OG_DESCRIPTION,
    canonicalHash: '#/contact'
  }
};

function updateMetaForRoute(key) {
  const meta = SEO_META[key] || SEO_META['do2i'];
  if (!meta) return;

  document.title = meta.title;

  const setContent = (selector, attr, value) => {
    const tag = document.querySelector(selector);
    if (tag && value) tag.setAttribute(attr, value);
  };

  const metaDescription = meta.description || DEFAULT_DESCRIPTION;
  const socialDescription = meta.ogDescription || metaDescription;

  setContent('meta[name="description"]', 'content', metaDescription);
  setContent('meta[property="og:title"]', 'content', meta.title);
  setContent('meta[property="og:description"]', 'content', socialDescription);
  setContent('meta[name="twitter:title"]', 'content', meta.title);
  setContent('meta[name="twitter:description"]', 'content', socialDescription);

  const canonicalTag = document.querySelector('link[rel="canonical"]');
  if (canonicalTag && meta.canonicalHash) {
    canonicalTag.setAttribute('href', `${CANONICAL_BASE}${meta.canonicalHash}`);
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
    row.innerHTML = `<span class="font-mono text-xs text-slate-500 dark:text-slate-400">CI ${ci.toFixed(1)}</span><span class="font-mono font-semibold text-right text-primary-900 dark:text-white">${flow.toFixed(2)} L/min</span>`;
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

const TEMP_PROFILES = [
  {
    min: 36,
    max: 40,
    label: '37°C (Normothermia)',
    ciMin: 2.4,
    ciMax: 2.6,
    vo2Factor: 1.0,
    do2Min: 280,
    do2Max: 300,
    note: 'Maintain full metabolic demand; adult baseline target.'
  },
  {
    min: 32,
    max: 36,
    label: '32°C (Mild hypothermia)',
    ciMin: 2.0,
    ciMax: 2.2,
    vo2Factor: 0.72,
    do2Min: 240,
    do2Max: 260,
    note: 'Lower metabolism, but keep DO₂i 240–260 for renal/organ protection.'
  },
  {
    min: 28,
    max: 32,
    label: '28°C (Moderate hypothermia)',
    ciMin: 1.6,
    ciMax: 1.8,
    vo2Factor: 0.57,
    do2Min: 220,
    do2Max: 240,
    note: 'Around 50% metabolic reduction; apply a dampened curve and never drop DO₂i below 200 mL/min/m².'
  },
  {
    min: 20,
    max: 28,
    label: '≤25°C (Deep hypothermia)',
    ciMin: 1.2,
    ciMax: 1.5,
    vo2Factor: 0.45,
    do2Min: 200,
    do2Max: 220,
    note: 'Maintain minimum flow; keep DO₂i ≥200 mL/min/m² as a hard floor to protect organs.'
  }
];

function getTempProfile(tempC) {
  if (!tempC && tempC !== 0) return null;
  for (const p of TEMP_PROFILES) {
    if (tempC >= p.min && tempC < p.max) return p;
  }
  return TEMP_PROFILES[0];
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
let hepShowFlow = false;

function setHepDoseButtons(activeDose) {
  document.querySelectorAll('[data-hep-dose]').forEach(btn => {
    if (!btn.dataset.hepDose) return;
    const isActive = Number(btn.dataset.hepDose) === activeDose;
    btn.classList.toggle('active-dose', isActive);
  });
}

function renderResistanceToggle() {
  const toggle = el('hep2-resistance-toggle');
  if (!toggle) return;
  const check = toggle.querySelector('span');
  const activeClasses = ['border-accent-500', 'bg-accent-50', 'dark:bg-primary-800/60'];
  const inactiveClasses = ['border-slate-200', 'dark:border-primary-700', 'bg-white', 'dark:bg-primary-800'];
  if (hepResistance) {
    toggle.classList.add(...activeClasses);
    toggle.classList.remove('border-slate-200', 'dark:border-primary-700', 'bg-white', 'dark:bg-primary-800');
    if (check) check.classList.remove('hidden');
  } else {
    toggle.classList.remove(...activeClasses);
    toggle.classList.add(...inactiveClasses);
    if (check) check.classList.add('hidden');
  }
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
  const maintenanceRate = Math.round(dosingWeight * (hepResistance ? 18 : 12));
  const additionalBolus = Math.round(dosingWeight * (hepResistance ? 100 : 50));

  // DuBois BSA approximation used here (0.007184 × H^0.725 × W^0.425)
  const bsaActual = 0.007184 * Math.pow(heightCm, 0.725) * Math.pow(weightKg, 0.425);
  let bsaUsedForFlow = bsaActual;
  let bsaCapped = false;
  if (bmi > 35 && bsaActual > 2.5) {
    bsaUsedForFlow = 2.5;
    bsaCapped = true;
  }

  const targetCI = 2.4;
  const flowRate = bsaUsedForFlow * targetCI;
  const flowWarning = flowRate > 6.0;

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
    maintenanceRate,
    additionalBolus,
    bsaActual,
    bsaUsedForFlow,
    bsaCapped,
    flowRate,
    flowWarning,
  };
}

function updateHeparinUI() {
  const heightInput = el('hep2-height');
  const weightInput = el('hep2-weight');
  const sex = el('hep2-sex')?.value || 'male';
  const weightStrategy = el('hep2-weight-strategy')?.value || 'auto';
  const targetActInput = el('hep2-target-act');

  const height = parseFloat(heightInput?.value);
  const weight = parseFloat(weightInput?.value);
  const rawTargetAct = parseFloat(targetActInput?.value);
  const targetAct = Number.isFinite(rawTargetAct) ? rawTargetAct : NaN;

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
  setText('hep2-maintenance', `${plan.maintenanceRate} U/hr`);
  setText('hep2-add-bolus', `${plan.additionalBolus.toLocaleString()} U`);
  setText('hep2-maintenance-note', `${plan.maintenanceRate} U/hr`);
  setText('hep2-target-act-display', Number.isFinite(targetAct) ? `${targetAct.toFixed(0)} s` : 'Target');

  const maintDetail = el('hep2-maint-detail');
  if (maintDetail) {
    const standardRate = Math.round(plan.dosingWeight * 12);
    const resistRate = Math.round(plan.dosingWeight * 18);
    setText('hep2-maint-standard', `• Standard: 12 U/kg/hr → ${standardRate.toLocaleString()} U/hr (based on ${plan.dosingWeight.toFixed(1)} kg)`);
    setText('hep2-maint-resist', `• Resistance toggle ON: 18 U/kg/hr → ${resistRate.toLocaleString()} U/hr (based on ${plan.dosingWeight.toFixed(1)} kg)`);
  }

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

  if (hepShowFlow) {
    el('hep2-flow-card')?.classList.remove('hidden');
    el('hep2-quick-card')?.classList.add('hidden');
    setText('hep2-flow-rate', plan.flowRate.toFixed(1));
    setText('hep2-flow-bsa', plan.bsaUsedForFlow.toFixed(2));
    const cap = el('hep2-flow-cap');
    if (cap) cap.classList.toggle('hidden', !plan.bsaCapped);
    const flowWarn = el('hep2-flow-warning');
    if (flowWarn) flowWarn.classList.toggle('hidden', !plan.flowWarning);
  } else {
    el('hep2-flow-card')?.classList.add('hidden');
    el('hep2-quick-card')?.classList.remove('hidden');
    const steps = el('hep2-quick-steps')?.querySelectorAll('li');
    if (steps && steps.length >= 5) {
      steps[0].textContent = `Bolus ${plan.initialBolus.toLocaleString()} U IV`;
      steps[2].textContent = `Start maintenance ${plan.maintenanceRate} U/hr`;
      steps[4].textContent = `If ACT low: +${plan.additionalBolus.toLocaleString()} U bolus`;
    }
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

  const resistanceBlock = el('hep2-resistance-block');
  if (resistanceBlock) resistanceBlock.classList.toggle('hidden', !hepResistance);

  const obesityBlock = el('hep2-obesity-warning');
  if (obesityBlock) obesityBlock.classList.toggle('hidden', hepResistance || plan.alertLevel !== 'high');

  const riskFactors = [
    el('hep2-rf-sirs')?.checked,
    el('hep2-rf-lmwh')?.checked,
    el('hep2-rf-ecmo')?.checked,
    el('hep2-rf-at3')?.checked,
    el('hep2-rf-history')?.checked,
  ].filter(Boolean).length;

  const riskChip = el('hep2-risk-chip');
  const riskNote = el('hep2-risk-note');
  const riskAdvice = el('hep2-risk-advice');
  const riskSummary = el('hep2-risk-summary');
  if (riskChip) {
    let level = 'Low';
    let colorClasses = ['bg-slate-200', 'dark:bg-primary-800', 'text-primary-900', 'dark:text-white'];
    if (riskFactors >= 4) {
      level = 'High';
      colorClasses = ['bg-red-500/20', 'dark:bg-red-900/40', 'text-red-700', 'dark:text-red-200'];
    } else if (riskFactors >= 2) {
      level = 'Moderate';
      colorClasses = ['bg-amber-200/60', 'dark:bg-amber-900/40', 'text-amber-700', 'dark:text-amber-200'];
    }
    riskChip.textContent = `Resistance risk: ${level} (${riskFactors}/5)`;
    riskChip.className = `px-2 py-1 rounded-full font-semibold text-[11px] ${colorClasses.join(' ')}`;
    if (riskNote) riskNote.textContent = 'Checked risk factors help anticipate Anti-Xa/AT-III needs; dosing is not automatically multiplied.';
  }
  if (riskSummary) riskSummary.textContent = `Resistance risk: ${riskFactors}/5 selected`;
  if (riskAdvice) riskAdvice.classList.toggle('hidden', riskFactors === 0);

  if (results) results.classList.remove('hidden');
  if (placeholder) placeholder.classList.add('hidden');
}

function initHeparinManagement() {
  setHepDoseButtons(hepDoseUnit);
  renderResistanceToggle();

  document.querySelectorAll('[data-hep-dose]').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = Number(btn.dataset.hepDose);
      hepDoseUnit = Number.isFinite(val) ? val : hepDoseUnit;
      setHepDoseButtons(hepDoseUnit);
      updateHeparinUI();
    });
  });

  const resistanceToggle = el('hep2-resistance-toggle');
  if (resistanceToggle) {
    resistanceToggle.addEventListener('click', () => {
      hepResistance = !hepResistance;
      renderResistanceToggle();
      updateHeparinUI();
    });
  }

  const flowToggle = el('hep2-show-flow');
  if (flowToggle) {
    hepShowFlow = flowToggle.checked;
    flowToggle.addEventListener('change', (e) => {
      hepShowFlow = e.target.checked;
      updateHeparinUI();
    });
  }

  const weightInfoToggle = el('hep2-weight-info-toggle');
  const weightInfo = el('hep2-weight-info');
  if (weightInfoToggle && weightInfo) {
    weightInfoToggle.addEventListener('click', () => {
      weightInfo.classList.toggle('hidden');
    });
  }

  ['hep2-height', 'hep2-weight', 'hep2-sex', 'hep2-weight-strategy', 'hep2-target-act', 'hep2-rf-sirs', 'hep2-rf-lmwh', 'hep2-rf-ecmo', 'hep2-rf-at3', 'hep2-rf-history'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('input', updateHeparinUI);
    if (node && node.tagName === 'SELECT') node.addEventListener('change', updateHeparinUI);
    if (node && node.type === 'checkbox') node.addEventListener('change', updateHeparinUI);
  });

  updateHeparinUI();
}

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
const gdpIds = ['h_cm', 'w_kg', 'bsa', 'bsa-method', 'flow', 'hb', 'sao2', 'pao2', 'temp_c'];
let lastChangedId = null;
let bsaManualOverride = false;
let targetDO2i = 280;
let targetMode = 'preset'; // 'preset' | 'custom'

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

  const bsaVal = el('bsa').value;
  const hbVal = el('hb').value;
  const sao2Val = el('sao2').value;
  const pao2Val = el('pao2').value;
  const flowVal = el('flow').value;
  const tempVal = el('temp_c') ? el('temp_c').value : '';
  const tempC = tempVal === '' ? null : parseFloat(tempVal);

  const warningEl = el('gdp-warning');
  const requiredMissing = [];
  if (!bsaVal) requiredMissing.push('BSA');
  if (!hbVal) requiredMissing.push('Hemoglobin');
  if (!sao2Val) requiredMissing.push('SaO₂');
  if (!pao2Val) requiredMissing.push('PaO₂');
  if (!targetDO2i) requiredMissing.push('Target DO₂i');

  const bsa = parseFloat(bsaVal) || 0;
  const flow = parseFloat(flowVal) || 0;
  const hb = parseFloat(hbVal) || 0;
  const sao2 = parseFloat(sao2Val) || 0;
  const pao2 = parseFloat(pao2Val) || 0;
  const currentCI = bsa ? flow / bsa : 0;

  const gauge = el('gdp-gauge');
  const gaugeMsg = el('gdp-gauge-msg');
  const statusText = el('gdp-status-text');
  const statusDetail = el('gdp-status-detail');
  const ciCommentEl = el('ci-comment');

  const cao2 = calcCaO2(hb, sao2, pao2);
  el('cao2').value = cao2 ? cao2.toFixed(2) : '';

  if (requiredMissing.length || !bsa || !hb || !sao2 || !pao2 || !targetDO2i) {
    if (warningEl) {
      warningEl.textContent = `Enter required fields: ${requiredMissing.join(', ')}`;
      warningEl.classList.remove('hidden');
    }
    const tempTag = el('temp-note');
    const tempComment = el('temp-comment');
    if (tempTag) {
      tempTag.textContent = '';
      tempTag.classList.add('hidden');
    }
    if (tempComment) {
      tempComment.innerHTML = (tempC || tempC === 0)
        ? '<div class="font-semibold mb-1">Temperature note</div><p>Provide the remaining required fields to view temperature-adjusted GDP guidance.</p>'
        : '<div class="font-semibold mb-1">Temperature note</div><p>No temperature provided. Using standard normothermic targets until temperature is entered.</p>';
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

  const requiredFlow = calcRequiredFlowLmin(targetDO2i, bsa, cao2);
  setText('required-flow', requiredFlow ? `${requiredFlow.toFixed(2)} <span class="text-xs text-slate-500 dark:text-slate-400">L/min</span>` : '—');

  const currentDO2i = flow ? calcDO2i(flow, bsa, cao2) : 0;
  setText('current-do2i', currentDO2i ? `${Math.round(currentDO2i)} <span class="text-xs text-slate-500 dark:text-slate-400">mL/min/m²</span>` : '—');

  let statusLabel = 'Waiting for current flow';
  let detail = 'Enter current pump flow to compare against the target DO₂i.';
  let gaugeColor = 'from-slate-300 to-slate-200 dark:from-primary-800 dark:to-primary-700';
  let gaugeWidth = '0%';
  let ciComment = '';

  const profile = (tempC || tempC === 0) && !Number.isNaN(tempC) ? getTempProfile(tempC) : null;
  const recommendedMin = profile ? profile.do2Min : targetDO2i * 0.9;
  const recommendedMax = profile ? profile.do2Max : targetDO2i * 1.1;
  const HARD_FLOOR = 200;
  const tempAdjustedMin = profile ? Math.max(recommendedMin, HARD_FLOOR) : recommendedMin;
  const tempAdjustedMax = profile ? Math.max(recommendedMax, tempAdjustedMin) : recommendedMax;

  const lowerTarget = profile ? tempAdjustedMin : targetDO2i * 0.9;
  const upperTarget = profile ? tempAdjustedMax : targetDO2i * 1.1;

  if (currentDO2i > 0) {
    const denom = upperTarget > 0 ? upperTarget * 1.05 : targetDO2i || 1;
    const pct = clamp((currentDO2i / denom) * 100, 0, 100);
    gaugeWidth = `${pct}%`;

    if (currentDO2i < lowerTarget) {
      const deltaFlow = Math.max(requiredFlow - flow, 0);
      statusLabel = profile ? 'Below temperature-adjusted target' : 'Below target';
      detail = profile
        ? `Need DO₂i ≥ ${tempAdjustedMin.toFixed(0)} mL/min/m² for ${profile.label}.${deltaFlow > 0 ? ` ~+${deltaFlow.toFixed(2)} L/min suggested.` : ''}`
        : (deltaFlow > 0
          ? `Needs approximately +${deltaFlow.toFixed(2)} L/min to reach the target.`
          : 'Increase flow to approach the target.');
      gaugeColor = 'from-amber-500 to-red-500';
    } else if (currentDO2i > upperTarget) {
      statusLabel = profile ? 'Above temperature-adjusted range' : 'Above target';
      detail = profile
        ? 'Above the temperature-adjusted GDP band—verify BP/afterload and hemodynamic tolerance.'
        : 'Above the goal—verify this is intentional and hemodynamically tolerated.';
      gaugeColor = 'from-sky-500 to-blue-500';
    } else {
      statusLabel = profile ? 'Within temperature-adjusted GDP range' : 'At / near target';
      detail = profile
        ? `${tempAdjustedMin.toFixed(0)}–${tempAdjustedMax.toFixed(0)} mL/min/m² band achieved at this temperature.`
        : 'Current delivery is within ±10% of the selected DO₂i goal.';
      gaugeColor = 'from-emerald-500 to-emerald-400';
    }
  }

  if (profile && currentCI) {
    if (currentCI < profile.ciMin) {
      ciComment = `Current CI ${currentCI.toFixed(2)} L/min/m² is below the ${profile.label} range (${profile.ciMin.toFixed(1)}–${profile.ciMax.toFixed(1)}).`;
    } else if (currentCI > profile.ciMax) {
      ciComment = `Current CI ${currentCI.toFixed(2)} L/min/m² is above the ${profile.label} range.`;
    } else {
      ciComment = `Current CI ${currentCI.toFixed(2)} L/min/m² is within the ${profile.label} range.`;
    }
  }

  statusText.textContent = statusLabel;
  statusDetail.textContent = detail;
  if (ciCommentEl) ciCommentEl.textContent = ciComment;
  gauge.style.width = gaugeWidth;
  gauge.className = `h-3 rounded-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_10px_rgba(34,211,238,0.25)] ${gaugeColor}`;
  if (profile) {
    gaugeMsg.textContent = currentDO2i
      ? `Temp-adjusted target ${tempAdjustedMin.toFixed(0)}–${tempAdjustedMax.toFixed(0)} • Current ${Math.round(currentDO2i)} mL/min/m²`
      : 'Enter current flow to visualize DO₂i vs. temperature-adjusted target';
  } else {
    gaugeMsg.textContent = currentDO2i
      ? `Target ${targetDO2i} mL/min/m² • Current ${Math.round(currentDO2i)} mL/min/m²`
      : 'Enter current flow to visualize DO₂i vs. target';
  }

  const tempTag = el('temp-note');
  const tempComment = el('temp-comment');
  if (tempTag) {
    tempTag.textContent = '';
    tempTag.classList.add('hidden');
  }

  if (tempComment) {
    if (!profile) {
      tempComment.innerHTML = `<div class="font-semibold mb-1">Temperature note</div>
        <p>No temperature provided. Using normothermic targets (e.g., 280–300 mL/min/m²) until temperature is entered.</p>
        <p>When hypothermic, adjust flow with SvO₂, lactate, and perfusion markers in mind.</p>`;
    } else {
      const vo2Pct = Math.round((profile.vo2Factor || 0) * 100);
      const currentDoText = currentDO2i ? `${Math.round(currentDO2i)} mL/min/m²` : '—';
      const ciLine = currentCI
        ? `Current CI ${currentCI.toFixed(2)} L/min/m² vs. recommended ${profile.ciMin.toFixed(1)}–${profile.ciMax.toFixed(1)}.`
        : `Recommended CI: ${profile.ciMin.toFixed(1)}–${profile.ciMax.toFixed(1)} L/min/m².`;
      tempComment.innerHTML = `<div class="font-semibold mb-1">Temperature-adjusted GDP comment</div>
        <p>${profile.label}; current ${tempC.toFixed(1)}°C. Estimated VO₂ ~${vo2Pct}% of normal.</p>
        <p>${ciLine}</p>
        <p>Recommended DO₂i: ${tempAdjustedMin.toFixed(0)}–${tempAdjustedMax.toFixed(0)} mL/min/m²; current: ${currentDoText}.</p>
        <p>Hard DO₂i floor: 200 mL/min/m². Confirm adequacy with SvO₂, lactate, urine output, and organ perfusion.</p>`;
    }
  }
}

function resetGDP() {
  ['h_cm', 'w_kg', 'bsa', 'flow', 'hb', 'sao2', 'pao2', 'temp_c'].forEach(id => {
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
          <td class="px-4 py-2 font-semibold text-primary-900 dark:text-white">${flowActual} L/min</td>
          <td class="px-4 py-2 font-semibold text-emerald-600 dark:text-emerald-400">${flowLean} L/min</td>
        `;
        flowBody.appendChild(tr);
      }
    }
  }
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

  let diff = endMin - startMin;
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
// Router & Navigation Styling
// -----------------------------
function route() {
  const hash = location.hash || '#/bsa';

  // Updated sections list to include LBM and standalone BSA
  const sections = ['view-bsa', 'view-do2i', 'view-hct', 'view-lbm', 'view-heparin', 'view-timecalc', 'faq', 'view-privacy', 'view-terms', 'view-contact'];
  sections.forEach(sid => {
    el(sid).classList.add('hidden');
  });

  // Route to appropriate section
  if (hash.includes('bsa')) el('view-bsa').classList.remove('hidden');
  else if (hash.includes('do2i')) el('view-do2i').classList.remove('hidden');
  else if (hash.includes('predicted-hct')) el('view-hct').classList.remove('hidden');
  else if (hash.includes('lbm')) el('view-lbm').classList.remove('hidden');
  else if (hash.includes('heparin')) el('view-heparin').classList.remove('hidden');
  else if (hash.includes('timecalc')) el('view-timecalc').classList.remove('hidden');
  else if (hash.includes('faq')) el('faq').classList.remove('hidden');
  else if (hash.includes('privacy')) el('view-privacy').classList.remove('hidden');
  else if (hash.includes('terms')) el('view-terms').classList.remove('hidden');
  else if (hash.includes('contact')) el('view-contact').classList.remove('hidden');
  else el('view-bsa').classList.remove('hidden');

  // Updated navMap to include LBM
  const navMap = {
    'do2i': ['nav-do2i', 'side-do2i', 'mob-do2i'],
    'predicted-hct': ['nav-hct', 'side-hct', 'mob-hct'],
    'bsa': ['nav-bsa', 'side-bsa', 'mob-bsa'],
    'lbm': ['nav-lbm', 'side-lbm', 'mob-lbm'],
    'heparin': ['nav-heparin', 'side-heparin', 'mob-heparin'],
    'timecalc': ['nav-time', 'side-time', 'mob-time'],
    'faq': ['nav-faq', 'side-faq', 'mob-faq']
  };

  document.querySelectorAll('.nav-link, .sidebar-link').forEach(l => {
    l.classList.remove('bg-primary-800', 'text-accent-400', 'bg-slate-100', 'text-primary-900', 'bg-primary-700', 'dark:bg-primary-800', 'dark:text-accent-400');
  });
  document.querySelectorAll('[id^="mob-"]').forEach(l => {
    l.classList.remove('text-accent-600', 'dark:text-accent-400');
    l.classList.add('text-slate-400', 'dark:text-slate-500');
  });

  // Determine active key
  let key = null;
  if (hash.includes('do2i')) key = 'do2i';
  else if (hash.includes('predicted-hct')) key = 'predicted-hct';
  else if (hash.includes('bsa')) key = 'bsa';
  else if (hash.includes('lbm')) key = 'lbm';
  else if (hash.includes('heparin')) key = 'heparin';
  else if (hash.includes('timecalc')) key = 'timecalc';
  else if (hash.includes('faq')) key = 'faq';
  else if (hash.includes('privacy')) key = 'privacy';
  else if (hash.includes('terms')) key = 'terms';
  else if (hash.includes('contact')) key = 'contact';

  updateMetaForRoute(key || 'do2i');

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
}

// -----------------------------
// Event Wiring
// -----------------------------
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  document.getElementById('year').textContent = now.getFullYear();
  const iso = now.toISOString().slice(0, 10);
  const pdate = document.getElementById('privacy-date');
  if (pdate) pdate.textContent = iso;
  const tdate = document.getElementById('terms-date');
  if (tdate) tdate.textContent = iso;

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

  setupContactActions();

  initTimeCalculator();
  initHeparinManagement();

  updateTargetDisplay();
  updateGDP();
  updateHct();
  updateLBM();
});
