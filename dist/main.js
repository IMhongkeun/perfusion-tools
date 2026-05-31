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
  { path: '/z-score/', label: 'Z-score' },
  { path: '/priming-volume/', label: 'Priming Volume' },
  { path: '/timecalc/', label: 'Time' },
  { path: '/quick-reference/', label: 'Quick Reference' },
  { path: '/unit-converter/', label: 'Unit Converter' },
  { path: '/info/', label: 'Info' },
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
const cannulaPressureDropData = [
  {
    manufacturer: 'Example placeholder — not clinical data',
    model: 'Demo model',
    category: 'arterial',
    size: '18 Fr',
    sourceLabel: 'Example placeholder — not clinical data',
    sourceUrl: '',
    testMedium: 'N/A',
    points: [],
    notes: 'Placeholder structure for future manufacturer-specific curve data.'
  },
  {
    manufacturer: 'LivaNova',
    model: 'RAP Femoral Venous Cannula',
    category: 'femoral venous',
    size: '22 Fr distal / 22 Fr proximal',
    sourceLabel: 'LivaNova MICS & Femoral Cannulae Brochure',
    sourceUrl: 'https://replantmed.hu/images/LN_BROCHURE_MICS_FEMORAL_CANNULAE_09295-178-A2.pdf',
    testMedium: 'Not specified on product page',
    points: [],
    notes: 'Pressure-flow chart source identified in LivaNova MICS & Femoral Cannulae brochure. Curve points have not yet been digitized.'
  },
  {
    manufacturer: 'LivaNova',
    model: 'RAP Femoral Venous Cannula',
    category: 'femoral venous',
    size: '23 Fr distal / 25 Fr proximal',
    sourceLabel: 'LivaNova MICS & Femoral Cannulae Brochure',
    sourceUrl: 'https://replantmed.hu/images/LN_BROCHURE_MICS_FEMORAL_CANNULAE_09295-178-A2.pdf',
    testMedium: 'Not specified on product page',
    points: [],
    notes: 'Pressure-flow chart source identified in LivaNova MICS & Femoral Cannulae brochure. Curve points have not yet been digitized.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Arterial Cannula',
    category: 'femoral arterial',
    size: 'PAS 1315',
    sourceLabel: 'Getinge/Maquet HLS Arterial Cannula pressure-drop chart and product order table',
    sourceUrl: 'Uploaded Getinge/Maquet HLS arterial cannula chart and product order table',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 9 },
      { flow: 1.0, pressureDrop: 24 },
      { flow: 1.5, pressureDrop: 49 },
      { flow: 2.0, pressureDrop: 86 },
      { flow: 2.5, pressureDrop: 140 }
    ],
    notes: 'PAS 1315: 13 Fr (4.3 mm) outer diameter, 15 cm insertion length, 2 side holes, 1 cm perforation length, 3/8" LL connector, BE-PAS 1315 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Arterial Cannula',
    category: 'femoral arterial',
    size: 'PAS 1515',
    sourceLabel: 'Getinge/Maquet HLS Arterial Cannula pressure-drop chart and product order table',
    sourceUrl: 'Uploaded Getinge/Maquet HLS arterial cannula chart and product order table',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 5 },
      { flow: 1.0, pressureDrop: 12 },
      { flow: 1.5, pressureDrop: 27 },
      { flow: 2.0, pressureDrop: 46 },
      { flow: 2.5, pressureDrop: 73 },
      { flow: 3.0, pressureDrop: 114 },
      { flow: 3.5, pressureDrop: 156 }
    ],
    notes: 'PAS 1515: 15 Fr (5.0 mm) outer diameter, 15 cm insertion length, 2 side holes, 1 cm perforation length, 3/8" LL connector, BE-PAS 1515 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Arterial Cannula',
    category: 'femoral arterial',
    size: 'PAS 1715',
    sourceLabel: 'Getinge/Maquet HLS Arterial Cannula pressure-drop chart and product order table',
    sourceUrl: 'Uploaded Getinge/Maquet HLS arterial cannula chart and product order table',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 8 },
      { flow: 1.5, pressureDrop: 15 },
      { flow: 2.0, pressureDrop: 25 },
      { flow: 2.5, pressureDrop: 38 },
      { flow: 3.0, pressureDrop: 55 },
      { flow: 3.5, pressureDrop: 77 },
      { flow: 4.0, pressureDrop: 101 },
      { flow: 4.5, pressureDrop: 129 },
      { flow: 5.0, pressureDrop: 161 },
      { flow: 5.5, pressureDrop: 195 }
    ],
    notes: 'PAS 1715: 17 Fr (5.7 mm) outer diameter, 15 cm insertion length, 2 side holes, 1 cm perforation length, 3/8" LL connector, BE-PAS 1715 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Arterial Cannula',
    category: 'femoral arterial',
    size: 'PAS 1915',
    sourceLabel: 'Getinge/Maquet HLS Arterial Cannula pressure-drop chart and product order table',
    sourceUrl: 'Uploaded Getinge/Maquet HLS arterial cannula chart and product order table',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 15 },
      { flow: 2.5, pressureDrop: 23 },
      { flow: 3.0, pressureDrop: 34 },
      { flow: 3.5, pressureDrop: 46 },
      { flow: 4.0, pressureDrop: 61 },
      { flow: 4.5, pressureDrop: 78 },
      { flow: 5.0, pressureDrop: 97 },
      { flow: 5.5, pressureDrop: 117 },
      { flow: 6.0, pressureDrop: 140 },
      { flow: 6.5, pressureDrop: 165 }
    ],
    notes: 'PAS 1915: 19 Fr (6.3 mm) outer diameter, 15 cm insertion length, 2 side holes, 1 cm perforation length, 3/8" LL connector, BE-PAS 1915 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Arterial Cannula',
    category: 'femoral arterial',
    size: 'PAS 2315',
    sourceLabel: 'Getinge/Maquet HLS Arterial Cannula pressure-drop chart and product order table',
    sourceUrl: 'Uploaded Getinge/Maquet HLS arterial cannula chart and product order table',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 7 },
      { flow: 2.5, pressureDrop: 12 },
      { flow: 3.0, pressureDrop: 16 },
      { flow: 3.5, pressureDrop: 21 },
      { flow: 4.0, pressureDrop: 27 },
      { flow: 4.5, pressureDrop: 34 },
      { flow: 5.0, pressureDrop: 43 },
      { flow: 5.5, pressureDrop: 51 },
      { flow: 6.0, pressureDrop: 60 },
      { flow: 6.5, pressureDrop: 72 },
      { flow: 7.0, pressureDrop: 82 }
    ],
    notes: 'PAS 2315: 23 Fr (7.7 mm) outer diameter, 15 cm insertion length, 2 side holes, 1 cm perforation length, 3/8" LL connector, BE-PAS 2315 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Arterial Cannula',
    category: 'femoral arterial',
    size: 'PAS 2115',
    sourceLabel: 'Getinge/Maquet HLS Arterial Cannula pressure-drop chart and product order table',
    sourceUrl: 'Uploaded Getinge/Maquet HLS arterial cannula chart and product order table',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 7 },
      { flow: 2.0, pressureDrop: 11 },
      { flow: 2.5, pressureDrop: 16 },
      { flow: 3.0, pressureDrop: 22 },
      { flow: 3.5, pressureDrop: 29 },
      { flow: 4.0, pressureDrop: 39 },
      { flow: 4.5, pressureDrop: 50 },
      { flow: 5.0, pressureDrop: 62 },
      { flow: 5.5, pressureDrop: 75 },
      { flow: 6.0, pressureDrop: 89 },
      { flow: 6.5, pressureDrop: 104 },
      { flow: 7.0, pressureDrop: 121 }
    ],
    notes: 'PAS 2115: 21 Fr (7.0 mm) outer diameter, 15 cm insertion length, 2 side holes, 1 cm perforation length, 3/8" LL connector, BE-PAS 2115 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Venous Cannula',
    category: 'femoral venous',
    size: 'PVL 2155',
    sourceLabel: 'Getinge/Maquet HLS venous cannula product order table and PVL 2155 pressure-drop chart',
    sourceUrl: 'Uploaded Getinge/Maquet HLS venous cannula product order table and pressure-drop chart',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 6 },
      { flow: 1.5, pressureDrop: 10 },
      { flow: 2.0, pressureDrop: 17 },
      { flow: 2.5, pressureDrop: 25 },
      { flow: 3.0, pressureDrop: 35 },
      { flow: 3.5, pressureDrop: 47 },
      { flow: 4.0, pressureDrop: 60 },
      { flow: 4.5, pressureDrop: 74 },
      { flow: 5.0, pressureDrop: 90 },
      { flow: 5.5, pressureDrop: 108 },
      { flow: 6.0, pressureDrop: 126 },
      { flow: 6.5, pressureDrop: 146 },
      { flow: 7.0, pressureDrop: 169 }
    ],
    notes: 'PVL 2155: 21 Fr (7.0 mm) outer diameter, 55 cm insertion length, 20 side holes, 20 cm perforation length, 3/8" connector, BE-PVL 2155 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Venous Cannula',
    category: 'femoral venous',
    size: 'PVL 2355',
    sourceLabel: 'Getinge/Maquet HLS venous cannula product order table and PVL 2355 pressure-drop chart',
    sourceUrl: 'Uploaded Getinge/Maquet HLS venous cannula product order table and pressure-drop chart',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 3 },
      { flow: 1.5, pressureDrop: 8 },
      { flow: 2.0, pressureDrop: 12 },
      { flow: 2.5, pressureDrop: 18 },
      { flow: 3.0, pressureDrop: 24 },
      { flow: 3.5, pressureDrop: 32 },
      { flow: 4.0, pressureDrop: 41 },
      { flow: 4.5, pressureDrop: 50 },
      { flow: 5.0, pressureDrop: 60 },
      { flow: 5.5, pressureDrop: 72 },
      { flow: 6.0, pressureDrop: 84 },
      { flow: 6.5, pressureDrop: 90 },
      { flow: 7.0, pressureDrop: 113 }
    ],
    notes: 'PVL 2355: 23 Fr (7.7 mm) outer diameter, 55 cm insertion length, 20 side holes, 20 cm perforation length, 3/8" connector, BE-PVL 2355 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Venous Cannula',
    category: 'femoral venous',
    size: 'PVL 2555',
    sourceLabel: 'Getinge/Maquet HLS venous cannula product order table and PVL 2555 pressure-drop chart',
    sourceUrl: 'Uploaded Getinge/Maquet HLS venous cannula product order table and pressure-drop chart',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 3 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 8 },
      { flow: 2.5, pressureDrop: 12 },
      { flow: 3.0, pressureDrop: 17 },
      { flow: 3.5, pressureDrop: 22 },
      { flow: 4.0, pressureDrop: 28 },
      { flow: 4.5, pressureDrop: 34 },
      { flow: 5.0, pressureDrop: 42 },
      { flow: 5.5, pressureDrop: 50 },
      { flow: 6.0, pressureDrop: 59 },
      { flow: 6.5, pressureDrop: 69 },
      { flow: 7.0, pressureDrop: 79 }
    ],
    notes: 'PVL 2555: 25 Fr (8.3 mm) outer diameter, 55 cm insertion length, 24 side holes, 20 cm perforation length, 3/8" connector, BE-PVL 2555 Bioline coating.'
  },
  {
    manufacturer: 'Getinge / Maquet',
    model: 'HLS Venous Cannula',
    category: 'femoral venous',
    size: 'PVL 2955',
    sourceLabel: 'Getinge/Maquet HLS venous cannula product order table and PVL 2955 pressure-drop chart',
    sourceUrl: 'Uploaded Getinge/Maquet HLS venous cannula product order table and pressure-drop chart',
    testMedium: 'Water at room temperature',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-drop chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 3 },
      { flow: 2.0, pressureDrop: 5 },
      { flow: 2.5, pressureDrop: 8 },
      { flow: 3.0, pressureDrop: 10 },
      { flow: 3.5, pressureDrop: 13 },
      { flow: 4.0, pressureDrop: 16 },
      { flow: 4.5, pressureDrop: 21 },
      { flow: 5.0, pressureDrop: 26 },
      { flow: 5.5, pressureDrop: 31 },
      { flow: 6.0, pressureDrop: 36 },
      { flow: 6.5, pressureDrop: 41 },
      { flow: 7.0, pressureDrop: 47 }
    ],
    notes: 'PVL 2955: 29 Fr (9.7 mm) outer diameter, 55 cm insertion length, 32 side holes, 20 cm perforation length, 3/8" connector, BE-PVL 2955 Bioline coating.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '12 Fr',
    outerDiameterFr: 12,
    outerDiameterMm: 4.0,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '66112',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are preserved to two decimals because this small-size cannula has a narrow, steep pressure-flow range.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.21, pressureDrop: 10 },
      { flow: 0.33, pressureDrop: 20 },
      { flow: 0.49, pressureDrop: 36 },
      { flow: 0.58, pressureDrop: 50 },
      { flow: 0.66, pressureDrop: 61 },
      { flow: 0.72, pressureDrop: 70 },
      { flow: 0.77, pressureDrop: 80 },
      { flow: 0.82, pressureDrop: 90 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 12 Fr (4.0 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 66112.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '14 Fr',
    outerDiameterFr: 14,
    outerDiameterMm: 4.7,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '66114',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are preserved to two decimals because this small-size cannula has a narrow, steep pressure-flow range.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.38, pressureDrop: 11 },
      { flow: 0.48, pressureDrop: 15 },
      { flow: 0.58, pressureDrop: 20 },
      { flow: 0.75, pressureDrop: 31 },
      { flow: 0.87, pressureDrop: 40 },
      { flow: 1.00, pressureDrop: 51 },
      { flow: 1.09, pressureDrop: 61 },
      { flow: 1.20, pressureDrop: 70 },
      { flow: 1.29, pressureDrop: 80 },
      { flow: 1.39, pressureDrop: 91 },
      { flow: 1.46, pressureDrop: 100 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 14 Fr (4.7 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 66114.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '16 Fr',
    outerDiameterFr: 16,
    outerDiameterMm: 5.3,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '66116',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are preserved to two decimals because this small-size cannula has a narrow, steep pressure-flow range.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.49, pressureDrop: 7 },
      { flow: 0.63, pressureDrop: 10 },
      { flow: 1.00, pressureDrop: 22 },
      { flow: 1.19, pressureDrop: 31 },
      { flow: 1.40, pressureDrop: 40 },
      { flow: 1.49, pressureDrop: 45 },
      { flow: 1.58, pressureDrop: 50 },
      { flow: 1.75, pressureDrop: 61 },
      { flow: 1.90, pressureDrop: 70 },
      { flow: 2.00, pressureDrop: 77 },
      { flow: 2.18, pressureDrop: 91 },
      { flow: 2.31, pressureDrop: 100 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 16 Fr (5.3 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 66116.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '18 Fr',
    outerDiameterFr: 18,
    outerDiameterMm: 6.0,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '66118',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 13 },
      { flow: 1.5, pressureDrop: 26 },
      { flow: 2.0, pressureDrop: 44 },
      { flow: 2.5, pressureDrop: 67 },
      { flow: 3.0, pressureDrop: 92 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 18 Fr (6.0 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 66118.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '20 Fr',
    outerDiameterFr: 20,
    outerDiameterMm: 6.7,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '66120',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 8 },
      { flow: 1.5, pressureDrop: 17 },
      { flow: 2.0, pressureDrop: 29 },
      { flow: 2.5, pressureDrop: 43 },
      { flow: 3.0, pressureDrop: 61 },
      { flow: 3.5, pressureDrop: 80 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 20 Fr (6.7 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 66120.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '22 Fr',
    outerDiameterFr: 22,
    outerDiameterMm: 7.3,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '66122',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 11 },
      { flow: 2.0, pressureDrop: 18 },
      { flow: 2.5, pressureDrop: 27 },
      { flow: 3.0, pressureDrop: 38 },
      { flow: 3.5, pressureDrop: 50 },
      { flow: 4.0, pressureDrop: 64 },
      { flow: 4.5, pressureDrop: 80 },
      { flow: 5.0, pressureDrop: 100 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 22 Fr (7.3 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 66122.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '24 Fr',
    outerDiameterFr: 24,
    outerDiameterMm: 8.0,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '66124',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 15 },
      { flow: 2.5, pressureDrop: 22 },
      { flow: 3.0, pressureDrop: 31 },
      { flow: 3.5, pressureDrop: 41 },
      { flow: 4.0, pressureDrop: 52 },
      { flow: 4.5, pressureDrop: 65 },
      { flow: 5.0, pressureDrop: 79 },
      { flow: 5.5, pressureDrop: 95 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 24 Fr (8.0 mm), 12–16 in (30.5–40.6 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 66124.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '26 Fr',
    outerDiameterFr: 26,
    outerDiameterMm: 8.7,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66126',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 3 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 10 },
      { flow: 2.5, pressureDrop: 14 },
      { flow: 3.0, pressureDrop: 20 },
      { flow: 3.5, pressureDrop: 27 },
      { flow: 4.0, pressureDrop: 34 },
      { flow: 4.5, pressureDrop: 42 },
      { flow: 5.0, pressureDrop: 51 },
      { flow: 5.5, pressureDrop: 61 },
      { flow: 6.0, pressureDrop: 72 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 26 Fr (8.7 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66126.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '28 Fr',
    outerDiameterFr: 28,
    outerDiameterMm: 9.3,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66128',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 7 },
      { flow: 2.5, pressureDrop: 10 },
      { flow: 3.0, pressureDrop: 14 },
      { flow: 3.5, pressureDrop: 19 },
      { flow: 4.0, pressureDrop: 24 },
      { flow: 4.5, pressureDrop: 30 },
      { flow: 5.0, pressureDrop: 36 },
      { flow: 5.5, pressureDrop: 43 },
      { flow: 6.0, pressureDrop: 51 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 28 Fr (9.3 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66128.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '30 Fr',
    outerDiameterFr: 30,
    outerDiameterMm: 10.0,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66130',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. A near-zero low-flow value was rounded to 0 mmHg for practical display.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 1 },
      { flow: 1.5, pressureDrop: 2 },
      { flow: 2.0, pressureDrop: 5 },
      { flow: 2.5, pressureDrop: 7 },
      { flow: 3.0, pressureDrop: 10 },
      { flow: 3.5, pressureDrop: 14 },
      { flow: 4.0, pressureDrop: 18 },
      { flow: 4.5, pressureDrop: 22 },
      { flow: 5.0, pressureDrop: 27 },
      { flow: 5.5, pressureDrop: 32 },
      { flow: 6.0, pressureDrop: 38 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 30 Fr (10.0 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66130.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '32 Fr',
    outerDiameterFr: 32,
    outerDiameterMm: 10.7,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66132',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. A near-zero low-flow value was rounded to 0 mmHg for practical display.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 1 },
      { flow: 1.5, pressureDrop: 2 },
      { flow: 2.0, pressureDrop: 4 },
      { flow: 2.5, pressureDrop: 6 },
      { flow: 3.0, pressureDrop: 8 },
      { flow: 3.5, pressureDrop: 11 },
      { flow: 4.0, pressureDrop: 14 },
      { flow: 4.5, pressureDrop: 18 },
      { flow: 5.0, pressureDrop: 22 },
      { flow: 5.5, pressureDrop: 26 },
      { flow: 6.0, pressureDrop: 31 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 32 Fr (10.7 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66132.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '34 Fr',
    outerDiameterFr: 34,
    outerDiameterMm: 11.3,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66134',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. A near-zero low-flow value was rounded to 0 mmHg for practical display.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 1 },
      { flow: 1.5, pressureDrop: 2 },
      { flow: 2.0, pressureDrop: 3 },
      { flow: 2.5, pressureDrop: 4 },
      { flow: 3.0, pressureDrop: 6 },
      { flow: 3.5, pressureDrop: 9 },
      { flow: 4.0, pressureDrop: 11 },
      { flow: 4.5, pressureDrop: 14 },
      { flow: 5.0, pressureDrop: 17 },
      { flow: 5.5, pressureDrop: 21 },
      { flow: 6.0, pressureDrop: 25 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 34 Fr (11.3 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66134.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '36 Fr',
    outerDiameterFr: 36,
    outerDiameterMm: 12.0,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66136',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. A near-zero low-flow value was rounded to 0 mmHg for practical display.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 1 },
      { flow: 1.5, pressureDrop: 1 },
      { flow: 2.0, pressureDrop: 2 },
      { flow: 2.5, pressureDrop: 3 },
      { flow: 3.0, pressureDrop: 4 },
      { flow: 3.5, pressureDrop: 6 },
      { flow: 4.0, pressureDrop: 7 },
      { flow: 4.5, pressureDrop: 9 },
      { flow: 5.0, pressureDrop: 11 },
      { flow: 5.5, pressureDrop: 13 },
      { flow: 6.0, pressureDrop: 16 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 36 Fr (12.0 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66136.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae',
    category: 'venous',
    size: '40 Fr',
    outerDiameterFr: 40,
    outerDiameterMm: 13.3,
    overallLengthRangeIn: '12–16',
    overallLengthRangeCm: '30.5–40.6',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '66140',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Near-zero low-flow values were rounded to 0 mmHg for practical display.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 0 },
      { flow: 1.5, pressureDrop: 1 },
      { flow: 2.0, pressureDrop: 1 },
      { flow: 2.5, pressureDrop: 2 },
      { flow: 3.0, pressureDrop: 2 },
      { flow: 3.5, pressureDrop: 4 },
      { flow: 4.0, pressureDrop: 5 },
      { flow: 4.5, pressureDrop: 6 },
      { flow: 5.0, pressureDrop: 7 },
      { flow: 5.5, pressureDrop: 9 },
      { flow: 6.0, pressureDrop: 10 }
    ],
    notes: 'DLP Single Stage Venous Cannulae. 40 Fr (13.3 mm), 12–16 in (30.5–40.6 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 66140.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Malleable Single Stage Venous Cannulae',
    category: 'venous',
    size: '12 Fr',
    outerDiameterFr: 12,
    outerDiameterMm: 4.0,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '68112',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Malleable Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.22–0.86',
    points: [
      { flow: 0.22, pressureDrop: 10 },
      { flow: 0.35, pressureDrop: 20 },
      { flow: 0.49, pressureDrop: 36 },
      { flow: 0.60, pressureDrop: 50 },
      { flow: 0.65, pressureDrop: 60 },
      { flow: 0.72, pressureDrop: 70 },
      { flow: 0.77, pressureDrop: 80 },
      { flow: 0.82, pressureDrop: 90 },
      { flow: 0.86, pressureDrop: 100 }
    ],
    notes: 'DLP Malleable Single Stage Venous Cannulae. 12 Fr (4.0 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 68112.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Malleable Single Stage Venous Cannulae',
    category: 'venous',
    size: '14 Fr',
    outerDiameterFr: 14,
    outerDiameterMm: 4.7,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '68114',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Malleable Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.39–1.45',
    points: [
      { flow: 0.39, pressureDrop: 10 },
      { flow: 0.49, pressureDrop: 15 },
      { flow: 0.74, pressureDrop: 30 },
      { flow: 0.88, pressureDrop: 40 },
      { flow: 1.01, pressureDrop: 52 },
      { flow: 1.10, pressureDrop: 60 },
      { flow: 1.19, pressureDrop: 70 },
      { flow: 1.28, pressureDrop: 80 },
      { flow: 1.37, pressureDrop: 90 },
      { flow: 1.45, pressureDrop: 100 }
    ],
    notes: 'DLP Malleable Single Stage Venous Cannulae. 14 Fr (4.7 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 68114.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Malleable Single Stage Venous Cannulae',
    category: 'venous',
    size: '16 Fr',
    outerDiameterFr: 16,
    outerDiameterMm: 5.3,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '68116',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Malleable Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.48–2.31',
    points: [
      { flow: 0.48, pressureDrop: 7 },
      { flow: 1.01, pressureDrop: 22 },
      { flow: 1.20, pressureDrop: 30 },
      { flow: 1.50, pressureDrop: 45 },
      { flow: 1.75, pressureDrop: 60 },
      { flow: 1.99, pressureDrop: 77 },
      { flow: 2.18, pressureDrop: 90 },
      { flow: 2.31, pressureDrop: 100 }
    ],
    notes: 'DLP Malleable Single Stage Venous Cannulae. 16 Fr (5.3 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 68116.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '12 Fr',
    outerDiameterFr: 12,
    outerDiameterMm: 4.0,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67512',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are preserved to two decimals because this small-size cannula has a narrow, steep pressure-flow range.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.20, pressureDrop: 10 },
      { flow: 0.34, pressureDrop: 20 },
      { flow: 0.46, pressureDrop: 34 },
      { flow: 0.51, pressureDrop: 40 },
      { flow: 0.58, pressureDrop: 51 },
      { flow: 0.66, pressureDrop: 61 },
      { flow: 0.72, pressureDrop: 70 },
      { flow: 0.77, pressureDrop: 80 },
      { flow: 0.81, pressureDrop: 90 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 12 Fr (4.0 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 67512.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '14 Fr',
    outerDiameterFr: 14,
    outerDiameterMm: 4.7,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67514',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.39–1.38',
    points: [
      { flow: 0.39, pressureDrop: 11 },
      { flow: 0.47, pressureDrop: 15 },
      { flow: 0.58, pressureDrop: 21 },
      { flow: 0.73, pressureDrop: 30 },
      { flow: 0.86, pressureDrop: 40 },
      { flow: 1.00, pressureDrop: 51 },
      { flow: 1.09, pressureDrop: 60 },
      { flow: 1.19, pressureDrop: 70 },
      { flow: 1.29, pressureDrop: 80 },
      { flow: 1.38, pressureDrop: 90 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 14 Fr (4.7 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 67514.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '16 Fr',
    outerDiameterFr: 16,
    outerDiameterMm: 5.3,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67516',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.47–2.18',
    points: [
      { flow: 0.47, pressureDrop: 7 },
      { flow: 0.99, pressureDrop: 23 },
      { flow: 1.17, pressureDrop: 30 },
      { flow: 1.50, pressureDrop: 45 },
      { flow: 1.74, pressureDrop: 60 },
      { flow: 1.89, pressureDrop: 70 },
      { flow: 1.99, pressureDrop: 77 },
      { flow: 2.18, pressureDrop: 90 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 16 Fr (5.3 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in (0.64 cm) connection site. Order code 67516.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '18 Fr',
    outerDiameterFr: 18,
    outerDiameterMm: 6.0,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '67518',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.46–3.00',
    points: [
      { flow: 0.46, pressureDrop: 4 },
      { flow: 0.99, pressureDrop: 13 },
      { flow: 1.49, pressureDrop: 27 },
      { flow: 2.00, pressureDrop: 45 },
      { flow: 2.35, pressureDrop: 60 },
      { flow: 2.51, pressureDrop: 67 },
      { flow: 2.78, pressureDrop: 80 },
      { flow: 3.00, pressureDrop: 93 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 18 Fr (6.0 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 67518.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '20 Fr',
    outerDiameterFr: 20,
    outerDiameterMm: 6.7,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '67520',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.47–3.73',
    points: [
      { flow: 0.47, pressureDrop: 2 },
      { flow: 0.99, pressureDrop: 9 },
      { flow: 1.49, pressureDrop: 17 },
      { flow: 2.00, pressureDrop: 29 },
      { flow: 2.51, pressureDrop: 44 },
      { flow: 3.00, pressureDrop: 61 },
      { flow: 3.51, pressureDrop: 81 },
      { flow: 3.73, pressureDrop: 90 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 20 Fr (6.7 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 67520.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '22 Fr',
    outerDiameterFr: 22,
    outerDiameterMm: 7.3,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '67522',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.47–5.00',
    points: [
      { flow: 0.47, pressureDrop: 2 },
      { flow: 0.99, pressureDrop: 6 },
      { flow: 1.49, pressureDrop: 11 },
      { flow: 2.00, pressureDrop: 18 },
      { flow: 2.50, pressureDrop: 28 },
      { flow: 2.99, pressureDrop: 38 },
      { flow: 3.50, pressureDrop: 51 },
      { flow: 4.00, pressureDrop: 65 },
      { flow: 4.50, pressureDrop: 81 },
      { flow: 5.00, pressureDrop: 100 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 22 Fr (7.3 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 67522.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '24 Fr',
    outerDiameterFr: 24,
    outerDiameterMm: 8.0,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '1/4 in–3/8 in (0.64–0.95 cm)',
    cannulaOrderCode: '67524',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.46–5.52',
    points: [
      { flow: 0.46, pressureDrop: 2 },
      { flow: 1.00, pressureDrop: 5 },
      { flow: 1.50, pressureDrop: 9 },
      { flow: 2.00, pressureDrop: 15 },
      { flow: 2.51, pressureDrop: 22 },
      { flow: 3.01, pressureDrop: 31 },
      { flow: 3.50, pressureDrop: 41 },
      { flow: 4.00, pressureDrop: 53 },
      { flow: 4.50, pressureDrop: 66 },
      { flow: 5.01, pressureDrop: 79 },
      { flow: 5.52, pressureDrop: 95 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 24 Fr (8.0 mm), 12–15 in (30.5–38.1 cm) overall length range, 1/4 in–3/8 in (0.64–0.95 cm) connection site. Order code 67524.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '26 Fr',
    outerDiameterFr: 26,
    outerDiameterMm: 8.7,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67526',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.48–6.01',
    points: [
      { flow: 0.48, pressureDrop: 1 },
      { flow: 1.00, pressureDrop: 3 },
      { flow: 1.48, pressureDrop: 6 },
      { flow: 2.00, pressureDrop: 10 },
      { flow: 2.50, pressureDrop: 15 },
      { flow: 3.00, pressureDrop: 20 },
      { flow: 3.50, pressureDrop: 27 },
      { flow: 4.00, pressureDrop: 34 },
      { flow: 4.50, pressureDrop: 42 },
      { flow: 5.00, pressureDrop: 51 },
      { flow: 5.51, pressureDrop: 62 },
      { flow: 6.01, pressureDrop: 73 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 26 Fr (8.7 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67526.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '28 Fr',
    outerDiameterFr: 28,
    outerDiameterMm: 9.3,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67528',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.47–6.01',
    points: [
      { flow: 0.47, pressureDrop: 1 },
      { flow: 0.99, pressureDrop: 2 },
      { flow: 1.50, pressureDrop: 4 },
      { flow: 2.00, pressureDrop: 7 },
      { flow: 2.51, pressureDrop: 11 },
      { flow: 2.99, pressureDrop: 15 },
      { flow: 3.50, pressureDrop: 19 },
      { flow: 4.01, pressureDrop: 25 },
      { flow: 4.50, pressureDrop: 30 },
      { flow: 5.01, pressureDrop: 37 },
      { flow: 5.52, pressureDrop: 44 },
      { flow: 6.01, pressureDrop: 51 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 28 Fr (9.3 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67528.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '30 Fr',
    outerDiameterFr: 30,
    outerDiameterMm: 10.0,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67530',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.51–5.99',
    points: [
      { flow: 0.51, pressureDrop: 0 },
      { flow: 1.02, pressureDrop: 1 },
      { flow: 1.51, pressureDrop: 2 },
      { flow: 2.02, pressureDrop: 5 },
      { flow: 2.53, pressureDrop: 7 },
      { flow: 3.02, pressureDrop: 10 },
      { flow: 3.51, pressureDrop: 14 },
      { flow: 4.01, pressureDrop: 18 },
      { flow: 4.50, pressureDrop: 22 },
      { flow: 5.00, pressureDrop: 27 },
      { flow: 5.50, pressureDrop: 32 },
      { flow: 5.99, pressureDrop: 38 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 30 Fr (10.0 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67530.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '32 Fr',
    outerDiameterFr: 32,
    outerDiameterMm: 10.7,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67532',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.50–5.99',
    points: [
      { flow: 0.50, pressureDrop: 0 },
      { flow: 1.02, pressureDrop: 1 },
      { flow: 1.52, pressureDrop: 2 },
      { flow: 2.03, pressureDrop: 4 },
      { flow: 2.52, pressureDrop: 6 },
      { flow: 3.02, pressureDrop: 8 },
      { flow: 3.52, pressureDrop: 11 },
      { flow: 4.01, pressureDrop: 14 },
      { flow: 4.50, pressureDrop: 18 },
      { flow: 5.00, pressureDrop: 22 },
      { flow: 5.51, pressureDrop: 27 },
      { flow: 5.99, pressureDrop: 31 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 32 Fr (10.7 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67532.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '34 Fr',
    outerDiameterFr: 34,
    outerDiameterMm: 11.3,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67534',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.50–5.97',
    points: [
      { flow: 0.50, pressureDrop: 0 },
      { flow: 1.02, pressureDrop: 1 },
      { flow: 1.52, pressureDrop: 2 },
      { flow: 2.02, pressureDrop: 3 },
      { flow: 2.53, pressureDrop: 5 },
      { flow: 3.02, pressureDrop: 7 },
      { flow: 3.52, pressureDrop: 9 },
      { flow: 4.01, pressureDrop: 11 },
      { flow: 4.50, pressureDrop: 14 },
      { flow: 5.00, pressureDrop: 17 },
      { flow: 5.51, pressureDrop: 21 },
      { flow: 5.97, pressureDrop: 24 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 34 Fr (11.3 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67534.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '36 Fr',
    outerDiameterFr: 36,
    outerDiameterMm: 12.0,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67536',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.52–5.99',
    points: [
      { flow: 0.52, pressureDrop: 0 },
      { flow: 1.03, pressureDrop: 1 },
      { flow: 1.51, pressureDrop: 2 },
      { flow: 2.02, pressureDrop: 2 },
      { flow: 2.53, pressureDrop: 3 },
      { flow: 3.01, pressureDrop: 4 },
      { flow: 3.51, pressureDrop: 6 },
      { flow: 4.03, pressureDrop: 7 },
      { flow: 4.51, pressureDrop: 9 },
      { flow: 5.00, pressureDrop: 11 },
      { flow: 5.51, pressureDrop: 13 },
      { flow: 5.99, pressureDrop: 15 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 36 Fr (12.0 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67536.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Right Angle Single Stage Venous Cannulae',
    category: 'venous',
    size: '38 Fr',
    outerDiameterFr: 38,
    outerDiameterMm: 12.7,
    overallLengthRangeIn: '12–15',
    overallLengthRangeCm: '30.5–38.1',
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '67538',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Right Angle Single Stage Venous Cannulae pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve-cleaned',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Flow values are rounded to two decimals and pressure-drop values are rounded to the nearest whole mmHg.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    referenceFlowRangeLabel: '0.51–6.00',
    points: [
      { flow: 0.51, pressureDrop: 0 },
      { flow: 1.03, pressureDrop: 1 },
      { flow: 1.51, pressureDrop: 1 },
      { flow: 2.03, pressureDrop: 2 },
      { flow: 2.52, pressureDrop: 2 },
      { flow: 3.01, pressureDrop: 3 },
      { flow: 3.52, pressureDrop: 4 },
      { flow: 4.02, pressureDrop: 5 },
      { flow: 4.51, pressureDrop: 7 },
      { flow: 5.01, pressureDrop: 8 },
      { flow: 5.52, pressureDrop: 9 },
      { flow: 6.00, pressureDrop: 11 }
    ],
    notes: 'DLP Right Angle Single Stage Venous Cannulae. 38 Fr (12.7 mm), 12–15 in (30.5–38.1 cm) overall length range, 3/8 in (0.95 cm) connection site. Order code 67538.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '12 Fr',
    outerDiameterFr: 12,
    outerDiameterMm: 4.0,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67312',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 1/4 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 1/4 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 14 },
      { flow: 1.0, pressureDrop: 48 },
      { flow: 1.5, pressureDrop: 98 },
      { flow: 2.0, pressureDrop: 163 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 12 Fr (4.0 mm), 14 in (35.6 cm) overall length, 1/4 in (0.64 cm) connection site. Order code 67312.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '12 Fr',
    outerDiameterFr: 12,
    outerDiameterMm: 4.0,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69312',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 12 },
      { flow: 1.0, pressureDrop: 45 },
      { flow: 1.5, pressureDrop: 92 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 12 Fr (4.0 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69312.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '14 Fr',
    outerDiameterFr: 14,
    outerDiameterMm: 4.7,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69314',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 17 },
      { flow: 1.5, pressureDrop: 34 },
      { flow: 2.0, pressureDrop: 58 },
      { flow: 2.5, pressureDrop: 88 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 14 Fr (4.7 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69314.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '16 Fr',
    outerDiameterFr: 16,
    outerDiameterMm: 5.3,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69316',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 3 },
      { flow: 1.0, pressureDrop: 12 },
      { flow: 1.5, pressureDrop: 24 },
      { flow: 2.0, pressureDrop: 41 },
      { flow: 2.5, pressureDrop: 62 },
      { flow: 3.0, pressureDrop: 86 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 16 Fr (5.3 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69316.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '18 Fr',
    outerDiameterFr: 18,
    outerDiameterMm: 6.0,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69318',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 6 },
      { flow: 1.5, pressureDrop: 13 },
      { flow: 2.0, pressureDrop: 22 },
      { flow: 2.5, pressureDrop: 33 },
      { flow: 3.0, pressureDrop: 45 },
      { flow: 3.5, pressureDrop: 60 },
      { flow: 4.0, pressureDrop: 76 },
      { flow: 4.5, pressureDrop: 94 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 18 Fr (6.0 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69318.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '20 Fr',
    outerDiameterFr: 20,
    outerDiameterMm: 6.7,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69320',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 15 },
      { flow: 2.5, pressureDrop: 23 },
      { flow: 3.0, pressureDrop: 32 },
      { flow: 3.5, pressureDrop: 42 },
      { flow: 4.0, pressureDrop: 54 },
      { flow: 4.5, pressureDrop: 67 },
      { flow: 5.0, pressureDrop: 82 },
      { flow: 5.5, pressureDrop: 98 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 20 Fr (6.7 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69320.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '22 Fr',
    outerDiameterFr: 22,
    outerDiameterMm: 7.3,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69322',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 5 },
      { flow: 2.0, pressureDrop: 9 },
      { flow: 2.5, pressureDrop: 13 },
      { flow: 3.0, pressureDrop: 18 },
      { flow: 3.5, pressureDrop: 24 },
      { flow: 4.0, pressureDrop: 31 },
      { flow: 4.5, pressureDrop: 39 },
      { flow: 5.0, pressureDrop: 47 },
      { flow: 5.5, pressureDrop: 57 },
      { flow: 6.0, pressureDrop: 67 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 22 Fr (7.3 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69322.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '24 Fr',
    outerDiameterFr: 24,
    outerDiameterMm: 8.0,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69324',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart. A near-zero low-flow value was rounded to 0 mmHg to avoid displaying a negative pressure-drop artifact from manual digitization.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 1 },
      { flow: 1.5, pressureDrop: 3 },
      { flow: 2.0, pressureDrop: 6 },
      { flow: 2.5, pressureDrop: 9 },
      { flow: 3.0, pressureDrop: 13 },
      { flow: 3.5, pressureDrop: 17 },
      { flow: 4.0, pressureDrop: 21 },
      { flow: 4.5, pressureDrop: 27 },
      { flow: 5.0, pressureDrop: 33 },
      { flow: 5.5, pressureDrop: 40 },
      { flow: 6.0, pressureDrop: 47 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 24 Fr (8.0 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69324.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '28 Fr',
    outerDiameterFr: 28,
    outerDiameterMm: 9.3,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69328',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart. A near-zero low-flow value was rounded to 0 mmHg to avoid displaying a negative pressure-drop artifact from manual digitization.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 0 },
      { flow: 1.5, pressureDrop: 2 },
      { flow: 2.0, pressureDrop: 3 },
      { flow: 2.5, pressureDrop: 5 },
      { flow: 3.0, pressureDrop: 7 },
      { flow: 3.5, pressureDrop: 9 },
      { flow: 4.0, pressureDrop: 12 },
      { flow: 4.5, pressureDrop: 15 },
      { flow: 5.0, pressureDrop: 18 },
      { flow: 5.5, pressureDrop: 22 },
      { flow: 6.0, pressureDrop: 26 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 28 Fr (9.3 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69328.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '31 Fr',
    outerDiameterFr: 31,
    outerDiameterMm: 10.3,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '3/8 in (0.95 cm)',
    cannulaOrderCode: '69331',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 3/8 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 3/8 in connection site chart. Near-zero low-flow values were rounded to 0 mmHg for practical display.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 0 },
      { flow: 1.5, pressureDrop: 1 },
      { flow: 2.0, pressureDrop: 2 },
      { flow: 2.5, pressureDrop: 3 },
      { flow: 3.0, pressureDrop: 5 },
      { flow: 3.5, pressureDrop: 7 },
      { flow: 4.0, pressureDrop: 9 },
      { flow: 4.5, pressureDrop: 12 },
      { flow: 5.0, pressureDrop: 15 },
      { flow: 5.5, pressureDrop: 18 },
      { flow: 6.0, pressureDrop: 21 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 31 Fr (10.3 mm), 14 in (35.6 cm) overall length, 3/8 in (0.95 cm) connection site. Order code 69331.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '14 Fr',
    outerDiameterFr: 14,
    outerDiameterMm: 4.7,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67314',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 1/4 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 1/4 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 5 },
      { flow: 1.0, pressureDrop: 17 },
      { flow: 1.5, pressureDrop: 35 },
      { flow: 2.0, pressureDrop: 60 },
      { flow: 2.5, pressureDrop: 89 },
      { flow: 3.0, pressureDrop: 123 },
      { flow: 3.5, pressureDrop: 163 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 14 Fr (4.7 mm), 14 in (35.6 cm) overall length, 1/4 in (0.64 cm) connection site. Order code 67314.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '16 Fr',
    outerDiameterFr: 16,
    outerDiameterMm: 5.3,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67316',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 1/4 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 1/4 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 3 },
      { flow: 1.0, pressureDrop: 12 },
      { flow: 1.5, pressureDrop: 25 },
      { flow: 2.0, pressureDrop: 41 },
      { flow: 2.5, pressureDrop: 62 },
      { flow: 3.0, pressureDrop: 86 },
      { flow: 3.5, pressureDrop: 116 },
      { flow: 4.0, pressureDrop: 147 },
      { flow: 4.5, pressureDrop: 182 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 16 Fr (5.3 mm), 14 in (35.6 cm) overall length, 1/4 in (0.64 cm) connection site. Order code 67316.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '18 Fr',
    outerDiameterFr: 18,
    outerDiameterMm: 6.0,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67318',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 1/4 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 1/4 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 6 },
      { flow: 1.5, pressureDrop: 14 },
      { flow: 2.0, pressureDrop: 24 },
      { flow: 2.5, pressureDrop: 37 },
      { flow: 3.0, pressureDrop: 52 },
      { flow: 3.5, pressureDrop: 69 },
      { flow: 4.0, pressureDrop: 89 },
      { flow: 4.5, pressureDrop: 111 },
      { flow: 5.0, pressureDrop: 134 },
      { flow: 5.5, pressureDrop: 162 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 18 Fr (6.0 mm), 14 in (35.6 cm) overall length, 1/4 in (0.64 cm) connection site. Order code 67318.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'venous',
    size: '20 Fr',
    outerDiameterFr: 20,
    outerDiameterMm: 6.7,
    overallLengthIn: 14,
    overallLengthCm: 35.6,
    connectionSite: '1/4 in (0.64 cm)',
    cannulaOrderCode: '67320',
    cartonQuantity: '10 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — DLP Single Stage Venous Cannulae with Right Angle Metal Tip, 1/4 in connection site pressure-loss chart',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. This dataset is specific to the 1/4 in connection site chart.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 11 },
      { flow: 2.0, pressureDrop: 20 },
      { flow: 2.5, pressureDrop: 31 },
      { flow: 3.0, pressureDrop: 43 },
      { flow: 3.5, pressureDrop: 57 },
      { flow: 4.0, pressureDrop: 73 },
      { flow: 4.5, pressureDrop: 92 },
      { flow: 5.0, pressureDrop: 113 },
      { flow: 5.5, pressureDrop: 136 },
      { flow: 6.0, pressureDrop: 159 }
    ],
    notes: 'DLP Single Stage Venous Cannula with Right Angle Metal Tip. 20 Fr (6.7 mm), 14 in (35.6 cm) overall length, 1/4 in (0.64 cm) connection site. Order code 67320.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'EOPA 3D Arterial Cannulae',
    category: 'arterial',
    size: '20 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — EOPA 3D Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 3 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 10 },
      { flow: 2.5, pressureDrop: 15 },
      { flow: 3.0, pressureDrop: 22 },
      { flow: 3.5, pressureDrop: 31 },
      { flow: 4.0, pressureDrop: 41 },
      { flow: 4.5, pressureDrop: 52 },
      { flow: 5.0, pressureDrop: 65 },
      { flow: 5.5, pressureDrop: 81 },
      { flow: 6.0, pressureDrop: 96 }
    ],
    notes: 'EOPA 3D arterial cannulae with tapered diffuse flow tips and kink-resistant elongated wirewound bodies. 20 Fr (6.7 mm), vented 3/8 in connector order code 78220, non-vented 3/8 in connector order code 78320.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'EOPA 3D Arterial Cannulae',
    category: 'arterial',
    size: '22 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — EOPA 3D Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 6 },
      { flow: 2.5, pressureDrop: 9 },
      { flow: 3.0, pressureDrop: 13 },
      { flow: 3.5, pressureDrop: 18 },
      { flow: 4.0, pressureDrop: 24 },
      { flow: 4.5, pressureDrop: 31 },
      { flow: 5.0, pressureDrop: 39 },
      { flow: 5.5, pressureDrop: 47 },
      { flow: 6.0, pressureDrop: 56 }
    ],
    notes: 'EOPA 3D arterial cannulae with tapered diffuse flow tips and kink-resistant elongated wirewound bodies. 22 Fr (7.3 mm), vented 3/8 in connector order code 78222, non-vented 3/8 in connector order code 78322.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Select 3D II Arterial Cannulae',
    category: 'arterial',
    size: '20 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Select 3D II Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 8 },
      { flow: 2.0, pressureDrop: 14 },
      { flow: 2.5, pressureDrop: 22 },
      { flow: 3.0, pressureDrop: 32 },
      { flow: 3.5, pressureDrop: 43 },
      { flow: 4.0, pressureDrop: 56 },
      { flow: 4.5, pressureDrop: 71 },
      { flow: 5.0, pressureDrop: 88 },
      { flow: 5.35, pressureDrop: 100 }
    ],
    notes: 'Select 3D II arterial cannulae with beveled tips and tapered, one-piece, kink-resistant wirewound bodies. 20 Fr (6.7 mm), 11.5 in (29.2 cm) overall length, 45° tip, vented 3/8 in connector order code 78420, non-vented 3/8 in connector order code 78520.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Select 3D II Arterial Cannulae',
    category: 'arterial',
    size: '22 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Select 3D II Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 3 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 10 },
      { flow: 2.5, pressureDrop: 16 },
      { flow: 3.0, pressureDrop: 23 },
      { flow: 3.5, pressureDrop: 32 },
      { flow: 4.0, pressureDrop: 41 },
      { flow: 4.5, pressureDrop: 52 },
      { flow: 5.0, pressureDrop: 65 },
      { flow: 5.5, pressureDrop: 78 },
      { flow: 6.0, pressureDrop: 92 }
    ],
    notes: 'Select 3D II arterial cannulae with beveled tips and tapered, one-piece, kink-resistant wirewound bodies. 22 Fr (7.3 mm), 11.5 in (29.2 cm) overall length, 45° tip, vented 3/8 in connector order code 78422, non-vented 3/8 in connector order code 78522.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Select 3D II Arterial Cannulae',
    category: 'arterial',
    size: '24 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Select 3D II Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 7 },
      { flow: 2.5, pressureDrop: 11 },
      { flow: 3.0, pressureDrop: 16 },
      { flow: 3.5, pressureDrop: 22 },
      { flow: 4.0, pressureDrop: 29 },
      { flow: 4.5, pressureDrop: 37 },
      { flow: 5.0, pressureDrop: 46 },
      { flow: 5.5, pressureDrop: 55 },
      { flow: 6.0, pressureDrop: 66 }
    ],
    notes: 'Select 3D II arterial cannulae with beveled tips and tapered, one-piece, kink-resistant wirewound bodies. 24 Fr (8.0 mm), 11.5 in (29.2 cm) overall length, 45° tip, vented 3/8 in connector order code 78424, non-vented 3/8 in connector order code 78524.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'EOPA Arterial Cannulae',
    category: 'arterial',
    size: '18 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — EOPA Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; pressure-drop values corrected by ×2 after identifying an initial Y-axis calibration error. Values rounded for practical reference use.',
    validationStatus: 'corrected',
    validationNote: 'EOPA Arterial Cannulae Y-axis corrected from presumed 0–100 mmHg calibration to the correct 0–200 mmHg chart scale.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 10 },
      { flow: 2.0, pressureDrop: 18 },
      { flow: 2.5, pressureDrop: 28 },
      { flow: 3.0, pressureDrop: 40 },
      { flow: 3.5, pressureDrop: 54 },
      { flow: 4.0, pressureDrop: 70 },
      { flow: 4.5, pressureDrop: 88 },
      { flow: 5.0, pressureDrop: 110 },
      { flow: 5.5, pressureDrop: 132 },
      { flow: 6.0, pressureDrop: 156 }
    ],
    notes: 'EOPA arterial cannulae with elongated, one-piece, kink-resistant wirewound bodies, introducer, hemostasis cap, depth markings, and adjustable radiopaque suture ring. 18 Fr (6.0 mm), 12 in (30.5 cm) overall length, 3/8 in connector. Blunt tip order codes 77418/77518; dilator tip order codes 77618/77718.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'EOPA Arterial Cannulae',
    category: 'arterial',
    size: '20 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — EOPA Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; pressure-drop values corrected by ×2 after identifying an initial Y-axis calibration error. Values rounded for practical reference use.',
    validationStatus: 'corrected',
    validationNote: 'EOPA Arterial Cannulae Y-axis corrected from presumed 0–100 mmHg calibration to the correct 0–200 mmHg chart scale.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 12 },
      { flow: 2.5, pressureDrop: 20 },
      { flow: 3.0, pressureDrop: 28 },
      { flow: 3.5, pressureDrop: 38 },
      { flow: 4.0, pressureDrop: 50 },
      { flow: 4.5, pressureDrop: 62 },
      { flow: 5.0, pressureDrop: 76 },
      { flow: 5.5, pressureDrop: 94 },
      { flow: 6.0, pressureDrop: 110 }
    ],
    notes: 'EOPA arterial cannulae with elongated, one-piece, kink-resistant wirewound bodies, introducer, hemostasis cap, depth markings, and adjustable radiopaque suture ring. 20 Fr (6.7 mm), 12 in (30.5 cm) overall length, 3/8 in connector. Blunt tip order codes 77420/77520; dilator tip order codes 77620/77720.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'EOPA Arterial Cannulae',
    category: 'arterial',
    size: '22 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — EOPA Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; pressure-drop values corrected by ×2 after identifying an initial Y-axis calibration error. Values rounded for practical reference use.',
    validationStatus: 'corrected',
    validationNote: 'EOPA Arterial Cannulae Y-axis corrected from presumed 0–100 mmHg calibration to the correct 0–200 mmHg chart scale.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 8 },
      { flow: 2.5, pressureDrop: 12 },
      { flow: 3.0, pressureDrop: 16 },
      { flow: 3.5, pressureDrop: 22 },
      { flow: 4.0, pressureDrop: 30 },
      { flow: 4.5, pressureDrop: 36 },
      { flow: 5.0, pressureDrop: 46 },
      { flow: 5.5, pressureDrop: 54 },
      { flow: 6.0, pressureDrop: 64 }
    ],
    notes: 'EOPA arterial cannulae with elongated, one-piece, kink-resistant wirewound bodies, introducer, hemostasis cap, depth markings, and adjustable radiopaque suture ring. 22 Fr (7.3 mm), 12 in (30.5 cm) overall length, 3/8 in connector. Blunt tip order codes 77422/77522; dilator tip order codes 77622/77722.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'EOPA Arterial Cannulae',
    category: 'arterial',
    size: '24 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — EOPA Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; pressure-drop values corrected by ×2 after identifying an initial Y-axis calibration error. Values rounded for practical reference use.',
    validationStatus: 'corrected',
    validationNote: 'EOPA Arterial Cannulae Y-axis corrected from presumed 0–100 mmHg calibration to the correct 0–200 mmHg chart scale.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 2 },
      { flow: 2.0, pressureDrop: 4 },
      { flow: 2.5, pressureDrop: 6 },
      { flow: 3.0, pressureDrop: 10 },
      { flow: 3.5, pressureDrop: 12 },
      { flow: 4.0, pressureDrop: 16 },
      { flow: 4.5, pressureDrop: 20 },
      { flow: 5.0, pressureDrop: 26 },
      { flow: 5.5, pressureDrop: 30 },
      { flow: 6.0, pressureDrop: 36 }
    ],
    notes: 'EOPA arterial cannulae with elongated, one-piece, kink-resistant wirewound bodies, introducer, hemostasis cap, depth markings, and adjustable radiopaque suture ring. 24 Fr (8.0 mm), 12 in (30.5 cm) overall length, 3/8 in connector. Blunt tip order codes 77424/77524; dilator tip order codes 77624/77724.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Select Series Angled Tip Arterial Cannulae',
    category: 'arterial',
    size: '20 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Select Series Angled Tip Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 3 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 11 },
      { flow: 2.5, pressureDrop: 16 },
      { flow: 3.0, pressureDrop: 23 },
      { flow: 3.5, pressureDrop: 31 },
      { flow: 4.0, pressureDrop: 40 },
      { flow: 4.5, pressureDrop: 50 },
      { flow: 5.0, pressureDrop: 62 },
      { flow: 5.5, pressureDrop: 74 },
      { flow: 6.0, pressureDrop: 89 }
    ],
    notes: 'Select Series Angled Tip arterial cannulae with beveled tips and tapered, one-piece, kink-resistant wirewound bodies, tip orientation line, and connector peel cap. 20 Fr (6.7 mm), 12 in (30.5 cm) overall length, 45° angled tip. Vented 3/8 in connector order codes: 72420 without side holes, 73420 with side holes. Non-vented 3/8 in connector order code: 72520 without side holes.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Select Series Angled Tip Arterial Cannulae',
    category: 'arterial',
    size: '22 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Select Series Angled Tip Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 7 },
      { flow: 2.5, pressureDrop: 10 },
      { flow: 3.0, pressureDrop: 15 },
      { flow: 3.5, pressureDrop: 20 },
      { flow: 4.0, pressureDrop: 26 },
      { flow: 4.5, pressureDrop: 32 },
      { flow: 5.0, pressureDrop: 40 },
      { flow: 5.5, pressureDrop: 48 },
      { flow: 6.0, pressureDrop: 56 }
    ],
    notes: 'Select Series Angled Tip arterial cannulae with beveled tips and tapered, one-piece, kink-resistant wirewound bodies, tip orientation line, and connector peel cap. 22 Fr (7.3 mm), 12 in (30.5 cm) overall length, 45° angled tip. Vented 3/8 in connector order codes: 72422 without side holes, 73422 with side holes. Non-vented 3/8 in connector order code: 72522 without side holes.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Select Series Angled Tip Arterial Cannulae',
    category: 'arterial',
    size: '24 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Select Series Angled Tip Arterial Cannulae',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 1 },
      { flow: 1.5, pressureDrop: 2 },
      { flow: 2.0, pressureDrop: 4 },
      { flow: 2.5, pressureDrop: 7 },
      { flow: 3.0, pressureDrop: 10 },
      { flow: 3.5, pressureDrop: 13 },
      { flow: 4.0, pressureDrop: 17 },
      { flow: 4.5, pressureDrop: 21 },
      { flow: 5.0, pressureDrop: 26 },
      { flow: 5.5, pressureDrop: 31 },
      { flow: 6.0, pressureDrop: 37 }
    ],
    notes: 'Select Series Angled Tip arterial cannulae with beveled tips and tapered, one-piece, kink-resistant wirewound bodies, tip orientation line, and connector peel cap. 24 Fr (8.0 mm), 12 in (30.5 cm) overall length, 45° angled tip. Vented 3/8 in connector order codes: 72424 without side holes, 73424 with side holes. Non-vented 3/8 in connector order code: 72524 without side holes.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus Multi-stage Femoral Venous Cannula with Insertion Kit',
    category: 'femoral venous',
    size: '19 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus Multi-stage Femoral Venous Cannula with Insertion Kit',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outerDiameterFr: 19,
    outerDiameterMm: 6.3,
    overallLengthIn: 30,
    overallLengthCm: 76.2,
    tipLengthIn: 23.6,
    tipLengthCm: 60,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96880-019',
    cartonQuantity: '1 per carton',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 16 },
      { flow: 2.5, pressureDrop: 24 },
      { flow: 3.0, pressureDrop: 34 },
      { flow: 3.5, pressureDrop: 45 },
      { flow: 4.0, pressureDrop: 57 },
      { flow: 4.5, pressureDrop: 71 },
      { flow: 5.0, pressureDrop: 86 },
      { flow: 5.5, pressureDrop: 104 },
      { flow: 6.0, pressureDrop: 120 }
    ],
    notes: 'Bio-Medicus Multi-stage femoral venous cannula with insertion kit. 19 Fr (6.3 mm), 30 in (76.2 cm) overall length, 23.6 in (60 cm) tip length, non-vented 3/8 in connector. Order code 96880-019.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus Multi-stage Femoral Venous Cannula with Insertion Kit',
    category: 'femoral venous',
    size: '21 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus Multi-stage Femoral Venous Cannula with Insertion Kit',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outerDiameterFr: 21,
    outerDiameterMm: 7.0,
    overallLengthIn: 30,
    overallLengthCm: 76.2,
    tipLengthIn: 23.6,
    tipLengthCm: 60,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96880-021',
    cartonQuantity: '1 per carton',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 16 },
      { flow: 2.5, pressureDrop: 24 },
      { flow: 3.0, pressureDrop: 34 },
      { flow: 3.5, pressureDrop: 45 },
      { flow: 4.0, pressureDrop: 57 },
      { flow: 4.5, pressureDrop: 71 },
      { flow: 5.0, pressureDrop: 86 },
      { flow: 5.5, pressureDrop: 104 },
      { flow: 6.0, pressureDrop: 120 }
    ],
    notes: 'Bio-Medicus Multi-stage femoral venous cannula with insertion kit. 21 Fr (7.0 mm), 30 in (76.2 cm) overall length, 23.6 in (60 cm) tip length, non-vented 3/8 in connector. Order code 96880-021.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus Multi-stage Femoral Venous Cannula with Insertion Kit',
    category: 'femoral venous',
    size: '25 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus Multi-stage Femoral Venous Cannula with Insertion Kit',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outerDiameterFr: 25,
    outerDiameterMm: 8.3,
    overallLengthIn: 30,
    overallLengthCm: 76.2,
    tipLengthIn: 23.6,
    tipLengthCm: 60,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96880-025',
    cartonQuantity: '1 per carton',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 3 },
      { flow: 2.0, pressureDrop: 6 },
      { flow: 2.5, pressureDrop: 10 },
      { flow: 3.0, pressureDrop: 15 },
      { flow: 3.5, pressureDrop: 20 },
      { flow: 4.0, pressureDrop: 27 },
      { flow: 4.5, pressureDrop: 34 },
      { flow: 5.0, pressureDrop: 41 },
      { flow: 5.5, pressureDrop: 50 },
      { flow: 6.0, pressureDrop: 58 }
    ],
    notes: 'Bio-Medicus Multi-stage femoral venous cannula with insertion kit. 25 Fr (8.3 mm), 30 in (76.2 cm) overall length, 23.6 in (60 cm) tip length, non-vented 3/8 in connector. Order code 96880-025.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Arterial Cannula',
    category: 'femoral arterial',
    size: '15 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    points: [
      { flow: 0.5, pressureDrop: 5 },
      { flow: 1.0, pressureDrop: 14 },
      { flow: 1.5, pressureDrop: 26 },
      { flow: 2.0, pressureDrop: 45 },
      { flow: 2.5, pressureDrop: 88 },
      { flow: 3.0, pressureDrop: 99 },
      { flow: 3.5, pressureDrop: 137 },
      { flow: 4.0, pressureDrop: 185 }
    ],
    notes: 'Bio-Medicus NextGen femoral arterial cannula. 15 Fr (5.0 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-115; cannula kit order code 96530-115.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '15 Fr',
    outerDiameterFr: 15,
    outerDiameterMm: 5.0,
    overallLengthCm: 64.8,
    tipLengthCm: 48.9,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-115',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-115',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 7 },
      { flow: 1.0, pressureDrop: 22 },
      { flow: 1.5, pressureDrop: 45 },
      { flow: 2.0, pressureDrop: 76 },
      { flow: 2.5, pressureDrop: 115 },
      { flow: 3.0, pressureDrop: 159 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 15 Fr (5.0 mm), 64.8 cm overall length, 48.9 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-115; cannula kit order code 96600-115.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '17 Fr',
    outerDiameterFr: 17,
    outerDiameterMm: 5.7,
    overallLengthCm: 64.8,
    tipLengthCm: 48.9,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-117',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-117',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 5 },
      { flow: 1.0, pressureDrop: 14 },
      { flow: 1.5, pressureDrop: 27 },
      { flow: 2.0, pressureDrop: 43 },
      { flow: 2.5, pressureDrop: 65 },
      { flow: 3.0, pressureDrop: 88 },
      { flow: 3.5, pressureDrop: 117 },
      { flow: 4.0, pressureDrop: 150 },
      { flow: 4.5, pressureDrop: 185 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 17 Fr (5.7 mm), 64.8 cm overall length, 48.9 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-117; cannula kit order code 96600-117.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '19 Fr',
    outerDiameterFr: 19,
    outerDiameterMm: 6.3,
    overallLengthCm: 69.9,
    tipLengthCm: 54.0,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-119',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-119',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 9 },
      { flow: 1.5, pressureDrop: 16 },
      { flow: 2.0, pressureDrop: 26 },
      { flow: 2.5, pressureDrop: 38 },
      { flow: 3.0, pressureDrop: 51 },
      { flow: 3.5, pressureDrop: 67 },
      { flow: 4.0, pressureDrop: 86 },
      { flow: 4.5, pressureDrop: 106 },
      { flow: 5.0, pressureDrop: 128 },
      { flow: 5.5, pressureDrop: 153 },
      { flow: 6.0, pressureDrop: 179 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 19 Fr (6.3 mm), 69.9 cm overall length, 54.0 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-119; cannula kit order code 96600-119.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '21 Fr',
    outerDiameterFr: 21,
    outerDiameterMm: 7.0,
    overallLengthCm: 69.9,
    tipLengthCm: 54.0,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-121',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-121',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 7 },
      { flow: 1.5, pressureDrop: 11 },
      { flow: 2.0, pressureDrop: 17 },
      { flow: 2.5, pressureDrop: 25 },
      { flow: 3.0, pressureDrop: 32 },
      { flow: 3.5, pressureDrop: 42 },
      { flow: 4.0, pressureDrop: 53 },
      { flow: 4.5, pressureDrop: 64 },
      { flow: 5.0, pressureDrop: 78 },
      { flow: 5.5, pressureDrop: 93 },
      { flow: 6.0, pressureDrop: 110 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 21 Fr (7.0 mm), 69.9 cm overall length, 54.0 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-121; cannula kit order code 96600-121.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '23 Fr',
    outerDiameterFr: 23,
    outerDiameterMm: 7.7,
    overallLengthCm: 76.2,
    tipLengthCm: 60.0,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-123',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-123',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 6 },
      { flow: 1.5, pressureDrop: 10 },
      { flow: 2.0, pressureDrop: 14 },
      { flow: 2.5, pressureDrop: 18 },
      { flow: 3.0, pressureDrop: 24 },
      { flow: 3.5, pressureDrop: 31 },
      { flow: 4.0, pressureDrop: 38 },
      { flow: 4.5, pressureDrop: 47 },
      { flow: 5.0, pressureDrop: 57 },
      { flow: 5.5, pressureDrop: 68 },
      { flow: 6.0, pressureDrop: 80 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 23 Fr (7.7 mm), 76.2 cm overall length, 60.0 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-123; cannula kit order code 96600-123.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '25 Fr',
    outerDiameterFr: 25,
    outerDiameterMm: 8.3,
    overallLengthCm: 76.2,
    tipLengthCm: 60.0,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-125',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-125',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 7 },
      { flow: 2.0, pressureDrop: 9 },
      { flow: 2.5, pressureDrop: 13 },
      { flow: 3.0, pressureDrop: 17 },
      { flow: 3.5, pressureDrop: 21 },
      { flow: 4.0, pressureDrop: 26 },
      { flow: 4.5, pressureDrop: 32 },
      { flow: 5.0, pressureDrop: 40 },
      { flow: 5.5, pressureDrop: 46 },
      { flow: 6.0, pressureDrop: 53 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 25 Fr (8.3 mm), 76.2 cm overall length, 60.0 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-125; cannula kit order code 96600-125.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '27 Fr',
    outerDiameterFr: 27,
    outerDiameterMm: 9.0,
    overallLengthCm: 76.2,
    tipLengthCm: 60.0,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-127',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-127',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 4 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 8 },
      { flow: 2.5, pressureDrop: 11 },
      { flow: 3.0, pressureDrop: 14 },
      { flow: 3.5, pressureDrop: 18 },
      { flow: 4.0, pressureDrop: 21 },
      { flow: 4.5, pressureDrop: 26 },
      { flow: 5.0, pressureDrop: 31 },
      { flow: 5.5, pressureDrop: 35 },
      { flow: 6.0, pressureDrop: 42 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 27 Fr (9.0 mm), 76.2 cm overall length, 60.0 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-127; cannula kit order code 96600-127.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula',
    category: 'femoral bi-caval venous',
    size: '29 Fr',
    outerDiameterFr: 29,
    outerDiameterMm: 9.7,
    overallLengthCm: 76.2,
    tipLengthCm: 60.0,
    connectorSize: 'Non-vented 3/8 in (0.95 cm)',
    cannulaOrderCode: '96670-129',
    cannulaOrderCodeLabel: 'Cannula singles order code',
    cannulaKitOrderCode: '96600-129',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Bi-caval Venous Cannula and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 3 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 5 },
      { flow: 2.0, pressureDrop: 6 },
      { flow: 2.5, pressureDrop: 8 },
      { flow: 3.0, pressureDrop: 11 },
      { flow: 3.5, pressureDrop: 13 },
      { flow: 4.0, pressureDrop: 15 },
      { flow: 4.5, pressureDrop: 18 },
      { flow: 5.0, pressureDrop: 23 },
      { flow: 5.5, pressureDrop: 27 },
      { flow: 6.0, pressureDrop: 31 }
    ],
    notes: 'Bio-Medicus NextGen femoral bi-caval venous cannula. 29 Fr (9.7 mm), 76.2 cm overall length, 60.0 cm tip length, non-vented 3/8 in connector. Cannula singles order code 96670-129; cannula kit order code 96600-129.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Jugular Venous Cannula',
    category: 'jugular venous',
    size: '15 Fr',
    outerDiameterFr: 15,
    outerDiameterMm: 5.0,
    overallLengthIn: 12.5,
    overallLengthCm: 31.8,
    tipLengthIn: 7.09,
    tipLengthCm: 18.0,
    connectorSize: '3/8 in (0.95 cm)',
    cannulaOrderCode: '96570-115',
    cannulaKitOrderCode: '96530-115',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 3 },
      { flow: 1.0, pressureDrop: 11 },
      { flow: 1.5, pressureDrop: 24 },
      { flow: 2.0, pressureDrop: 41 },
      { flow: 2.5, pressureDrop: 65 },
      { flow: 3.0, pressureDrop: 94 },
      { flow: 3.5, pressureDrop: 132 },
      { flow: 4.0, pressureDrop: 178 }
    ],
    notes: 'Bio-Medicus NextGen jugular venous cannula. 15 Fr (5.0 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-115; cannula kit order code 96530-115.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Jugular Venous Cannula',
    category: 'jugular venous',
    size: '17 Fr',
    outerDiameterFr: 17,
    outerDiameterMm: 5.7,
    overallLengthIn: 12.5,
    overallLengthCm: 31.8,
    tipLengthIn: 7.09,
    tipLengthCm: 18.0,
    connectorSize: '3/8 in (0.95 cm)',
    cannulaOrderCode: '96570-117',
    cannulaKitOrderCode: '96530-117',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 6 },
      { flow: 1.5, pressureDrop: 15 },
      { flow: 2.0, pressureDrop: 27 },
      { flow: 2.5, pressureDrop: 42 },
      { flow: 3.0, pressureDrop: 60 },
      { flow: 3.5, pressureDrop: 80 },
      { flow: 4.0, pressureDrop: 104 },
      { flow: 4.5, pressureDrop: 131 },
      { flow: 5.0, pressureDrop: 160 },
      { flow: 5.5, pressureDrop: 193 }
    ],
    notes: 'Bio-Medicus NextGen jugular venous cannula. 17 Fr (5.7 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-117; cannula kit order code 96530-117.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Jugular Venous Cannula',
    category: 'jugular venous',
    size: '19 Fr',
    outerDiameterFr: 19,
    outerDiameterMm: 6.3,
    overallLengthIn: 12.5,
    overallLengthCm: 31.8,
    tipLengthIn: 7.09,
    tipLengthCm: 18.0,
    connectorSize: '3/8 in (0.95 cm)',
    cannulaOrderCode: '96570-119',
    cannulaKitOrderCode: '96530-119',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 16 },
      { flow: 2.5, pressureDrop: 24 },
      { flow: 3.0, pressureDrop: 34 },
      { flow: 3.5, pressureDrop: 45 },
      { flow: 4.0, pressureDrop: 59 },
      { flow: 4.5, pressureDrop: 73 },
      { flow: 5.0, pressureDrop: 90 },
      { flow: 5.5, pressureDrop: 109 },
      { flow: 6.0, pressureDrop: 130 }
    ],
    notes: 'Bio-Medicus NextGen jugular venous cannula. 19 Fr (6.3 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-119; cannula kit order code 96530-119.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Jugular Venous Cannula',
    category: 'jugular venous',
    size: '21 Fr',
    outerDiameterFr: 21,
    outerDiameterMm: 7.0,
    overallLengthIn: 12.5,
    overallLengthCm: 31.8,
    tipLengthIn: 7.09,
    tipLengthCm: 18.0,
    connectorSize: '3/8 in (0.95 cm)',
    cannulaOrderCode: '96570-121',
    cannulaKitOrderCode: '96530-121',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate. A near-zero low-flow value was rounded to 0 mmHg to avoid displaying a negative pressure-drop artifact from manual digitization.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 10 },
      { flow: 2.5, pressureDrop: 17 },
      { flow: 3.0, pressureDrop: 23 },
      { flow: 3.5, pressureDrop: 31 },
      { flow: 4.0, pressureDrop: 40 },
      { flow: 4.5, pressureDrop: 50 },
      { flow: 5.0, pressureDrop: 61 },
      { flow: 5.5, pressureDrop: 73 },
      { flow: 6.0, pressureDrop: 86 }
    ],
    notes: 'Bio-Medicus NextGen jugular venous cannula. 21 Fr (7.0 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-121; cannula kit order code 96530-121.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Jugular Venous Cannula',
    category: 'jugular venous',
    size: '23 Fr',
    outerDiameterFr: 23,
    outerDiameterMm: 7.7,
    overallLengthIn: 12.5,
    overallLengthCm: 31.8,
    tipLengthIn: 7.09,
    tipLengthCm: 18.0,
    connectorSize: '3/8 in (0.95 cm)',
    cannulaOrderCode: '96570-123',
    cannulaKitOrderCode: '96530-123',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 1 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 5 },
      { flow: 2.0, pressureDrop: 8 },
      { flow: 2.5, pressureDrop: 12 },
      { flow: 3.0, pressureDrop: 16 },
      { flow: 3.5, pressureDrop: 21 },
      { flow: 4.0, pressureDrop: 26 },
      { flow: 4.5, pressureDrop: 33 },
      { flow: 5.0, pressureDrop: 40 },
      { flow: 5.5, pressureDrop: 48 },
      { flow: 6.0, pressureDrop: 57 }
    ],
    notes: 'Bio-Medicus NextGen jugular venous cannula. 23 Fr (7.7 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-123; cannula kit order code 96530-123.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Jugular Venous Cannula',
    category: 'jugular venous',
    size: '25 Fr',
    outerDiameterFr: 25,
    outerDiameterMm: 8.3,
    overallLengthIn: 12.5,
    overallLengthCm: 31.8,
    tipLengthIn: 7.09,
    tipLengthCm: 18.0,
    connectorSize: '3/8 in (0.95 cm)',
    cannulaOrderCode: '96570-125',
    cannulaKitOrderCode: '96530-125',
    cartonQuantity: '1 per carton',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'digitized-curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    outOfRangeMessage: 'Target flow is outside the digitized manufacturer chart range. Pressure drop is not estimated.',
    points: [
      { flow: 0.5, pressureDrop: 0 },
      { flow: 1.0, pressureDrop: 2 },
      { flow: 1.5, pressureDrop: 3 },
      { flow: 2.0, pressureDrop: 5 },
      { flow: 2.5, pressureDrop: 8 },
      { flow: 3.0, pressureDrop: 11 },
      { flow: 3.5, pressureDrop: 15 },
      { flow: 4.0, pressureDrop: 19 },
      { flow: 4.5, pressureDrop: 24 },
      { flow: 5.0, pressureDrop: 29 },
      { flow: 5.5, pressureDrop: 34 },
      { flow: 6.0, pressureDrop: 41 }
    ],
    notes: 'Bio-Medicus NextGen jugular venous cannula. 25 Fr (8.3 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-125; cannula kit order code 96530-125.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Arterial Cannula',
    category: 'femoral arterial',
    size: '17 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 13 },
      { flow: 2.0, pressureDrop: 24 },
      { flow: 2.5, pressureDrop: 37 },
      { flow: 3.0, pressureDrop: 54 },
      { flow: 3.5, pressureDrop: 73 },
      { flow: 4.0, pressureDrop: 96 },
      { flow: 4.5, pressureDrop: 122 },
      { flow: 5.0, pressureDrop: 152 },
      { flow: 5.5, pressureDrop: 185 }
    ],
    notes: 'Bio-Medicus NextGen femoral arterial cannula. 17 Fr (5.7 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-117; cannula kit order code 96530-117.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Arterial Cannula',
    category: 'femoral arterial',
    size: '19 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 5 },
      { flow: 1.5, pressureDrop: 9 },
      { flow: 2.0, pressureDrop: 15 },
      { flow: 2.5, pressureDrop: 23 },
      { flow: 3.0, pressureDrop: 32 },
      { flow: 3.5, pressureDrop: 42 },
      { flow: 4.0, pressureDrop: 55 },
      { flow: 4.5, pressureDrop: 69 },
      { flow: 5.0, pressureDrop: 85 },
      { flow: 5.5, pressureDrop: 104 },
      { flow: 6.0, pressureDrop: 125 }
    ],
    notes: 'Bio-Medicus NextGen femoral arterial cannula. 19 Fr (6.3 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-119; cannula kit order code 96530-119.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Arterial Cannula',
    category: 'femoral arterial',
    size: '21 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    points: [
      { flow: 0.5, pressureDrop: 3 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 6 },
      { flow: 2.0, pressureDrop: 10 },
      { flow: 2.5, pressureDrop: 16 },
      { flow: 3.0, pressureDrop: 21 },
      { flow: 3.5, pressureDrop: 28 },
      { flow: 4.0, pressureDrop: 35 },
      { flow: 4.5, pressureDrop: 44 },
      { flow: 5.0, pressureDrop: 53 },
      { flow: 5.5, pressureDrop: 65 },
      { flow: 6.0, pressureDrop: 79 }
    ],
    notes: 'Bio-Medicus NextGen femoral arterial cannula. 21 Fr (7.0 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-121; cannula kit order code 96530-121.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Arterial Cannula',
    category: 'femoral arterial',
    size: '23 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    points: [
      { flow: 0.5, pressureDrop: 2 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 5 },
      { flow: 2.0, pressureDrop: 8 },
      { flow: 2.5, pressureDrop: 11 },
      { flow: 3.0, pressureDrop: 14 },
      { flow: 3.5, pressureDrop: 18 },
      { flow: 4.0, pressureDrop: 23 },
      { flow: 4.5, pressureDrop: 28 },
      { flow: 5.0, pressureDrop: 35 },
      { flow: 5.5, pressureDrop: 42 },
      { flow: 6.0, pressureDrop: 51 }
    ],
    notes: 'Bio-Medicus NextGen femoral arterial cannula. 23 Fr (7.7 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-123; cannula kit order code 96530-123.'
  },
  {
    manufacturer: 'Medtronic',
    model: 'Bio-Medicus NextGen Femoral Arterial Cannula',
    category: 'femoral arterial',
    size: '25 Fr',
    sourceLabel: 'Medtronic Cannula Catalog 2020 — Bio-Medicus NextGen Femoral Arterial or Jugular Venous Cannulae and Kits',
    sourceUrl: 'Uploaded Medtronic Cannula Catalog 2020',
    testMedium: 'Water',
    dataStatus: 'Digitized curve',
    digitizationNote: 'Digitized manually from manufacturer-published pressure-loss chart; values rounded for practical reference use. Femoral arterial and jugular venous curves are kept separate.',
    points: [
      { flow: 0.5, pressureDrop: 3 },
      { flow: 1.0, pressureDrop: 4 },
      { flow: 1.5, pressureDrop: 4 },
      { flow: 2.0, pressureDrop: 6 },
      { flow: 2.5, pressureDrop: 8 },
      { flow: 3.0, pressureDrop: 10 },
      { flow: 3.5, pressureDrop: 12 },
      { flow: 4.0, pressureDrop: 15 },
      { flow: 4.5, pressureDrop: 18 },
      { flow: 5.0, pressureDrop: 22 },
      { flow: 5.5, pressureDrop: 25 },
      { flow: 6.0, pressureDrop: 31 }
    ],
    notes: 'Bio-Medicus NextGen femoral arterial cannula. 25 Fr (8.3 mm), 12.5 in (31.8 cm) overall length, 7.09 in (18.0 cm) tip length, 3/8 in connector. Cannula order code 96570-125; cannula kit order code 96530-125.'
  }
];

const CANNULA_GAUGE_LOOKUP = [
  { gauge: 14, diameterMm: 2.10 },
  { gauge: 16, diameterMm: 1.65 },
  { gauge: 18, diameterMm: 1.27 },
  { gauge: 20, diameterMm: 0.90 },
  { gauge: 22, diameterMm: 0.70 },
  { gauge: 24, diameterMm: 0.55 }
];

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
  const cannulaTabButton = el('unit-tab-cannula');
  const flowPanel = el('unit-panel-flow');
  const pressurePanel = el('unit-panel-pressure');
  const cannulaPanel = el('unit-panel-cannula');
  if (!flowTabButton || !pressureTabButton || !cannulaTabButton || !flowPanel || !pressurePanel || !cannulaPanel) return;

  const tabButtons = {
    flow: flowTabButton,
    pressure: pressureTabButton,
    cannula: cannulaTabButton
  };
  const tabPanels = {
    flow: flowPanel,
    pressure: pressurePanel,
    cannula: cannulaPanel
  };
  const normalizedTab = ['flow', 'pressure', 'cannula'].includes(activeTab) ? activeTab : 'flow';

  Object.entries(tabPanels).forEach(([tabKey, tabPanel]) => {
    tabPanel.classList.toggle('hidden', tabKey !== normalizedTab);
  });

  Object.entries(tabButtons).forEach(([tabKey, tabButton]) => {
    const isActive = tabKey === normalizedTab;
    tabButton.classList.toggle('bg-accent-500/15', isActive);
    tabButton.classList.toggle('text-accent-700', isActive);
    tabButton.classList.toggle('dark:text-accent-300', isActive);
    tabButton.classList.toggle('text-slate-600', !isActive);
    tabButton.classList.toggle('dark:text-slate-300', !isActive);
  });
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

function getClosestGaugeReferenceByMm(diameterMm) {
  if (!(diameterMm > 0)) return null;

  return CANNULA_GAUGE_LOOKUP.reduce((closest, entry) => {
    if (!closest) return entry;
    const nextDiff = Math.abs(entry.diameterMm - diameterMm);
    const currentDiff = Math.abs(closest.diameterMm - diameterMm);
    return nextDiff < currentDiff ? entry : closest;
  }, null);
}

function updateCannulaInputMode() {
  const sizeTypeSelect = el('cannula-size-type');
  const frMmWrap = el('cannula-fr-mm-wrap');
  const frMmLabel = el('cannula-fr-mm-label');
  const frMmInput = el('cannula-fr-mm-value');
  const gaugeWrap = el('cannula-gauge-wrap');
  if (!sizeTypeSelect || !frMmWrap || !frMmLabel || !frMmInput || !gaugeWrap) return;

  const isGaugeMode = sizeTypeSelect.value === 'gauge';
  frMmWrap.classList.toggle('hidden', isGaugeMode);
  gaugeWrap.classList.toggle('hidden', !isGaugeMode);

  if (sizeTypeSelect.value === 'mm') {
    frMmLabel.textContent = 'Diameter (mm)';
    frMmInput.placeholder = '2.00';
  } else {
    frMmLabel.textContent = 'French size (Fr)';
    frMmInput.placeholder = '6';
  }
}

function updateCannulaConverter() {
  const sizeTypeSelect = el('cannula-size-type');
  const frMmInput = el('cannula-fr-mm-value');
  const gaugeSelect = el('cannula-gauge-value');
  const mmOutput = el('cannula-output-mm');
  const frOutput = el('cannula-output-fr');
  const gaugeOutput = el('cannula-output-gauge');
  const noteOutput = el('cannula-output-note');

  if (!sizeTypeSelect || !frMmInput || !gaugeSelect || !mmOutput || !frOutput || !gaugeOutput || !noteOutput) return;

  const sizeType = sizeTypeSelect.value;
  let diameterMm = null;
  let frenchSize = null;
  let gaugeReferenceText = '—';
  let clinicalNote = 'Select a size type and enter a value to convert.';

  if (sizeType === 'gauge') {
    const selectedGauge = Number(gaugeSelect.value);
    const gaugeEntry = CANNULA_GAUGE_LOOKUP.find(entry => entry.gauge === selectedGauge);
    if (gaugeEntry) {
      diameterMm = gaugeEntry.diameterMm;
      // French formula: Fr = outer diameter(mm) × 3.
      frenchSize = gaugeEntry.diameterMm * 3;
      gaugeReferenceText = `~${gaugeEntry.gauge}G (approximate reference)`;
      clinicalNote = 'Gauge to mm and Gauge to Fr values are approximate and depend on device and manufacturer.';
    }
  } else {
    const inputValue = parseFloat(frMmInput.value);
    if (Number.isFinite(inputValue) && inputValue >= 0) {
      if (sizeType === 'fr') {
        frenchSize = inputValue;
        // French to diameter formula: diameter(mm) = Fr ÷ 3.
        diameterMm = inputValue / 3;
      } else if (sizeType === 'mm') {
        diameterMm = inputValue;
        // Diameter to French formula: Fr = diameter(mm) × 3.
        frenchSize = inputValue * 3;
      }

      const closestGauge = getClosestGaugeReferenceByMm(diameterMm);
      if (closestGauge) {
        gaugeReferenceText = `Closest ~${closestGauge.gauge}G (approximate, OD ${closestGauge.diameterMm.toFixed(2)} mm)`;
      }
      clinicalNote = 'Fr to mm conversion is exact by definition; Gauge reference shown here is approximate.';
    }
  }

  mmOutput.textContent = Number.isFinite(diameterMm) ? `${diameterMm.toFixed(2)} mm` : '—';
  frOutput.textContent = Number.isFinite(frenchSize) ? `${frenchSize.toFixed(1)} Fr` : '—';
  gaugeOutput.textContent = gaugeReferenceText;
  noteOutput.textContent = clinicalNote;
}


function normalizePressureDropKey(value) {
  return String(value || '').trim().toLowerCase();
}

function getPressureDropSizeOptionValue(entry) {
  const connectionSite = entry.connectionSite || '';
  const outerDiameterFr = Number.isFinite(entry.outerDiameterFr) ? entry.outerDiameterFr : '';
  return `${entry.size || ''}||${connectionSite}||${outerDiameterFr}`;
}

function parsePressureDropSizeOptionValue(value) {
  const [size = '', connectionSite = '', outerDiameterFr = ''] = String(value || '').split('||');
  return { size, connectionSite, outerDiameterFr: parseFloat(outerDiameterFr) };
}

function findPressureDropEntry({ manufacturer, category, model, size }) {
  const selectedSize = parsePressureDropSizeOptionValue(size);
  const normalizedManufacturer = normalizePressureDropKey(manufacturer);
  const normalizedCategory = normalizePressureDropKey(category);
  const normalizedModel = normalizePressureDropKey(model);
  const normalizedSize = normalizePressureDropKey(selectedSize.size);
  const normalizedConnectionSite = normalizePressureDropKey(selectedSize.connectionSite);
  const selectedOuterDiameterFr = selectedSize.outerDiameterFr;

  if (!normalizedManufacturer || !normalizedCategory || !normalizedModel || !normalizedSize) return null;

  return cannulaPressureDropData.find(entry => (
    normalizePressureDropKey(entry.manufacturer) === normalizedManufacturer &&
    normalizePressureDropKey(entry.category) === normalizedCategory &&
    normalizePressureDropKey(entry.model) === normalizedModel &&
    normalizePressureDropKey(entry.size) === normalizedSize &&
    (!normalizedConnectionSite || normalizePressureDropKey(entry.connectionSite) === normalizedConnectionSite) &&
    (!Number.isFinite(selectedOuterDiameterFr) || entry.outerDiameterFr === selectedOuterDiameterFr)
  )) || null;
}

const PRESSURE_DROP_EXACT_FLOW_TOLERANCE = 0.01;

function getValidPressureDropPoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .filter(point => Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop))
    .sort((a, b) => a.flow - b.flow);
}

function findExactPressureDropPoint(points, targetFlow) {
  if (!Number.isFinite(targetFlow)) return null;
  const validPoints = getValidPressureDropPoints(points);
  return validPoints.find(point => Math.abs(point.flow - targetFlow) <= PRESSURE_DROP_EXACT_FLOW_TOLERANCE + Number.EPSILON) || null;
}

function interpolatePressureDrop(points, targetFlow) {
  if (!Number.isFinite(targetFlow)) return { state: 'invalid', value: null };
  const validPoints = getValidPressureDropPoints(points);
  if (!validPoints.length) return { state: 'no_points', value: null };

  const minFlow = validPoints[0].flow;
  const maxFlow = validPoints[validPoints.length - 1].flow;
  if (targetFlow < minFlow || targetFlow > maxFlow) return { state: 'out_of_range', value: null, minFlow, maxFlow };
  // Exact raw manufacturer points take priority over fitted or interpolated estimates.
  const exactPoint = findExactPressureDropPoint(validPoints, targetFlow);
  if (exactPoint) return { state: 'exact', value: exactPoint.pressureDrop, flow: exactPoint.flow, minFlow, maxFlow };
  for (let i = 0; i < validPoints.length - 1; i += 1) {
    const left = validPoints[i]; const right = validPoints[i + 1];
    if (targetFlow > left.flow && targetFlow < right.flow) {
      const ratio = (targetFlow - left.flow) / (right.flow - left.flow);
      return { state: 'interpolated', value: left.pressureDrop + ((right.pressureDrop - left.pressureDrop) * ratio), minFlow, maxFlow };
    }
  }
  return { state: 'out_of_range', value: null, minFlow, maxFlow };
}

function fitPressureDropPowerLaw(points) {
  const positivePoints = getValidPressureDropPoints(points).filter(point => point.flow > 0 && point.pressureDrop > 0);
  if (positivePoints.length < 2) return null;

  // Power-law model for pressure drop curves: ΔP = a × Q^b.
  // Fit is computed in log-log space, with Q=0 handled separately as ΔP=0.
  const logPoints = positivePoints.map(point => ({ x: Math.log(point.flow), y: Math.log(point.pressureDrop) }));
  const meanX = logPoints.reduce((sum, point) => sum + point.x, 0) / logPoints.length;
  const meanY = logPoints.reduce((sum, point) => sum + point.y, 0) / logPoints.length;
  const denominator = logPoints.reduce((sum, point) => sum + ((point.x - meanX) ** 2), 0);
  if (!(denominator > 0)) return null;

  const rawExponent = logPoints.reduce((sum, point) => sum + ((point.x - meanX) * (point.y - meanY)), 0) / denominator;
  const exponent = Math.min(Math.max(rawExponent, 0.2), 4);
  const intercept = meanY - (exponent * meanX);
  const coefficient = Math.exp(intercept);
  if (!(coefficient > 0) || !(exponent > 0)) return null;

  const estimate = flow => {
    if (!(flow > 0)) return 0;
    return coefficient * (flow ** exponent);
  };
  const maxRelativeError = positivePoints.reduce((maxError, point) => {
    const fittedDrop = estimate(point.flow);
    const relativeError = Math.abs(fittedDrop - point.pressureDrop) / Math.max(point.pressureDrop, 1);
    return Math.max(maxError, relativeError);
  }, 0);

  return maxRelativeError <= 0.45 ? { estimate, type: 'power-law' } : null;
}

function createMonotonePressureDropModel(points) {
  const validPoints = getValidPressureDropPoints(points);
  if (validPoints.length < 2) return null;

  const flows = validPoints.map(point => point.flow);
  const drops = validPoints.map(point => point.pressureDrop);
  const intervalCount = validPoints.length - 1;
  const intervalWidths = [];
  const intervalSlopes = [];
  for (let i = 0; i < intervalCount; i += 1) {
    intervalWidths.push(flows[i + 1] - flows[i]);
    intervalSlopes.push((drops[i + 1] - drops[i]) / intervalWidths[i]);
  }

  // Fritsch-Carlson monotone cubic interpolation preserves increasing pressure-drop data
  // and avoids overshoot between digitized manufacturer chart points.
  const tangents = new Array(validPoints.length).fill(0);
  tangents[0] = intervalSlopes[0];
  tangents[validPoints.length - 1] = intervalSlopes[intervalCount - 1];
  for (let i = 1; i < intervalCount; i += 1) {
    if (intervalSlopes[i - 1] * intervalSlopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      const widthSum = intervalWidths[i - 1] + intervalWidths[i];
      tangents[i] = (3 * widthSum) / (((widthSum + intervalWidths[i]) / intervalSlopes[i - 1]) + ((widthSum + intervalWidths[i - 1]) / intervalSlopes[i]));
    }
  }

  const estimate = flow => {
    if (flow <= flows[0]) return drops[0];
    if (flow >= flows[flows.length - 1]) return drops[drops.length - 1];
    let index = 0;
    while (index < intervalCount - 1 && flow > flows[index + 1]) index += 1;
    const width = intervalWidths[index];
    const t = (flow - flows[index]) / width;
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = (2 * t3) - (3 * t2) + 1;
    const h10 = t3 - (2 * t2) + t;
    const h01 = (-2 * t3) + (3 * t2);
    const h11 = t3 - t2;
    return (h00 * drops[index]) + (h10 * width * tangents[index]) + (h01 * drops[index + 1]) + (h11 * width * tangents[index + 1]);
  };

  return { estimate, type: 'monotone-cubic' };
}

function createPressureDropCurveModel(points) {
  return fitPressureDropPowerLaw(points) || createMonotonePressureDropModel(points);
}

function drawPressureDropChart(svgNode, points, targetFlow, estimatedPressureDrop, options = {}) {
  const validPoints = getValidPressureDropPoints(points);
  if (!svgNode || !validPoints.length) return;
  const width = 320; const height = 140;
  const padding = { left: 34, right: 10, top: 10, bottom: 24 };
  const minFlow = validPoints[0].flow;
  const maxFlow = validPoints[validPoints.length - 1].flow;
  const useLinearOnly = options.curveMode === 'linear';
  const curveModel = useLinearOnly ? null : createPressureDropCurveModel(validPoints);
  const sampleCount = useLinearOnly ? validPoints.length : 80;
  let lastCurveDrop = 0;
  const curveSamples = Array.from({ length: sampleCount }, (_, index) => {
    if (useLinearOnly) return validPoints[index];
    const ratio = index / (sampleCount - 1);
    const flow = minFlow + ((maxFlow - minFlow) * ratio);
    return { flow, pressureDrop: curveModel ? curveModel.estimate(flow) : interpolatePressureDrop(validPoints, flow).value };
  }).filter(point => Number.isFinite(point.pressureDrop)).map(point => {
    if (useLinearOnly) return point;
    lastCurveDrop = Math.max(lastCurveDrop, point.pressureDrop);
    return { ...point, pressureDrop: lastCurveDrop };
  });
  const maxDrop = Math.max(...validPoints.map(p => p.pressureDrop), ...curveSamples.map(p => p.pressureDrop), 1);
  const scaleX = flow => padding.left + ((flow - minFlow) / Math.max(maxFlow - minFlow, 0.0001)) * (width - padding.left - padding.right);
  const scaleY = drop => height - padding.bottom - (drop / maxDrop) * (height - padding.top - padding.bottom);
  const smoothCurvePath = curveSamples.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.flow).toFixed(1)} ${scaleY(point.pressureDrop).toFixed(1)}`).join(' ');
  const targetX = Number.isFinite(targetFlow) ? scaleX(targetFlow) : null;
  const targetY = Number.isFinite(estimatedPressureDrop) ? scaleY(estimatedPressureDrop) : null;
  const showTargetMarker = Number.isFinite(targetX) && Number.isFinite(targetY);
  const targetLabelX = showTargetMarker ? Math.min(Math.max(targetX + 7, padding.left + 4), width - 144) : null;
  const targetLabelY = showTargetMarker ? Math.max(targetY - 33, padding.top + 3) : null;
  const targetMarker = showTargetMarker
    ? `<g><line x1="${targetX.toFixed(1)}" y1="${padding.top}" x2="${targetX.toFixed(1)}" y2="${height - padding.bottom}" stroke="#f59e0b" stroke-dasharray="3 3" /><circle cx="${targetX.toFixed(1)}" cy="${targetY.toFixed(1)}" r="4" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" /><rect x="${targetLabelX.toFixed(1)}" y="${targetLabelY.toFixed(1)}" width="140" height="28" rx="4" fill="#0f172a" opacity="0.88" /><text x="${(targetLabelX + 5).toFixed(1)}" y="${(targetLabelY + 11).toFixed(1)}" font-size="8" fill="#ffffff">Target flow: ${targetFlow.toFixed(1)} L/min</text><text x="${(targetLabelX + 5).toFixed(1)}" y="${(targetLabelY + 22).toFixed(1)}" font-size="8" fill="#ffffff">Estimated pressure drop: ${estimatedPressureDrop.toFixed(1)} mmHg</text></g>`
    : '';
  svgNode.innerHTML = `<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="currentColor" stroke-opacity="0.35" /><line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" stroke="currentColor" stroke-opacity="0.35" /><path d="${smoothCurvePath}" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />${validPoints.map(p => `<circle cx="${scaleX(p.flow).toFixed(1)}" cy="${scaleY(p.pressureDrop).toFixed(1)}" r="2.2" fill="#ffffff" stroke="#0ea5e9" stroke-width="1.4" />`).join('')}${targetMarker}<text x="${padding.left}" y="${height - 6}" font-size="9" fill="currentColor" opacity="0.65">Flow (L/min)</text><text x="${width - 110}" y="${padding.top + 9}" font-size="9" fill="currentColor" opacity="0.65">Pressure drop (mmHg)</text>`;
}


function getPressureDropProductFamily(entry) {
  const model = String(entry.model || '');
  if (model.includes('HLS')) return 'HLS Cannulae';
  if (model.includes('EOPA 3D')) return 'EOPA 3D';
  if (model.includes('EOPA')) return 'EOPA';
  if (model.includes('Select 3D II')) return 'Select 3D II';
  if (model.includes('Select Series')) return 'Select Series';
  if (model.includes('DLP')) return 'DLP';
  if (model.includes('Bio-Medicus Multi-stage')) return 'Bio-Medicus';
  if (model.includes('Bio-Medicus NextGen')) return 'Bio-Medicus NextGen';
  if (model.includes('RAP')) return 'MICS Cannulae — RAP Femoral Venous Cannulae';
  return 'Other';
}

function setSelectOptions(selectNode, options, placeholder) {
  if (!selectNode) return;
  selectNode.innerHTML = '';
  const base = document.createElement('option');
  base.value = '';
  base.textContent = placeholder;
  selectNode.appendChild(base);
  options.forEach(option => {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    selectNode.appendChild(node);
  });
}


function renderAvailableCurveDatasets() {
  const wrap = el('pressure-drop-available-list');
  if (!wrap) return;
  const curveEntries = cannulaPressureDropData.filter(entry => Array.isArray(entry.points) && entry.points.length > 0);
  const grouped = {};
  curveEntries.forEach(entry => {
    const manufacturer = entry.manufacturer || 'Unknown';
    const family = getPressureDropProductFamily(entry);
    const model = entry.model || 'Unknown model';
    grouped[manufacturer] = grouped[manufacturer] || {};
    grouped[manufacturer][family] = grouped[manufacturer][family] || {};
    grouped[manufacturer][family][model] = grouped[manufacturer][family][model] || new Set();
    const sizeLabel = entry.connectionSite ? `${entry.size || 'Unknown size'} (${entry.connectionSite})` : (entry.size || 'Unknown size');
    grouped[manufacturer][family][model].add(sizeLabel);
  });

  const parts = [];
  Object.keys(grouped).sort().forEach(manufacturer => {
    parts.push(`<div><p class="font-semibold">${manufacturer}</p>`);
    Object.keys(grouped[manufacturer]).sort().forEach(family => {
      parts.push(`<p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">${family}</p><ul class="pl-3 list-disc">`);
      Object.keys(grouped[manufacturer][family]).sort().forEach(model => {
        const sizes = Array.from(grouped[manufacturer][family][model]).sort().join(', ');
        parts.push(`<li><span class="font-medium">${model}</span>: ${sizes}</li>`);
      });
      parts.push('</ul>');
    });
    parts.push('</div>');
  });
  wrap.innerHTML = parts.join('');
}

function syncPressureDropSelectors(changedLevel = 'manufacturer') {
  const manufacturerSelect = el('pressure-drop-manufacturer');
  const familySelect = el('pressure-drop-product-family');
  const categoryInput = el('pressure-drop-category');
  const modelSelect = el('pressure-drop-model');
  const sizeSelect = el('pressure-drop-size');
  if (!manufacturerSelect || !familySelect || !categoryInput || !modelSelect || !sizeSelect) return;

  const byManufacturer = cannulaPressureDropData.filter(entry => !manufacturerSelect.value || entry.manufacturer === manufacturerSelect.value);
  if (changedLevel === 'manufacturer') {
    setSelectOptions(familySelect, [...new Set(byManufacturer.map(entry => getPressureDropProductFamily(entry)))].map(v => ({ value: v, label: v })), 'Select product family');
    modelSelect.value = ''; sizeSelect.value = ''; categoryInput.value = '';
    setSelectOptions(modelSelect, [], 'Select model'); setSelectOptions(sizeSelect, [], 'Select size');
    if (familySelect.options.length === 2) { familySelect.value = familySelect.options[1].value; syncPressureDropSelectors('family'); }
    return;
  }
  const byFamily = byManufacturer.filter(entry => getPressureDropProductFamily(entry) === familySelect.value);
  if (changedLevel === 'family') {
    setSelectOptions(modelSelect, [...new Set(byFamily.map(entry => entry.model))].map(v => ({ value: v, label: v })), 'Select model');
    sizeSelect.value=''; categoryInput.value=''; setSelectOptions(sizeSelect, [], 'Select size');
    if (modelSelect.options.length === 2) { modelSelect.value = modelSelect.options[1].value; syncPressureDropSelectors('model'); }
    return;
  }
  const byModel = byFamily.filter(entry => entry.model === modelSelect.value);
  if (changedLevel === 'model') {
    setSelectOptions(sizeSelect, byModel.map(entry => {
      const connectionLabel = entry.connectionSite ? ` — ${entry.connectionSite}` : '';
      const dataLabel = (entry.points || []).length ? 'curve available' : 'metadata only';
      return { value: getPressureDropSizeOptionValue(entry), label: `${entry.size}${connectionLabel} — ${dataLabel}` };
    }), 'Select size');
    categoryInput.value='';
    if (sizeSelect.options.length === 2) { sizeSelect.value = sizeSelect.options[1].value; syncPressureDropSelectors('size'); }
    return;
  }
  const selectedSize = parsePressureDropSizeOptionValue(sizeSelect.value);
  const match = byModel.find(entry => (
    entry.size === selectedSize.size &&
    (!selectedSize.connectionSite || entry.connectionSite === selectedSize.connectionSite) &&
    (!Number.isFinite(selectedSize.outerDiameterFr) || entry.outerDiameterFr === selectedSize.outerDiameterFr)
  ));
  categoryInput.value = match ? match.category : '';
}

function formatPressureDropDataStatus(status) {
  if (status === 'digitized-curve-cleaned') return 'Digitized curve, cleaned';
  if (status === 'digitized-curve') return 'Digitized curve';
  return status || '—';
}

function isDigitizedPressureDropCurve(entry) {
  return String(entry?.dataStatus || '').toLowerCase().includes('digitized') && Array.isArray(entry?.points) && entry.points.length > 0;
}

function getPressureDropReferenceSourceText(entry) {
  if (isDigitizedPressureDropCurve(entry)) return 'Digitized manufacturer pressure-loss curve';
  return 'Manufacturer pressure-drop reference data';
}

function formatPressureDropFlowValue(flow) {
  if (!Number.isFinite(flow)) return '—';
  if (Math.abs(flow) < 0.005) return '0';
  return Number.isInteger(flow) ? flow.toFixed(1) : flow.toFixed(2).replace(/0$/, '');
}

function getPressureDropRangeText(validPoints, fallbackLabel = '') {
  if (fallbackLabel) return `${fallbackLabel} L/min`;
  if (!validPoints.length) return '—';
  const minFlow = validPoints[0].flow;
  const maxFlow = validPoints[validPoints.length - 1].flow;
  return `${formatPressureDropFlowValue(minFlow)}–${formatPressureDropFlowValue(maxFlow)} L/min`;
}

function getPressureDropPanelNote(entry, hasEstimate = false) {
  const baseNote = entry?.digitizationNote || 'Digitized manually from manufacturer-published pressure-loss chart; values are approximate.';
  if (!hasEstimate) return baseNote;
  return `${baseNote} Smoothed/interpolated values are approximate and may differ from direct bench testing.`;
}

function getPressureDropProductMetadataText(entry) {
  if (!entry || !Number.isFinite(entry.outerDiameterFr) || !Number.isFinite(entry.outerDiameterMm)) return '';
  const formatLengthMetadata = (label, lengthIn, lengthCm) => {
    if (Number.isFinite(lengthIn) && Number.isFinite(lengthCm)) return `${label}: ${lengthIn} in (${lengthCm} cm)`;
    if (Number.isFinite(lengthCm)) return `${label}: ${lengthCm} cm`;
    return '';
  };
  const formatLengthRangeMetadata = (label, lengthRangeIn, lengthRangeCm) => {
    if (lengthRangeIn && lengthRangeCm) return `${label}: ${lengthRangeIn} in (${lengthRangeCm} cm)`;
    if (lengthRangeCm) return `${label}: ${lengthRangeCm} cm`;
    return '';
  };
  const cannulaOrderCodeLabel = entry.cannulaOrderCodeLabel || 'Cannula order code';
  const parts = [
    `Outer diameter: ${entry.outerDiameterFr} Fr (${entry.outerDiameterMm.toFixed(1)} mm)`,
    formatLengthMetadata('Overall length', entry.overallLengthIn, entry.overallLengthCm),
    formatLengthRangeMetadata('Overall length', entry.overallLengthRangeIn, entry.overallLengthRangeCm),
    formatLengthMetadata('Tip length', entry.tipLengthIn, entry.tipLengthCm),
    entry.connectionSite ? `Connection site: ${entry.connectionSite}` : '',
    entry.connectorSize ? `Connector: ${entry.connectorSize}` : '',
    entry.cannulaOrderCode ? `${cannulaOrderCodeLabel}: ${entry.cannulaOrderCode}` : '',
    entry.cannulaKitOrderCode ? `Cannula kit order code: ${entry.cannulaKitOrderCode}` : '',
    entry.cartonQuantity ? `Carton quantity: ${entry.cartonQuantity}` : ''
  ].filter(Boolean);
  return parts.join('; ');
}

function updatePressureDropReference() {
  const manufacturerInput = el('pressure-drop-manufacturer'); const categorySelect = el('pressure-drop-category'); const familySelect = el('pressure-drop-product-family'); const modelInput = el('pressure-drop-model'); const sizeInput = el('pressure-drop-size'); const targetFlowInput = el('pressure-drop-target-flow');
  const statusMessage = el('pressure-drop-status-message'); const sourceWrap = el('pressure-drop-source'); const sourceLabel = el('pressure-drop-source-label'); const sourceUrl = el('pressure-drop-source-url'); const testMedium = el('pressure-drop-test-medium'); const dataStatus = el('pressure-drop-data-status'); const digitizationNote = el('pressure-drop-digitization-note'); const connectionSite = el('pressure-drop-connection-site'); const notes = el('pressure-drop-notes'); const productMeta = el('pressure-drop-product-meta');
  const chartWrap = el('pressure-drop-chart-wrap'); const chartNode = el('pressure-drop-chart'); const curveMeta = el('pressure-drop-curve-meta'); const selectedModel = el('pressure-drop-selected-model'); const rangeText = el('pressure-drop-range'); const interpNote = el('pressure-drop-interp-note');
  const referenceSource = el('pressure-drop-reference-source'); const estimateCard = el('pressure-drop-estimate-card'); const estimateValue = el('pressure-drop-estimate-value'); const estimateContext = el('pressure-drop-estimate-context'); const rangeWrap = el('pressure-drop-chart-range-wrap'); const rangeStatus = el('pressure-drop-range-status'); const panelDataStatusWrap = el('pressure-drop-data-status-wrap'); const panelDataStatus = el('pressure-drop-panel-data-status');
  if (!manufacturerInput || !categorySelect || !familySelect || !modelInput || !sizeInput || !targetFlowInput || !statusMessage || !sourceWrap || !sourceLabel || !sourceUrl || !testMedium || !notes || !chartWrap || !chartNode || !curveMeta || !selectedModel || !rangeText || !interpNote || !referenceSource || !estimateCard || !estimateValue || !estimateContext || !rangeWrap || !rangeStatus || !panelDataStatusWrap || !panelDataStatus) return;

  chartWrap.classList.add('hidden'); curveMeta.classList.add('hidden'); sourceWrap.classList.add('hidden'); interpNote.classList.add('hidden'); estimateCard.classList.add('hidden'); rangeWrap.classList.add('hidden'); panelDataStatusWrap.classList.add('hidden');
  referenceSource.textContent = 'Select a cannula to view pressure-drop reference data.';
  statusMessage.textContent = 'Pressure-drop data is not available for this model yet. Pressure drop cannot be estimated from Fr size alone.';
  estimateValue.textContent = '—'; estimateContext.textContent = '—'; rangeText.textContent = '—'; rangeStatus.textContent = '—'; panelDataStatus.textContent = '—';
  if (chartNode) chartNode.innerHTML = '';

  if (!manufacturerInput.value || !familySelect.value || !modelInput.value || !sizeInput.value) {
    statusMessage.textContent = 'Select a manufacturer, product family, model, and size to view available pressure-drop reference data.';
    return;
  }

  const match = findPressureDropEntry({ manufacturer: manufacturerInput.value, category: categorySelect.value, model: modelInput.value, size: sizeInput.value });
  if (!match) {
    referenceSource.textContent = 'No pressure-drop reference data for selected cannula';
    statusMessage.textContent = 'Pressure-drop data is not available for this model yet. Pressure drop cannot be estimated from Fr size alone.';
    return;
  }

  const validPoints = getValidPressureDropPoints(match.points);
  if (!validPoints.length) {
    referenceSource.textContent = 'Direct bench-data table unavailable';
    statusMessage.textContent = 'Manufacturer-specific curve data has not been added for this model yet.';
    return;
  }

  const targetFlowText = targetFlowInput.value.trim();
  const hasTargetFlow = targetFlowText !== '';
  const targetFlow = hasTargetFlow ? parseFloat(targetFlowText) : NaN;
  const result = hasTargetFlow ? interpolatePressureDrop(validPoints, targetFlow) : { state: 'invalid', value: null };
  const useLinearOnly = match.interpolationMode === 'linear';
  const curveModel = useLinearOnly ? null : createPressureDropCurveModel(validPoints);
  const chartOptions = useLinearOnly ? { curveMode: 'linear' } : {};
  const flowRangeLabel = match.referenceFlowRangeLabel || '';
  const formattedDataStatus = formatPressureDropDataStatus(match.dataStatus);
  const rangeDisplayText = getPressureDropRangeText(validPoints, flowRangeLabel);

  referenceSource.textContent = getPressureDropReferenceSourceText(match);
  panelDataStatus.textContent = formattedDataStatus;
  rangeText.textContent = rangeDisplayText;
  selectedModel.textContent = `${match.manufacturer} / ${match.model} / ${match.category} / ${match.size}${match.connectionSite ? ` / ${match.connectionSite}` : ''}`;
  interpNote.textContent = match.interpolationNote || 'Digitized from manufacturer chart; fitted/interpolated pressure drop is approximate.';
  curveMeta.classList.remove('hidden'); sourceWrap.classList.remove('hidden'); rangeWrap.classList.remove('hidden'); panelDataStatusWrap.classList.remove('hidden'); chartWrap.classList.remove('hidden'); interpNote.classList.remove('hidden');
  sourceLabel.textContent = match.sourceLabel || '—'; sourceUrl.textContent = match.sourceUrl || '—'; testMedium.textContent = `Test medium: ${match.testMedium || '—'}`; dataStatus.textContent = `Data status: ${formattedDataStatus}`; digitizationNote.textContent = `Digitization note: ${match.digitizationNote || '—'}`; if (connectionSite) connectionSite.textContent = `Connection site: ${match.connectionSite || '—'}`; notes.textContent = `Notes: ${match.notes || '—'}`;
  if (productMeta) {
    const metadataText = getPressureDropProductMetadataText(match);
    productMeta.textContent = metadataText ? `Product metadata: ${metadataText}` : '';
    productMeta.classList.toggle('hidden', !metadataText);
  }

  if (!hasTargetFlow || result.state === 'invalid') {
    rangeStatus.textContent = 'Enter target flow to check whether it falls within the digitized chart range.';
    statusMessage.textContent = getPressureDropPanelNote(match, false);
    drawPressureDropChart(chartNode, validPoints, NaN, NaN, chartOptions);
    return;
  }

  if (result.state === 'exact' || result.state === 'interpolated') {
    const estimatedPressureDrop = result.state === 'exact' ? result.value : (curveModel ? curveModel.estimate(targetFlow) : result.value);
    const markerFlow = result.state === 'exact' && Number.isFinite(result.flow) ? result.flow : targetFlow;
    estimateValue.textContent = estimatedPressureDrop.toFixed(1);
    estimateContext.textContent = `at ${targetFlow.toFixed(1)} L/min`;
    estimateCard.classList.remove('hidden');
    rangeStatus.textContent = 'Target flow within digitized chart range.';
    statusMessage.textContent = getPressureDropPanelNote(match, true);
    drawPressureDropChart(chartNode, validPoints, markerFlow, estimatedPressureDrop, chartOptions);
    return;
  }

  if (result.state === 'out_of_range') {
    rangeStatus.textContent = 'Target flow outside digitized chart range; estimate may require extrapolation.';
    statusMessage.textContent = match.outOfRangeMessage || 'Target flow is outside the manufacturer chart range. Pressure drop is not estimated.';
    drawPressureDropChart(chartNode, validPoints, NaN, NaN, chartOptions);
    return;
  }

  rangeStatus.textContent = 'Reference flow range is available in manufacturer chart data.';
  statusMessage.textContent = getPressureDropPanelNote(match, false);
  drawPressureDropChart(chartNode, validPoints, NaN, NaN, chartOptions);
}
const TUBING_PRESET_ACTIVE_CLASSES = ['border-accent-500', 'bg-accent-500/10', 'text-accent-700', 'dark:text-accent-300', 'shadow-sm'];
const TUBING_PRESET_INACTIVE_CLASSES = ['border-slate-200', 'dark:border-primary-700', 'text-slate-700', 'dark:text-slate-200'];

function setTubingPresetSelection(selectedButton = null) {
  document.querySelectorAll('[data-tubing-inch]').forEach((button) => {
    const isSelected = button === selectedButton;
    button.setAttribute('aria-pressed', String(isSelected));
    button.classList.remove(...TUBING_PRESET_ACTIVE_CLASSES, ...TUBING_PRESET_INACTIVE_CLASSES);
    button.classList.add(...(isSelected ? TUBING_PRESET_ACTIVE_CLASSES : TUBING_PRESET_INACTIVE_CLASSES));
  });
}

function resetTubingPresetConverter() {
  setTubingPresetSelection(null);
  setText('tubing-output-cm', '—');
  setText('tubing-output-mm', '—');
  setText('tubing-output-fr', '—');
}

function updateTubingPresetConverter(inchValue, selectedButton = null) {
  if (!(inchValue > 0)) return;
  setTubingPresetSelection(selectedButton);
  // Formulas:
  // mm = inch × 25.4
  // cm = mm / 10
  // Fr-equivalent = mm × 3
  const diameterMm = inchValue * 25.4;
  const diameterCm = diameterMm / 10;
  const frEquivalent = diameterMm * 3;
  setText('tubing-output-cm', `${diameterCm.toFixed(4)} cm`);
  setText('tubing-output-mm', `${diameterMm.toFixed(3)} mm`);
  setText('tubing-output-fr', `${frEquivalent.toFixed(1)} Fr ≈ ${Math.round(frEquivalent)} Fr`);
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

function calculatePreCpbHct({ ebvCoef, weightKg, preCpbHct, primeVolumeMl, additionalCrystalloidMl, ultrafiltrationRemovedMl, rbcUnits, rbcVolumePerUnitMl, rbcUnitHct }) {
  const ebvMl = (ebvCoef || 0) * (weightKg || 0);
  const patientRbcMl = ebvMl * ((preCpbHct || 0) / 100);
  const transfusedRbcVolumeMl = (rbcUnits || 0) * (rbcVolumePerUnitMl || 0);
  const transfusedRbcCellVolumeMl = transfusedRbcVolumeMl * ((rbcUnitHct || 0) / 100);
  const totalVolumeMl = ebvMl + (primeVolumeMl || 0) + (additionalCrystalloidMl || 0) + transfusedRbcVolumeMl - (ultrafiltrationRemovedMl || 0);
  const finalRbcVolumeMl = patientRbcMl + transfusedRbcCellVolumeMl;
  const resultHctPercent = totalVolumeMl > 0 ? (finalRbcVolumeMl / totalVolumeMl) * 100 : 0;
  return { ebvMl, totalVolumeMl, resultHctPercent };
}

function computePredictedHct({ pttype, weight, pre, prime, fluids = 0, removed = 0, rbcUnits = 0, rbcUnitVol = 300, rbcHct = 60, ebvCoefValue }) {
  const coef = ebvCoefValue || ebvCoef(pttype);
  const r = calculatePreCpbHct({ ebvCoef: coef, weightKg: weight || 0, preCpbHct: pre || 0, primeVolumeMl: prime || 0, additionalCrystalloidMl: fluids || 0, ultrafiltrationRemovedMl: removed || 0, rbcUnits: rbcUnits || 0, rbcVolumePerUnitMl: rbcUnitVol || 0, rbcUnitHct: rbcHct || 0 });
  return { ebv: r.ebvMl, totalVol: r.totalVolumeMl, hct: r.resultHctPercent };
}

function computeOnPumpHctAdjustment({ patientType, weightKg, ebvCoefValue, primeVolume, currentHct, useManualOverride = false, manualCurrentVolumeOverride = 0, addedCrystalloid = 0, rbcUnits = 0, rbcUnitVol = 300, rbcUnitHct = 60, ultrafiltrationRemoved = 0 }) {
  const safeEbvCoef = Number.isFinite(ebvCoefValue) && ebvCoefValue > 0 ? ebvCoefValue : ebvCoef(patientType);
  const ebv = (weightKg || 0) * safeEbvCoef;
  const estimatedCpbVolumeAuto = ebv + (primeVolume || 0);
  let estimatedCpbVolume = estimatedCpbVolumeAuto;
  if (useManualOverride && (manualCurrentVolumeOverride || 0) > 0) estimatedCpbVolume = manualCurrentVolumeOverride;
  const totalRbcProductVolume = (rbcUnits || 0) * (rbcUnitVol || 0);
  const currentRbcVolume = (estimatedCpbVolume || 0) * ((currentHct || 0) / 100);
  const addedRbcVolume = totalRbcProductVolume * ((rbcUnitHct || 0) / 100);
  const finalTotalVolume = (estimatedCpbVolume || 0) + (addedCrystalloid || 0) + totalRbcProductVolume - (ultrafiltrationRemoved || 0);
  const predictedHct = finalTotalVolume > 0 ? ((currentRbcVolume + addedRbcVolume) / finalTotalVolume) * 100 : 0;
  const hctChange = predictedHct - (currentHct || 0);
  return { ebv, estimatedCpbVolumeAuto, estimatedCpbVolume, currentRbcVolume, addedRbcVolume, finalTotalVolume, predictedHct, hctChange };
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
let hepInitialUfhOverrideTouched = false;
const HEPARIN_QUICK_PROTOCOL_ACT_LOW_COPY = 'If ACT below target: reassess sample/device/heparin delivery and follow institutional protocol';

function syncHeparinQuickProtocolCopy() {
  const steps = el('hep2-quick-steps')?.querySelectorAll('li');
  if (steps && steps.length >= 4) {
    steps[3].textContent = HEPARIN_QUICK_PROTOCOL_ACT_LOW_COPY;
  }
}

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
    bsaActual,
    bsaCapped,
  };
}

function updateHeparinUI() {
  syncHeparinQuickProtocolCopy();

  const heightInput = el('hep2-height');
  const weightInput = el('hep2-weight');
  const sex = el('hep2-sex')?.value || 'male';
  const weightStrategy = el('hep2-weight-strategy')?.value || 'auto';

  const height = parseFloat(heightInput?.value);
  const weight = parseFloat(weightInput?.value);
  const readOptionalNumber = (id) => {
    const node = el(id);
    if (!node || node.value === '') return null;
    const value = parseFloat(node.value);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const additionalUfh = readOptionalNumber('hep2-additional-ufh') ?? 0;
  const otherUfh = readOptionalNumber('hep2-other-ufh') ?? 0;
  const primeHeparin = readOptionalNumber('hep2-prime-heparin') ?? 0;
  const customUfhReference = readOptionalNumber('hep2-custom-ufh');
  const enteredInitialUfhGiven = readOptionalNumber('hep2-initial-ufh-given');
  const protamineBasis = el('hep2-protamine-basis')?.value || 'total';
  const protamineMode = el('hep2-protamine-ratio-mode')?.value || '0.8';
  const protamineCustom = readOptionalNumber('hep2-protamine-ratio-custom');
  const protamineRatio = protamineMode === 'custom' ? protamineCustom : parseFloat(protamineMode);

  const setText = (id, text) => {
    const node = el(id);
    if (node) node.textContent = text;
  };

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
    const recapEmpty = el('hep2-recap-empty');
    const recapValues = el('hep2-recap-values');
    if (recapEmpty) recapEmpty.classList.remove('hidden');
    if (recapValues) recapValues.classList.add('hidden');
    ['hep2-systemic-ufh', 'hep2-systemic-ufh-kg', 'hep2-ufh-reference-used', 'hep2-selected-basis', 'hep2-selected-ratio', 'hep2-protamine-mg', 'hep2-protamine-rounded', 'hep2-ratio-label'].forEach(id => setText(id, '-'));
    ['hep2-resistance-cue', 'hep2-protamine-ratio-warn', 'hep2-protamine-high-warn'].forEach(id => {
      const node = el(id);
      if (node) node.classList.add('hidden');
    });
    return;
  }

  const plan = computeHeparinPlan({ heightCm: height, weightKg: weight, sex, doseUnit: hepDoseUnit, weightStrategy });
  if (!plan) {
    if (results) results.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }

  setText('hep2-bmi', plan.bmi.toFixed(1));
  setText('hep2-ibw', plan.ibw.toFixed(1));
  setText('hep2-bsa', plan.bsaActual.toFixed(2));
  setText('hep2-abw', plan.abw.toFixed(1));
  setText('hep2-dosing-weight', plan.dosingWeight.toFixed(1));
  setText('hep2-dosing-note', plan.strategyLabel);

  const capBadge = el('hep2-bsa-cap');
  if (capBadge) capBadge.classList.toggle('hidden', !plan.bsaCapped);

  setText('hep2-initial-bolus', plan.initialBolus.toLocaleString());
  const initialUfhInput = el('hep2-initial-ufh-given');
  if (initialUfhInput && !hepInitialUfhOverrideTouched) {
    initialUfhInput.value = String(plan.initialBolus);
  }
  const initialUfhGiven = hepInitialUfhOverrideTouched ? (enteredInitialUfhGiven ?? plan.initialBolus) : plan.initialBolus;
  const recapEmpty = el('hep2-recap-empty');
  const recapValues = el('hep2-recap-values');
  if (recapEmpty) recapEmpty.classList.add('hidden');
  if (recapValues) recapValues.classList.remove('hidden');
  setText('hep2-recap-initial', `${plan.initialBolus.toLocaleString()} U`);
  setText('hep2-recap-weight', `${plan.dosingWeight.toFixed(1)} kg`);
  setText('hep2-recap-strategy', plan.strategyLabel);
  setText('hep2-recap-dose', `${hepDoseUnit} U/kg`);

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


  // Track systemic UFH exposure for a simple heparin resistance safety cue.
  // Formula: cumulative systemic UFH = initial patient bolus + additional systemic UFH + other systemic UFH.
  // Circuit prime heparin is intentionally excluded from this resistance cue because it may not be systemic.
  const cumulativeSystemicUfh = initialUfhGiven + additionalUfh + otherUfh;
  const cumulativeSystemicPerKg = cumulativeSystemicUfh / plan.dosingWeight;
  setText('hep2-systemic-ufh', `${Math.round(cumulativeSystemicUfh).toLocaleString()} U`);
  setText('hep2-systemic-ufh-kg', `${cumulativeSystemicPerKg.toFixed(1)} U/kg`);

  const resistanceCue = el('hep2-resistance-cue');
  if (resistanceCue) resistanceCue.classList.toggle('hidden', cumulativeSystemicPerKg < 500);

  // Protamine estimate formula: protamine mg = UFH reference amount / 100 × selected ratio.
  // The basis selector controls which UFH reference amount is used.
  const totalUfh = initialUfhGiven + additionalUfh + otherUfh + primeHeparin;
  let ufhReference = totalUfh;
  let ufhReferenceLabel = 'total UFH administered';
  if (protamineBasis === 'initial') {
    ufhReference = initialUfhGiven;
    ufhReferenceLabel = 'initial systemic UFH bolus';
  } else if (protamineBasis === 'custom') {
    ufhReference = customUfhReference;
    ufhReferenceLabel = 'custom UFH reference';
  }

  const hasUfhReference = Number.isFinite(ufhReference) && ufhReference > 0;
  const protamineValid = Number.isFinite(protamineRatio) && protamineRatio > 0;
  const protamineMg = hasUfhReference && protamineValid ? (ufhReference / 100) * protamineRatio : null;
  const protamineRounded = Number.isFinite(protamineMg) ? Math.round(protamineMg / 25) * 25 : null;
  setText('hep2-ufh-reference-used', hasUfhReference ? `${Math.round(ufhReference).toLocaleString()} U (${ufhReferenceLabel})` : '-');
  setText('hep2-selected-basis', ufhReferenceLabel);
  setText('hep2-selected-ratio', protamineValid ? `${protamineRatio.toFixed(2)} mg / 100 U heparin` : '-');
  setText('hep2-protamine-mg', Number.isFinite(protamineMg) ? `${protamineMg.toFixed(1)} mg` : '-');
  setText('hep2-protamine-rounded', Number.isFinite(protamineRounded) ? `${protamineRounded.toLocaleString()} mg` : '-');

  const ratioLabelNode = el('hep2-ratio-label');
  let ratioLabel = '-';
  if (protamineValid) {
    if (protamineRatio === 0.6) ratioLabel = '0.6 conservative';
    else if (protamineRatio === 0.8) ratioLabel = '0.8 balanced';
    else if (protamineRatio === 0.9) ratioLabel = '0.9 intermediate';
    else if (protamineRatio === 1.0) ratioLabel = '1.0 traditional';
    else ratioLabel = `${protamineRatio.toFixed(2)} custom`;
  }
  if (ratioLabelNode) ratioLabelNode.textContent = ratioLabel;
  const ratioWarn = el('hep2-protamine-ratio-warn');
  if (ratioWarn) ratioWarn.classList.toggle('hidden', !(protamineValid && protamineRatio > 1.0));
  const highWarn = el('hep2-protamine-high-warn');
  if (highWarn) highWarn.classList.toggle('hidden', !(Number.isFinite(protamineMg) && protamineMg >= 400));

  const referenceWeight = plan.dosingWeight;
  const referenceDose = Math.round(referenceWeight * 300);
  const referenceLabel = weightStrategy === 'auto' ? 'selected auto strategy' : plan.strategyLabel;
  const sensAbwDose = Math.round(plan.abw * 300);
  const sensTbwDose = Math.round(plan.tbw * 300);
  const sensIbwDose = Math.round(plan.ibw * 300);
  setText('hep2-sens-abw-wt', `${plan.abw.toFixed(1)} kg`);
  setText('hep2-sens-abw-dose', `${sensAbwDose.toLocaleString()} U (${(sensAbwDose - referenceDose >= 0 ? '+' : '')}${(sensAbwDose - referenceDose).toLocaleString()} vs ${referenceLabel})`);
  setText('hep2-sens-tbw-wt', `${plan.tbw.toFixed(1)} kg`);
  setText('hep2-sens-tbw-dose', `${sensTbwDose.toLocaleString()} U (${(sensTbwDose - referenceDose >= 0 ? '+' : '')}${(sensTbwDose - referenceDose).toLocaleString()} vs ${referenceLabel})`);
  setText('hep2-sens-ibw-wt', `${plan.ibw.toFixed(1)} kg`);
  setText('hep2-sens-ibw-dose', `${sensIbwDose.toLocaleString()} U (${(sensIbwDose - referenceDose >= 0 ? '+' : '')}${(sensIbwDose - referenceDose).toLocaleString()} vs ${referenceLabel})`);

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

  const toggleTargetCustom = () => {
    const wrap = el('hep2-target-act-custom-wrap');
    if (wrap) wrap.classList.toggle('hidden', (el('hep2-target-act-mode')?.value || '') !== 'custom');
  };
  const toggleProtamineCustom = () => {
    const wrap = el('hep2-protamine-ratio-custom-wrap');
    if (wrap) wrap.classList.toggle('hidden', (el('hep2-protamine-ratio-mode')?.value || '') !== 'custom');
  };
  const updateProtamineBasisUi = () => {
    const basis = el('hep2-protamine-basis')?.value || 'total';
    const customWrap = el('hep2-custom-ufh-wrap');
    const help = el('hep2-protamine-basis-help');
    if (customWrap) customWrap.classList.toggle('hidden', basis !== 'custom');
    if (help) {
      if (basis === 'initial') {
        help.textContent = 'Uses the first systemic UFH bolus as the reference amount. This may reduce protamine exposure, but does not account for later additional UFH or measured residual heparin.';
      } else if (basis === 'custom') {
        help.textContent = 'Use when local protocol, heparin concentration monitoring, Hepcon/HMS, anti-Xa, or clinical assessment provides a preferred UFH reference amount.';
      } else {
        help.textContent = 'Uses total entered UFH exposure as the protamine reference. Simple and common, but may overestimate reversal needs when CPB duration is long.';
      }
    }
  };
  ['hep2-target-act-mode', 'hep2-protamine-ratio-mode', 'hep2-protamine-basis'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('change', () => { toggleTargetCustom(); toggleProtamineCustom(); updateProtamineBasisUi(); updateHeparinUI(); });
  });
  const initialUfhGivenInput = el('hep2-initial-ufh-given');
  if (initialUfhGivenInput) {
    initialUfhGivenInput.addEventListener('input', () => {
      hepInitialUfhOverrideTouched = initialUfhGivenInput.value !== '';
      updateHeparinUI();
    });
  }
  ['hep2-target-act-custom', 'hep2-additional-ufh', 'hep2-other-ufh', 'hep2-prime-heparin', 'hep2-custom-ufh', 'hep2-protamine-ratio-custom'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('input', updateHeparinUI);
  });
  toggleTargetCustom();
  toggleProtamineCustom();
  updateProtamineBasisUi();

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
  const mode = el('hct_mode')?.value || 'pre';
  const isOnPumpMode = mode === 'onpump';
  const preModeEl = el('hct-pre-mode');
  const onPumpModeEl = el('hct-onpump-mode');
  const leftLabelEl = el('hct-left-label');
  const onPumpExtraResultsEl = el('onpump-extra-results');
  const rightLabelEl = el('hct-right-label');
  if (preModeEl) preModeEl.classList.toggle('hidden', isOnPumpMode);
  if (onPumpModeEl) onPumpModeEl.classList.toggle('hidden', !isOnPumpMode);
  if (onPumpExtraResultsEl) onPumpExtraResultsEl.classList.toggle('hidden', !isOnPumpMode);
  const modeHelpEl = el('hct-mode-help');
  if (modeHelpEl) {
    modeHelpEl.textContent = isOnPumpMode
      ? 'Estimate hematocrit change from fluid addition, RBC transfusion, and ultrafiltration.'
      : 'Estimate dilutional hematocrit at CPB initiation.';
  }

  if (isOnPumpMode) {
    const r = computeOnPumpHctAdjustment({
      weightKg: num('onpump_weight'),
      ebvCoefValue: num('onpump_ebv_coef'),
      primeVolume: num('onpump_prime'),
      currentHct: num('current_hct'),
      useManualOverride: !!el('use_manual_current_volume')?.checked,
      manualCurrentVolumeOverride: num('manual_current_volume'),
      addedCrystalloid: num('onpump_fluids'),
      rbcUnits: num('onpump_rbc_units'),
      rbcUnitVol: num('onpump_rbc_unit_vol'),
      rbcUnitHct: num('onpump_rbc_hct'),
      ultrafiltrationRemoved: num('onpump_removed')
    });
    if (leftLabelEl) leftLabelEl.textContent = 'Current Vol';
    setText('ebv', r.finalTotalVolume ? r.finalTotalVolume.toFixed(0) : '0');
    setText('total_vol', r.finalTotalVolume ? r.finalTotalVolume.toFixed(0) : '0');
    setText('pred_hct', r.predictedHct ? r.predictedHct.toFixed(1) + '%' : '0%');
    setText('current_rbc_vol', `${r.currentRbcVolume.toFixed(0)} mL`);
    setText('added_rbc_vol', `${r.addedRbcVolume.toFixed(0)} mL`);
    setText('onpump_ebv', `${r.ebv.toFixed(0)} mL`);
    setText('onpump_estimated_volume', `${r.estimatedCpbVolume.toFixed(0)} mL`);
    setText('onpump_ebv_auto', `${r.ebv.toFixed(0)} mL`);
    setText('onpump_estimated_auto', `${r.estimatedCpbVolumeAuto.toFixed(0)} mL`);
    const manualWrapEl = el('manual-current-volume-wrap');
    const manualEnabled = !!el('use_manual_current_volume')?.checked;
    if (manualWrapEl) manualWrapEl.classList.toggle('hidden', !manualEnabled);
    const manualActiveNoteEl = el('manual-override-active-note');
    if (manualActiveNoteEl) manualActiveNoteEl.classList.toggle('hidden', !(manualEnabled && num('manual_current_volume') > 0));
    setText('current_hct_result', `${(num('current_hct') || 0).toFixed(1)}%`);
    setText('pred_hct_result', `${r.predictedHct.toFixed(1)}%`);
    setText('hct_change', `${r.hctChange >= 0 ? '+' : ''}${r.hctChange.toFixed(1)}`);
    return;
  }

  const pttype = el('pttype').value;
  const payload = {
    pttype,
    weight: num('wt_hct'),
    pre: num('pre_hct'),
    prime: num('prime'),
    fluids: 0,
    removed: 0,
    rbcUnits: num('rbc_units'),
    rbcUnitVol: num('rbc_unit_vol'),
    rbcHct: num('rbc_hct'),
    ebvCoefValue: num('ebv_coef')
  };
  const r = computePredictedHct(payload);
  if (leftLabelEl) leftLabelEl.textContent = 'EBV';
  if (rightLabelEl) rightLabelEl.textContent = 'Total Vol';
  setText('ebv', r.ebv ? r.ebv.toFixed(0) : '0');
  setText('total_vol', r.totalVol ? r.totalVol.toFixed(0) : '0');
  setText('pred_hct', r.hct ? r.hct.toFixed(1) + '%' : '0%');
}

function setHctMode(mode) {
  const modeInput = el('hct_mode');
  if (!modeInput) return;
  const nextMode = mode === 'onpump' ? 'onpump' : 'pre';
  modeInput.value = nextMode;
  const isPre = nextMode === 'pre';
  const preBtn = el('hct-mode-pre');
  const onPumpBtn = el('hct-mode-onpump');
  if (preBtn) {
    preBtn.setAttribute('aria-pressed', String(isPre));
    preBtn.setAttribute('aria-selected', String(isPre));
    preBtn.classList.toggle('bg-primary-900', isPre);
    preBtn.classList.toggle('text-white', isPre);
    preBtn.classList.toggle('dark:bg-accent-500', isPre);
    preBtn.classList.toggle('bg-white', !isPre);
    preBtn.classList.toggle('text-slate-700', !isPre);
    preBtn.classList.toggle('dark:bg-primary-800', !isPre);
    preBtn.classList.toggle('dark:text-slate-200', !isPre);
    preBtn.classList.toggle('border', !isPre);
  }
  if (onPumpBtn) {
    onPumpBtn.setAttribute('aria-pressed', String(!isPre));
    onPumpBtn.setAttribute('aria-selected', String(!isPre));
    onPumpBtn.classList.toggle('bg-primary-900', !isPre);
    onPumpBtn.classList.toggle('text-white', !isPre);
    onPumpBtn.classList.toggle('dark:bg-accent-500', !isPre);
    onPumpBtn.classList.toggle('bg-white', isPre);
    onPumpBtn.classList.toggle('text-slate-700', isPre);
    onPumpBtn.classList.toggle('dark:bg-primary-800', isPre);
    onPumpBtn.classList.toggle('dark:text-slate-200', isPre);
    onPumpBtn.classList.toggle('border', isPre);
  }
  updateHct();
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

  if (path.includes('phn-echo') || path.includes('z-score')) { showSection('view-phn-echo'); key = 'phn-echo'; }
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

  const hasHomeView = Boolean(document.getElementById('view-home'));
  if (hasHomeView) {
    document.querySelectorAll('.nav-link, .sidebar-link').forEach(l => {
      l.classList.remove('bg-primary-800', 'text-accent-400', 'bg-slate-100', 'text-primary-900', 'text-accent-600', 'border', 'border-slate-200', 'border-primary-900', 'dark:border-primary-700', 'bg-primary-700', 'dark:bg-primary-800', 'dark:text-accent-400');
    });
    document.querySelectorAll('[id^="mob-"]').forEach(l => {
      l.classList.remove('text-accent-600', 'dark:text-accent-400');
      l.classList.add('text-slate-400', 'dark:text-slate-500');
    });

    updateMetaForRoute(path || '/');

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
          '/z-score/',
          '/quick-reference/',
          '/priming-volume/',
          '/unit-converter/',
          '/bsa',
          '/gdp',
          '/heparin',
          '/predicted-hct',
          '/lbm',
          '/timecalc',
          '/z-score',
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
    ['wt_hct', 'pre_hct', 'prime', 'rbc_units', 'rbc_unit_vol', 'rbc_hct', 'ebv_coef'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('input', updateHct);
    });
    ['hct_mode', 'onpump_weight', 'onpump_ebv_coef', 'onpump_prime', 'current_hct', 'manual_current_volume', 'use_manual_current_volume', 'onpump_fluids', 'onpump_rbc_units', 'onpump_rbc_unit_vol', 'onpump_rbc_hct', 'onpump_removed', 'onpump_pttype'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('input', updateHct);
      if (x) x.addEventListener('change', updateHct);
    });
    const modeButtons = Array.from(document.querySelectorAll('[data-hct-mode]'));
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => setHctMode(btn.dataset.hctMode));
      btn.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const idx = modeButtons.indexOf(btn);
        const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % modeButtons.length : (idx - 1 + modeButtons.length) % modeButtons.length;
        modeButtons[nextIdx].focus();
        setHctMode(modeButtons[nextIdx].dataset.hctMode);
      });
    });
    setHctMode(el('hct_mode')?.value || 'pre');
    const onPumpPttypeSelect = el('onpump_pttype');
    if (onPumpPttypeSelect) {
      onPumpPttypeSelect.addEventListener('change', () => {
        const onPumpCoefInput = el('onpump_ebv_coef');
        if (onPumpCoefInput) onPumpCoefInput.value = ebvCoef(onPumpPttypeSelect.value);
        updateHct();
      });
      const onPumpCoefInput = el('onpump_ebv_coef');
      if (onPumpCoefInput && !onPumpCoefInput.value) onPumpCoefInput.value = ebvCoef(onPumpPttypeSelect.value);
    }

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
    ['cannula-size-type', 'cannula-gauge-value'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('change', () => {
        if (id === 'cannula-size-type') updateCannulaInputMode();
        updateCannulaConverter();
    renderAvailableCurveDatasets();
    syncPressureDropSelectors('manufacturer');
    updatePressureDropReference();
      });
    });
    const cannulaFrMmInput = el('cannula-fr-mm-value');
    if (cannulaFrMmInput) cannulaFrMmInput.addEventListener('input', updateCannulaConverter);
    document.querySelectorAll('[data-tubing-inch]').forEach((button) => {
      button.addEventListener('click', () => {
        const inchValue = Number(button.dataset.tubingInch);
        updateTubingPresetConverter(inchValue, button);
      });
    });

    ['pressure-drop-manufacturer', 'pressure-drop-product-family', 'pressure-drop-model', 'pressure-drop-size', 'pressure-drop-target-flow'].forEach(id => {
      const x = el(id);
      if (!x) return;
      const eventName = x.tagName === 'SELECT' ? 'change' : 'input';
      x.addEventListener(eventName, () => {
        if (id === 'pressure-drop-manufacturer') syncPressureDropSelectors('manufacturer');
        else if (id === 'pressure-drop-product-family') syncPressureDropSelectors('family');
        else if (id === 'pressure-drop-model') syncPressureDropSelectors('model');
        else if (id === 'pressure-drop-size') syncPressureDropSelectors('size');
        updatePressureDropReference();
      });
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
    updateCannulaInputMode();
    updateCannulaConverter();
    resetTubingPresetConverter();
    setUnitConverterTab('flow');
  }
});
