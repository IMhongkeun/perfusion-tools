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
const themeColorMeta = document.getElementById('theme-color-meta');

function updateThemeColor(isDark) {
  if (!themeColorMeta) return;
  themeColorMeta.setAttribute('content', isDark ? '#0f172a' : '#f8fafc');
}

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

  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  updateThemeColor(isDark);
}

const savedTheme = localStorage.getItem('theme');
const initialIsDark = savedTheme === 'dark';
updateThemeUI(initialIsDark);

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
  canonicalPath: '/',
  robots: 'index,follow'
};

function getRouteMeta(path) {
  const metaSource = window.routeMeta || {};
  const rawNormalized = window.normalizeRoute
    ? window.normalizeRoute(path)
    : path;
  const normalized = typeof rawNormalized === 'string' && rawNormalized.length > 1 && rawNormalized.endsWith('/')
    ? rawNormalized.slice(0, -1)
    : rawNormalized;
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

  let robotsTag = document.querySelector('meta[name="robots"]');
  if (!robotsTag) {
    robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    document.head.appendChild(robotsTag);
  }
  robotsTag.setAttribute('content', meta.robots || FALLBACK_META.robots);

  const canonicalTag = document.querySelector('link[rel="canonical"]');
  if (canonicalTag) {
    const canonicalPath = meta.canonicalPath || FALLBACK_META.canonicalPath || '/';
    canonicalTag.setAttribute('href', `${CANONICAL_BASE}${canonicalPath}`);
  }
}

const TOP_NAV_ITEMS = [
  { path: '/', label: 'Home' },
  { path: '/bsa/', label: 'BSA' },
  { path: '/lbm/', label: 'LBM' },
  { path: '/gdp/', label: 'GDP' },
  { path: '/heparin/', label: 'Heparin' },
  { path: '/predicted-hct/', label: 'Predicted Hct' },
  { path: '/phn-echo/', label: 'Z-score' },
  { path: '/priming-volume/', label: 'Priming Volume' },
  { path: '/timecalc/', label: 'Time' },
  { path: '/quick-reference/', label: 'Quick Reference' },
  { path: '/unit-converter/', label: 'Unit Converter' },
  { path: '/info', label: 'Info' },
];

function initStandaloneTopNav() {
  // The integrated homepage already ships its own full top nav.
  if (el('nav-home')) return;

  const headerRow = document.querySelector('header .max-w-7xl');
  const themeBtn = el('theme-toggle');
  if (!headerRow || !themeBtn) return;

  const currentPath = window.normalizeRoute
    ? window.normalizeRoute(window.location.pathname || '/')
    : (window.location.pathname || '/');

  let nav = el('global-top-nav');
  if (!nav) {
    nav = document.createElement('nav');
    nav.id = 'global-top-nav';
    nav.className = 'hidden md:flex items-center gap-1 text-sm font-medium overflow-x-auto whitespace-nowrap max-w-[68%] pr-1';
    headerRow.insertBefore(nav, themeBtn);
  }

  nav.innerHTML = TOP_NAV_ITEMS.map((item) => {
    const normalizedItemPath = item.path.length > 1 && item.path.endsWith('/')
      ? item.path.slice(0, -1)
      : item.path;
    const isActive = currentPath === normalizedItemPath;
    const activeClasses = isActive
      ? 'bg-slate-100 text-accent-600 dark:bg-primary-800 dark:text-accent-400 border-slate-200 dark:border-primary-700'
      : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800 hover:border-slate-200 dark:hover:border-primary-700 hover:text-primary-900 dark:hover:text-accent-400';
    return `<a href="${item.path}" class="nav-link px-4 py-2 rounded-full border transition-colors ${activeClasses}">${item.label}</a>`;
  }).join('');

  attachTopNavOverflowArrow(nav, 'global-top-nav-next');
}

function attachTopNavOverflowArrow(nav, buttonId) {
  if (!nav) return;
  const headerRow = document.querySelector('header .max-w-7xl');
  const themeBtn = el('theme-toggle');
  if (!headerRow || !themeBtn) return;

  let nextBtn = el(buttonId);
  if (!nextBtn) {
    nextBtn = document.createElement('button');
    nextBtn.id = buttonId;
    nextBtn.type = 'button';
    nextBtn.className = 'hidden md:inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 dark:border-primary-700 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800 transition-colors';
    nextBtn.innerHTML = '→';
    headerRow.insertBefore(nextBtn, themeBtn);
  }

  const updateButtonVisibility = () => {
    const hasOverflow = nav.scrollWidth - nav.clientWidth > 8;
    const atEnd = nav.scrollLeft + nav.clientWidth >= nav.scrollWidth - 8;
    nextBtn.classList.toggle('hidden', !hasOverflow || atEnd);
  };

  nextBtn.onclick = () => {
    nav.scrollBy({ left: 220, behavior: 'smooth' });
    setTimeout(updateButtonVisibility, 180);
  };

  nav.addEventListener('scroll', updateButtonVisibility);
  window.addEventListener('resize', updateButtonVisibility);
  setTimeout(updateButtonVisibility, 50);
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

const BSA_UNIT = {
  metric: 'metric',
  imperial: 'imperial'
};

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;
let bsaInputUnit = BSA_UNIT.metric;
let bsaPatientSex = 'male';
let bsaLeanSelectedCi = 2.4;
const bsaFlowNumericClass = "bsa-flow-number text-xs font-semibold [font-variant-numeric:tabular-nums_lining-nums] [font-feature-settings:'tnum'_1,'lnum'_1]";

function toMetricBsaInputs(heightValue, weightValue, inputUnit) {
  if (inputUnit === BSA_UNIT.imperial) {
    return {
      heightCm: heightValue * CM_PER_INCH,
      weightKg: weightValue * KG_PER_LB
    };
  }

  return {
    heightCm: heightValue,
    weightKg: weightValue
  };
}

function convertBsaInputValue(value, fromUnit, toUnit, type) {
  if (!Number.isFinite(value) || value <= 0 || fromUnit === toUnit) return value;

  if (type === 'height') {
    return fromUnit === BSA_UNIT.metric ? (value / CM_PER_INCH) : (value * CM_PER_INCH);
  }
  return fromUnit === BSA_UNIT.metric ? (value / KG_PER_LB) : (value * KG_PER_LB);
}

function updateBsaUnitUi() {
  const isMetric = bsaInputUnit === BSA_UNIT.metric;
  const metricBtn = el('bsa-unit-metric');
  const imperialBtn = el('bsa-unit-imperial');
  const heightUnit = el('bsa-height-unit');
  const weightUnit = el('bsa-weight-unit');
  const heightInput = el('bsa_height');
  const weightInput = el('bsa_weight');

  if (metricBtn) {
    metricBtn.className = isMetric
      ? 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-900 text-white dark:bg-primary-700'
      : 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800';
  }

  if (imperialBtn) {
    imperialBtn.className = isMetric
      ? 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800'
      : 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-900 text-white dark:bg-primary-700';
  }

  if (heightUnit) heightUnit.textContent = isMetric ? 'cm' : 'inches';
  if (weightUnit) weightUnit.textContent = isMetric ? 'kg' : 'lb';
  if (heightInput) heightInput.placeholder = isMetric ? '170' : '66.9';
  if (weightInput) weightInput.placeholder = isMetric ? '70' : '154.3';
}

function updateBsaSexUi() {
  const maleBtn = el('bsa-sex-male');
  const femaleBtn = el('bsa-sex-female');
  const isMale = bsaPatientSex === 'male';

  if (maleBtn) {
    maleBtn.className = isMale
      ? 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-900 text-white dark:bg-primary-700'
      : 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800';
  }

  if (femaleBtn) {
    femaleBtn.className = isMale
      ? 'px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800'
      : 'px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-900 text-white dark:bg-primary-700';
  }
}

function renderLeanFlowList(leanBsa) {
  const leanFlowList = el('bsa-lean-flow-list');
  const quickWrap = el('bsa-lean-ci-quick');
  if (!leanFlowList) return;

  leanFlowList.innerHTML = '';
  if (!(leanBsa > 0)) return;

  for (let ciTenths = 10; ciTenths <= 30; ciTenths += 2) {
    const ci = ciTenths / 10;
    const flow = ci * leanBsa;
    const row = document.createElement('div');
    const isSelected = Math.abs(ci - bsaLeanSelectedCi) < 0.05;
    const isCi24 = Math.abs(ci - 2.4) < 0.05;
    row.className = `grid grid-cols-[1fr_auto] items-center py-1.5 px-2 text-sm border-b border-blue-100 dark:border-blue-900/60 last:border-0 gap-3 ${isSelected ? 'bg-blue-200/70 dark:bg-blue-700/40' : (isCi24 ? 'bg-blue-100/70 dark:bg-blue-800/30' : '')}`;
    row.innerHTML = `<span class="${bsaFlowNumericClass} text-blue-800 dark:text-blue-200">CI ${ci.toFixed(1)}</span><span class="${bsaFlowNumericClass} text-right text-blue-900 dark:text-blue-100">${flow.toFixed(2)} L/min</span>`;
    leanFlowList.appendChild(row);
  }

  if (quickWrap) {
    quickWrap.querySelectorAll('button[data-ci]').forEach((btn) => {
      const ci = Number(btn.dataset.ci);
      const isActive = Math.abs(ci - bsaLeanSelectedCi) < 0.05;
      btn.className = isActive
        ? 'px-2 py-1 text-xs rounded-md border border-blue-500 bg-blue-600 text-white font-semibold'
        : 'px-2 py-1 text-xs rounded-md border border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-800/40';
    });
  }
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
    row.innerHTML = `<span class="${bsaFlowNumericClass} text-slate-500 dark:text-slate-400">CI ${ci.toFixed(1)}</span><span class="${bsaFlowNumericClass} text-right text-primary-900 dark:text-white">${flow.toFixed(2)} L/min</span>`;
    list.appendChild(row);
  }
}

function updateStandaloneBsa() {
  const bsaMethodLabelMap = {
    Mosteller: 'Mosteller',
    DuBois: 'Du Bois',
    Haycock: 'Haycock',
    GehanGeorge: 'Gehan-George',
    Boyd: 'Boyd'
  };
  const hRaw = num('bsa_height');
  const wRaw = num('bsa_weight');
  const method = el('bsa-method-standalone') ? el('bsa-method-standalone').value : 'Mosteller';
  const formulaCompareEl = el('bsa-formula-compare');
  const bmiDisplay = el('bsa-bmi-display');
  const obesityNote = el('bsa-obesity-note');
  const obesityBadge = el('bsa-obesity-badge');
  const obesityMessage = el('bsa-obesity-message');
  const leanFlowCard = el('bsa-lean-flow-card');
  const tbwFlowCard = el('bsa-tbw-flow-card');
  const leanBsaEl = el('bsa-lean-bsa');
  const leanWeightEl = el('bsa-lean-weight');
  const heparinAlert = el('bsa-heparin-alert');

  const metricInput = toMetricBsaInputs(hRaw, wRaw, bsaInputUnit);
  const h = metricInput.heightCm;
  const w = metricInput.weightKg;

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
  if (methodActive) methodActive.textContent = bsaMethodLabelMap[method] || method;

  if (bmiDisplay) {
    if (h > 0 && w > 0) {
      const heightMeters = h / 100;
      const bmi = w / (heightMeters * heightMeters);
      bmiDisplay.textContent = `BMI: ${bmi.toFixed(1)} kg/m²`;
      if (obesityNote) obesityNote.textContent = bmi >= 30 ? 'Obesity Adjustment: Lean flow recommended' : 'Obesity Adjustment: Not indicated';

      if (obesityBadge) {
        obesityBadge.classList.toggle('hidden', bmi < 30);
        obesityBadge.textContent = bmi >= 30 ? `Obese BMI ${bmi.toFixed(1)}` : 'Obese BMI —';
      }
      if (obesityMessage) obesityMessage.textContent = 'TBW BSA may overestimate metabolic demand';

      if (leanFlowCard && tbwFlowCard) {
        const isObese = bmi >= 30;
        leanFlowCard.classList.toggle('hidden', !isObese);
        if (isObese) {
          const targetBmiWeightKg = 25 * Math.pow(heightMeters, 2);
          const leanBsa = computeBSA(h, targetBmiWeightKg, method);
          if (leanBsaEl) leanBsaEl.textContent = `${leanBsa.toFixed(2)} m²`;
          if (leanWeightEl) leanWeightEl.textContent = `${targetBmiWeightKg.toFixed(1)} kg`;
          renderLeanFlowList(leanBsa);

          if (heparinAlert) heparinAlert.classList.toggle('hidden', bmi < 35);
        } else {
          if (leanBsaEl) leanBsaEl.textContent = '—';
          if (leanWeightEl) leanWeightEl.textContent = '—';
          if (heparinAlert) heparinAlert.classList.add('hidden');
        }
      }
    } else {
      bmiDisplay.textContent = 'BMI: —';
      if (obesityNote) obesityNote.textContent = 'Obesity Adjustment: —';
      if (obesityBadge) {
        obesityBadge.classList.add('hidden');
        obesityBadge.textContent = 'Obese BMI —';
      }
      if (obesityMessage) obesityMessage.textContent = 'TBW BSA may overestimate metabolic demand';
      if (leanFlowCard) leanFlowCard.classList.add('hidden');
      if (leanBsaEl) leanBsaEl.textContent = '—';
      if (leanWeightEl) leanWeightEl.textContent = '—';
      if (heparinAlert) heparinAlert.classList.add('hidden');
    }
  }

  if (formulaCompareEl) {
    if (!v) {
      formulaCompareEl.innerHTML = '<p class="text-xs text-slate-500 dark:text-slate-400">Enter height and weight to compare formulas.</p>';
    } else {
      const allMethods = ['Mosteller', 'DuBois', 'Haycock', 'GehanGeorge', 'Boyd'];
      const rows = allMethods
        .filter((formula) => formula !== method)
        .map((formula) => ({ formula, bsa: computeBSA(h, w, formula) }));

      const tableRows = rows.map((row) => `
        <tr class="border-t border-slate-100 dark:border-primary-700/60">
          <td class="py-1.5 pr-2 text-slate-600 dark:text-slate-300">${bsaMethodLabelMap[row.formula] || row.formula}</td>
          <td class="py-1.5 text-right font-semibold text-primary-900 dark:text-white">${row.bsa.toFixed(3)} m²</td>
        </tr>
      `).join('');

      formulaCompareEl.innerHTML = `
        <table class="w-full text-xs">
          <thead>
            <tr class="text-slate-500 dark:text-slate-400">
              <th class="text-left font-semibold py-1">Formula</th>
              <th class="text-right font-semibold py-1">BSA</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      `;
    }
  }

  updateBsaFlowList(v);
}

function setBsaUnit(nextUnit) {
  if (!nextUnit || nextUnit === bsaInputUnit) return;

  const heightInput = el('bsa_height');
  const weightInput = el('bsa_weight');
  const currentHeight = heightInput ? Number(heightInput.value) : NaN;
  const currentWeight = weightInput ? Number(weightInput.value) : NaN;

  if (heightInput && Number.isFinite(currentHeight) && currentHeight > 0) {
    const convertedHeight = convertBsaInputValue(currentHeight, bsaInputUnit, nextUnit, 'height');
    heightInput.value = Number.isFinite(convertedHeight) ? convertedHeight.toFixed(1) : '';
  }

  if (weightInput && Number.isFinite(currentWeight) && currentWeight > 0) {
    const convertedWeight = convertBsaInputValue(currentWeight, bsaInputUnit, nextUnit, 'weight');
    const weightDecimals = nextUnit === BSA_UNIT.imperial ? 2 : 1;
    weightInput.value = Number.isFinite(convertedWeight) ? convertedWeight.toFixed(weightDecimals) : '';
  }

  bsaInputUnit = nextUnit;
  updateBsaUnitUi();
  updateStandaloneBsa();
}

function openHeparinFromBsa() {
  const metricInput = toMetricBsaInputs(num('bsa_height'), num('bsa_weight'), bsaInputUnit);
  const heightCm = metricInput.heightCm;
  const weightKg = metricInput.weightKg;
  if (!(heightCm > 0) || !(weightKg > 0)) return;

  const method = el('bsa-method-standalone') ? el('bsa-method-standalone').value : 'Mosteller';
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  const targetBmiWeightKg = 25 * Math.pow(heightCm / 100, 2);
  const leanBsa = computeBSA(heightCm, targetBmiWeightKg, method);
  const bsaValue = computeBSA(heightCm, weightKg, method);

  const payload = {
    source: 'bsa',
    heightCm,
    weightKg,
    sex: bsaPatientSex,
    bmi,
    bsa: bsaValue,
    leanBsa,
    leanWeightKg: targetBmiWeightKg,
    timestamp: Date.now()
  };

  localStorage.setItem('patientDataFromBSA', JSON.stringify(payload));
  window.location.href = '/heparin';
}

function preloadHeparinFromBsa() {
  const raw = localStorage.getItem('patientDataFromBSA');
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    const heightInput = el('hep2-height');
    const weightInput = el('hep2-weight');
    const sexInput = el('hep2-sex');
    if (!heightInput || !weightInput || !sexInput) return;

    if (data.heightCm > 0) heightInput.value = Number(data.heightCm).toFixed(1);
    if (data.weightKg > 0) weightInput.value = Number(data.weightKg).toFixed(1);
    if (data.sex === 'male' || data.sex === 'female') sexInput.value = data.sex;

    localStorage.removeItem('patientDataFromBSA');
  } catch (error) {
    // ignore invalid cached payloads
  }
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


const UNIT_LABELS = {
  flowInput: 'L/min',
  flowOutputMlMin: 'mL/min',
  flowOutputMlKgMin: 'mL/kg/min',
  flowWeightInput: 'kg',
  pressureMmhg: 'mmHg',
  pressureKpa: 'kPa',
  pressureCmh2o: 'cmH₂O',
  pressurePsi: 'psi',
  pressureBar: 'bar'
};

function initUnitConverterLabels() {
  const flowInputLabel = el('unit-label-flow-input');
  const flowWeightLabel = el('unit-label-flow-weight-input');
  const flowOutputMlMinLabel = el('unit-label-flow-output-mlmin');
  const flowOutputMlKgMinLabel = el('unit-label-flow-output-mlkgmin');
  const pressureMmhgLabel = el('unit-label-pressure-mmhg');
  const pressureKpaClinicalLabel = el('unit-label-pressure-kpa-clinical');
  const pressureCmh2oLabel = el('unit-label-pressure-cmh2o');
  const pressurePsiLabel = el('unit-label-pressure-psi');
  const pressureKpaGasLabel = el('unit-label-pressure-kpa-gas');
  const pressureBarLabel = el('unit-label-pressure-bar');
  const pressureMmhgUnit = el('unit-pressure-mmhg-unit');
  const pressureKpaClinicalUnit = el('unit-pressure-kpa-clinical-unit');
  const pressureCmh2oUnit = el('unit-pressure-cmh2o-unit');
  const pressurePsiUnit = el('unit-pressure-psi-unit');
  const pressureKpaGasUnit = el('unit-pressure-kpa-gas-unit');
  const pressureBarUnit = el('unit-pressure-bar-unit');
  const flowFormulaMlMin = el('unit-flow-formula-mlmin');
  const flowFormulaMlKgMin = el('unit-flow-formula-mlkgmin');
  const pressureFromSelect = el('unit-pressure-from');

  if (flowInputLabel) flowInputLabel.textContent = `Flow (${UNIT_LABELS.flowInput})`;
  if (flowWeightLabel) flowWeightLabel.textContent = `Weight (${UNIT_LABELS.flowWeightInput})`;
  if (flowOutputMlMinLabel) flowOutputMlMinLabel.textContent = UNIT_LABELS.flowOutputMlMin;
  if (flowOutputMlKgMinLabel) flowOutputMlKgMinLabel.textContent = UNIT_LABELS.flowOutputMlKgMin;
  if (pressureMmhgLabel) pressureMmhgLabel.textContent = UNIT_LABELS.pressureMmhg;
  if (pressureKpaClinicalLabel) pressureKpaClinicalLabel.textContent = UNIT_LABELS.pressureKpa;
  if (pressureCmh2oLabel) pressureCmh2oLabel.textContent = UNIT_LABELS.pressureCmh2o;
  if (pressurePsiLabel) pressurePsiLabel.textContent = UNIT_LABELS.pressurePsi;
  if (pressureKpaGasLabel) pressureKpaGasLabel.textContent = UNIT_LABELS.pressureKpa;
  if (pressureBarLabel) pressureBarLabel.textContent = UNIT_LABELS.pressureBar;
  if (pressureMmhgUnit) pressureMmhgUnit.textContent = UNIT_LABELS.pressureMmhg;
  if (pressureKpaClinicalUnit) pressureKpaClinicalUnit.textContent = UNIT_LABELS.pressureKpa;
  if (pressureCmh2oUnit) pressureCmh2oUnit.textContent = UNIT_LABELS.pressureCmh2o;
  if (pressurePsiUnit) pressurePsiUnit.textContent = UNIT_LABELS.pressurePsi;
  if (pressureKpaGasUnit) pressureKpaGasUnit.textContent = UNIT_LABELS.pressureKpa;
  if (pressureBarUnit) pressureBarUnit.textContent = UNIT_LABELS.pressureBar;

  if (flowFormulaMlMin) {
    flowFormulaMlMin.innerHTML = `<strong>Formula:</strong> ${UNIT_LABELS.flowOutputMlMin} = ${UNIT_LABELS.flowInput} × 1000`;
  }
  if (flowFormulaMlKgMin) {
    flowFormulaMlKgMin.innerHTML = `<strong>Formula:</strong> ${UNIT_LABELS.flowOutputMlKgMin} = (${UNIT_LABELS.flowInput} × 1000) / weight(kg)`;
  }

  if (pressureFromSelect) {
    const labelsByValue = {
      mmhg: UNIT_LABELS.pressureMmhg,
      kpa: UNIT_LABELS.pressureKpa,
      cmh2o: UNIT_LABELS.pressureCmh2o,
      psi: UNIT_LABELS.pressurePsi,
      bar: UNIT_LABELS.pressureBar
    };
    Array.from(pressureFromSelect.options).forEach(option => {
      const label = labelsByValue[option.value];
      if (label) option.textContent = label;
    });
  }
}
function updateUnitConverterFlow() {
  const flowLminInput = el('unit-flow-lmin');
  const weightInput = el('unit-flow-weight');
  const mlMinOutput = el('unit-flow-mlmin');
  const mlKgMinOutput = el('unit-flow-mlkgmin');
  if (!flowLminInput || !weightInput || !mlMinOutput || !mlKgMinOutput) return;

  const setWeightRequiredStyle = (isRequired) => {
    mlKgMinOutput.classList.toggle('text-sm', isRequired);
    mlKgMinOutput.classList.toggle('font-medium', isRequired);
    mlKgMinOutput.classList.toggle('text-slate-400', isRequired);
    mlKgMinOutput.classList.toggle('dark:text-slate-500', isRequired);
    mlKgMinOutput.classList.toggle('text-xl', !isRequired);
    mlKgMinOutput.classList.toggle('font-bold', !isRequired);
    mlKgMinOutput.classList.toggle('text-primary-900', !isRequired);
    mlKgMinOutput.classList.toggle('dark:text-white', !isRequired);
  };

  const flowLmin = parseFloat(flowLminInput.value);
  const weightKg = parseFloat(weightInput.value);

  if (!(flowLmin >= 0)) {
    mlMinOutput.textContent = '—';
    mlKgMinOutput.textContent = 'Weight required';
    setWeightRequiredStyle(true);
    return;
  }

  // Base conversion formula: mL/min = L/min × 1000.
  const flowMlMin = flowLmin * 1000;
  mlMinOutput.textContent = `${flowMlMin.toFixed(0)} ${UNIT_LABELS.flowOutputMlMin}`;

  if (!(weightKg > 0)) {
    mlKgMinOutput.textContent = 'Weight required';
    setWeightRequiredStyle(true);
    return;
  }

  // Flow index formula: mL/kg/min = (L/min × 1000) / weight(kg).
  const flowMlKgMin = flowMlMin / weightKg;
  mlKgMinOutput.textContent = `${flowMlKgMin.toFixed(2)} ${UNIT_LABELS.flowOutputMlKgMin}`;
  setWeightRequiredStyle(false);
}

function setUnitConverterTab(activeTab) {
  const flowTabButton = el('unit-tab-flow');
  const pressureTabButton = el('unit-tab-pressure');
  const flowPanel = el('unit-panel-flow');
  const pressurePanel = el('unit-panel-pressure');
  if (!flowTabButton || !pressureTabButton || !flowPanel || !pressurePanel) return;

  const isFlowActive = activeTab !== 'pressure';

  flowPanel.classList.toggle('hidden', !isFlowActive);
  pressurePanel.classList.toggle('hidden', isFlowActive);

  flowTabButton.classList.toggle('bg-accent-500/15', isFlowActive);
  flowTabButton.classList.toggle('text-accent-700', isFlowActive);
  flowTabButton.classList.toggle('dark:text-accent-300', isFlowActive);
  flowTabButton.classList.toggle('text-slate-600', !isFlowActive);
  flowTabButton.classList.toggle('dark:text-slate-300', !isFlowActive);

  pressureTabButton.classList.toggle('bg-accent-500/15', !isFlowActive);
  pressureTabButton.classList.toggle('text-accent-700', !isFlowActive);
  pressureTabButton.classList.toggle('dark:text-accent-300', !isFlowActive);
  pressureTabButton.classList.toggle('text-slate-600', isFlowActive);
  pressureTabButton.classList.toggle('dark:text-slate-300', isFlowActive);
}

function updateUnitConverterPressure() {
  const valueInput = el('unit-pressure-value');
  const fromUnitSelect = el('unit-pressure-from');
  const mmhgOutput = el('unit-pressure-mmhg-value');
  const kpaClinicalOutput = el('unit-pressure-kpa-clinical-value');
  const cmh2oOutput = el('unit-pressure-cmh2o-value');
  const psiOutput = el('unit-pressure-psi-value');
  const kpaGasOutput = el('unit-pressure-kpa-gas-value');
  const barOutput = el('unit-pressure-bar-value');

  if (!valueInput || !fromUnitSelect || !mmhgOutput || !kpaClinicalOutput || !cmh2oOutput || !psiOutput || !kpaGasOutput || !barOutput) return;

  const inputValue = parseFloat(valueInput.value);
  if (!Number.isFinite(inputValue)) {
    [mmhgOutput, kpaClinicalOutput, cmh2oOutput, psiOutput, kpaGasOutput, barOutput].forEach(output => {
      output.textContent = '—';
    });
    return;
  }

  const fromUnit = fromUnitSelect.value;
  let kpaValue = 0;

  // Pressure conversion uses kPa as canonical unit.
  // mmHg -> kPa: kPa = mmHg × 0.133322
  // cmH₂O -> mmHg: mmHg = cmH₂O × 0.735559, then mmHg -> kPa
  // psi -> kPa: kPa = psi × 6.89476
  // bar -> kPa: kPa = bar × 100
  if (fromUnit === 'mmhg') kpaValue = inputValue * 0.133322;
  else if (fromUnit === 'kpa') kpaValue = inputValue;
  else if (fromUnit === 'cmh2o') kpaValue = (inputValue * 0.735559) * 0.133322;
  else if (fromUnit === 'psi') kpaValue = inputValue * 6.89476;
  else if (fromUnit === 'bar') kpaValue = inputValue * 100;

  // kPa -> mmHg: mmHg = kPa × 7.50062
  // mmHg -> cmH₂O: cmH₂O = mmHg × 1.35951
  // kPa -> psi: psi = kPa / 6.89476
  // kPa -> bar: bar = kPa / 100
  const mmhgValue = kpaValue * 7.50062;
  const cmh2oValue = mmhgValue * 1.35951;
  const psiValue = kpaValue / 6.89476;
  const barValue = kpaValue / 100;

  mmhgOutput.textContent = mmhgValue.toFixed(1);
  kpaClinicalOutput.textContent = kpaValue.toFixed(2);
  cmh2oOutput.textContent = cmh2oValue.toFixed(1);
  psiOutput.textContent = psiValue.toFixed(2);
  kpaGasOutput.textContent = kpaValue.toFixed(2);
  barOutput.textContent = barValue.toFixed(2);
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

  setText('required-flow', results.requiredFlow ? `${results.requiredFlow.toFixed(2)} <span class="text-xs text-slate-500 dark:text-slate-400">L/min</span>` : '—');
  setText('current-do2i', results.currentDO2i ? `${Math.round(results.currentDO2i)} <span class="text-xs text-slate-500 dark:text-slate-400">mL/min/m²</span>` : '—');

  let statusLabel = 'Waiting for current flow';
  let detail = 'Enter current pump flow to compare against the target DO₂i.';
  let gaugeColor = 'from-slate-300 to-slate-200 dark:from-primary-800 dark:to-primary-700';
  let gaugeWidth = '0%';
  let ciComment = results.currentCI ? `Current CI ${results.currentCI.toFixed(2)} L/min/m².` : '';

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
        ? `Needs approximately +${deltaFlow.toFixed(2)} L/min to reach the target.`
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
    const guidelineLine = '<p>Guideline DO₂i (37°C): 280–300 mL/min/m²</p>';
    const userAdjustedLine = `<p>Selected DO₂i target range: ${results.recommendedMin}–${results.recommendedMax} mL/min/m²</p>`;
    const flowLine = results.currentDO2i
      ? `<p class="text-[11px] text-slate-200/80">Current DO₂i: ${Math.round(results.currentDO2i)} mL/min/m²</p>`
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
    DuBois: 'Du Bois formula',
    Haycock: 'Haycock formula',
    GehanGeorge: 'Gehan–George formula',
    Boyd: 'Boyd formula'
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
  const copyBtn = el('contact-copy');
  const toast = el('contact-toast');
  const emailText = el('contact-email');

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
// Bundled quick-reference data (inlined to keep single runtime script)
// -----------------------------
/**
 * @typedef {Object} QuickReferenceReference
 * @property {string} label
 * @property {string=} url
 */

/**
 * @typedef {Object} QuickReferenceCard
 * @property {string} id
 * @property {string} title
 * @property {string} value
 * @property {string} unit
 * @property {string=} notes
 * @property {string=} info
 * @property {string=} copyText
 * @property {{label: string, url?: string}[]=} references
 * @property {string=} lastReviewed
 * @property {{min: number, max: number}=} range
 */

/**
 * @typedef {Object} QuickReferenceTab
 * @property {string} id
 * @property {string} label
 * @property {QuickReferenceCard[]} cards
 * @property {{adult?: QuickReferenceCard[], pediatric?: QuickReferenceCard[]}=} profiles
 * @property {{durations: number[], defaultDuration: number, endpointText: string}=} calculator
 * @property {{title: string, subtitle: string, guidance: string}=} intro
 * @property {{label: string, value: string, unit?: string}=} tableColumns
 * @property {{label: string, rangeLabel: string, unitLabel: string, range: {min: number, max: number}}=} miniCalculator
 * @property {{id: string, label: string, pediatric: string, adult: string, notes?: string, highlight?: string}[]=} tableRows
 * @property {string=} checklist
 */

/** @type {{tabs: QuickReferenceTab[]}} */
window.quickReferenceData = {
  tabs: [
    {
      id: 'acp',
      label: 'ACP',
      profiles: {
        adult: [
          {
            id: 'acp-adult-flow',
            title: 'Flow rate',
            value: '8–12',
            unit: 'mL/kg/min',
            info: 'High-flow may increase cerebral edema risk; titrate with monitoring.',
            lastReviewed: '2024-11-15',
            range: { min: 8, max: 12 }
          },
          {
            id: 'acp-adult-pressure',
            title: 'Perfusion pressure',
            value: '40–60',
            unit: 'mmHg',
            info: 'Right radial artery pressure reference.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-temp',
            title: 'Perfusate temp',
            value: '23–28',
            unit: '°C',
            notes: 'Moderate hypothermia',
            info: 'Moderate hypothermia is often favored over deep for neurologic outcomes.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-ph',
            title: 'pH management',
            value: 'Alpha-stat',
            unit: '',
            info: 'Preserves cerebral autoregulation; reduces embolization risk.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-duration',
            title: 'Duration',
            value: 'Up to 80',
            unit: 'min (reference)',
            notes: 'Varies by center/monitoring/bilateral ACP',
            info: 'Reported durations vary; if >40–50 min, consider bilateral ACP.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-monitoring',
            title: 'Monitoring',
            value: 'NIRS (rSO₂), EEG',
            unit: '',
            info: 'Confirm left-right balance with bilateral NIRS.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-adult-hct',
            title: 'Hct',
            value: '25–30',
            unit: '%',
            lastReviewed: '2024-11-15'
          }
        ],
        pediatric: [
          {
            id: 'acp-peds-flow',
            title: 'Flow rate',
            value: '40–80',
            unit: 'mL/kg/min',
            notes: 'Reference 50–64',
            info: 'Neonates: ~46 ± 6 mL/kg/min; <30 mL/kg/min risks hypoxic injury.',
            lastReviewed: '2024-11-15',
            range: { min: 40, max: 80 }
          },
          {
            id: 'acp-peds-pressure',
            title: 'Perfusion pressure',
            value: 'Titrate',
            unit: '',
            notes: 'Often 20–25 mmHg reported',
            info: 'Higher MAP targets are used in some centers; adjust per protocol/monitoring site.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-temp',
            title: 'Perfusate temp',
            value: '18–25',
            unit: '°C',
            info: '25°C moderate hypothermia preserves rSO₂; moderate often favored vs deep.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-ph',
            title: 'pH management',
            value: 'pH-stat',
            unit: '',
            info: 'Often preferred in neonates/infants for cerebral protection.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-duration',
            title: 'Duration',
            value: '20–48',
            unit: 'min (reference)',
            info: 'Up to ~123 min reported; >45 min DHCA avoidance is common.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-monitoring',
            title: 'Monitoring',
            value: 'NIRS, EEG',
            unit: '',
            notes: 'TCD optional',
            info: 'Use baseline/trend changes and bilateral symmetry rather than absolute values.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'acp-peds-hct',
            title: 'Hct',
            value: '30–35',
            unit: '%',
            info: 'Neonatal/infant arch ACP + hypothermia commonly uses Hct 30–35% (adjust per protocol/NIRS/EEG).',
            lastReviewed: '2024-11-15'
          }
        ]
      }
    },
    {
      id: 'rcp',
      label: 'RCP',
      cards: [
        {
          id: 'rcp-svc-pressure',
          title: 'SVC pressure',
          value: '20–30',
          unit: 'mmHg',
          notes: 'Target 20–25',
          info: 'Excess pressure increases brain edema risk.',
          lastReviewed: '2024-11-15'
        },
          {
            id: 'rcp-flow',
            title: 'Flow rate',
            value: '300–500',
            unit: 'mL/min',
            notes: 'Pressure-driven (SVC <25)',
            info: 'Flow is titrated to pressure; 300–500 mL/min is commonly cited.',
            lastReviewed: '2024-11-15'
          },
          {
            id: 'rcp-monitoring',
            title: 'Monitoring',
            value: 'NIRS, EEG',
            unit: '',
            notes: 'TCD optional',
            info: 'Use baseline/trend changes and bilateral symmetry rather than absolute values.',
            lastReviewed: '2024-11-15'
          }
      ]
    },
    {
      id: 'tca',
      label: 'HCA',
      headerTitle: 'HCA by Temperature (Conservative Estimates)',
      tableRows: [
        {
          id: 'hca-28-30',
          temperature: '28–30<br>(Mild–Moderate)',
          duration: '10–15 (conservative)',
          notes: '<strong>MHCA + ACP</strong> ≤40 min possible; shorter CPB time, less coagulopathy',
          severity: 'safe',
          tooltip: 'Mild-moderate hypothermia with ACP can extend safe duration.'
        },
        {
          id: 'hca-24-28',
          temperature: '24–28 (Moderate)',
          duration: '15–20 (conservative)',
          notes: '<strong>ACP/RCP required</strong>; recent trend with lower stroke risk',
          severity: 'caution',
          tooltip: 'Moderate hypothermia commonly paired with ACP/RCP.'
        },
        {
          id: 'hca-20-24',
          temperature: '20–24<br>(Low–Moderate)',
          duration: '20–30',
          notes: '<strong>ACP</strong> shows non-inferior cognitive outcomes vs DHCA',
          severity: 'caution',
          tooltip: 'Low-moderate ranges benefit from ACP support.'
        },
        {
          id: 'hca-18-20',
          temperature: '18–20 (Deep)',
          duration: '~30 (conservative; up to 40 with caution)',
          notes: 'Isolated DHCA: limit 30; >40 ↑ neurologic injury risk',
          severity: 'high',
          tooltip: 'Deep hypothermia has higher risk beyond 30–40 minutes.'
        },
        {
          id: 'hca-<18',
          temperature: '<18 (Profound)',
          duration: '30–45',
          notes: 'High coagulopathy risk; rarely used',
          severity: 'high',
          tooltip: 'Profound hypothermia is uncommon due to bleeding risk.'
        }
      ]
    },
    {
      id: 'muf',
      label: 'MUF',
      intro: {
        title: 'MUF (Modified Ultrafiltration)',
        subtitle: 'Post-CPB hemoconcentration & fluid removal',
        guidance: '(Pediatric strongly recommended / Adult selective)'
      },
      tableColumns: {
        label: 'Parameter',
        pediatric: 'Pediatric (Strongly Recommended)',
        adult: 'Adult (Selective Use)',
        notes: 'Notes'
      },
      miniCalculator: {
        label: 'Pediatric MUF flow range',
        rangeLabel: 'Flow range',
        unitLabel: 'mL/min',
        range: { min: 10, max: 20 }
      },
      tableRows: [
        {
          id: 'muf-flow-rate',
          label: 'Flow Rate',
          pediatric: '10–20 mL/kg/min',
          adult: '150–300 mL/min',
          notes: 'Start slow, titrate to hemodynamics',
          highlight: 'pediatric'
        },
        {
          id: 'muf-duration',
          label: 'Duration',
          pediatric: '10–20 min or until goal',
          adult: '10–15 min',
          notes: 'Until target Hct or volume removed',
          highlight: 'pediatric'
        },
        {
          id: 'muf-target-hct',
          label: 'Target Hct',
          pediatric: '≥35–40%',
          adult: '≥30–35%',
          notes: 'Or minimize transfusion/bleeding',
          highlight: 'pediatric'
        },
        {
          id: 'muf-circuit',
          label: 'Circuit',
          pediatric: 'A-V MUF (preferred)',
          adult: 'A-V or similar',
          notes: 'Heat exchanger required',
          highlight: 'pediatric'
        },
        {
          id: 'muf-pressure',
          label: 'Pressure',
          pediatric: 'Arterial line always positive',
          adult: 'Arterial line always positive',
          notes: 'Negative pressure → air embolism risk!',
          highlight: 'pediatric'
        }
      ],
      checklist: 'Pre-MUF checklist: Unslave pump, warm exchanger, confirm air-free circuit, maintain positive arterial pressure.',
      cards: []
    }
  ]
};


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
    infoButton.className = 'quick-ref-info-button w-6 h-6 rounded-full border border-slate-200 dark:border-primary-700 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-accent-600 hover:border-accent-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-primary-900';
    infoButton.textContent = 'ⓘ';
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

function renderMufTab(panel, tab) {
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'flex flex-wrap items-center justify-between gap-3';

  const titleBlock = document.createElement('div');
  titleBlock.className = 'space-y-1';
  const title = document.createElement('p');
  title.className = 'text-sm font-semibold text-primary-900 dark:text-white';
  title.textContent = tab.intro?.title || 'MUF (Modified Ultrafiltration)';

  const subtitle = document.createElement('p');
  subtitle.className = 'text-xs text-slate-500 dark:text-slate-400';
  subtitle.textContent = tab.intro?.subtitle || '';

  const guidance = document.createElement('p');
  guidance.className = 'text-xs text-slate-500 dark:text-slate-400';
  guidance.textContent = tab.intro?.guidance || '';

  titleBlock.appendChild(title);
  if (subtitle.textContent) titleBlock.appendChild(subtitle);
  if (guidance.textContent) titleBlock.appendChild(guidance);

  header.appendChild(titleBlock);

  if (tab.checklist) {
    const infoWrap = document.createElement('div');
    infoWrap.className = 'relative';
    const infoButton = document.createElement('button');
    infoButton.type = 'button';
    infoButton.className = 'quick-ref-info-button w-7 h-7 rounded-full border border-slate-200 dark:border-primary-700 text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-accent-600 hover:border-accent-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-primary-900';
    infoButton.textContent = 'ⓘ';
    infoButton.setAttribute('aria-label', 'Pre-MUF checklist');

    const infoPanel = document.createElement('div');
    infoPanel.className = 'hidden absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900 shadow-lg p-3 text-xs text-slate-600 dark:text-slate-300';
    infoPanel.textContent = tab.checklist;
    infoPanel.classList.add('quick-ref-info-panel');

    infoButton.addEventListener('click', () => {
      const isHidden = infoPanel.classList.contains('hidden');
      document.querySelectorAll('.quick-ref-info-panel').forEach(panelEl => {
        panelEl.classList.add('hidden');
      });
      if (isHidden) {
        infoPanel.classList.remove('hidden');
      }
    });

    infoWrap.appendChild(infoButton);
    infoWrap.appendChild(infoPanel);
    header.appendChild(infoWrap);
  }

  panel.appendChild(header);

  if (tab.miniCalculator && tab.miniCalculator.range) {
    const miniCalc = document.createElement('div');
    miniCalc.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-slate-50 dark:bg-primary-900/60 p-4';
    miniCalc.innerHTML = `
      <div class="grid gap-3 md:grid-cols-[1fr_2fr] items-end">
        <div class="space-y-1">
          <label for="muf-mini-weight" class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Weight (kg)</label>
          <input id="muf-mini-weight" type="number" min="0" step="0.1" placeholder="Enter weight" class="w-full rounded-xl border border-slate-200 dark:border-primary-700 bg-white dark:bg-primary-800 px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none dark:text-white" />
        </div>
        <div class="space-y-1">
          <div class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">${tab.miniCalculator.label || 'Pediatric MUF flow range'}</div>
          <div id="muf-mini-flow" class="text-lg font-semibold text-primary-900 dark:text-white">—</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">${tab.miniCalculator.rangeLabel || 'Flow range'} (${tab.miniCalculator.unitLabel || 'mL/min'})</div>
        </div>
      </div>
    `;

    const miniWeightInput = miniCalc.querySelector('#muf-mini-weight');
    const miniFlowOutput = miniCalc.querySelector('#muf-mini-flow');

    const updateMiniFlow = () => {
      const weight = parseFloat(miniWeightInput.value);
      if (!(weight > 0)) {
        miniFlowOutput.textContent = '—';
        return;
      }
      // Pediatric MUF flow range: (mL/kg/min) × kg = mL/min.
      const minFlow = tab.miniCalculator.range.min * weight;
      const maxFlow = tab.miniCalculator.range.max * weight;
      miniFlowOutput.textContent = `${Math.round(minFlow)}–${Math.round(maxFlow)} ${tab.miniCalculator.unitLabel || 'mL/min'}`;
    };

    miniWeightInput.addEventListener('input', updateMiniFlow);
    updateMiniFlow();

    panel.appendChild(miniCalc);
  }

  const tableWrap = document.createElement('div');
  tableWrap.className = 'overflow-x-auto';

  const table = document.createElement('table');
  table.className = 'min-w-[720px] w-full text-xs border border-slate-200 dark:border-primary-800 rounded-xl overflow-hidden';

  const columnLabels = tab.tableColumns || {};
  table.innerHTML = `
    <thead class="bg-slate-50 dark:bg-primary-900/70 text-slate-600 dark:text-slate-300">
      <tr>
        <th class="text-left px-3 py-2">${columnLabels.label || 'Parameter'}</th>
        <th class="text-left px-3 py-2">${columnLabels.pediatric || 'Pediatric'}</th>
        <th class="text-left px-3 py-2">${columnLabels.adult || 'Adult'}</th>
        <th class="text-left px-3 py-2">${columnLabels.notes || 'Notes'}</th>
      </tr>
    </thead>
  `;

  const tbody = document.createElement('tbody');
  (tab.tableRows || []).forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-100 dark:border-primary-800 hover:bg-slate-50/70 dark:hover:bg-primary-900/60';
    tr.innerHTML = `
      <td class="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">${row.label}</td>
      <td class="px-3 py-2 text-slate-700 dark:text-slate-200">${row.pediatric}</td>
      <td class="px-3 py-2 text-slate-700 dark:text-slate-200">${row.adult}</td>
      <td class="px-3 py-2 text-slate-600 dark:text-slate-300">${row.notes || ''}</td>
    `;
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  panel.appendChild(tableWrap);

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
  header.textContent = tab.headerTitle || 'HCA by Temperature';
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

  return;
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

    if (tab.id === 'muf') {
      renderMufTab(panel, tab);
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
    if (event.target.closest('.quick-ref-info-button')) return;
    document.querySelectorAll('.quick-ref-info-panel').forEach(panel => {
      panel.classList.add('hidden');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.quick-ref-info-panel').forEach(panel => {
      panel.classList.add('hidden');
    });
  });

  if (lastReviewedEl) lastReviewedEl.textContent = getLatestReviewedDate(tabs);

  quickReferenceInitialized = true;
}



// -----------------------------
// Bundled PHN coefficients + calculator (inlined to keep single runtime script)
// -----------------------------
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


// -----------------------------
// PHN Pediatric Echo Z-score Calculator
// -----------------------------
let phnCalculatedBsa = null;

function setPhnError(message) {
  const box = el('phn-error');
  if (!box) return;
  if (!message) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.textContent = message;
  box.classList.remove('hidden');
}

function formatPhnNumericText(text) {
  if (!text) return '';
  return String(text).replace(/(\d+(?:\.\d+)?(?:[–-]\d+(?:\.\d+)?)?)/g, '<span class="result-number">$1</span>');
}

function renderPhnWarnings(warnings) {
  const wrap = el('phn-warnings');
  if (!wrap) return;
  wrap.innerHTML = '';
  (warnings || []).forEach((text) => {
    const item = document.createElement('div');
    item.className = 'rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200';
    item.innerHTML = formatPhnNumericText(text);
    wrap.appendChild(item);
  });
}

function renderPhnRows(rows) {
  const resultsEl = el('phn-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = '';

  rows.forEach((row) => {
    const zNeg2DisplayMm = window.PhnCalculator.clampToDisplayMm(row.range.zNeg2Mm);
    const line = document.createElement('div');
    line.className = 'grid grid-cols-4 gap-2 px-3 py-2 text-sm items-center';
    const zNeg2DisplayText = window.PhnCalculator.formatMm(zNeg2DisplayMm).replace(/\s*mm$/i, '');
    const z0DisplayText = window.PhnCalculator.formatMm(row.range.z0Mm).replace(/\s*mm$/i, '');
    const zPos2DisplayText = window.PhnCalculator.formatMm(row.range.zPos2Mm).replace(/\s*mm$/i, '');

    line.innerHTML = `
      <div class="text-primary-900 dark:text-white font-medium text-xs leading-tight">${row.coeff.label}</div>
      <div class="flex items-baseline justify-center gap-1 text-primary-900 dark:text-slate-100">
        <span class="result-number">${zNeg2DisplayText}</span>
        <span class="result-unit text-sm">mm</span>
      </div>
      <div class="flex items-baseline justify-center gap-1 font-semibold text-emerald-600 dark:text-emerald-300">
        <span class="result-number">${z0DisplayText}</span>
        <span class="result-unit text-sm">mm</span>
      </div>
      <div class="flex items-baseline justify-center gap-1 text-primary-900 dark:text-slate-100">
        <span class="result-number">${zPos2DisplayText}</span>
        <span class="result-unit text-sm">mm</span>
      </div>
    `;
    resultsEl.appendChild(line);
  });
}

function updatePhnDebugPanel(bsaValue, rows) {
  const panel = el('phn-debug-panel');
  const output = el('phn-debug-output');
  if (!panel || !output) return;

  const isDevMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  panel.classList.toggle('hidden', !isDevMode);
  if (!isDevMode) return;

  const lines = rows.map((row) => {
    const regression = window.PhnCalculator.calculateRegressionReferenceCm(
      bsaValue,
      window.PhnCalculator.PHN_REGRESSION[row.key]
    );
    return `${row.coeff.label}
  BSA^alpha: ${row.range.bsaPowAlpha.toFixed(6)}
  inverse z0 (cm): ${row.range.z0Cm.toFixed(6)}
  regression ref (cm): ${regression.toFixed(6)}
`;
  });

  output.textContent = lines.join('\n');
}

function updatePhnMeasuredStructureOptions() {
  const select = el('phn-measured-structure');
  if (!select || select.options.length > 0) return;
  window.PhnCalculator.PHN_STRUCTURE_ORDER.forEach((key) => {
    const coeff = window.PhnCalculator.PHN_STRUCTURES[key];
    const option = document.createElement('option');
    option.value = key;
    option.textContent = coeff.label;
    select.appendChild(option);
  });
}

function clearPhnOutputs() {
  const resultsEl = el('phn-results');
  if (resultsEl) resultsEl.innerHTML = '';
  const displayEl = el('phn-bsa-display');
  if (displayEl) displayEl.textContent = '—';
  renderPhnWarnings([]);
}

function updatePhnEchoPredictor() {
  const bsaInput = el('phn-bsa-input');
  if (!bsaInput || !window.PhnCalculator) return;

  if (!bsaInput.value || bsaInput.value.trim() === '') {
    setPhnError('');
    clearPhnOutputs();
    return;
  }

  const bsaValue = Number(bsaInput.value);
  if (!Number.isFinite(bsaValue) || bsaValue <= 0) {
    setPhnError('BSA must be a positive number.');
    clearPhnOutputs();
    return;
  }

  setPhnError('');
  el('phn-bsa-display').innerHTML = `<span class="result-number">${bsaValue.toFixed(2)}</span>`;

  const rows = window.PhnCalculator.createRowsForBsa(bsaValue);
  renderPhnRows(rows);
  renderPhnWarnings(window.PhnCalculator.getBsaWarnings(bsaValue));
  updatePhnDebugPanel(bsaValue, rows);
}

function calculatePhnBsaFromInputs() {
  const heightValue = Number(el('phn-height-cm') ? el('phn-height-cm').value : NaN);
  const weightValue = Number(el('phn-weight-kg') ? el('phn-weight-kg').value : NaN);
  const methodSelect = el('phn-bsa-method');
  const selectedMethod = methodSelect ? methodSelect.value : 'Haycock';
  const display = el('phn-calculated-bsa');

  if (!(heightValue > 0) || !(weightValue > 0)) {
    phnCalculatedBsa = null;
    if (display) display.innerHTML = 'Calculated BSA: <span class="result-number">—</span>';
    return;
  }

  // Uses existing shared BSA formulas in this app (Mosteller, DuBois, Haycock, Boyd).
  const result = computeBSA(heightValue, weightValue, selectedMethod);

  if (!(result > 0) || !Number.isFinite(result)) {
    phnCalculatedBsa = null;
    if (display) display.innerHTML = 'Calculated BSA: <span class="result-number">—</span>';
    setPhnError('Unable to calculate BSA with selected formula.');
    return;
  }

  phnCalculatedBsa = result;
  if (display) display.innerHTML = `Calculated BSA: <span class="result-number">${result.toFixed(4)}</span> m² (${selectedMethod})`;
  setPhnError('');
}

function usePhnCalculatedBsa() {
  const bsaInput = el('phn-bsa-input');
  if (!bsaInput) return;
  if (!Number.isFinite(phnCalculatedBsa) || phnCalculatedBsa <= 0) {
    setPhnError('Calculate BSA first, then apply it.');
    return;
  }

  bsaInput.value = phnCalculatedBsa.toFixed(4);
  updatePhnEchoPredictor();
}

function calculatePhnMeasuredZ() {
  const output = el('phn-measured-z');
  const structureSelect = el('phn-measured-structure');
  const measuredMm = Number(el('phn-measured-mm') ? el('phn-measured-mm').value : NaN);
  const bsaValue = Number(el('phn-bsa-input') ? el('phn-bsa-input').value : NaN);

  if (!output || !structureSelect) return;

  try {
    const key = structureSelect.value;
    const coeff = window.PhnCalculator.PHN_STRUCTURES[key];
    const measuredCm = measuredMm / 10;
    const zScore = window.PhnCalculator.calculateForwardZScore(measuredCm, bsaValue, coeff);
    output.innerHTML = `Measured Z-score: <span class="result-number">${zScore.toFixed(2)}</span>`;
    setPhnError('');
  } catch (error) {
    output.innerHTML = 'Measured Z-score: <span class="result-number">—</span>';
    setPhnError(error.message || 'Unable to compute measured Z-score.');
  }
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

function navigateTo(path, options = {}) {
  const target = window.normalizeRoute ? window.normalizeRoute(path) : (path || '/');
  const current = getActivePath();
  const { resetScrollTop = false } = options;

  if (current !== target) {
    history.pushState({}, '', target);
  }
  route();

  if (resetScrollTop) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}


function route() {
  const path = getActivePath();
  const sections = ['view-home', 'view-bsa', 'view-phn-echo', 'view-do2i', 'view-hct', 'view-lbm', 'view-priming-volume', 'view-heparin', 'view-timecalc', 'view-unit-converter', 'view-quick-reference', 'view-info', 'view-privacy', 'view-terms', 'view-contact'];
  sections.forEach(sid => {
    const section = el(sid);
    if (section) section.classList.add('hidden');
  });

  let key = 'home';
  const showSection = (id) => {
    const section = el(id);
    if (section) section.classList.remove('hidden');
  };

  if (path.includes('phn-echo')) { showSection('view-phn-echo'); key = 'phn-echo'; }
  else if (path.includes('bsa')) { showSection('view-bsa'); key = 'bsa'; }
  else if (path.includes('do2i') || path.includes('gdp')) { showSection('view-do2i'); key = 'do2i'; }
  else if (path.includes('predicted-hct')) { showSection('view-hct'); key = 'predicted-hct'; }
  else if (path.includes('lbm')) { showSection('view-lbm'); key = 'lbm'; }
  else if (path.includes('priming-volume')) { showSection('view-priming-volume'); key = 'priming-volume'; }
  else if (path.includes('heparin')) { showSection('view-heparin'); key = 'heparin'; }
  else if (path.includes('timecalc')) { showSection('view-timecalc'); key = 'timecalc'; }
  else if (path.includes('unit-converter')) { showSection('view-unit-converter'); key = 'unit-converter'; }
  else if (path.includes('quick-reference')) { showSection('view-quick-reference'); key = 'quick-reference'; }
  else if (path.includes('info')) { showSection('view-info'); key = 'info'; }
  else if (path.includes('privacy')) { showSection('view-privacy'); key = 'privacy'; }
  else if (path.includes('terms')) { showSection('view-terms'); key = 'terms'; }
  else if (path.includes('contact')) { showSection('view-contact'); key = 'contact'; }
  else { showSection('view-home'); key = 'home'; }

  const navMap = {
    'home': ['nav-home', 'side-home', 'mob-home'],
    'do2i': ['nav-do2i', 'side-do2i', 'mob-do2i'],
    'predicted-hct': ['nav-hct', 'side-hct', 'mob-hct'],
    'bsa': ['nav-bsa', 'side-bsa', 'mob-bsa'],
    'phn-echo': ['nav-phn-echo', 'side-phn-echo', 'mob-phn-echo'],
    'lbm': ['nav-lbm', 'side-lbm', 'mob-lbm'],
    'heparin': ['nav-heparin', 'side-heparin', 'mob-heparin'],
    'priming-volume': ['nav-priming', 'side-priming', 'mob-priming'],
    'timecalc': ['nav-time', 'side-time', 'mob-time'],
    'unit-converter': ['nav-unit-converter', 'side-unit-converter', 'mob-unit-converter'],
    'quick-reference': ['nav-quick-reference', 'side-quick-reference', 'mob-quick-reference'],
    'info': ['nav-info', 'side-info', 'mob-info']
  };

  const isStandalonePage = !document.getElementById('view-home');
  if (isStandalonePage) return;

  document.querySelectorAll('.nav-link, .sidebar-link').forEach(l => {
    l.classList.remove('bg-primary-800', 'text-accent-400', 'bg-slate-100', 'text-primary-900', 'text-accent-600', 'border', 'border-slate-200', 'border-primary-900', 'dark:border-primary-700', 'bg-primary-700', 'dark:bg-primary-800', 'dark:text-accent-400');
  });
  document.querySelectorAll('[id^="mob-"]').forEach(l => {
    l.classList.remove('text-accent-600', 'dark:text-accent-400');
    l.classList.add('text-slate-400', 'dark:text-slate-500');
  });

  if (document.getElementById('view-home')) {
    updateMetaForRoute(path || '/');
  }

  let sideEl = null;
  if (key && navMap[key]) {
    const navEl = el(navMap[key][0]);
    if (navEl) navEl.classList.add('bg-slate-100', 'text-primary-900', 'border', 'border-slate-200', 'dark:bg-primary-800', 'dark:text-accent-400', 'dark:border-primary-700');

    sideEl = el(navMap[key][1]);
    if (sideEl) sideEl.classList.add('bg-slate-100', 'text-accent-600', 'dark:bg-primary-800', 'dark:text-accent-400');

    const mobEl = el(navMap[key][2]);
    if (mobEl) {
      mobEl.classList.remove('text-slate-400', 'dark:text-slate-500');
      mobEl.classList.add('text-accent-600', 'dark:text-accent-400');
    }
  }

  const topResetRoutes = new Set(['timecalc', 'unit-converter', 'quick-reference', 'info']);
  if (topResetRoutes.has(key)) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
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
function resetScrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  setTimeout(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, 20);
}

if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

window.addEventListener('load', resetScrollToTop);
window.addEventListener('pageshow', resetScrollToTop);
window.addEventListener('popstate', () => {
  route();
  resetScrollToTop();
});
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.style.scrollPaddingTop = '0px';
  resetScrollToTop();
  setTimeout(resetScrollToTop, 10);
  initStandaloneTopNav();
  const primaryTopNav = el('nav-home') ? el('nav-home').closest('nav') : null;
  if (primaryTopNav) {
    primaryTopNav.classList.add('overflow-x-auto', 'whitespace-nowrap', 'max-w-[68%]', 'pr-1');
    attachTopNavOverflowArrow(primaryTopNav, 'top-nav-main-next');
  }

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (link.classList.contains('sidebar-link') || href.startsWith('/')) {
      setTimeout(resetScrollToTop, 50);
    }
  });

  const hasElement = (id) => !!el(id);
  const hasGdpCalculator = hasElement('view-do2i');
  const hasStandaloneBsaCalculator = hasElement('view-bsa');
  const hasPhnEchoCalculator = hasElement('view-phn-echo');
  const hasHctCalculator = hasElement('view-hct');
  const hasLbmCalculator = hasElement('view-lbm');
  const hasPrimingCalculator = hasElement('view-priming-volume');
  const hasUnitConverter = hasElement('view-unit-converter');
  const hasHeparinCalculator = hasElement('view-heparin');
  const hasTimeCalculator = hasElement('view-timecalc');

  document.querySelectorAll('a[data-route]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href.startsWith('/')) {
                const standaloneRoutes = new Set([
          '/bsa/',
          '/gdp/',
          '/heparin/',
          '/predicted-hct/',
          '/lbm/',
          '/timecalc/',
          '/phn-echo/',
          '/quick-reference/',
          '/priming-volume/',
          '/unit-converter/',
          '/bsa',
          '/gdp',
          '/heparin',
          '/predicted-hct',
          '/lbm',
          '/timecalc',
          '/phn-echo',
          '/quick-reference',
          '/priming-volume',
          '/unit-converter'
        ]);
        if (standaloneRoutes.has(href)) {
          return;
        }
        e.preventDefault();
        const shouldResetScrollTop = link.classList.contains('nav-link');
        navigateTo(href, { resetScrollTop: shouldResetScrollTop });
      }
    });
  });

  const now = new Date();
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = now.getFullYear();

  route();

  if (hasGdpCalculator) {
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
  }

  if (hasStandaloneBsaCalculator) {
    // Standalone BSA event listeners
    ['bsa_height', 'bsa_weight'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('input', updateStandaloneBsa);
    });
    const bsaMethodStandalone = el('bsa-method-standalone');
    if (bsaMethodStandalone) bsaMethodStandalone.addEventListener('change', updateStandaloneBsa);

    const metricBtn = el('bsa-unit-metric');
    if (metricBtn) metricBtn.addEventListener('click', () => setBsaUnit(BSA_UNIT.metric));
    const imperialBtn = el('bsa-unit-imperial');
    if (imperialBtn) imperialBtn.addEventListener('click', () => setBsaUnit(BSA_UNIT.imperial));
    const maleBtn = el('bsa-sex-male');
    if (maleBtn) maleBtn.addEventListener('click', () => { bsaPatientSex = 'male'; updateBsaSexUi(); updateStandaloneBsa(); });
    const femaleBtn = el('bsa-sex-female');
    if (femaleBtn) femaleBtn.addEventListener('click', () => { bsaPatientSex = 'female'; updateBsaSexUi(); updateStandaloneBsa(); });
    const leanQuick = el('bsa-lean-ci-quick');
    if (leanQuick) {
      leanQuick.querySelectorAll('button[data-ci]').forEach((btn) => {
        btn.addEventListener('click', () => {
          bsaLeanSelectedCi = Number(btn.dataset.ci) || 2.4;
          updateStandaloneBsa();
        });
      });
    }
    const openHeparinBtn = el('bsa-open-heparin');
    if (openHeparinBtn) openHeparinBtn.addEventListener('click', openHeparinFromBsa);

    updateBsaUnitUi();
    updateBsaSexUi();
    updateStandaloneBsa();
  }

  if (hasPhnEchoCalculator) {
    // PHN pediatric echo predictor listeners
    updatePhnMeasuredStructureOptions();
    const phnBsaInput = el('phn-bsa-input');
    if (phnBsaInput) phnBsaInput.addEventListener('input', updatePhnEchoPredictor);

    const phnCalcBsaBtn = el('phn-calc-bsa-btn');
    if (phnCalcBsaBtn) phnCalcBsaBtn.addEventListener('click', calculatePhnBsaFromInputs);

    const phnUseBsaBtn = el('phn-use-bsa-btn');
    if (phnUseBsaBtn) phnUseBsaBtn.addEventListener('click', usePhnCalculatedBsa);

    ['phn-height-cm', 'phn-weight-kg'].forEach((id) => {
      const node = el(id);
      if (node) node.addEventListener('input', calculatePhnBsaFromInputs);
    });

    const phnBsaMethod = el('phn-bsa-method');
    if (phnBsaMethod) phnBsaMethod.addEventListener('change', calculatePhnBsaFromInputs);

    const phnMeasuredButton = el('phn-measured-calc-btn');
    if (phnMeasuredButton) phnMeasuredButton.addEventListener('click', calculatePhnMeasuredZ);

    updatePhnEchoPredictor();
  }

  if (hasHctCalculator) {
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
  }

  if (hasLbmCalculator) {
    // LBM event listeners
    ['lbm_h_cm', 'lbm_w_kg', 'lbm_sex', 'lbm_formula', 'lbm_bsa_formula'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('input', updateLBM);
    });
    ['lbm_sex', 'lbm_formula', 'lbm_bsa_formula'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('change', updateLBM);
    });
  }

  if (hasPrimingCalculator) {
    ['priming-id', 'priming-length', 'priming-length-unit'].forEach(id => {
      const x = el(id);
      if (x) {
        x.addEventListener('input', updatePrimingVolume);
        x.addEventListener('change', updatePrimingVolume);
      }
    });
  }

  if (hasUnitConverter) {
    ['unit-flow-lmin', 'unit-flow-weight'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('input', updateUnitConverterFlow);
    });

    ['unit-pressure-value', 'unit-pressure-from'].forEach(id => {
      const x = el(id);
      if (!x) return;
      const eventName = id === 'unit-pressure-from' ? 'change' : 'input';
      x.addEventListener(eventName, updateUnitConverterPressure);
    });

    document.querySelectorAll('[data-unit-tab]').forEach(button => {
      button.addEventListener('click', () => {
        setUnitConverterTab(button.dataset.unitTab || 'flow');
      });
    });
  }

  setupContactActions();

  if (hasTimeCalculator) {
    initTimeCalculator();
  }
  if (hasHeparinCalculator) {
    preloadHeparinFromBsa();
    initHeparinManagement();
  }

  if (hasGdpCalculator) {
    updateTargetDisplay();
    updateGDP();
  }
  if (hasHctCalculator) updateHct();
  if (hasLbmCalculator) updateLBM();
  if (hasPrimingCalculator) updatePrimingVolume();
  if (hasUnitConverter) {
    initUnitConverterLabels();
    updateUnitConverterFlow();
    updateUnitConverterPressure();
    setUnitConverterTab('flow');
  }
});
