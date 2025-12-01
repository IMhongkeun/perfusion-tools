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

  for (let ci = 1.0; ci <= 3.0001; ci += 0.1) {
    const flow = ci * bsaVal;
    const row = document.createElement('div');
    row.className = 'grid grid-cols-[1fr_auto] items-center py-1.5 text-sm border-b border-slate-100 dark:border-primary-800 last:border-0 gap-3';
    row.innerHTML = `<span class="font-mono text-xs text-slate-500 dark:text-slate-400">CI ${ci.toFixed(1)}</span><span class="font-semibold text-primary-900 dark:text-white">${flow.toFixed(2)} L/min</span>`;
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
const do2iIds = ['h_cm', 'w_kg', 'bsa', 'bsa-method', 'flow', 'hb', 'sao2', 'pao2'];
let lastChangedId = null;
let bsaManualOverride = false;
let do2iMode = 'adult';

const THRESHOLDS = {
  adult: { low: 260, borderline: 300, upper: 450, max: 500, legend: 'Target: 280 - 300+' },
  infant: { low: 340, borderline: 380, upper: 520, max: 600, legend: 'Target: 350+' }
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

function updateDO2i() {
  updateBSA();
  const bsaVal = el('bsa').value;
  const hbVal = el('hb').value;
  const sao2Val = el('sao2').value;
  const pao2Val = el('pao2').value;
  const flowVal = el('flow').value;

  const requiredFilled = [bsaVal, hbVal, sao2Val, pao2Val, flowVal]
    .every(v => v !== '' && !Number.isNaN(parseFloat(v)));

  const bsa = parseFloat(bsaVal) || 0;
  const flow = parseFloat(flowVal) || 0;
  const hb = parseFloat(hbVal) || 0;
  const sao2 = parseFloat(sao2Val) || 0;
  const pao2 = parseFloat(pao2Val) || 0;
  const g = el('do2i-gauge');

  if (!requiredFilled || !bsa) {
    el('cao2').value = '';
    setText('do2i', '0 <span class="text-lg font-normal text-slate-400">mL/min/m²</span>');
    g.style.width = '0%';
    g.className = 'h-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)] from-accent-600 to-accent-400';
    setText('do2i-msg', 'Enter required fields (BSA, Hb, SaO₂, PaO₂, Pump Flow)');
    el('do2i-msg').className = 'text-sm font-bold text-amber-400';
    return;
  }

  const cao2 = calcCaO2(hb, sao2, pao2);
  el('cao2').value = cao2 ? cao2.toFixed(2) : '';
  const do2i = flow ? calcDO2i(flow, bsa, cao2) : 0;
  setText('do2i', do2i ? `${Math.round(do2i)} <span class="text-lg font-normal text-slate-400">mL/min/m²</span>` : '0 <span class="text-lg font-normal text-slate-400">mL/min/m²</span>');
  const t = THRESHOLDS[do2iMode];
  let gaugePct = 0, msg = 'Waiting...', gaugeColor = 'from-accent-600 to-accent-400';
  if (do2i) {
    gaugePct = Math.min(Math.max((do2i / t.max) * 100, 0), 100);
    if (do2i < t.low) {
      msg = 'Low Delivery';
      gaugeColor = 'from-red-600 to-red-400';
    }
    else if (do2i < t.borderline) {
      msg = 'Borderline';
      gaugeColor = 'from-amber-500 to-amber-300';
    }
    else if (do2i <= t.upper) {
      msg = 'Target Range';
      gaugeColor = 'from-emerald-500 to-emerald-300';
    }
    else {
      msg = 'High Delivery';
      gaugeColor = 'from-sky-500 to-sky-300';
    }
  }

  if (!flow) {
    msg = 'Enter pump flow to assess adequacy';
  }

  g.style.width = `${gaugePct}%`;
  g.className = `h-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_10px_rgba(255,255,255,0.3)] ${gaugeColor}`;
  setText('do2i-msg', msg);

  const msgEl = el('do2i-msg');
  let msgClass = 'text-sm font-bold text-accent-400';
  if (!flow) msgClass = 'text-sm font-bold text-amber-400';
  else if (do2i < t.low) msgClass = 'text-sm font-bold text-red-400';
  else if (do2i < t.borderline) msgClass = 'text-sm font-bold text-amber-400';
  else if (do2i <= t.upper) msgClass = 'text-sm font-bold text-emerald-400';
  else msgClass = 'text-sm font-bold text-sky-400';
  msgEl.className = msgClass;
}

function resetDO2i() {
  ['h_cm', 'w_kg', 'bsa', 'flow', 'hb', 'sao2', 'pao2'].forEach(id => {
    const n = el(id);
    if (n) n.value = '';
  });
  bsaManualOverride = false;
  el('cao2').value = '';
  setText('do2i', '0 <span class="text-lg font-normal text-slate-400">mL/min/m²</span>');
  el('do2i-gauge').style.width = '0%';
  setText('do2i-msg', 'Waiting for input...');
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
function updateLBM() {
  const h = num('lbm_h_cm');
  const w = num('lbm_w_kg');
  const sex = el('lbm_sex').value;
  const formula = el('lbm_formula').value;

  const lbm = computeLBM({ sex, h, w, formula });
  setText(
    'lbm_result',
    lbm
      ? `${lbm.toFixed(1)} <span class="text-lg font-normal text-slate-400">kg</span>`
      : `0 <span class="text-lg font-normal text-slate-400">kg</span>`
  );
}

// -----------------------------
// Router & Navigation Styling
// -----------------------------
function route() {
  const hash = location.hash || '#/do2i';

  // Updated sections list to include LBM and standalone BSA
  const sections = ['view-do2i', 'view-hct', 'view-lbm', 'view-bsa', 'faq', 'view-privacy', 'view-terms', 'view-contact'];
  sections.forEach(sid => {
    el(sid).classList.add('hidden');
  });

  // Route to appropriate section
  if (hash.includes('do2i')) el('view-do2i').classList.remove('hidden');
  else if (hash.includes('predicted-hct')) el('view-hct').classList.remove('hidden');
  else if (hash.includes('bsa')) el('view-bsa').classList.remove('hidden');
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
    'bsa': ['nav-bsa', 'side-bsa', 'mob-bsa'],
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
  else if (hash.includes('bsa')) key = 'bsa';
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
        if (id === 'bsa') {
          bsaManualOverride = true;
          setText('bsa-hint', el('bsa').value ? 'manual' : 'auto-calc');
        }
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
