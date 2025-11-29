'use strict';

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
  GehanGeorge(h, w) {
    return 0.0235 * Math.pow(h, 0.42246) * Math.pow(w, 0.51456);
  },
};

function computeBSA(h, w, method) {
  if (!h || !w || h <= 0 || w <= 0) return 0;
  return BSA[method || 'Mosteller'](h, w);
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

// Metabolic factor for temperature-adjusted DO₂i interpretation.
// This simplified Q10 model is derived from CPB hypothermia literature:
// - Normothermic targets (~280–300 mL/min/m²) correlate with lower AKI/lactate in adult CPB.
// - VO₂ roughly halves with a 10°C drop during moderate hypothermia (Q10 ≈ 2.0), with reported 6–7% VO₂ change per °C.
// - We clamp to 20–39°C to avoid extreme extrapolation; factor floors near deep hypothermia are still >= ~0.35 of normothermic demand.
function computeMetabolicFactor(tempC) {
  const Q10 = 1.9; // conservative midpoint (literature range ~1.8–2.0) for whole-body VO₂ under CPB hypothermia
  const t = clamp(tempC || 37, 20, 39);
  const factor = Math.pow(Q10, (t - 37) / 10);
  return clamp(factor, 0.35, 1.1);
}
// Example scaling: 37°C → 1.00× (280–300); 32°C → ~0.72× (~200–216); 28°C → ~0.57× (~160–171).
// Educational only — does not replace institutional perfusion targets or metabolic monitoring.

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
// DO2i Interaction
// -----------------------------
const do2iIds = ['h_cm', 'w_kg', 'bsa', 'bsa-method', 'flow', 'hb', 'sao2', 'pao2', 'temp_c'];
let lastChangedId = null;
let do2iMode = 'adult';

const THRESHOLDS = {
  adult: { low: 260, borderline: 300, upper: 450, max: 500, legend: 'Target: 280 - 300+' },
  infant: { low: 340, borderline: 380, upper: 520, max: 600, legend: 'Target: 350+' }
};

const BASE_TARGETS = {
  adult: { low: 280, high: 300 },
  infant: { low: 350, high: 380 }
};

function applyModeUI() {
  const isAdult = do2iMode === 'adult';
  el('mode-adult').className = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors ' + (isAdult ? 'bg-white dark:bg-primary-700 shadow-sm text-primary-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-primary-900');
  el('mode-infant').className = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors ' + (!isAdult ? 'bg-white dark:bg-primary-700 shadow-sm text-primary-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-primary-900');
  setText('do2i-legend', THRESHOLDS[do2iMode].legend);

  el('clinical-note-adult').classList.toggle('hidden', !isAdult);
  el('clinical-note-infant').classList.toggle('hidden', isAdult);
}

function updateBSA() {
  if (lastChangedId === 'bsa') return;
  const h = num('h_cm'), w = num('w_kg');
  const method = el('bsa-method').value;
  const v = computeBSA(h, w, method);
  const out = v ? v.toFixed(2) : '';
  el('bsa').value = out;
  setText('bsa-hint', out ? 'calculated' : 'auto-calc');
}

function updateDO2i() {
  updateBSA();
  const bsa = num('bsa');
  const flow = num('flow');
  const hb = num('hb');
  const sao2 = num('sao2');
  const pao2 = parseFloat(el('pao2').value) || 0;
  const tempRaw = parseFloat(el('temp_c')?.value);
  const hasTemp = !Number.isNaN(tempRaw);
  const temp = hasTemp ? tempRaw : 37;
  const baseThresholds = THRESHOLDS[do2iMode];
  // temperature-adjusted thresholds for the gauge
  const factor = hasTemp ? clamp(computeMetabolicFactor(temp), 0.4, 1.1) : 1;
  const low = baseThresholds.low * factor;
  const borderline = baseThresholds.borderline * factor;
  const upper = baseThresholds.upper * factor;
  const max = baseThresholds.max * factor;
  const cao2 = calcCaO2(hb, sao2, pao2);
  el('cao2').value = cao2 ? cao2.toFixed(2) : '';
  const do2i = calcDO2i(flow, bsa, cao2);
  setText('do2i', do2i ? `${Math.round(do2i)} <span class="text-lg font-normal text-slate-400">mL/min/m²</span>` : '0 <span class="text-lg font-normal text-slate-400">mL/min/m²</span>');
  let gaugePct = 0, msg = 'Waiting...', gaugeColor = 'from-accent-600 to-accent-400';
  if (do2i) {
    gaugePct = Math.min(Math.max((do2i / max) * 100, 0), 100);
    if (do2i < low) {
      msg = 'Low Delivery';
      gaugeColor = 'from-red-600 to-red-400';
    }
    else if (do2i < borderline) {
      msg = 'Borderline';
      gaugeColor = 'from-amber-500 to-amber-300';
    }
    else if (do2i <= upper) {
      msg = 'Target Range';
      gaugeColor = 'from-emerald-500 to-emerald-300';
    }
    else {
      msg = 'High Delivery';
      gaugeColor = 'from-sky-500 to-sky-300';
    }
  }

  const g = el('do2i-gauge');
  g.style.width = `${gaugePct}%`;
  g.className = `h-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)] ${gaugeColor}`;
  setText('do2i-msg', msg);

  const msgEl = el('do2i-msg');
  if (do2i < low) msgEl.className = 'text-sm font-bold text-red-400';
  else if (do2i < borderline) msgEl.className = 'text-sm font-bold text-amber-400';
  else if (do2i <= upper) msgEl.className = 'text-sm font-bold text-emerald-400';
  else msgEl.className = 'text-sm font-bold text-sky-400';

  // Temperature-adjusted interpretive target (does not alter measured DO₂i)
  const baseTargets = BASE_TARGETS[do2iMode];
  const tempLow = Math.max(baseTargets.low * factor, 150);
  const tempHigh = Math.max(baseTargets.high * factor, 150);
  const factorText = factor.toFixed(2);
  if (hasTemp) {
    setText('do2i-temp-target', `Equivalent DO₂i target at ${temp.toFixed(1)}°C: ${Math.round(tempLow)}–${Math.round(tempHigh)} mL/min/m² <span class="text-[11px] text-slate-400 dark:text-slate-500">(scaled by metabolic factor ${factorText}; baseline ${baseTargets.low}–${baseTargets.high} at 37°C)</span>`);
    setText('do2i-legend', `${do2iMode === 'adult' ? 'Adult' : 'Infant'}, ${temp.toFixed(1)}°C target ≈ ${Math.round(tempLow)}–${Math.round(tempHigh)} mL/min/m² (baseline ${baseTargets.low}–${baseTargets.high} at 37°C)`);
  } else {
    setText('do2i-temp-target', `Equivalent DO₂i target at 37.0°C: ${baseTargets.low}–${baseTargets.high} mL/min/m²`);
    setText('do2i-legend', baseThresholds.legend);
  }
}

function resetDO2i() {
  ['h_cm', 'w_kg', 'bsa', 'flow', 'hb', 'sao2', 'pao2', 'temp_c'].forEach(id => {
    const n = el(id);
    if (n) n.value = '';
  });
  el('cao2').value = '';
  setText('do2i', '0 <span class="text-lg font-normal text-slate-400">mL/min/m²</span>');
  el('do2i-gauge').style.width = '0%';
  setText('do2i-msg', 'Waiting for input...');
  setText('do2i-temp-target', 'Equivalent DO₂i target at 37.0°C: 280–300 mL/min/m²');
  do2iMode = 'adult';
  applyModeUI();
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

  const lbm = computeLBM({ sex, h, w, formula });
  const lbmDisplay = lbm && lbm > 0 ? lbm.toFixed(1) : '0';
  setText('lbm_result', `${lbmDisplay} <span class="text-lg font-normal text-slate-400">kg</span>`);

  // BSA (Mosteller) using actual weight and lean body mass (if available)
  const bsaActual = computeBSA(h, w, 'Mosteller');
  const bsaLean = lbm && lbm > 0 ? computeBSA(h, lbm, 'Mosteller') : 0;

  setText('lbm_bsa_actual', bsaActual && bsaActual > 0
    ? `${bsaActual.toFixed(2)} <span class="text-sm font-normal text-slate-400 dark:text-slate-500">m²</span>`
    : '—');

  setText('lbm_bsa_lean', bsaLean && bsaLean > 0
    ? `${bsaLean.toFixed(2)} <span class="text-sm font-normal text-slate-400 dark:text-slate-500">m²</span>`
    : '—');

  renderLBMFlowTable(bsaActual, bsaLean);
}

// -----------------------------
// Router & Navigation Styling
// -----------------------------
function route() {
  const hash = location.hash || '#/do2i';

  // Updated sections list to include LBM
  const sections = ['view-do2i', 'view-hct', 'view-lbm', 'faq', 'view-privacy', 'view-terms', 'view-contact'];
  sections.forEach(sid => {
    el(sid).classList.add('hidden');
  });

  // Route to appropriate section
  if (hash.includes('do2i')) el('view-do2i').classList.remove('hidden');
  else if (hash.includes('predicted-hct')) el('view-hct').classList.remove('hidden');
  else if (hash.includes('lbm')) el('view-lbm').classList.remove('hidden');
  else if (hash.includes('faq')) el('faq').classList.remove('hidden');
  else if (hash.includes('privacy')) el('view-privacy').classList.remove('hidden');
  else if (hash.includes('terms')) el('view-terms').classList.remove('hidden');
  else if (hash.includes('contact')) el('view-contact').classList.remove('hidden');
  else el('view-do2i').classList.remove('hidden');

  // Updated navMap to include LBM
  const navMap = {
    'do2i': ['nav-do2i', 'side-do2i', 'mob-do2i'],
    'predicted-hct': ['nav-hct', 'side-hct', 'mob-hct'],
    'lbm': ['nav-lbm', 'side-lbm', 'mob-lbm'],
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
  else if (hash.includes('lbm')) key = 'lbm';
  else if (hash.includes('faq')) key = 'faq';

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

  // DO2i event listeners
  do2iIds.forEach(id => {
    const x = el(id);
    if (x) {
      x.addEventListener('input', () => {
        lastChangedId = id;
        updateDO2i();
      });

      if (id === 'bsa-method') x.addEventListener('change', () => {
        lastChangedId = id;
        updateDO2i();
      });
    }
  });

  el('mode-adult').addEventListener('click', () => {
    do2iMode = 'adult';
    applyModeUI();
    updateDO2i();
  });
  el('mode-infant').addEventListener('click', () => {
    do2iMode = 'infant';
    applyModeUI();
    updateDO2i();
  });
  el('do2i-reset').addEventListener('click', () => {
    lastChangedId = null;
    resetDO2i();
  });

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
  ['lbm_h_cm', 'lbm_w_kg', 'lbm_sex', 'lbm_formula'].forEach(id => {
    const x = el(id);
    if (x) x.addEventListener('input', updateLBM);
  });

  // Contact form handler
  const cform = document.getElementById('contact-form');
  if (cform) {
    cform.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = el('c_name').value;
      const status = el('c_status');
      status.textContent = `Thanks ${name || 'user'}, opening mail client...`;
      setTimeout(() => status.textContent = '', 3000);
    });
  }

  applyModeUI();
  updateDO2i();
  updateHct();
  updateLBM();
});
