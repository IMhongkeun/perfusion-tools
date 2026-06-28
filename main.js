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
  { path: '/cannula-pressure-drop/', label: 'Cannula Pressure Drop' },
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

  const renderTopNavItem = (item) => {
    const baseLinkClasses = 'nav-link px-4 py-2 rounded-full border transition-colors';
    const getLinkMarkup = (linkItem, compact = false) => {
      const normalizedItemPath = linkItem.path.length > 1 && linkItem.path.endsWith('/')
        ? linkItem.path.slice(0, -1)
        : linkItem.path;
      const isActive = currentPath === normalizedItemPath;
      const activeClasses = isActive
        ? 'bg-slate-100 text-accent-600 dark:bg-primary-800 dark:text-accent-400 border-slate-200 dark:border-primary-700'
        : 'border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-primary-800 hover:border-slate-200 dark:hover:border-primary-700 hover:text-primary-900 dark:hover:text-accent-400';
      const padding = compact ? 'px-3 py-2' : 'px-4 py-2';
      return `<a href="${linkItem.path}" class="${baseLinkClasses} ${padding} ${activeClasses}">${linkItem.label}</a>`;
    };

    if (Array.isArray(item.items)) {
      const childLinks = item.items.map(child => getLinkMarkup(child, true)).join('');
      return `<span class="hidden lg:inline-flex items-center pl-2 pr-1 text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500">${item.label}</span>${childLinks}`;
    }

    return getLinkMarkup(item);
  };

  nav.innerHTML = TOP_NAV_ITEMS.map(renderTopNavItem).join('');

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

function updateBsaFlowList(bsaVal, weightKg) {
  const list = el('bsa-flow-list');
  if (!list) return;

  list.innerHTML = '';
  if (!(Number.isFinite(bsaVal) && bsaVal > 0)) {
    list.innerHTML = '<p class="text-xs text-slate-500 dark:text-slate-400">Enter height and weight to populate the flow table.</p>';
    return;
  }

  const hasValidWeight = Number.isFinite(weightKg) && weightKg > 0;
  const header = document.createElement('div');
  header.className = 'hidden sm:grid sm:grid-cols-[0.75fr_1fr_1.3fr] items-center px-2 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 gap-3 border-b border-slate-100 dark:border-primary-800';
  header.innerHTML = '<span>CI</span><span class="text-right">flow</span><span class="text-right">ml/kg/min</span>';
  list.appendChild(header);

  for (let ciTenths = 10; ciTenths <= 30; ciTenths += 2) {
    const ci = ciTenths / 10;
    // BSA-indexed flow: flowLpm = BSA(m²) × cardiac index (L/min/m²).
    const flowLpm = ci * bsaVal;
    // Weight-indexed equivalent: mL/kg/min = (flowLpm × 1000) ÷ weight(kg).
    const mlKgMin = hasValidWeight ? Math.round((flowLpm * 1000) / weightKg) : null;
    const desktopEquivalentText = mlKgMin === null ? '—' : `${mlKgMin} <span class="font-medium opacity-75">mL/kg/min</span>`;
    const mobileEquivalentText = mlKgMin === null ? '— mL/kg/min' : `≈ ${mlKgMin} mL/kg/min`;
    const row = document.createElement('div');
    const highlight = Math.abs(ci - 2.4) < 0.05;
    row.className = 'grid grid-cols-[1fr_auto] sm:grid-cols-[0.75fr_1fr_1.3fr] items-center min-h-[3.25rem] sm:min-h-0 py-2 sm:py-1.5 px-2 text-sm border-b border-slate-100 dark:border-primary-800 last:border-0 gap-x-3 gap-y-1' + (highlight ? ' bg-amber-50 dark:bg-amber-900/20' : '');
    const ciClass = `${bsaFlowNumericClass} ${highlight ? 'text-amber-700 dark:text-amber-200' : 'text-slate-500 dark:text-slate-400'}`;
    const flowClass = `${bsaFlowNumericClass} text-right ${highlight ? 'text-amber-800 dark:text-amber-100' : 'text-primary-900 dark:text-white'}`;
    const equivalentClass = `${bsaFlowNumericClass} col-span-2 sm:col-span-1 text-[11px] sm:text-xs text-left sm:text-right ${highlight ? 'text-amber-700 dark:text-amber-200' : 'text-slate-500 dark:text-slate-400'}`;
    row.innerHTML = `<span class="${ciClass}">CI ${ci.toFixed(1)}</span><span class="${flowClass}">${flowLpm.toFixed(2)} L/min</span><span class="${equivalentClass}"><span class="sm:hidden">${mobileEquivalentText}</span><span class="hidden sm:inline">${desktopEquivalentText}</span></span>`;
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

  updateBsaFlowList(v, w);
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
const CANNULA_PRESSURE_DROP_DATA_URL = '/data/cannula-pressure-drop.json';
let cannulaPressureDropDataPromise = null;

async function loadCannulaPressureDropData() {
  if (cannulaPressureDropDataPromise) return cannulaPressureDropDataPromise;

  cannulaPressureDropDataPromise = fetch(CANNULA_PRESSURE_DROP_DATA_URL, { cache: 'default' })
    .then(response => {
      if (!response.ok) throw new Error(`Unable to load cannula pressure-drop data (${response.status})`);
      return response.json();
    })
    .then(payload => {
      if (!payload || !Array.isArray(payload.items)) {
        throw new Error('Invalid cannula pressure-drop data format');
      }
      return payload.items;
    })
    .catch(error => {
      cannulaPressureDropDataPromise = null;
      throw error;
    });

  return cannulaPressureDropDataPromise;
}


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
  const connectorSize = entry.connectorSize || '';
  const cannulaOrderCode = entry.cannulaOrderCode || '';
  const outerDiameterFr = Number.isFinite(entry.outerDiameterFr) ? entry.outerDiameterFr : '';
  return `${entry.size || ''}||${connectionSite}||${connectorSize}||${cannulaOrderCode}||${outerDiameterFr}`;
}

function parsePressureDropSizeOptionValue(value) {
  const [size = '', connectionSite = '', connectorSize = '', cannulaOrderCode = '', outerDiameterFr = ''] = String(value || '').split('||');
  return { size, connectionSite, connectorSize, cannulaOrderCode, outerDiameterFr: parseFloat(outerDiameterFr) };
}

function findPressureDropEntry({ manufacturer, category, model, size }, entries = []) {
  const selectedSize = parsePressureDropSizeOptionValue(size);
  const normalizedManufacturer = normalizePressureDropKey(manufacturer);
  const normalizedCategory = normalizePressureDropKey(category);
  const normalizedModel = normalizePressureDropKey(model);
  const normalizedSize = normalizePressureDropKey(selectedSize.size);
  const normalizedConnectionSite = normalizePressureDropKey(selectedSize.connectionSite);
  const selectedOuterDiameterFr = selectedSize.outerDiameterFr;

  if (!normalizedManufacturer || !normalizedCategory || !normalizedModel || !normalizedSize) return null;

  return entries.find(entry => (
    normalizePressureDropKey(entry.manufacturer) === normalizedManufacturer &&
    normalizePressureDropKey(entry.category) === normalizedCategory &&
    normalizePressureDropKey(entry.model) === normalizedModel &&
    normalizePressureDropKey(entry.size) === normalizedSize &&
    (!normalizedConnectionSite || normalizePressureDropKey(entry.connectionSite) === normalizedConnectionSite) &&
    (!selectedSize.connectorSize || normalizePressureDropKey(entry.connectorSize) === normalizePressureDropKey(selectedSize.connectorSize)) &&
    (!selectedSize.cannulaOrderCode || normalizePressureDropKey(entry.cannulaOrderCode) === normalizePressureDropKey(selectedSize.cannulaOrderCode)) &&
    (!Number.isFinite(selectedOuterDiameterFr) || entry.outerDiameterFr === selectedOuterDiameterFr)
  )) || null;
}

const PRESSURE_DROP_EXACT_FLOW_TOLERANCE = 1e-6;

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
      // Linear interpolation between adjacent manufacturer curve points:
      // estimatedPressureDrop = y1 + ((flow - x1) / (x2 - x1)) * (y2 - y1).
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

function buildPressureDropAxisTicks(minValue, maxValue, tickCount = 4) {
  const safeMin = Number.isFinite(minValue) ? minValue : 0;
  const safeMax = Number.isFinite(maxValue) ? maxValue : safeMin;
  const count = Math.max(Math.floor(tickCount), 2);
  if (Math.abs(safeMax - safeMin) < Number.EPSILON) return [safeMin];
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return safeMin + ((safeMax - safeMin) * ratio);
  }).filter(Number.isFinite);
}

function formatPressureDropAxisTick(value, range = 0) {
  if (!Number.isFinite(value)) return '';
  const absRange = Math.abs(range);
  const decimals = absRange > 0 && absRange < 1 ? 2 : (absRange > 0 && absRange < 10 ? 1 : 0);
  return value.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function drawPressureDropChart(svgNode, points, targetFlow, estimatedPressureDrop, options = {}) {
  const validPoints = getValidPressureDropPoints(points);
  if (!svgNode || !validPoints.length) return;
  const width = 420; const height = 200;
  const padding = { left: 58, right: 18, top: 18, bottom: 42 };
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
  const plotRight = width - padding.right;
  const plotBottom = height - padding.bottom;
  const plotMiddleY = padding.top + ((plotBottom - padding.top) / 2);
  const xTicks = buildPressureDropAxisTicks(minFlow, maxFlow, 4);
  const yTicks = buildPressureDropAxisTicks(0, maxDrop, 4);
  const xTickLabels = xTicks.map(flow => {
    const rawX = scaleX(flow);
    const labelX = Math.min(Math.max(rawX, padding.left + 7), plotRight - 7);
    return `<text x="${labelX.toFixed(1)}" y="${(plotBottom + 12).toFixed(1)}" font-size="8" text-anchor="middle" fill="currentColor" opacity="0.65">${formatPressureDropAxisTick(flow, maxFlow - minFlow)}</text>`;
  }).join('');
  const yTickLabels = yTicks.map(drop => `<text x="${(padding.left - 6).toFixed(1)}" y="${scaleY(drop).toFixed(1)}" font-size="8" text-anchor="end" dominant-baseline="middle" fill="currentColor" opacity="0.65">${formatPressureDropAxisTick(drop, maxDrop)}</text>`).join('');
  const xGridlines = xTicks.map(flow => {
    const x = scaleX(flow);
    return `<line x1="${x.toFixed(1)}" y1="${padding.top}" x2="${x.toFixed(1)}" y2="${plotBottom}" stroke="currentColor" stroke-opacity="0.10" stroke-width="0.75" />`;
  }).join('');
  const yGridlines = yTicks.map(drop => {
    const y = scaleY(drop);
    return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${plotRight}" y2="${y.toFixed(1)}" stroke="currentColor" stroke-opacity="0.10" stroke-width="0.75" />`;
  }).join('');
  const targetX = Number.isFinite(targetFlow) ? scaleX(targetFlow) : null;
  const targetY = Number.isFinite(estimatedPressureDrop) ? scaleY(estimatedPressureDrop) : null;
  const showTargetMarker = Number.isFinite(targetX) && Number.isFinite(targetY);
  const targetLabelWidth = 174;
  const targetLabelX = showTargetMarker ? Math.min(Math.max(targetX + 7, padding.left + 4), width - targetLabelWidth - 4) : null;
  const targetLabelY = showTargetMarker ? Math.max(targetY - 33, padding.top + 3) : null;
  const targetMarker = showTargetMarker
    ? `<g><line x1="${targetX.toFixed(1)}" y1="${padding.top}" x2="${targetX.toFixed(1)}" y2="${height - padding.bottom}" stroke="#f59e0b" stroke-dasharray="3 3" /><circle cx="${targetX.toFixed(1)}" cy="${targetY.toFixed(1)}" r="4" fill="#f59e0b" stroke="#ffffff" stroke-width="1.5" /><rect x="${targetLabelX.toFixed(1)}" y="${targetLabelY.toFixed(1)}" width="${targetLabelWidth}" height="28" rx="4" fill="#0f172a" opacity="0.88" /><text x="${(targetLabelX + 5).toFixed(1)}" y="${(targetLabelY + 11).toFixed(1)}" font-size="8" fill="#ffffff">Target flow: ${targetFlow.toFixed(1)} L/min</text><text x="${(targetLabelX + 5).toFixed(1)}" y="${(targetLabelY + 22).toFixed(1)}" font-size="8" fill="#ffffff">Est. pressure drop: ${estimatedPressureDrop.toFixed(1)} mmHg</text></g>`
    : '';
  svgNode.innerHTML = `${xGridlines}${yGridlines}<line x1="${padding.left}" y1="${plotBottom}" x2="${plotRight}" y2="${plotBottom}" stroke="currentColor" stroke-opacity="0.35" /><line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${plotBottom}" stroke="currentColor" stroke-opacity="0.35" /><path d="${smoothCurvePath}" fill="none" stroke="#0ea5e9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />${validPoints.map(p => `<circle cx="${scaleX(p.flow).toFixed(1)}" cy="${scaleY(p.pressureDrop).toFixed(1)}" r="2.2" fill="#ffffff" stroke="#0ea5e9" stroke-width="1.4" />`).join('')}${targetMarker}${xTickLabels}${yTickLabels}<text x="${plotRight}" y="${height - 8}" font-size="9" text-anchor="end" fill="currentColor" opacity="0.65">Flow [L/min]</text><text x="14" y="${plotMiddleY.toFixed(1)}" transform="rotate(-90 14 ${plotMiddleY.toFixed(1)})" font-size="9" text-anchor="middle" fill="currentColor" opacity="0.65">Pressure drop [mmHg]</text>`;
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


function renderAvailableCurveDatasets(entries = []) {
  const wrap = el('pressure-drop-available-list');
  if (!wrap) return;
  const curveEntries = entries.filter(entry => Array.isArray(entry.points) && entry.points.length > 0);
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

function syncPressureDropSelectors(changedLevel = 'manufacturer', entries = []) {
  const manufacturerSelect = el('pressure-drop-manufacturer');
  const familySelect = el('pressure-drop-product-family');
  const categoryInput = el('pressure-drop-category');
  const modelSelect = el('pressure-drop-model');
  const sizeSelect = el('pressure-drop-size');
  if (!manufacturerSelect || !familySelect || !categoryInput || !modelSelect || !sizeSelect) return;

  const byManufacturer = entries.filter(entry => !manufacturerSelect.value || entry.manufacturer === manufacturerSelect.value);
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
      const connectorLabel = entry.connectorSize ? ` — ${entry.connectorSize}` : '';
      const orderCodeLabel = entry.cannulaOrderCode ? ` — ${entry.cannulaOrderCode}` : '';
      const dataLabel = (entry.points || []).length ? 'curve available' : 'metadata only';
      return { value: getPressureDropSizeOptionValue(entry), label: `${entry.size}${connectionLabel}${connectorLabel}${orderCodeLabel} — ${dataLabel}` };
    }), 'Select size');
    categoryInput.value='';
    if (sizeSelect.options.length === 2) { sizeSelect.value = sizeSelect.options[1].value; syncPressureDropSelectors('size'); }
    return;
  }
  const selectedSize = parsePressureDropSizeOptionValue(sizeSelect.value);
  const match = byModel.find(entry => (
    entry.size === selectedSize.size &&
    (!selectedSize.connectionSite || entry.connectionSite === selectedSize.connectionSite) &&
    (!selectedSize.connectorSize || entry.connectorSize === selectedSize.connectorSize) &&
    (!selectedSize.cannulaOrderCode || entry.cannulaOrderCode === selectedSize.cannulaOrderCode) &&
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
let hepBsaMethod = 'DuBois';
let hepInitialUfhOverrideTouched = false;
const HEPARIN_BSA_METHOD_LABELS = {
  Mosteller: 'Mosteller',
  DuBois: 'Du Bois'
};
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

function computeHeparinPlan({ heightCm, weightKg, sex, doseUnit, weightStrategy, bsaMethod = 'DuBois' }) {
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

  // Adult CPB BSA formula selection uses the shared calculator formulas:
  // Mosteller = sqrt(H × W / 3600), DuBois = 0.007184 × H^0.725 × W^0.425.
  const bsaActual = computeBSA(heightCm, weightKg, bsaMethod);
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

function updateHeparinResistanceChecklist() {
  const items = Array.from(document.querySelectorAll('.hep2-resistance-check'));
  if (!items.length) return;

  let score = 0;
  let forceHighCue = false;
  items.forEach((item) => {
    if (!item.checked) return;
    score += Number.parseInt(item.dataset.points || '0', 10) || 0;
    if (item.dataset.forceHigh === 'true') forceHighCue = true;
  });

  let level = 'low';
  let label = 'Low cue';
  let message = 'Low heparin resistance cue. Continue institutional ACT/heparin monitoring.';
  let style = 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30';

  if (forceHighCue || score >= 6) {
    level = 'high';
    label = 'High cue';
    message = 'High heparin resistance cue. If ACT remains below target despite high UFH exposure, consider heparin resistance evaluation, AT activity, heparin concentration/anti-Xa if available, AT concentrate or plasma per institutional protocol, and team discussion.';
    style = 'bg-red-50 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-200 dark:border-red-500/30';
  } else if (score >= 3) {
    level = 'moderate';
    label = 'Moderate cue';
    message = 'Moderate heparin resistance cue. Recheck ACT, confirm heparin delivery, sample quality, and ACT device validity. Consider AT activity or heparin concentration if available.';
    style = 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:border-amber-500/30';
  }

  const output = el('hep2-resistance-check-output');
  if (output) {
    output.dataset.level = level;
    output.className = `rounded-xl border px-3 py-2 text-sm ${style}`;
  }
  const scoreLabel = score === 1 ? '1 point' : `${score} points`;
  const setText = (id, value) => {
    const node = el(id);
    if (node) node.textContent = value;
  };
  setText('hep2-resistance-check-label', label);
  setText('hep2-resistance-check-score', scoreLabel);
  setText('hep2-resistance-check-message', message);
}

function updateHeparinUI() {
  syncHeparinQuickProtocolCopy();
  updateHeparinResistanceChecklist();

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
  const sensitivity = el('hep2-sensitivity');

  if (!(heightValid && weightValid)) {
    if (results) results.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (sensitivity) sensitivity.classList.add('hidden');
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

  const selectedBsaMethod = HEPARIN_BSA_METHOD_LABELS[hepBsaMethod] ? hepBsaMethod : 'DuBois';
  const plan = computeHeparinPlan({ heightCm: height, weightKg: weight, sex, doseUnit: hepDoseUnit, weightStrategy, bsaMethod: selectedBsaMethod });
  if (!plan) {
    if (results) results.classList.add('hidden');
    if (placeholder) placeholder.classList.remove('hidden');
    if (sensitivity) sensitivity.classList.add('hidden');
    return;
  }

  const bsaMethodLabel = HEPARIN_BSA_METHOD_LABELS[selectedBsaMethod];
  setText('hep2-bsa-method-current', `(${bsaMethodLabel})`);
  document.querySelectorAll('[data-hep-bsa-method]').forEach((option) => {
    const isSelected = option.dataset.hepBsaMethod === selectedBsaMethod;
    option.setAttribute('aria-selected', String(isSelected));
    option.classList.toggle('bg-accent-500/10', isSelected);
    option.classList.toggle('text-accent-600', isSelected);
    option.classList.toggle('dark:text-accent-400', isSelected);
  });
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
  // Formula: cumulative systemic UFH = initial patient bolus + additional systemic UFH during CPB.
  // Circuit prime heparin is intentionally excluded from this resistance cue because it may not be systemic.
  const cumulativeSystemicUfh = initialUfhGiven + additionalUfh;
  const cumulativeSystemicPerKg = cumulativeSystemicUfh / plan.dosingWeight;
  setText('hep2-systemic-ufh', `${Math.round(cumulativeSystemicUfh).toLocaleString()} U`);
  setText('hep2-systemic-ufh-kg', `${cumulativeSystemicPerKg.toFixed(1)} U/kg`);

  const resistanceCue = el('hep2-resistance-cue');
  if (resistanceCue) resistanceCue.classList.toggle('hidden', cumulativeSystemicPerKg < 500);

  // Protamine estimate formula: protamine mg = UFH reference amount / 100 × selected ratio.
  // The basis selector controls which UFH reference amount is used.
  const totalUfh = initialUfhGiven + additionalUfh + primeHeparin;
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
  const selectedDoseUnit = hepDoseUnit;
  const referenceDose = Math.round(referenceWeight * selectedDoseUnit);
  const referenceLabel = weightStrategy === 'auto' ? 'selected auto strategy' : plan.strategyLabel;
  const sensAbwWeight = plan.bmi >= 40 ? plan.abwSuper : plan.abw;
  const sensAbwDose = Math.round(sensAbwWeight * selectedDoseUnit);
  setText('hep2-sens-abw-label', plan.bmi >= 40 ? 'ABW (0.3)' : 'ABW (0.4)');
  const sensTbwDose = Math.round(plan.tbw * selectedDoseUnit);
  const sensIbwDose = Math.round(plan.ibw * selectedDoseUnit);
  setText('hep2-sens-abw-wt', `${sensAbwWeight.toFixed(1)} kg`);
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

  if (sensitivity) sensitivity.classList.remove('hidden');
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

  const bsaMethodToggle = el('hep2-bsa-method-toggle');
  const bsaMethodMenu = el('hep2-bsa-method-menu');
  if (bsaMethodToggle && bsaMethodMenu) {
    const closeBsaMethodMenu = () => {
      bsaMethodMenu.classList.add('hidden');
      bsaMethodToggle.setAttribute('aria-expanded', 'false');
    };

    bsaMethodToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = !bsaMethodMenu.classList.contains('hidden');
      bsaMethodMenu.classList.toggle('hidden', isOpen);
      bsaMethodToggle.setAttribute('aria-expanded', String(!isOpen));
    });

    bsaMethodMenu.querySelectorAll('[data-hep-bsa-method]').forEach((option) => {
      option.addEventListener('click', () => {
        const nextMethod = option.dataset.hepBsaMethod;
        if (HEPARIN_BSA_METHOD_LABELS[nextMethod]) {
          hepBsaMethod = nextMethod;
          updateHeparinUI();
        }
        closeBsaMethodMenu();
      });
    });

    document.addEventListener('click', closeBsaMethodMenu);
  }

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

  document.querySelectorAll('.hep2-resistance-check').forEach((node) => {
    node.addEventListener('change', updateHeparinResistanceChecklist);
  });
  updateHeparinResistanceChecklist();

  ['hep2-height', 'hep2-weight', 'hep2-sex', 'hep2-weight-strategy'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('input', updateHeparinUI);
    if (node && node.tagName === 'SELECT') node.addEventListener('change', updateHeparinUI);
    if (node && node.type === 'checkbox') node.addEventListener('change', updateHeparinUI);
  });

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
  ['hep2-protamine-ratio-mode', 'hep2-protamine-basis'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('change', () => { toggleProtamineCustom(); updateProtamineBasisUi(); updateHeparinUI(); });
  });
  const initialUfhGivenInput = el('hep2-initial-ufh-given');
  if (initialUfhGivenInput) {
    initialUfhGivenInput.addEventListener('input', () => {
      hepInitialUfhOverrideTouched = initialUfhGivenInput.value !== '';
      updateHeparinUI();
    });
  }
  ['hep2-additional-ufh', 'hep2-prime-heparin', 'hep2-custom-ufh', 'hep2-protamine-ratio-custom'].forEach(id => {
    const node = el(id);
    if (node) node.addEventListener('input', updateHeparinUI);
  });
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
  const GDP_Q10 = 2.2;
  const GDP_DEFAULT_TEMPERATURE_C = 37;
  let lastChangedId = null;
  let bsaManualOverride = false;
  let targetDO2i = 280;
  let targetMode = 'preset'; // 'preset' | 'custom'

  function getGdpTemperatureC() {
    const input = el('gdp-temp-c');
    const value = input ? parseFloat(input.value) : GDP_DEFAULT_TEMPERATURE_C;
    if (!Number.isFinite(value)) return GDP_DEFAULT_TEMPERATURE_C;
    return clamp(value, 20, 37);
  }

  function getGdpInputs() {
    const bsaVal = el('bsa').value;
    const hbVal = el('hb').value;
    const sao2Val = el('sao2').value;
    const pao2Val = el('pao2').value;
    const flowVal = el('flow').value;
    const temperatureC = getGdpTemperatureC();

    return {
      bsaVal,
      hbVal,
      sao2Val,
      pao2Val,
      flowVal,
      temperatureC
    };
  }

  function calculateGdpVo2Fraction(temperatureC) {
    // Q10 temperature correction: VO2 fraction = Q10 ^ ((temperatureC - 37) / 10).
    // This estimates relative metabolic demand during hypothermic CPB and is not a pump-flow prescription.
    return Math.pow(GDP_Q10, (temperatureC - GDP_DEFAULT_TEMPERATURE_C) / 10);
  }

  function computeGdpResults(inputs) {
    const bsa = parseFloat(inputs.bsaVal) || 0;
    const flow = parseFloat(inputs.flowVal) || 0;
    const hb = parseFloat(inputs.hbVal) || 0;
    const sao2 = parseFloat(inputs.sao2Val) || 0;
    const pao2 = parseFloat(inputs.pao2Val) || 0;
    const temperatureC = Number.isFinite(inputs.temperatureC) ? inputs.temperatureC : GDP_DEFAULT_TEMPERATURE_C;
    const vo2Fraction = calculateGdpVo2Fraction(temperatureC);
    const currentCI = bsa ? flow / bsa : 0;
    const cao2 = calcCaO2(hb, sao2, pao2);
    const currentDO2i = flow ? calcDO2i(flow, bsa, cao2) : 0;
    const baseTarget = targetDO2i;
    const normothermicMin = Math.round(baseTarget * 0.9);
    const normothermicMax = Math.round(baseTarget * 1.1);
    const flowTargetDo2i = (normothermicMin + normothermicMax) / 2;
    const requiredFlow = calcRequiredFlowLmin(flowTargetDo2i, bsa, cao2);
    const tempAdjustedDo2Reference = baseTarget * vo2Fraction;
    const tempAdjustedReferenceFlow = requiredFlow * vo2Fraction;

    return {
      bsa,
      hb,
      sao2,
      pao2,
      flow,
      temperatureC,
      vo2Fraction,
      currentCI,
      cao2,
      requiredFlow,
      tempAdjustedDo2Reference,
      tempAdjustedReferenceFlow,
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

function formatGdpTemperature(temperatureC) {
  const safeTemperature = Number.isFinite(temperatureC) ? clamp(temperatureC, 20, 37) : GDP_DEFAULT_TEMPERATURE_C;
  return `${safeTemperature.toFixed(1)}°C`;
}

function updateGdpTemperatureDisplay(temperatureC, vo2Fraction) {
  const safeTemperature = Number.isFinite(temperatureC) ? clamp(temperatureC, 20, 37) : GDP_DEFAULT_TEMPERATURE_C;
  const slider = el('gdp-temp-slider');
  const input = el('gdp-temp-c');
  const fraction = Number.isFinite(vo2Fraction) ? vo2Fraction : calculateGdpVo2Fraction(safeTemperature);
  const temperatureLabel = formatGdpTemperature(safeTemperature);

  if (slider && document.activeElement !== slider) slider.value = String(safeTemperature);
  if (input && document.activeElement !== input) input.value = safeTemperature.toFixed(1);
  setText('gdp-temp-display', temperatureLabel);
  setText('gdp-vo2-fraction', `${Math.round(fraction * 100)}%`);
  setText('corrected-flow-label', `Corrected flow (${temperatureLabel})`);
  setText('corrected-row-label', `${temperatureLabel} corrected`);

  document.querySelectorAll('[data-gdp-temp-preset]').forEach((button) => {
    const preset = Number(button.dataset.gdpTempPreset);
    const active = Math.abs(preset - safeTemperature) < 0.05;
    button.className = 'gdp-temp-preset min-h-9 px-2.5 py-1.5 text-[11px] font-semibold rounded-full border transition-colors ' + (active
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

  const statusText = el('gdp-status-text');
  const statusDetail = el('gdp-status-detail');
  const cao2Hidden = el('cao2');
  if (cao2Hidden) cao2Hidden.value = results.cao2 ? results.cao2.toFixed(2) : '';

  if (requiredMissing.length || !results.bsa || !results.hb || !results.sao2 || !results.pao2 || !targetDO2i) {
    if (warningEl) {
      warningEl.textContent = `Enter required fields: ${requiredMissing.join(', ')}`;
      warningEl.classList.remove('hidden');
    }
    setText('cao2-result', '—');
    setText('required-flow', '—');
    setText('temp-reference-flow', '—');
    setText('normothermia-flow', '—');
    setText('normothermia-do2-floor', targetDO2i ? `${Math.round(targetDO2i)} mL/min/m²` : '—');
    setText('corrected-flow-table', '—');
    setText('corrected-do2-floor', results.tempAdjustedDo2Reference ? `${Math.round(results.tempAdjustedDo2Reference)} mL/min/m²` : '—');
    setText('current-do2i', '—');
    const adequacyBar = el('gdp-adequacy-bar');
    if (adequacyBar) {
      adequacyBar.style.width = '0%';
      adequacyBar.className = 'h-full w-0 rounded-full bg-slate-400 transition-all duration-500 ease-out';
    }
    updateGdpTemperatureDisplay(results.temperatureC, results.vo2Fraction);
    if (statusText) statusText.textContent = 'No data';
    if (statusDetail) statusDetail.textContent = 'Enter required fields to calculate flow and DO₂i.';
    return;
  }

  if (warningEl) warningEl.classList.add('hidden');

  updateGdpTemperatureDisplay(results.temperatureC, results.vo2Fraction);
  setText('cao2-result', results.cao2 ? `${results.cao2.toFixed(2)} <span class="text-xs font-medium text-slate-300">mL O₂/dL</span>` : '—');
  setText('required-flow', results.requiredFlow ? `${results.requiredFlow.toFixed(2)} <span class="text-xs font-medium text-slate-300">L/min</span>` : '—');
  setText('temp-reference-flow', results.tempAdjustedReferenceFlow ? `${results.tempAdjustedReferenceFlow.toFixed(2)} <span class="text-xs font-medium text-emerald-100/90">L/min</span>` : '—');
  setText('normothermia-flow', results.requiredFlow ? `${results.requiredFlow.toFixed(2)} L/min` : '—');
  setText('normothermia-do2-floor', results.baseTarget ? `${Math.round(results.baseTarget)} mL/min/m²` : '—');
  setText('corrected-flow-table', results.tempAdjustedReferenceFlow ? `${results.tempAdjustedReferenceFlow.toFixed(2)} L/min` : '—');
  setText('corrected-do2-floor', results.tempAdjustedDo2Reference ? `${Math.round(results.tempAdjustedDo2Reference)} mL/min/m²` : '—');
  setText('current-do2i', results.currentDO2i ? `${Math.round(results.currentDO2i)} <span class="text-xs font-medium text-slate-300">mL/min/m²</span>` : '—');

  let statusLabel = 'No data';
  let detail = 'Enter current pump flow to evaluate DO₂i.';
  let adequacyWidth = '0%';
  let adequacyColor = 'bg-slate-400';

  const lowerTarget = results.recommendedMin;
  const upperTarget = results.recommendedMax;

  if (results.currentDO2i > 0) {
    const temperatureLabel = formatGdpTemperature(results.temperatureC);
    const flowDelta = results.flow - results.tempAdjustedReferenceFlow;
    const referencePhrase = flowDelta >= 0
      ? `flow is ${Math.abs(flowDelta).toFixed(2)} L/min above the ${temperatureLabel} reference floor.`
      : `flow is ${Math.abs(flowDelta).toFixed(2)} L/min below the ${temperatureLabel} reference floor.`;
    const adequacyDenominator = upperTarget > 0 ? upperTarget * 1.1 : targetDO2i || 1;
    adequacyWidth = `${clamp((results.currentDO2i / adequacyDenominator) * 100, 0, 100)}%`;

    if (results.currentDO2i < lowerTarget) {
      statusLabel = 'Below target';
      detail = `Below the selected normothermic target; ${referencePhrase}`;
      adequacyColor = 'bg-gradient-to-r from-amber-500 to-red-500';
    } else if (results.currentDO2i > upperTarget) {
      statusLabel = 'Above target';
      detail = `Above the selected normothermic target; ${referencePhrase}`;
      adequacyColor = 'bg-gradient-to-r from-sky-500 to-blue-500';
    } else {
      statusLabel = 'Borderline';
      detail = `Within ±10% of the selected target; ${referencePhrase}`;
      adequacyColor = 'bg-gradient-to-r from-emerald-500 to-emerald-400';
    }
  }

  const adequacyBar = el('gdp-adequacy-bar');
  if (adequacyBar) {
    adequacyBar.style.width = adequacyWidth;
    adequacyBar.className = `h-full rounded-full transition-all duration-500 ease-out ${adequacyColor}`;
  }
  if (statusText) statusText.textContent = statusLabel;
  if (statusDetail) statusDetail.textContent = detail;
}

function resetGDP() {
  ['h_cm', 'w_kg', 'bsa', 'flow', 'hb', 'pao2'].forEach(id => {
    const n = el(id);
    if (n) n.value = '';
  });
  const sao2El = el('sao2');
  if (sao2El) sao2El.value = '100';
  const customInput = el('target-custom');
  if (customInput) customInput.value = '';
  targetDO2i = 280;
  targetMode = 'preset';
  bsaManualOverride = false;
  const cao2El = el('cao2');
  if (cao2El) cao2El.value = '';
  const tempInput = el('gdp-temp-c');
  const tempSlider = el('gdp-temp-slider');
  if (tempInput) tempInput.value = String(GDP_DEFAULT_TEMPERATURE_C);
  if (tempSlider) tempSlider.value = String(GDP_DEFAULT_TEMPERATURE_C);
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

function calculatePrimingVolumeMl(idMm, lengthM, quantity = 1) {
  if (idMm == null || lengthM == null || quantity == null) return null;
  // Formula: V(mL) = (π/4) × ID(mm)^2 × Length(m) × Quantity.
  // Because 1 m = 1000 mm, mm² × m converts to 1000 mm³, which equals 1 mL.
  return (Math.PI / 4) * Math.pow(idMm, 2) * lengthM * quantity;
}

function updatePrimingVolume() {
  const result = getCurrentPrimingTubingSegment();
  const customWrap = el('priming-custom-id-wrap');
  const idMmEl = el('priming-id-mm');
  const mlPerMEl = el('priming-ml-per-m');
  const mlPerCmEl = el('priming-ml-per-cm');
  const lengthMEl = el('priming-length-m');
  const volumeEl = el('priming-volume');
  const lengthError = el('priming-length-error');
  const lengthInput = el('priming-length');
  const addButton = el('priming-add-tubing-item');

  if (customWrap) customWrap.classList.toggle('hidden', result.tubeId !== 'custom');
  if (idMmEl) idMmEl.textContent = result.idReady ? result.idMm.toFixed(4) : '—';
  if (mlPerMEl) mlPerMEl.textContent = result.idReady ? result.mlPerM.toFixed(2) : '—';
  if (mlPerCmEl) mlPerCmEl.textContent = result.idReady ? result.mlPerCm.toFixed(3) : '—';
  if (lengthMEl) lengthMEl.textContent = result.lengthProvided && Number.isFinite(result.lengthM) ? result.lengthM.toFixed(4) : '—';
  if (lengthError) {
    const lengthTouched = lengthInput?.dataset?.touched === 'true';
    const lengthHasInput = !!lengthInput?.value.trim();
    lengthError.classList.toggle('hidden', !(result.lengthInvalid && (lengthTouched || lengthHasInput)));
  }
  if (volumeEl) volumeEl.textContent = result.ready ? result.volumeMl.toFixed(1) : '—';
  if (addButton) addButton.disabled = !result.ready || result.volumeMl <= 0;
}

let primingBuilderItems = [];
let primingNextBuilderItemId = 1;

function readPrimingNonNegative(inputEl) {
  if (!inputEl) return { value: 0, invalid: false, provided: false };
  const raw = inputEl.value.trim();
  if (raw === '') {
    inputEl.classList.remove('ring-1', 'ring-rose-400', 'border-rose-400');
    return { value: 0, invalid: false, provided: false };
  }
  const parsed = parseFloat(raw);
  const invalid = Number.isNaN(parsed) || inputEl.validity?.badInput;
  if (parsed < 0) {
    inputEl.value = '0';
    inputEl.classList.remove('ring-1', 'ring-rose-400', 'border-rose-400');
    return { value: 0, invalid: false, provided: true };
  }
  ['ring-1', 'ring-rose-400', 'border-rose-400'].forEach(cls => inputEl.classList.toggle(cls, invalid));
  return { value: invalid ? 0 : parsed, invalid, provided: true };
}

function escapePrimingHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrimingMl(value, decimals = 1) {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—';
}

function formatPrimingExpressionValue(value) {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function getPrimingTubeByKey(key) {
  return PRIMING_TUBE_IDS.find(item => item.key === key) || null;
}

function getCurrentPrimingTubingSegment() {
  const tubeId = el('priming-id')?.value || '';
  const tube = getPrimingTubeByKey(tubeId);
  const customId = readPrimingNonNegative(el('priming-custom-id'));
  const length = readPrimingNonNegative(el('priming-length'));
  const quantity = readPrimingNonNegative(el('priming-quantity'));
  const unit = el('priming-length-unit')?.value || 'cm';
  const idMm = tubeId === 'custom' ? customId.value : (tube ? tube.idMm : 0);
  const idReady = tubeId === 'custom' ? customId.provided && !customId.invalid && idMm > 0 : !!tube;
  const lengthM = convertLengthToMeters(length.value, unit);
  const lengthInvalid = length.invalid;
  const quantityValue = quantity.provided ? quantity.value : 0;
  const ready = idReady && length.provided && !lengthInvalid && !quantity.invalid && length.value > 0 && quantityValue > 0;
  const volumeMl = ready ? calculatePrimingVolumeMl(idMm, lengthM, quantityValue) : NaN;
  const displayLabel = tube ? tube.label : (tubeId === 'custom' ? `${idMm.toFixed(4)} mm` : '');

  return {
    tubeId,
    tube,
    idMm,
    idReady,
    mlPerM: idReady ? (Math.PI / 4) * Math.pow(idMm, 2) : NaN,
    mlPerCm: idReady ? ((Math.PI / 4) * Math.pow(idMm, 2)) / 100 : NaN,
    lengthM,
    lengthProvided: length.provided,
    lengthInvalid,
    lengthValue: length.value,
    unit,
    quantity: quantityValue,
    ready,
    volumeMl,
    displayLabel
  };
}

function addPrimingBuilderItem(item) {
  if (!item || !Number.isFinite(item.volume) || item.volume <= 0) return;
  primingBuilderItems.push({ ...item, id: primingNextBuilderItemId++ });
  renderPrimingBuilder();
}

function addCurrentPrimingTubingItem() {
  const result = getCurrentPrimingTubingSegment();
  if (!result.ready) return;
  const name = el('priming-segment-name')?.value.trim() || 'Tubing segment';
  const lengthRaw = el('priming-length')?.value.trim() || '0';
  addPrimingBuilderItem({
    item: 'Tubing',
    details: `${name} · ${result.displayLabel}, ${lengthRaw} ${result.unit} × ${formatPrimingExpressionValue(result.quantity)}`,
    volume: result.volumeMl,
    category: 'tubing'
  });
}

function handlePrimingOxygenatorModelChange() {
  const modelSelect = el('priming-oxygenator-model');
  const volumeInput = el('priming-oxygenator-volume');
  if (!modelSelect || !volumeInput) return;
  if (modelSelect.value && modelSelect.value !== 'custom') volumeInput.value = modelSelect.value;
}

function getSelectedOxygenatorLabel() {
  const modelSelect = el('priming-oxygenator-model');
  if (!modelSelect) return 'Oxygenator';
  const selected = modelSelect.options[modelSelect.selectedIndex];
  return selected?.dataset?.label || 'Custom oxygenator';
}

function addPrimingOxygenatorItem() {
  const volume = readPrimingNonNegative(el('priming-oxygenator-volume'));
  if (volume.invalid || volume.value <= 0) return;
  const model = getSelectedOxygenatorLabel();
  addPrimingBuilderItem({ item: 'Oxygenator', details: model, volume: volume.value, category: 'oxygenator' });
}

function renderPrimingBuilder() {
  const emptyEl = el('priming-builder-empty');
  const tableWrap = el('priming-builder-table-wrap');
  const cardWrap = el('priming-builder-cards');
  const body = el('priming-builder-items');
  const hasItems = primingBuilderItems.length > 0;

  if (emptyEl) emptyEl.classList.toggle('hidden', hasItems);
  if (tableWrap) tableWrap.style.display = hasItems ? '' : 'none';
  if (cardWrap) {
    cardWrap.classList.toggle('hidden', !hasItems);
    cardWrap.innerHTML = primingBuilderItems.map(item => `
      <div class="rounded-xl border border-slate-200 dark:border-primary-800 bg-slate-50 dark:bg-primary-900/50 p-3 flex items-start gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-semibold text-slate-700 dark:text-slate-200">${escapePrimingHtml(item.item)}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400 break-words">${escapePrimingHtml(item.details)}</div>
          <div class="mt-1 font-semibold text-primary-900 dark:text-white">${formatPrimingMl(item.volume)} mL</div>
        </div>
        <button type="button" class="priming-delete-builder-item inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-primary-700 text-lg leading-none text-slate-400 hover:text-rose-500 hover:border-rose-300 transition-colors" data-builder-id="${item.id}" aria-label="Remove item">×</button>
      </div>
    `).join('');
  }
  if (body) {
    body.innerHTML = primingBuilderItems.map(item => `
      <tr>
        <td class="px-3 py-2 align-top font-medium text-slate-700 dark:text-slate-200">${escapePrimingHtml(item.item)}</td>
        <td class="px-3 py-2 align-top text-slate-500 dark:text-slate-400">${escapePrimingHtml(item.details)}</td>
        <td class="px-3 py-2 align-top text-right font-semibold text-primary-900 dark:text-white">${formatPrimingMl(item.volume)} mL</td>
        <td class="px-3 py-2 align-top text-center"><button type="button" class="priming-delete-builder-item inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 dark:border-primary-700 text-lg leading-none text-slate-400 hover:text-rose-500 hover:border-rose-300 transition-colors" data-builder-id="${item.id}" aria-label="Remove item">×</button></td>
      </tr>
    `).join('');
  }
  [body, cardWrap].forEach(container => {
    container?.querySelectorAll('.priming-delete-builder-item').forEach(button => {
      button.addEventListener('click', () => {
        primingBuilderItems = primingBuilderItems.filter(item => item.id !== Number(button.dataset.builderId));
        renderPrimingBuilder();
      });
    });
  });

  const tubingSubtotal = primingBuilderItems.filter(item => item.category === 'tubing').reduce((sum, item) => sum + item.volume, 0);
  const oxygenatorSubtotal = primingBuilderItems.filter(item => item.category === 'oxygenator').reduce((sum, item) => sum + item.volume, 0);
  const total = tubingSubtotal + oxygenatorSubtotal;
  setText('priming-builder-tubing-subtotal', formatPrimingMl(tubingSubtotal));
  setText('priming-builder-oxygenator-subtotal', formatPrimingMl(oxygenatorSubtotal));
  setText('priming-builder-total', formatPrimingMl(total));

  const expression = hasItems
    ? `Total Prime Volume = ${primingBuilderItems.map(item => formatPrimingExpressionValue(item.volume)).join(' + ')} = ${formatPrimingMl(total)} mL`
    : 'Total Prime Volume = 0 mL';
  setText('priming-builder-expression', expression);
}

function clearPrimingBuilderItems() {
  primingBuilderItems = [];
  renderPrimingBuilder();
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

function normalizePressureDropFilterLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function getPressureDropGroupLabel(category) {
  const normalized = normalizePressureDropKey(category);
  if (normalized.includes('cardioplegia')) return 'Cardioplegia cannula';
  if (normalized.includes('vent')) return 'Vent cannula';
  if (normalized.includes('arterial')) return 'Arterial cannula';
  if (normalized.includes('venous')) return 'Venous cannula';
  if (normalized.includes('aortic')) return 'Aortic cannula';
  return String(category || '').trim().replace(/\s+/g, ' ') || 'Specialty cannula';
}

function getPressureDropCategoryFilterValue(category) {
  return normalizePressureDropFilterLabel(getPressureDropGroupLabel(category));
}

function getPressureDropSourceNode(entry, compact = false, options = {}) {
  const sourceWrap = document.createElement('div');
  sourceWrap.className = compact
    ? 'rounded-lg border border-slate-200 dark:border-primary-800 bg-slate-50/80 dark:bg-primary-900/50 p-3 space-y-2 text-xs'
    : 'min-w-[14rem] space-y-2';
  const label = document.createElement('div');
  label.className = 'font-medium text-slate-700 dark:text-slate-200';
  label.textContent = entry.sourceLabel || 'Manufacturer reference';
  sourceWrap.appendChild(label);

  const sourceUrl = String(entry.sourceUrl || '').trim();
  const hasPublicSourceUrl = /^https?:\/\//i.test(sourceUrl);
  if (sourceUrl && hasPublicSourceUrl) {
    const link = document.createElement('a');
    link.href = sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = compact
      ? 'inline-flex w-fit items-center rounded-full border border-accent-500/30 bg-white dark:bg-primary-800 px-2.5 py-1 font-semibold text-accent-600 dark:text-accent-400 hover:border-accent-500/60 hover:text-accent-700 dark:hover:text-accent-300 transition-colors'
      : 'inline-flex text-accent-600 dark:text-accent-400 hover:underline break-all';
    link.textContent = /\.pdf(?:[?#].*)?$/i.test(sourceUrl) ? 'Open manufacturer PDF' : 'Open source';
    sourceWrap.appendChild(link);
  } else if (sourceUrl) {
    const source = document.createElement('div');
    source.className = 'text-slate-500 dark:text-slate-400 break-words';
    source.textContent = sourceUrl;
    sourceWrap.appendChild(source);
  }

  if (!hasPublicSourceUrl && options.showMissingPublicLinkNote) {
    const helper = document.createElement('div');
    helper.className = 'text-[11px] leading-relaxed text-slate-400 dark:text-slate-500';
    helper.textContent = 'Manufacturer source label is recorded; public PDF link has not been added yet.';
    sourceWrap.appendChild(helper);
  }

  if (entry.testMedium) {
    const medium = document.createElement('div');
    medium.className = 'text-slate-500 dark:text-slate-400';
    medium.textContent = `Test medium: ${entry.testMedium}`;
    sourceWrap.appendChild(medium);
  }
  return sourceWrap;
}

function createPressureDropPointsDetails(entry) {
  const validPoints = getValidPressureDropPoints(entry.points);
  const details = document.createElement('details');
  details.className = 'group rounded-lg border border-slate-200 dark:border-primary-700 bg-white/70 dark:bg-primary-900/40 px-3 py-2';

  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer text-xs font-semibold text-accent-700 dark:text-accent-300';
  summary.textContent = validPoints.length ? `${validPoints.length} chart points` : 'Metadata only';
  details.appendChild(summary);

  const content = document.createElement('div');
  content.className = 'mt-2 space-y-2 text-xs text-slate-600 dark:text-slate-300';
  if (validPoints.length) {
    const pointList = document.createElement('div');
    pointList.className = 'flex flex-wrap gap-1.5';
    validPoints.forEach(point => {
      const chip = document.createElement('span');
      chip.className = 'rounded-full border border-slate-200 dark:border-primary-700 bg-slate-50 dark:bg-primary-800 px-2 py-1 tabular-nums';
      chip.textContent = `${formatPressureDropFlowValue(point.flow)} L/min → ${point.pressureDrop} mmHg`;
      pointList.appendChild(chip);
    });
    content.appendChild(pointList);
  } else {
    const empty = document.createElement('p');
    empty.textContent = 'No digitized pressure-drop curve points are available for this row.';
    content.appendChild(empty);
  }

  const note = document.createElement('p');
  note.className = 'leading-relaxed';
  note.textContent = entry.digitizationNote || 'Manufacturer pressure-drop reference data.';
  content.appendChild(note);
  details.appendChild(content);
  return details;
}

function getPressureDropFlowRange(entry) {
  const validPoints = getValidPressureDropPoints(entry.points);
  return getPressureDropRangeText(validPoints, entry.referenceFlowRangeLabel || '');
}

function getPressureDropMetadataItems(entry) {
  return [
    entry.outerDiameterFr && entry.outerDiameterMm ? `${entry.outerDiameterFr} Fr / ${entry.outerDiameterMm.toFixed(1)} mm OD` : '',
    entry.connectionSite ? `Connection: ${entry.connectionSite}` : '',
    entry.connectorSize ? `Connector: ${entry.connectorSize}` : '',
    entry.cannulaOrderCode ? `${entry.cannulaOrderCodeLabel || 'Order code'}: ${entry.cannulaOrderCode}` : '',
    entry.cannulaKitOrderCode ? `Kit: ${entry.cannulaKitOrderCode}` : ''
  ].filter(Boolean);
}


function getCannulaPressureDropReferenceEntries(items = []) {
  return items
    .filter(entry => entry && entry.manufacturer && entry.model && !entry.manufacturer.toLowerCase().includes('example placeholder'))
    .sort((a, b) => `${a.manufacturer} ${a.category || ''} ${a.model} ${a.size || ''} ${a.connectionSite || ''}`.localeCompare(`${b.manufacturer} ${b.category || ''} ${b.model} ${b.size || ''} ${b.connectionSite || ''}`));
}

function getPressureDropOrderCodeText(entry) {
  return [
    entry.cannulaOrderCode ? `${entry.cannulaOrderCodeLabel || 'Order code'}: ${entry.cannulaOrderCode}` : '',
    entry.cannulaKitOrderCode ? `Kit: ${entry.cannulaKitOrderCode}` : ''
  ].filter(Boolean).join('; ') || '—';
}

function getPressureDropEntrySearchText(entry) {
  return [
    entry.manufacturer,
    entry.model,
    entry.category,
    entry.size,
    entry.connectionSite,
    entry.connectorSize,
    entry.cannulaOrderCode,
    entry.cannulaKitOrderCode,
    entry.sourceLabel,
    entry.sourceUrl,
    entry.notes,
    entry.digitizationNote,
    entry.dataStatus
  ].filter(Boolean).join(' ').toLowerCase();
}

function getUniquePressureDropValues(entries, getter) {
  return Array.from(new Set(entries.map(getter).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
}

function setPressureDropSelectOptions(selectNode, values, placeholder) {
  if (!selectNode) return;
  const currentValue = selectNode.value;
  selectNode.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  selectNode.appendChild(placeholderOption);
  values.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    selectNode.appendChild(option);
  });
  selectNode.value = values.includes(currentValue) ? currentValue : '';
}

function filterPressureDropEntries(entries, filters) {
  const normalizedQuery = normalizePressureDropKey(filters.search);
  return entries.filter(entry => {
    if (filters.manufacturer && entry.manufacturer !== filters.manufacturer) return false;
    if (filters.category && getPressureDropCategoryFilterValue(entry.category) !== filters.category) return false;
    if (filters.model && entry.model !== filters.model) return false;
    if (filters.size && entry.size !== filters.size) return false;
    if (filters.connectionSite && (entry.connectionSite || '') !== filters.connectionSite) return false;
    if (normalizedQuery && !getPressureDropEntrySearchText(entry).includes(normalizedQuery)) return false;
    return true;
  });
}

function createPressureDropPageTable(entries) {
  const tableWrap = document.createElement('div');
  tableWrap.className = 'hidden lg:block overflow-x-auto rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/30';

  const table = document.createElement('table');
  table.className = 'min-w-[1180px] w-full text-xs';
  table.innerHTML = `
    <thead class="bg-slate-50 dark:bg-primary-900/80 text-slate-600 dark:text-slate-300">
      <tr>
        <th class="px-3 py-2 text-left font-semibold">Manufacturer</th>
        <th class="px-3 py-2 text-left font-semibold">Model</th>
        <th class="px-3 py-2 text-left font-semibold">Type</th>
        <th class="px-3 py-2 text-left font-semibold">Size</th>
        <th class="px-3 py-2 text-left font-semibold">Connection / connector</th>
        <th class="px-3 py-2 text-left font-semibold">Order code</th>
        <th class="px-3 py-2 text-left font-semibold">Flow range</th>
        <th class="px-3 py-2 text-left font-semibold">Pressure drop points</th>
        <th class="px-3 py-2 text-left font-semibold">Data status</th>
        <th class="px-3 py-2 text-left font-semibold">Source / note</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');

  entries.forEach(entry => {
    const tr = document.createElement('tr');
    tr.className = 'border-t border-slate-100 dark:border-primary-800 align-top hover:bg-slate-50/70 dark:hover:bg-primary-900/60';

    [entry.manufacturer, entry.model, entry.category || '—', entry.size || '—'].forEach(value => {
      const td = document.createElement('td');
      td.className = 'px-3 py-3 text-slate-700 dark:text-slate-200';
      td.textContent = value;
      tr.appendChild(td);
    });

    const connectionTd = document.createElement('td');
    connectionTd.className = 'px-3 py-3 text-slate-600 dark:text-slate-300 space-y-1';
    const connectionValue = document.createElement('div');
    connectionValue.textContent = entry.connectionSite || '—';
    connectionTd.appendChild(connectionValue);
    if (entry.connectorSize) {
      const connectorValue = document.createElement('div');
      connectorValue.className = 'text-slate-500 dark:text-slate-400';
      connectorValue.textContent = `Connector: ${entry.connectorSize}`;
      connectionTd.appendChild(connectorValue);
    }
    tr.appendChild(connectionTd);

    const orderTd = document.createElement('td');
    orderTd.className = 'px-3 py-3 text-slate-600 dark:text-slate-300';
    orderTd.textContent = getPressureDropOrderCodeText(entry);
    tr.appendChild(orderTd);

    const flowTd = document.createElement('td');
    flowTd.className = 'px-3 py-3 text-slate-700 dark:text-slate-200';
    flowTd.textContent = `${getPressureDropFlowRange(entry)}${entry.testMedium ? ` (${entry.testMedium})` : ''}`;
    tr.appendChild(flowTd);

    const pointsTd = document.createElement('td');
    pointsTd.className = 'px-3 py-3 min-w-[18rem]';
    pointsTd.appendChild(createPressureDropPointsDetails(entry));
    tr.appendChild(pointsTd);

    const statusTd = document.createElement('td');
    statusTd.className = 'px-3 py-3 text-slate-600 dark:text-slate-300';
    statusTd.textContent = formatPressureDropDataStatus(entry.dataStatus);
    tr.appendChild(statusTd);

    const sourceTd = document.createElement('td');
    sourceTd.className = 'px-3 py-3 text-slate-600 dark:text-slate-300 space-y-2';
    sourceTd.appendChild(getPressureDropSourceNode(entry, true));
    const digitizationNote = document.createElement('p');
    digitizationNote.className = 'text-slate-500 dark:text-slate-400 leading-relaxed';
    digitizationNote.textContent = entry.digitizationNote || 'Manufacturer pressure-drop reference data.';
    sourceTd.appendChild(digitizationNote);
    if (entry.notes) {
      const notes = document.createElement('p');
      notes.className = 'text-slate-500 dark:text-slate-400 leading-relaxed';
      notes.textContent = entry.notes;
      sourceTd.appendChild(notes);
    }
    tr.appendChild(sourceTd);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableWrap.appendChild(table);
  return tableWrap;
}


function createPressureDropPageCards(entries) {
  const list = document.createElement('div');
  list.className = 'grid gap-3 lg:hidden';
  entries.forEach(entry => {
    const card = document.createElement('article');
    card.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/30 p-4 space-y-3';

    const title = document.createElement('div');
    title.innerHTML = `<p class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">${entry.manufacturer || 'Unknown manufacturer'}</p><h3 class="text-sm font-semibold text-primary-900 dark:text-white">${entry.model || 'Unknown model'} · ${entry.size || 'Unknown size'}</h3><p class="text-xs text-slate-500 dark:text-slate-400">${getPressureDropGroupLabel(entry.category)}${entry.connectionSite ? ` · ${entry.connectionSite}` : ''}</p>`;
    card.appendChild(title);

    const facts = document.createElement('dl');
    facts.className = 'grid grid-cols-2 gap-2 text-xs';
    [
      ['Connection', entry.connectionSite || '—'],
      ['Connector size', entry.connectorSize || '—'],
      ['Order code', getPressureDropOrderCodeText(entry)],
      ['Flow range', getPressureDropFlowRange(entry)],
      ['Test medium', entry.testMedium || '—'],
      ['Data status', formatPressureDropDataStatus(entry.dataStatus)]
    ].forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'rounded-lg bg-slate-50 dark:bg-primary-800/60 p-2';
      const dt = document.createElement('dt');
      dt.className = 'text-slate-500 dark:text-slate-400';
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.className = 'mt-1 font-medium text-slate-700 dark:text-slate-200 break-words';
      dd.textContent = value;
      item.append(dt, dd);
      facts.appendChild(item);
    });
    card.appendChild(facts);

    card.appendChild(createPressureDropPointsDetails(entry));
    card.appendChild(getPressureDropSourceNode(entry, true));

    const note = document.createElement('p');
    note.className = 'text-xs text-slate-500 dark:text-slate-400 leading-relaxed';
    note.textContent = entry.digitizationNote || 'Manufacturer pressure-drop reference data.';
    card.appendChild(note);
    if (entry.notes) {
      const notes = document.createElement('p');
      notes.className = 'text-xs text-slate-500 dark:text-slate-400 leading-relaxed';
      notes.textContent = entry.notes;
      card.appendChild(notes);
    }

    list.appendChild(card);
  });
  return list;
}

function setPressureDropSelectOptionPairs(selectNode, optionPairs, placeholder) {
  if (!selectNode) return;
  const currentValue = selectNode.value;
  selectNode.innerHTML = '';
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = placeholder;
  selectNode.appendChild(placeholderOption);
  optionPairs.forEach(option => {
    const node = document.createElement('option');
    node.value = option.value;
    node.textContent = option.label;
    selectNode.appendChild(node);
  });
  selectNode.value = optionPairs.some(option => option.value === currentValue) ? currentValue : '';
  selectNode.disabled = optionPairs.length === 0;
}


function createPressureDropSearchableSelect(selectNode, placeholder, onChange) {
  if (!selectNode || selectNode.dataset.searchableCombobox === 'ready') return null;
  selectNode.dataset.searchableCombobox = 'ready';
  selectNode.classList.add('hidden');
  selectNode.setAttribute('aria-hidden', 'true');
  selectNode.tabIndex = -1;

  const wrapper = document.createElement('div');
  wrapper.className = 'pressure-drop-combobox relative';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-primary-700 bg-white dark:bg-primary-800 px-3 py-2 text-left text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none dark:text-white disabled:opacity-60';
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const label = document.createElement('span');
  label.className = 'min-w-0 flex-1 truncate';
  const icon = document.createElement('span');
  icon.className = 'flex-shrink-0 text-slate-400 dark:text-slate-500';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '▾';
  button.append(label, icon);

  const panel = document.createElement('div');
  panel.className = 'pressure-drop-combobox-panel absolute z-30 mt-1 hidden rounded-xl border border-slate-200 dark:border-primary-700 bg-white dark:bg-primary-900 shadow-xl p-2';
  panel.style.maxWidth = 'min(520px, calc(100vw - 32px))';
  panel.style.width = 'min(520px, calc(100vw - 32px))';
  panel.style.maxHeight = '320px';
  panel.style.overflow = 'hidden';

  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'mb-2 w-full rounded-lg border border-slate-200 dark:border-primary-700 bg-slate-50 dark:bg-primary-950 px-3 py-2 text-sm text-primary-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none';
  search.placeholder = 'Search cannula model';
  search.setAttribute('aria-label', 'Search cannula model');

  const list = document.createElement('div');
  list.className = 'max-h-[260px] overflow-y-auto overflow-x-hidden pr-1';
  list.setAttribute('role', 'listbox');
  panel.append(search, list);
  wrapper.append(button, panel);
  selectNode.insertAdjacentElement('afterend', wrapper);

  let options = [];
  let visibleOptions = [];
  let highlightedIndex = -1;

  const close = () => {
    panel.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    highlightedIndex = -1;
  };
  const updatePanelPosition = () => {
    const rect = wrapper.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    if (viewportWidth <= 768) {
      panel.style.top = `${Math.max(rect.bottom + 4, 16)}px`;
      panel.style.left = '16px';
      panel.style.right = '16px';
      return;
    }
    panel.style.top = '';
    if (viewportWidth && rect.left + 520 > viewportWidth - 16) {
      panel.style.left = 'auto';
      panel.style.right = '0';
    } else {
      panel.style.left = '0';
      panel.style.right = 'auto';
    }
  };
  const selectValue = (value) => {
    selectNode.value = value;
    selectNode.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof onChange === 'function') onChange(value);
    close();
    button.focus();
  };
  const renderOptions = () => {
    const query = search.value.trim().toLowerCase();
    visibleOptions = options.filter(option => !query || option.label.toLowerCase().includes(query));
    list.innerHTML = '';
    visibleOptions.forEach((option, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `block w-full overflow-hidden text-ellipsis whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${option.value === selectNode.value ? 'bg-accent-500/10 text-accent-700 dark:text-accent-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-primary-800'}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.value === selectNode.value ? 'true' : 'false');
      item.title = option.label;
      item.textContent = option.label;
      item.addEventListener('mousedown', event => event.preventDefault());
      item.addEventListener('click', () => selectValue(option.value));
      list.appendChild(item);
      if (option.value === selectNode.value) highlightedIndex = index;
    });
    if (!visibleOptions.length) {
      const empty = document.createElement('div');
      empty.className = 'px-3 py-2 text-sm text-slate-500 dark:text-slate-400';
      empty.textContent = 'No matching cannula models';
      list.appendChild(empty);
    }
  };
  const highlight = (nextIndex) => {
    if (!visibleOptions.length) return;
    highlightedIndex = (nextIndex + visibleOptions.length) % visibleOptions.length;
    Array.from(list.querySelectorAll('[role="option"]')).forEach((item, index) => {
      item.classList.toggle('bg-accent-500/20', index === highlightedIndex);
      if (index === highlightedIndex) item.scrollIntoView({ block: 'nearest' });
    });
  };
  const open = () => {
    if (selectNode.disabled) return;
    updatePanelPosition();
    search.value = '';
    renderOptions();
    panel.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    setTimeout(() => search.focus(), 0);
  };
  const refresh = () => {
    options = Array.from(selectNode.options).map(option => ({ value: option.value, label: option.textContent || option.value }));
    const selected = options.find(option => option.value === selectNode.value);
    label.textContent = selected?.label || placeholder;
    label.title = selected?.label || placeholder;
    button.disabled = selectNode.disabled;
    renderOptions();
  };

  button.addEventListener('click', () => panel.classList.contains('hidden') ? open() : close());
  search.addEventListener('input', () => { highlightedIndex = -1; renderOptions(); });
  search.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); highlight(highlightedIndex + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); highlight(highlightedIndex - 1); }
    else if (event.key === 'Enter') { event.preventDefault(); if (visibleOptions[highlightedIndex]) selectValue(visibleOptions[highlightedIndex].value); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); button.focus(); }
  });
  button.addEventListener('keydown', event => {
    if (['ArrowDown', 'Enter', ' '].includes(event.key)) { event.preventDefault(); open(); }
    else if (event.key === 'Escape') close();
  });
  document.addEventListener('mousedown', event => { if (!wrapper.contains(event.target)) close(); });
  window.addEventListener('resize', updatePanelPosition);

  refresh();
  return { refresh, close, open, panel, button, search, list };
}

function syncPressureDropConnectionControl(selectNode, wrapNode, optionPairs, shouldShow) {
  setPressureDropSelectOptionPairs(selectNode, optionPairs, 'Any connection site');
  if (!selectNode) return;

  if (!shouldShow) {
    selectNode.value = optionPairs.length === 1 ? optionPairs[0].value : '';
  }

  if (wrapNode) {
    wrapNode.classList.toggle('hidden', !shouldShow);
    wrapNode.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  }
}

function getPressureDropConnectionOptionValue(entry) {
  const connectionSite = entry.connectionSite || '__not_specified__';
  const connectorSize = entry.connectorSize || '';
  const cannulaOrderCode = entry.cannulaOrderCode || '';
  return `${connectionSite}||${connectorSize}||${cannulaOrderCode}`;
}

function getPressureDropConnectionOptionLabel(value) {
  const [connectionSite = '__not_specified__', connectorSize = '', cannulaOrderCode = ''] = String(value || '').split('||');
  const parts = [connectionSite === '__not_specified__' ? 'Not specified' : connectionSite, connectorSize, cannulaOrderCode].filter(Boolean);
  return parts.join(' — ');
}

function getUniquePressureDropOptionPairs(entries, getter, labeler = value => value) {
  return Array.from(new Set(entries.map(getter).filter(Boolean)))
    .sort((a, b) => String(labeler(a)).localeCompare(String(labeler(b)), undefined, { numeric: true }))
    .map(value => ({ value, label: labeler(value) }));
}

function getUniquePressureDropCategoryOptionPairs(entries) {
  const optionMap = new Map();
  entries.forEach(entry => {
    const label = getPressureDropGroupLabel(entry.category);
    const key = normalizePressureDropFilterLabel(label);
    if (!key || optionMap.has(key)) return;
    optionMap.set(key, { value: key, label });
  });
  return Array.from(optionMap.values())
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function getPressureDropLookupMatches(entries, filters = {}) {
  return entries.filter(entry => {
    if (filters.manufacturer && entry.manufacturer !== filters.manufacturer) return false;
    if (filters.model && entry.model !== filters.model) return false;
    if (filters.category && getPressureDropCategoryFilterValue(entry.category) !== filters.category) return false;
    if (filters.size && entry.size !== filters.size) return false;
    if (filters.connectionSite && getPressureDropConnectionOptionValue(entry) !== filters.connectionSite) return false;
    return true;
  });
}

function getPressureDropLookupSelection(controls) {
  return {
    manufacturer: controls.manufacturerSelect?.value || '',
    model: controls.modelSelect?.value || '',
    category: controls.categorySelect?.value || '',
    size: controls.sizeSelect?.value || '',
    connectionSite: controls.connectionSelect?.value || ''
  };
}

function parsePressureDropFlowInput(value) {
  const normalizedValue = String(value || '').trim().replace(',', '.');
  if (!normalizedValue || normalizedValue === '.') return NaN;
  const parsedValue = Number.parseFloat(normalizedValue);
  return Number.isFinite(parsedValue) ? parsedValue : NaN;
}

function createPressureDropLookupPrompt(candidates, totalCount) {
  const prompt = document.createElement('div');
  prompt.className = 'rounded-xl border border-dashed border-slate-300 dark:border-primary-700 bg-slate-50/80 dark:bg-primary-900/40 p-5 text-sm text-slate-600 dark:text-slate-300 space-y-2';
  const title = document.createElement('h3');
  title.className = 'text-base font-semibold text-primary-900 dark:text-white';
  title.textContent = 'Select a manufacturer and cannula to view the pressure-flow curve.';
  const body = document.createElement('p');
  body.textContent = candidates.length && candidates.length < totalCount
    ? `${candidates.length} matching references remain. Continue narrowing by model, type, size, or connection site.`
    : 'Start with manufacturer, then choose a model, category, size, and optional connection site.';
  prompt.append(title, body);
  return prompt;
}

function createPressureDropCandidateList(candidates, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/30 p-4 space-y-3';
  const title = document.createElement('div');
  title.innerHTML = `<h3 class="text-sm font-semibold text-primary-900 dark:text-white">Available matching cannulae</h3><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Click any row to fill the remaining lookup controls.</p>`;
  wrap.appendChild(title);
  const list = document.createElement('div');
  list.className = 'grid gap-2';
  candidates.slice(0, 12).forEach(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-left rounded-lg border border-slate-200 dark:border-primary-800 bg-slate-50 dark:bg-primary-800/50 p-3 hover:border-accent-500/50 transition-colors';
    button.innerHTML = `<p class="text-sm font-semibold text-primary-900 dark:text-white">${entry.manufacturer} · ${entry.model}</p><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${getPressureDropGroupLabel(entry.category)} · ${entry.size || 'Unknown size'}${entry.connectionSite ? ` · ${entry.connectionSite}` : ''} · ${getPressureDropFlowRange(entry)}</p>`;
    button.addEventListener('click', () => onSelect(entry));
    list.appendChild(button);
  });
  wrap.appendChild(list);
  if (candidates.length > 12) {
    const more = document.createElement('p');
    more.className = 'text-xs text-slate-500 dark:text-slate-400';
    more.textContent = `Showing 12 of ${candidates.length} matches. Use the controls above to narrow further.`;
    wrap.appendChild(more);
  }
  return wrap;
}

function createPressureDropEstimateCard(entry, flowInputValue, flowValue, interpolationResult, onFlowInput) {
  const card = document.createElement('div');
  const validPoints = getValidPressureDropPoints(entry.points);
  const rangeText = getPressureDropRangeText(validPoints, entry.referenceFlowRangeLabel || '');
  const isOutOfRange = interpolationResult?.state === 'out_of_range';
  card.className = `rounded-xl border ${isOutOfRange ? 'border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-500/10' : 'border-accent-500/25 bg-accent-500/10 dark:bg-accent-500/15'} p-4 space-y-3`;
  const title = document.createElement('p');
  title.className = 'text-xs uppercase tracking-wider text-accent-700 dark:text-accent-300';
  title.textContent = 'Estimated pressure drop';
  const value = document.createElement('p');
  value.className = 'text-2xl font-bold text-primary-900 dark:text-white';
  const note = document.createElement('p');
  note.className = 'text-xs leading-relaxed text-slate-600 dark:text-slate-300';

  const inputWrap = document.createElement('label');
  inputWrap.className = 'block space-y-1';
  const inputLabel = document.createElement('span');
  inputLabel.className = 'text-xs tracking-wider text-slate-500 dark:text-slate-400';
  inputLabel.textContent = 'Flow rate (L/min)';
  const input = document.createElement('input');
  input.id = 'pressure-drop-result-flow';
  input.type = 'text';
  input.inputMode = 'decimal';
  input.pattern = '[0-9]*[.,]?[0-9]*';
  input.placeholder = 'Enter flow rate';
  input.value = flowInputValue || '';
  input.className = 'w-full rounded-lg border border-slate-200 dark:border-primary-700 bg-white dark:bg-primary-800 px-3 py-2 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none dark:text-white';
  input.addEventListener('input', () => onFlowInput(input.value));
  const helper = document.createElement('span');
  helper.className = 'block text-xs text-slate-500 dark:text-slate-400';
  helper.textContent = validPoints.length ? `Same target flow as the lookup field above. Available manufacturer curve range: ${rangeText}.` : 'Same target flow as the lookup field above. No digitized curve range is available for this cannula.';
  inputWrap.append(inputLabel, input, helper);

  if (!validPoints.length) {
    value.textContent = 'Curve unavailable';
    note.textContent = 'No digitized pressure-flow points are available for this cannula yet.';
  } else if (!Number.isFinite(flowValue)) {
    value.textContent = 'Enter flow';
    note.textContent = `Enter a flow rate to estimate pressure drop from the selected manufacturer curve.`;
  } else if (validPoints.length < 2) {
    value.textContent = 'Unavailable';
    note.textContent = 'At least two manufacturer curve points are required for interpolation.';
  } else if (isOutOfRange) {
    value.textContent = 'Out of range';
    note.textContent = `The entered flow is outside the available manufacturer curve range (${formatPressureDropFlowValue(interpolationResult.minFlow)}–${formatPressureDropFlowValue(interpolationResult.maxFlow)} L/min). Values outside the curve range are not extrapolated.`;
  } else if (interpolationResult.state === 'exact' || interpolationResult.state === 'interpolated') {
    value.textContent = `${interpolationResult.value.toFixed(1)} mmHg`;
    note.textContent = `At ${flowValue.toFixed(1)} L/min, estimated pressure drop is approximately ${interpolationResult.value.toFixed(1)} mmHg. ${interpolationResult.state === 'exact' ? 'This matches a digitized manufacturer curve point.' : 'Linearly interpolated from adjacent digitized manufacturer-published curve points.'}`;
  } else {
    value.textContent = '—';
    note.textContent = `Available manufacturer curve range: ${rangeText}.`;
  }

  card.append(title, value, inputWrap, note);
  return card;
}

function createPressureDropChartPanel(entry, flowValue, interpolationResult) {
  const panel = document.createElement('article');
  panel.className = 'self-start h-fit rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/30 p-4 space-y-3';
  const header = document.createElement('div');
  header.innerHTML = `<h3 class="text-sm font-semibold text-primary-900 dark:text-white">Pressure-flow curve</h3><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Raw digitized points are shown as markers and connected with straight line segments.</p>`;
  const svgWrap = document.createElement('div');
  svgWrap.className = 'flex w-full items-center justify-center overflow-hidden rounded-lg bg-slate-50/60 dark:bg-primary-900/40 px-1 py-1 sm:px-2';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 420 200');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${entry.manufacturer} ${entry.model} pressure-flow curve`);
  svg.classList.add('block', 'w-full', 'h-auto', 'text-slate-500', 'dark:text-slate-300');
  const hasEstimate = interpolationResult && (interpolationResult.state === 'exact' || interpolationResult.state === 'interpolated');
  drawPressureDropChart(svg, entry.points, hasEstimate ? flowValue : NaN, hasEstimate ? interpolationResult.value : NaN, { curveMode: 'linear' });
  if (!getValidPressureDropPoints(entry.points).length) {
    const empty = document.createElement('div');
    empty.className = 'rounded-lg border border-dashed border-slate-300 dark:border-primary-700 p-4 text-sm text-slate-500 dark:text-slate-400';
    empty.textContent = 'No digitized pressure-flow curve points are available for this selected cannula.';
    panel.append(header, empty);
    return panel;
  }
  svgWrap.appendChild(svg);
  panel.append(header, svgWrap);
  return panel;
}

function createPressureDropSelectedSummary(entry) {
  const card = document.createElement('article');
  card.className = 'self-start rounded-xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/30 p-3 sm:p-4 space-y-3';
  const title = document.createElement('div');
  title.innerHTML = `<p class="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">Selected cannula</p><h3 class="text-base font-semibold text-primary-900 dark:text-white">${entry.manufacturer} · ${entry.model}</h3><p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${getPressureDropGroupLabel(entry.category)} · ${entry.size || 'Unknown size'}</p>`;
  card.appendChild(title);

  const facts = document.createElement('dl');
  facts.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-xs';
  const orderCodeText = getPressureDropOrderCodeText(entry);
  const dataStatusText = formatPressureDropDataStatus(entry.dataStatus);
  const flowRangeText = getPressureDropFlowRange(entry);
  [
    entry.connectorSize ? ['Connector size', entry.connectorSize] : null,
    entry.connectionSite ? ['Connection site', entry.connectionSite] : null,
    orderCodeText && orderCodeText !== '—' ? ['Order code', orderCodeText] : null,
    entry.testMedium ? ['Test medium', entry.testMedium] : null,
    dataStatusText && dataStatusText !== '—' ? ['Data status', dataStatusText] : null,
    flowRangeText && flowRangeText !== '—' ? ['Flow range', flowRangeText] : null
  ].filter(Boolean).forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'rounded-lg bg-slate-50 dark:bg-primary-800/60 p-2';
    const dt = document.createElement('dt');
    dt.className = 'text-slate-500 dark:text-slate-400';
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.className = 'mt-1 font-medium text-slate-700 dark:text-slate-200 break-words';
    dd.textContent = value;
    item.append(dt, dd);
    facts.appendChild(item);
  });
  card.appendChild(facts);
  card.appendChild(getPressureDropSourceNode(entry, true, { showMissingPublicLinkNote: true }));

  const details = document.createElement('details');
  details.className = 'rounded-lg border border-slate-200 dark:border-primary-800 bg-slate-50 dark:bg-primary-900/50 p-3 text-xs text-slate-600 dark:text-slate-300';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer font-semibold text-accent-700 dark:text-accent-300';
  summary.textContent = 'Digitization note and limitations';
  const note = document.createElement('p');
  note.className = 'mt-2 leading-relaxed';
  note.textContent = entry.digitizationNote || 'Manufacturer pressure-drop reference data.';
  details.append(summary, note);
  if (entry.notes) {
    const notes = document.createElement('p');
    notes.className = 'mt-2 leading-relaxed';
    notes.textContent = entry.notes;
    details.appendChild(notes);
  }
  card.appendChild(details);
  return card;
}

function createPressureDropLookupResult(entry, flowInputValue, flowValue, onFlowInput) {
  const interpolationResult = interpolatePressureDrop(entry.points, flowValue);
  const wrap = document.createElement('div');
  wrap.className = 'space-y-4';
  wrap.appendChild(createPressureDropEstimateCard(entry, flowInputValue, flowValue, interpolationResult, onFlowInput));
  wrap.appendChild(createPressureDropChartPanel(entry, flowValue, interpolationResult));
  wrap.appendChild(createPressureDropSelectedSummary(entry));
  return wrap;
}

function createPressureDropAvailableDatasetsDetails(entries, onSelect) {
  const details = document.createElement('details');
  details.className = 'rounded-xl border border-slate-200 dark:border-primary-800 bg-slate-50/60 dark:bg-primary-900/40 p-4';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer text-sm font-semibold text-primary-900 dark:text-white';
  summary.textContent = `Available datasets (${entries.length})`;
  const note = document.createElement('p');
  note.className = 'mt-2 text-xs text-slate-500 dark:text-slate-400';
  note.textContent = 'Compact index of available manufacturer datasets. Click any item to load it in the lookup.';

  const list = document.createElement('div');
  list.className = 'mt-3 max-h-96 overflow-y-auto pr-1 grid gap-2';
  entries.forEach(entry => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'w-full text-left rounded-lg border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/70 p-3 hover:border-accent-500/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 transition-colors';
    const connectionText = entry.connectionSite ? ` · ${entry.connectionSite}` : '';
    const sourceText = entry.sourceLabel ? ` · ${entry.sourceLabel}` : '';
    button.innerHTML = `<span class="block text-sm font-semibold text-primary-900 dark:text-white">${entry.manufacturer || 'Unknown manufacturer'} · ${entry.model || 'Unknown model'}</span><span class="mt-1 block text-xs text-slate-500 dark:text-slate-400">${getPressureDropGroupLabel(entry.category)} · ${entry.size || 'Unknown size'}${connectionText} · ${getPressureDropFlowRange(entry)}${sourceText}</span>`;
    button.addEventListener('click', () => onSelect(entry));
    list.appendChild(button);
  });

  details.append(summary, note, list);
  return details;
}

async function initCannulaPressureDropPage() {
  const page = el('cannula-pressure-drop-page');
  const root = el('pressure-drop-reference-root');
  if (!page || !root) return;

  const loading = el('pressure-drop-loading');
  const error = el('pressure-drop-error');
  const empty = el('pressure-drop-empty');
  const filterPanel = el('pressure-drop-filter-panel');
  const results = el('pressure-drop-results');
  const status = el('pressure-drop-result-status');
  if (!filterPanel || !results || !status) return;

  const setState = ({ isLoading = false, isError = false, isEmpty = false } = {}) => {
    if (loading) loading.classList.toggle('hidden', !isLoading);
    if (error) error.classList.toggle('hidden', !isError);
    if (empty) empty.classList.toggle('hidden', !isEmpty);
    results.classList.toggle('hidden', isLoading || isError || isEmpty);
  };

  try {
    setState({ isLoading: true });
    const entries = getCannulaPressureDropReferenceEntries(await loadCannulaPressureDropData()).map((entry, index) => ({ ...entry, lookupId: `pressure-drop-entry-${index}` }));

    const controls = {
      manufacturerSelect: el('pressure-drop-page-manufacturer'),
      modelSelect: el('pressure-drop-page-model'),
      categorySelect: el('pressure-drop-page-category'),
      sizeSelect: el('pressure-drop-page-size'),
      connectionSelect: el('pressure-drop-page-connection'),
      flowInput: el('pressure-drop-page-flow'),
      connectionWrap: el('pressure-drop-page-connection-wrap')
    };
    const resetButton = el('pressure-drop-page-reset');
    const modelCombobox = createPressureDropSearchableSelect(controls.modelSelect, 'Select model / cannula');

    const refreshModelCombobox = () => {
      if (modelCombobox) modelCombobox.refresh();
    };

    const populateLookupOptions = (changedLevel = '') => {
      if (changedLevel === 'manufacturer') {
        if (controls.modelSelect) controls.modelSelect.value = '';
        if (controls.categorySelect) controls.categorySelect.value = '';
        if (controls.sizeSelect) controls.sizeSelect.value = '';
        if (controls.connectionSelect) controls.connectionSelect.value = '';
      } else if (changedLevel === 'model') {
        if (controls.sizeSelect) controls.sizeSelect.value = '';
        if (controls.connectionSelect) controls.connectionSelect.value = '';
      } else if (changedLevel === 'category') {
        if (controls.modelSelect) controls.modelSelect.value = '';
        if (controls.sizeSelect) controls.sizeSelect.value = '';
        if (controls.connectionSelect) controls.connectionSelect.value = '';
      } else if (changedLevel === 'size') {
        if (controls.connectionSelect) controls.connectionSelect.value = '';
      }

      setPressureDropSelectOptionPairs(controls.manufacturerSelect, getUniquePressureDropOptionPairs(entries, entry => entry.manufacturer), 'Select manufacturer');

      const manufacturerValue = controls.manufacturerSelect?.value || '';
      const categoryEntries = getPressureDropLookupMatches(entries, { manufacturer: manufacturerValue });
      setPressureDropSelectOptionPairs(controls.categorySelect, getUniquePressureDropCategoryOptionPairs(categoryEntries), 'Select type');

      const categoryValue = controls.categorySelect?.value || '';
      const modelEntries = getPressureDropLookupMatches(entries, { manufacturer: manufacturerValue, category: categoryValue });
      setPressureDropSelectOptionPairs(controls.modelSelect, getUniquePressureDropOptionPairs(modelEntries, entry => entry.model), 'Select model / cannula');
      refreshModelCombobox();

      const sizeEntries = getPressureDropLookupMatches(entries, {
        manufacturer: manufacturerValue,
        category: controls.categorySelect?.value || '',
        model: controls.modelSelect?.value || ''
      });
      setPressureDropSelectOptionPairs(controls.sizeSelect, getUniquePressureDropOptionPairs(sizeEntries, entry => entry.size), 'Select size');

      const connectionEntries = getPressureDropLookupMatches(entries, {
        manufacturer: controls.manufacturerSelect?.value || '',
        category: controls.categorySelect?.value || '',
        model: controls.modelSelect?.value || '',
        size: controls.sizeSelect?.value || ''
      });
      const connectionOptions = controls.sizeSelect?.value
        ? getUniquePressureDropOptionPairs(connectionEntries, getPressureDropConnectionOptionValue, getPressureDropConnectionOptionLabel)
        : [];
      syncPressureDropConnectionControl(
        controls.connectionSelect,
        controls.connectionWrap,
        connectionOptions,
        Boolean(controls.sizeSelect?.value) && connectionOptions.length >= 2
      );
    };

    const focusResultFlowInput = () => {
      const resultFlowInput = el('pressure-drop-result-flow');
      if (!resultFlowInput) return;
      resultFlowInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
      resultFlowInput.focus({ preventScroll: true });
    };

    const selectEntry = (entry) => {
      if (controls.manufacturerSelect) controls.manufacturerSelect.value = entry.manufacturer || '';
      populateLookupOptions('');
      if (controls.modelSelect) controls.modelSelect.value = entry.model || '';
      populateLookupOptions('');
      if (controls.categorySelect) controls.categorySelect.value = getPressureDropCategoryFilterValue(entry.category);
      populateLookupOptions('');
      if (controls.sizeSelect) controls.sizeSelect.value = entry.size || '';
      populateLookupOptions('');
      if (controls.connectionSelect) controls.connectionSelect.value = getPressureDropConnectionOptionValue(entry);
      render({ focusResultFlow: true });
    };

    const syncFlowInput = (value, options = {}) => {
      if (controls.flowInput) controls.flowInput.value = value;
      render(options);
    };

    const render = ({ focusResultFlow = false } = {}) => {
      populateLookupOptions('');
      const filters = getPressureDropLookupSelection(controls);
      const candidates = getPressureDropLookupMatches(entries, filters);
      const selectedEntry = candidates.length === 1 ? candidates[0] : null;
      const flowInputValue = controls.flowInput?.value || '';
      const flowValue = parsePressureDropFlowInput(flowInputValue);
      results.innerHTML = '';

      if (!entries.length) {
        status.textContent = 'No pressure-drop references loaded';
        setState({ isEmpty: true });
        return;
      }

      if (!selectedEntry) {
        status.textContent = `${candidates.length} matching references · ${entries.length} total`;
        results.appendChild(createPressureDropLookupPrompt(candidates, entries.length));
        if (candidates.length && candidates.length < entries.length) {
          results.appendChild(createPressureDropCandidateList(candidates, selectEntry));
        }
        results.appendChild(createPressureDropAvailableDatasetsDetails(entries, selectEntry));
        setState({});
        return;
      }

      status.textContent = `Selected ${selectedEntry.manufacturer} · ${selectedEntry.model} · ${selectedEntry.size || 'size not specified'}`;
      results.appendChild(createPressureDropLookupResult(selectedEntry, flowInputValue, flowValue, value => syncFlowInput(value, { focusResultFlow: true })));
      results.appendChild(createPressureDropAvailableDatasetsDetails(entries, selectEntry));
      setState({});
      if (focusResultFlow) requestAnimationFrame(focusResultFlowInput);
    };

    [
      ['manufacturer', controls.manufacturerSelect],
      ['model', controls.modelSelect],
      ['category', controls.categorySelect],
      ['size', controls.sizeSelect],
      ['connection', controls.connectionSelect]
    ].forEach(([level, select]) => {
      if (select) select.addEventListener('change', () => { populateLookupOptions(level); render(); });
    });
    if (controls.flowInput) controls.flowInput.addEventListener('input', render);
    if (resetButton) resetButton.addEventListener('click', () => {
      Object.values(controls).forEach(control => { if (control && 'value' in control) control.value = ''; });
      populateLookupOptions('manufacturer');
      render();
    });

    populateLookupOptions('');
    render();
  } catch (err) {
    console.error('Failed to render cannula pressure drop page', err);
    setState({ isError: true });
  }
}

function getQuickReferenceHashId() {
  return decodeURIComponent((window.location.hash || '').replace(/^#/, ''));
}

function getQuickReferenceHashTabId() {
  const hashId = getQuickReferenceHashId();
  if (!hashId || hashId === 'cannula-pressure-drop') return '';
  const tabs = (getQuickReferenceData().tabs || []);
  return tabs.some(tab => tab.id === hashId) ? hashId : '';
}

function hasQuickReferenceHashTarget() {
  const hashId = getQuickReferenceHashId();
  if (!hashId || hashId === 'cannula-pressure-drop') return false;
  return Boolean(getQuickReferenceHashTabId() || document.getElementById(hashId));
}

function isQuickReferencePagePath() {
  const path = window.location.pathname || '';
  return path.includes('/quick-reference') || path.endsWith('/quick-reference/') || path === '/quick-reference';
}

function shouldPreserveQuickReferenceHashScroll() {
  return isQuickReferencePagePath() && hasQuickReferenceHashTarget();
}

function shouldRedirectLegacyQuickReferencePressureDropHash() {
  return isQuickReferencePagePath() && (window.location.hash || '') === '#cannula-pressure-drop';
}

function initQuickReference() {
  if (shouldRedirectLegacyQuickReferencePressureDropHash()) {
    window.location.replace('/cannula-pressure-drop/');
    return;
  }

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

  const setActiveTab = (tabId, focusTab = false, updateHash = false) => {
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
    if (updateHash && window.location.hash !== `#${tabId}`) {
      history.replaceState(null, '', `#${tabId}`);
    }
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
    setActiveTab(button.dataset.tabId, false, true);
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
    if (nextButton) setActiveTab(nextButton.dataset.tabId, true, true);
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

  const hashTab = getQuickReferenceHashTabId();
  if (hashTab) {
    setActiveTab(hashTab);
    const scrollHashPanelIntoView = () => {
      const activeButton = tabList.querySelector(`[data-tab-id="${hashTab}"]`);
      if (activeButton) activeButton.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const panel = panelContainer.querySelector(`[data-tab-id="${hashTab}"]`);
      if (panel) panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    requestAnimationFrame(scrollHashPanelIntoView);
    setTimeout(scrollHashPanelIntoView, 80);
  }

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

function calculatePhnTargetMm(bsa, targetZ, coeff) {
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  const zValue = Number(targetZ);
  if (!Number.isFinite(zValue)) throw new Error('Target Z-score must be a number.');
  const bsaPowAlpha = Math.pow(bsaValue, coeff.alpha);
  // PHN reverse formula (mm): target = (mean + targetZ × sd) × BSA^alpha × 10.
  return cmToMm((coeff.mean + zValue * coeff.sd) * bsaPowAlpha);
}

function calculatePettersenMeanLn(bsa, coeff) {
  const bsaValue = validatePositiveNumber(bsa, 'BSA');
  ['b0', 'b1', 'b2', 'b3', 'mse'].forEach((key) => {
    if (!Number.isFinite(coeff[key])) throw new Error('Coefficient missing');
  });
  return coeff.b0 + coeff.b1 * bsaValue + coeff.b2 * Math.pow(bsaValue, 2) + coeff.b3 * Math.pow(bsaValue, 3);
}

function calculatePettersenZScore(measuredMm, bsa, coeff) {
  const measured = validatePositiveNumber(measuredMm, 'Measured value');
  const meanLn = calculatePettersenMeanLn(bsa, coeff);
  // Detroit/Pettersen 2008 uses ln(measurement in cm) and sqrt(MSE) as the denominator.
  return (Math.log(measured / CM_TO_MM) - meanLn) / Math.sqrt(coeff.mse);
}

function calculatePettersenTargetMm(bsa, targetZ, coeff) {
  const zValue = Number(targetZ);
  if (!Number.isFinite(zValue)) throw new Error('Target Z-score must be a number.');
  const meanLn = calculatePettersenMeanLn(bsa, coeff);
  return cmToMm(Math.exp(meanLn + zValue * Math.sqrt(coeff.mse)));
}

function hasCompletePettersenCoefficients(coeff) {
  return Boolean(coeff) && ['b0', 'b1', 'b2', 'b3', 'mse'].every((key) => Number.isFinite(coeff[key]));
}

function buildZScoreModels() {
  const phnStructures = phnCoeffSource.PHN_STRUCTURE_ORDER.map((key) => ({
    key,
    label: phnCoeffSource.PHN_STRUCTURES[key].label,
    calculationType: 'phn',
    coefficients: phnCoeffSource.PHN_STRUCTURES[key]
  }));

  const detroitStructures = phnCoeffSource.PEDIATRIC_STRUCTURE_ORDER
    .map((key) => {
      const structure = phnCoeffSource.PEDIATRIC_STRUCTURES[key];
      const coeff = structure && structure.pettersenKey ? phnCoeffSource.PETTERSEN_STRUCTURES[structure.pettersenKey] : null;
      if (!hasCompletePettersenCoefficients(coeff)) return null;
      return {
        key,
        label: structure.label,
        calculationType: 'pettersen',
        coefficients: coeff
      };
    })
    .filter(Boolean);

  return {
    phnLopez: {
      label: 'PHN / Lopez',
      unit: 'cm-internal-mm-display',
      structures: phnStructures
    },
    detroitPettersen2008: {
      label: 'Detroit / Pettersen 2008',
      unit: 'cm-internal-mm-display',
      structures: detroitStructures
    }
  };
}

const zScoreModels = buildZScoreModels();

const selectedModelRangeNote = {
  phnLopez: 'PHN / Lopez: Developed from healthy, non-obese pediatric subjects up to 18 years. Use caution when applying to patients outside typical pediatric body size ranges.',
  detroitPettersen2008: 'Detroit / Pettersen 2008: Developed from patients aged 1 day to 18 years. Recommended calculator range: BSA up to approximately 2.0 m². Use caution above this range.'
};

const MODEL_CONSISTENCY_NOTE = 'Z-scores and expected sizes may differ between models. Use the same model consistently for serial follow-up.';

function shouldShowDetroitBsaWarning(modelKey, bsa) {
  return modelKey === 'detroitPettersen2008' && Number(bsa) > 2.0;
}

function getEquivalentStructureKey(currentKey, targetModelKey) {
  const targetModel = zScoreModels[targetModelKey];
  const targetStructures = targetModel?.structures || [];
  const firstTargetKey = targetStructures[0]?.key || '';
  if (!currentKey || !targetModel) return firstTargetKey;

  const targetSupports = (key) => targetStructures.some((structure) => structure.key === key);
  if (targetSupports(currentKey)) return currentKey;

  const targetMapKey = targetModelKey === 'phnLopez'
    ? 'phnKey'
    : (targetModelKey === 'detroitPettersen2008' ? 'pettersenKey' : null);
  if (!targetMapKey) return firstTargetKey;

  const pediatricStructures = phnCoeffSource.PEDIATRIC_STRUCTURES || {};
  const mappedStructure = Object.values(pediatricStructures).find((structure) => (
    structure.phnKey === currentKey || structure.pettersenKey === currentKey
  ));
  const mappedTargetKey = mappedStructure?.[targetMapKey];
  return mappedTargetKey && targetSupports(mappedTargetKey) ? mappedTargetKey : firstTargetKey;
}

function calculateModelTargetMm(modelKey, structureKey, bsa, targetZ) {
  const model = zScoreModels[modelKey];
  if (!model) throw new Error('Select a supported reference model.');
  const structure = model.structures.find((item) => item.key === structureKey);
  if (!structure) throw new Error('Select a structure supported by the selected model.');
  if (structure.calculationType === 'phn') return calculatePhnTargetMm(bsa, targetZ, structure.coefficients);
  if (structure.calculationType === 'pettersen') return calculatePettersenTargetMm(bsa, targetZ, structure.coefficients);
  throw new Error('Unsupported calculation type.');
}

function calculateModelExpectedSizes(modelKey, structureKey, bsa, targetZ) {
  return {
    zNeg2Mm: calculateModelTargetMm(modelKey, structureKey, bsa, -2),
    z0Mm: calculateModelTargetMm(modelKey, structureKey, bsa, 0),
    zPos2Mm: calculateModelTargetMm(modelKey, structureKey, bsa, 2),
    targetMm: calculateModelTargetMm(modelKey, structureKey, bsa, targetZ)
  };
}

function calculateModelMeasuredZScore(modelKey, structureKey, measuredMm, bsa) {
  const measured = validatePositiveNumber(measuredMm, 'Measured value');
  const model = zScoreModels[modelKey];
  if (!model) throw new Error('Select a supported reference model.');
  const structure = model.structures.find((item) => item.key === structureKey);
  if (!structure) throw new Error('Select a structure supported by the selected model.');
  if (structure.calculationType === 'phn') return calculateForwardZScore(measured / CM_TO_MM, bsa, structure.coefficients);
  if (structure.calculationType === 'pettersen') return calculatePettersenZScore(measured, bsa, structure.coefficients);
  throw new Error('Unsupported calculation type.');
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

function getModelBsaWarnings(modelKey, bsa) {
  if (!modelKey) return [];
  const val = validatePositiveNumber(bsa, 'BSA');
  if (modelKey === 'detroitPettersen2008') {
    return val > 2.0
      ? ['BSA is above the usual Detroit / Pettersen 2008 calculator range. Interpret results with caution.']
      : [];
  }
  if (modelKey === 'phnLopez') {
    const limits = phnCoeffSource.PHN_BSA_LIMITS;
    const warnings = [];
    if (val < limits.min || val > limits.max) {
      warnings.push(`BSA ${val.toFixed(2)} m² is outside the reference range (${limits.min.toFixed(2)}–${limits.max.toFixed(2)} m²).`);
    }
    if (val > limits.extrapolationFlag) {
      warnings.push('PHN / Lopez was developed from pediatric subjects up to 18 years. Use caution outside pediatric body size ranges.');
    }
    return warnings;
  }
  return [];
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
  PEDIATRIC_STRUCTURE_ORDER: phnCoeffSource.PEDIATRIC_STRUCTURE_ORDER,
  PEDIATRIC_STRUCTURES: phnCoeffSource.PEDIATRIC_STRUCTURES,
  PETTERSEN_STRUCTURES: phnCoeffSource.PETTERSEN_STRUCTURES,
  zScoreModels,
  selectedModelRangeNote,
  MODEL_CONSISTENCY_NOTE,
  shouldShowDetroitBsaWarning,
  getEquivalentStructureKey,
  calculateHaycockBSA,
  calculateInverseRange,
  calculateForwardZScore,
  calculatePhnTargetMm,
  calculatePettersenMeanLn,
  calculatePettersenZScore,
  calculatePettersenTargetMm,
  calculateModelTargetMm,
  calculateModelExpectedSizes,
  calculateModelMeasuredZScore,
  calculateRegressionReferenceCm,
  getBsaWarnings,
  getModelBsaWarnings,
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
  const wrapper = el('phn-results-wrapper');
  if (wrapper) wrapper.classList.remove('hidden');
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

function clearPhnReferenceRows() {
  const resultsEl = el('phn-results');
  if (resultsEl) resultsEl.innerHTML = '';

  const wrapper = el('phn-results-wrapper');
  if (wrapper) wrapper.classList.add('hidden');

  const debugOutput = el('phn-debug-output');
  if (debugOutput) debugOutput.textContent = '';
}

function clearPhnOutputs() {
  const displayEl = el('phn-bsa-display');
  if (displayEl) displayEl.textContent = '—';

  renderPhnWarnings([]);
  clearPhnReferenceRows();

  if (typeof clearSelectedModelOutputs === 'function') {
    clearSelectedModelOutputs();
  } else if (typeof clearPhnComparison === 'function') {
    clearPhnComparison();
  }
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
  updatePhnModelComparison();
  const selectedModelKey = getPhnSelectedModel()?.key;
  renderPhnWarnings(window.PhnCalculator.getModelBsaWarnings(selectedModelKey, bsaValue));
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

const PHN_DEFAULT_MODEL_KEY = 'phnLopez';
let phnZScoreState = {
  selectedModel: PHN_DEFAULT_MODEL_KEY,
  selectedStructure: null,
  targetZ: 0,
  measuredMm: null,
  bsa: null
};

function getPhnModelKeys() {
  return Object.keys(window.PhnCalculator?.zScoreModels || {});
}

function getPhnSelectedModel() {
  const models = window.PhnCalculator?.zScoreModels || {};
  const modelSelect = el('phn-model-select');
  const selectedModel = modelSelect && models[modelSelect.value] ? modelSelect.value : PHN_DEFAULT_MODEL_KEY;
  return models[selectedModel] ? { key: selectedModel, model: models[selectedModel] } : null;
}

function formatPhnSizeMm(valueMm) {
  if (!Number.isFinite(valueMm)) return '—';
  return `${window.PhnCalculator.clampToDisplayMm(valueMm).toFixed(1)} mm`;
}

function setPhnText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function updatePhnModelRangeNotes(modelKey) {
  if (!window.PhnCalculator) return;
  const rangeNote = window.PhnCalculator.selectedModelRangeNote?.[modelKey] || '';
  setPhnText('phn-model-range-note', rangeNote);
  setPhnText('phn-model-consistency-note', window.PhnCalculator.MODEL_CONSISTENCY_NOTE || 'Z-scores and expected sizes may differ between models. Use the same model consistently for serial follow-up.');
}

function updatePhnBsaRangeWarning(modelKey, bsaValue) {
  const warning = el('phn-model-bsa-warning');
  if (!warning || !window.PhnCalculator) return;
  const showWarning = window.PhnCalculator.shouldShowDetroitBsaWarning(modelKey, bsaValue);
  warning.classList.toggle('hidden', !showWarning);
}

function populatePhnModelOptions() {
  const modelSelect = el('phn-model-select');
  if (!modelSelect || !window.PhnCalculator?.zScoreModels) return;
  const currentValue = modelSelect.value || PHN_DEFAULT_MODEL_KEY;
  modelSelect.innerHTML = '';
  getPhnModelKeys().forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = window.PhnCalculator.zScoreModels[key].label;
    modelSelect.appendChild(option);
  });
  modelSelect.value = window.PhnCalculator.zScoreModels[currentValue] ? currentValue : PHN_DEFAULT_MODEL_KEY;
}

function populatePhnStructureOptions(preferredKey = '') {
  const structureSelect = el('phn-structure-select');
  const selected = getPhnSelectedModel();
  if (!structureSelect || !selected) return;
  const structures = selected.model.structures || [];
  const currentValue = preferredKey || structureSelect.value || phnZScoreState.selectedStructure;
  structureSelect.innerHTML = '';
  structures.forEach((structure) => {
    const option = document.createElement('option');
    option.value = structure.key;
    option.textContent = structure.label;
    structureSelect.appendChild(option);
  });
  const nextStructure = window.PhnCalculator.getEquivalentStructureKey
    ? window.PhnCalculator.getEquivalentStructureKey(currentValue, selected.key)
    : (structures.some((structure) => structure.key === currentValue) ? currentValue : (structures[0] ? structures[0].key : ''));
  structureSelect.value = nextStructure;
  phnZScoreState.selectedStructure = nextStructure;
}

function updatePhnMeasuredStructureOptions() {
  populatePhnModelOptions();
  populatePhnStructureOptions();
  updatePhnModelRangeNotes(getPhnSelectedModel()?.key || PHN_DEFAULT_MODEL_KEY);
}

function clearSelectedModelOutputs() {
  ['phn-result-model', 'phn-result-structure', 'phn-result-bsa', 'phn-expected-neg2', 'phn-expected-zero', 'phn-expected-pos2', 'phn-expected-target'].forEach((id) => setPhnText(id, '—'));
  setPhnText('phn-target-z-label', '0.0');
  updatePhnBsaRangeWarning(phnZScoreState.selectedModel, null);
  const measuredOutput = el('phn-measured-z');
  if (measuredOutput) measuredOutput.innerHTML = 'Calculated Z-score: <span class="result-number">—</span>';
  setPhnText('phn-measured-help', 'Enter BSA and a measured value to calculate Z-score.');
}

function readPhnZScoreState() {
  const selected = getPhnSelectedModel();
  const structureSelect = el('phn-structure-select');
  const targetInput = el('phn-target-z');
  const measuredInput = el('phn-measured-mm');
  const bsaInput = el('phn-bsa-input');
  const targetZ = targetInput && targetInput.value !== '' ? Number(targetInput.value) : 0;
  const measuredMm = measuredInput && measuredInput.value !== '' ? Number(measuredInput.value) : null;
  phnZScoreState = {
    selectedModel: selected ? selected.key : PHN_DEFAULT_MODEL_KEY,
    selectedStructure: structureSelect ? structureSelect.value : null,
    targetZ,
    measuredMm,
    bsa: bsaInput && bsaInput.value !== '' ? Number(bsaInput.value) : null
  };
  return phnZScoreState;
}

function updatePhnModelComparison() {
  if (!window.PhnCalculator) return;
  const selected = getPhnSelectedModel();
  if (!selected) return;
  const state = readPhnZScoreState();
  const structure = selected.model.structures.find((item) => item.key === state.selectedStructure);
  updatePhnModelRangeNotes(state.selectedModel);
  updatePhnBsaRangeWarning(state.selectedModel, state.bsa);

  setPhnText('phn-result-model', selected.model.label);
  setPhnText('phn-result-structure', structure ? structure.label : '—');
  setPhnText('phn-result-bsa', state.bsa && state.bsa > 0 ? `${state.bsa.toFixed(2)} m²` : '—');
  setPhnText('phn-target-z-label', Number.isFinite(state.targetZ) ? state.targetZ.toFixed(1) : '—');

  if (!(state.bsa > 0) || !structure) {
    ['phn-expected-neg2', 'phn-expected-zero', 'phn-expected-pos2', 'phn-expected-target'].forEach((id) => setPhnText(id, '—'));
    setPhnText('phn-measured-help', 'Enter BSA and a measured value to calculate Z-score.');
    return;
  }

  if (!Number.isFinite(state.targetZ)) {
    setPhnError('Target Z-score must be a number.');
    return;
  }

  try {
    const expected = window.PhnCalculator.calculateModelExpectedSizes(state.selectedModel, state.selectedStructure, state.bsa, state.targetZ);
    setPhnText('phn-expected-neg2', formatPhnSizeMm(expected.zNeg2Mm));
    setPhnText('phn-expected-zero', formatPhnSizeMm(expected.z0Mm));
    setPhnText('phn-expected-pos2', formatPhnSizeMm(expected.zPos2Mm));
    setPhnText('phn-expected-target', formatPhnSizeMm(expected.targetMm));
    setPhnError('');
  } catch (error) {
    setPhnError(error.message || 'Unable to compute expected size.');
    return;
  }

  const measuredOutput = el('phn-measured-z');
  if (state.measuredMm == null) {
    if (measuredOutput) measuredOutput.innerHTML = 'Calculated Z-score: <span class="result-number">—</span>';
    setPhnText('phn-measured-help', 'Enter a measured value to calculate Z-score.');
    return;
  }

  if (!(state.measuredMm > 0)) {
    if (measuredOutput) measuredOutput.innerHTML = 'Calculated Z-score: <span class="result-number">—</span>';
    setPhnText('phn-measured-help', 'Measured value must be a positive number.');
    return;
  }

  try {
    const zScore = window.PhnCalculator.calculateModelMeasuredZScore(state.selectedModel, state.selectedStructure, state.measuredMm, state.bsa);
    if (measuredOutput) measuredOutput.innerHTML = `Calculated Z-score: <span class="result-number">${zScore.toFixed(2)}</span>`;
    setPhnText('phn-measured-help', `Calculated with ${selected.model.label} for ${structure.label}.`);
  } catch (error) {
    if (measuredOutput) measuredOutput.innerHTML = 'Calculated Z-score: <span class="result-number">—</span>';
    setPhnText('phn-measured-help', error.message || 'Unable to calculate measured Z-score.');
  }
}

function calculatePhnMeasuredZ() {
  updatePhnModelComparison();
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
  else if (path.includes('cannula-pressure-drop')) { key = 'cannula-pressure-drop'; }
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
    'cannula-pressure-drop': ['nav-cannula-pressure-drop', 'side-cannula-pressure-drop', 'mob-cannula-pressure-drop'],
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
  if (topResetRoutes.has(key) && !shouldPreserveQuickReferenceHashScroll()) {
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
  if (shouldPreserveQuickReferenceHashScroll()) return;

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

// -----------------------------
// Lightweight Feedback MVP
// -----------------------------
const FEEDBACK_CALCULATOR_ROUTES = {
  '/bsa/': 'bsa',
  '/gdp/': 'gdp',
  '/heparin/': 'heparin',
  '/predicted-hct/': 'predicted_hct',
  '/lbm/': 'lbm',
  '/timecalc/': 'timecalc',
  '/z-score/': 'z_score',
  '/cannula-pressure-drop/': 'cannula_pressure_drop',
  '/priming-volume/': 'priming_volume',
  '/unit-converter/': 'unit_converter',
  '/phn-echo/': 'phn_echo'
};
const FEEDBACK_STORAGE_KEY = 'pt_feedback_visitor_id';
const FEEDBACK_SESSION_COUNT_KEY = 'pt_feedback_session_count';
const FEEDBACK_LAST_PROMPT_KEY = 'pt_feedback_last_prompt_at';

function normalizeFeedbackPath(pathname) {
  const path = pathname || '/';
  return path.length > 1 && !path.endsWith('/') ? `${path}/` : path;
}

function getFeedbackVisitorId() {
  let visitorId = localStorage.getItem(FEEDBACK_STORAGE_KEY);
  if (!visitorId) {
    const randomPart = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    visitorId = `pt_${randomPart.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    localStorage.setItem(FEEDBACK_STORAGE_KEY, visitorId);
  }
  return visitorId;
}

function getDeviceType() {
  const width = window.innerWidth || 1024;
  if (width < 640) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function canShowFeedbackPrompt() {
  const lastPromptAt = Number(localStorage.getItem(FEEDBACK_LAST_PROMPT_KEY) || 0);
  const oneHourMs = 60 * 60 * 1000;
  return !lastPromptAt || Date.now() - lastPromptAt > oneHourMs;
}

function markFeedbackPromptShown() {
  localStorage.setItem(FEEDBACK_LAST_PROMPT_KEY, String(Date.now()));
}

function getFeedbackCardMarkup(calculatorKey) {
  return `
    <section class="feedback-card mt-8 rounded-2xl border border-slate-200 dark:border-primary-800 bg-white dark:bg-primary-900/80 shadow-card p-4 sm:p-5" data-calculator-key="${calculatorKey}" aria-live="polite">
      <div data-feedback-step="rating">
        <h2 class="text-base font-semibold text-primary-900 dark:text-white">Was this calculator helpful?</h2>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row">
          <button type="button" data-feedback-rating="useful" class="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50">Useful</button>
          <button type="button" data-feedback-rating="needs_improvement" class="rounded-xl border border-slate-300 dark:border-primary-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/50">Needs improvement</button>
          <button type="button" data-feedback-rating="not_useful" class="rounded-xl border border-slate-300 dark:border-primary-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-accent-500/60 focus:outline-none focus:ring-2 focus:ring-accent-500/50">Not useful</button>
        </div>
      </div>
      <form data-feedback-step="details" class="hidden space-y-3">
        <h2 class="text-base font-semibold text-primary-900 dark:text-white">Could you briefly tell us what could be improved?</h2>
        <textarea data-feedback-message rows="3" maxlength="1000" class="w-full rounded-xl border border-slate-300 dark:border-primary-700 bg-white dark:bg-primary-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent-500/50" placeholder="Optional comment"></textarea>
        <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">Please do not include patient-identifiable information. Feedback is stored with anonymous browser metadata to help improve this tool.</p>
        <label class="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input data-feedback-calculation-issue type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500" />
          <span>This may be a calculation issue</span>
        </label>
        <button type="submit" class="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/50">Submit feedback</button>
      </form>
      <p data-feedback-message-status class="mt-3 hidden text-sm font-medium text-accent-600 dark:text-accent-400"></p>
    </section>`;
}

function buildFeedbackPayload(card, rating, options = {}) {
  const isCalculationIssue = Boolean(options.isCalculationIssue);
  return {
    visitor_id: getFeedbackVisitorId(),
    page_path: normalizeFeedbackPath(window.location.pathname),
    calculator_key: card.dataset.calculatorKey,
    rating,
    category: isCalculationIssue ? 'calculation_issue' : 'general_feedback',
    message: options.message || '',
    language: navigator.language || '',
    device_type: getDeviceType()
  };
}

async function submitFeedback(card, payload) {
  const sessionCount = Number(sessionStorage.getItem(FEEDBACK_SESSION_COUNT_KEY) || 0);
  if (sessionCount >= 5) throw new Error('Please try again later.');
  const response = await fetch('/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error('Unable to submit feedback right now.');
  sessionStorage.setItem(FEEDBACK_SESSION_COUNT_KEY, String(sessionCount + 1));
  return response.json();
}

function setFeedbackStatus(card, text, isError = false) {
  const status = card.querySelector('[data-feedback-message-status]');
  if (!status) return;
  status.textContent = text;
  status.classList.remove('hidden', 'text-red-600', 'dark:text-red-400', 'text-accent-600', 'dark:text-accent-400');
  status.classList.add(isError ? 'text-red-600' : 'text-accent-600', isError ? 'dark:text-red-400' : 'dark:text-accent-400');
}

function initFeedbackCard() {
  const pagePath = normalizeFeedbackPath(window.location.pathname);
  const calculatorKey = FEEDBACK_CALCULATOR_ROUTES[pagePath];
  if (!calculatorKey || document.querySelector('.feedback-card') || !canShowFeedbackPrompt()) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', `<div class="max-w-3xl mx-auto px-4">${getFeedbackCardMarkup(calculatorKey)}</div>`);
  markFeedbackPromptShown();
  const card = document.querySelector('.feedback-card');
  const details = card.querySelector('[data-feedback-step="details"]');
  const ratingStep = card.querySelector('[data-feedback-step="rating"]');
  let selectedRating = '';

  card.querySelectorAll('[data-feedback-rating]').forEach(button => {
    button.addEventListener('click', async () => {
      selectedRating = button.dataset.feedbackRating;
      if (selectedRating === 'useful') {
        try {
          await submitFeedback(card, buildFeedbackPayload(card, selectedRating));
          ratingStep.classList.add('hidden');
          setFeedbackStatus(card, 'Thank you for your feedback.');
        } catch (error) {
          setFeedbackStatus(card, error.message, true);
        }
        return;
      }
      ratingStep.classList.add('hidden');
      details.classList.remove('hidden');
      const textarea = card.querySelector('[data-feedback-message]');
      if (textarea) textarea.focus();
    });
  });

  details.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = card.querySelector('[data-feedback-message]').value.trim();
    const isCalculationIssue = card.querySelector('[data-feedback-calculation-issue]').checked;
    try {
      await submitFeedback(card, buildFeedbackPayload(card, selectedRating, { message, isCalculationIssue }));
      details.classList.add('hidden');
      setFeedbackStatus(card, 'Feedback submitted. Thank you for helping improve PerfusionTools.');
    } catch (error) {
      setFeedbackStatus(card, error.message, true);
    }
  });
}

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
  const hasCannulaPressureDropPage = hasElement('cannula-pressure-drop-page');

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
          '/cannula-pressure-drop/',
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
          '/cannula-pressure-drop',
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
  if (hasCannulaPressureDropPage) initCannulaPressureDropPage();

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

    const tempSlider = el('gdp-temp-slider');
    const tempInput = el('gdp-temp-c');
    const syncGdpTemperature = (value, options = {}) => {
      const temperature = clamp(parseFloat(value) || GDP_DEFAULT_TEMPERATURE_C, 20, 37);
      const displayValue = temperature.toFixed(1);
      if (tempSlider) tempSlider.value = String(temperature);
      if (tempInput && options.commitInput !== false) tempInput.value = displayValue;
      updateGDP();
    };
    if (tempSlider) {
      tempSlider.addEventListener('input', () => syncGdpTemperature(tempSlider.value));
    }
    if (tempInput) {
      tempInput.addEventListener('input', () => syncGdpTemperature(tempInput.value, { commitInput: false }));
      tempInput.addEventListener('change', () => syncGdpTemperature(tempInput.value));
    }
    document.querySelectorAll('[data-gdp-temp-preset]').forEach((button) => {
      button.addEventListener('click', () => syncGdpTemperature(button.dataset.gdpTempPreset));
    });

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

    ['phn-model-select', 'phn-structure-select', 'phn-target-z', 'phn-measured-mm'].forEach((id) => {
      const node = el(id);
      if (node) node.addEventListener('input', updatePhnModelComparison);
      if (node && node.tagName === 'SELECT') {
        node.addEventListener('change', () => {
          if (id === 'phn-model-select') populatePhnStructureOptions(phnZScoreState.selectedStructure);
          updatePhnModelComparison();
        });
      }
    });

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
    ['priming-id', 'priming-custom-id', 'priming-length', 'priming-length-unit', 'priming-quantity'].forEach(id => {
      const x = el(id);
      if (x) {
        x.addEventListener('input', updatePrimingVolume);
        x.addEventListener('change', updatePrimingVolume);
        if (id === 'priming-length') {
          x.addEventListener('blur', () => {
            x.dataset.touched = 'true';
            updatePrimingVolume();
          });
        }
      }
    });
    ['priming-oxygenator-volume'].forEach(id => {
      const x = el(id);
      if (x) x.addEventListener('input', () => readPrimingNonNegative(x));
    });
    const oxygenatorModel = el('priming-oxygenator-model');
    if (oxygenatorModel) oxygenatorModel.addEventListener('change', handlePrimingOxygenatorModelChange);
    const addTubing = el('priming-add-tubing-item');
    if (addTubing) addTubing.addEventListener('click', addCurrentPrimingTubingItem);
    const addOxygenator = el('priming-add-oxygenator-item');
    if (addOxygenator) addOxygenator.addEventListener('click', addPrimingOxygenatorItem);
    const clearBuilder = el('priming-clear-builder');
    if (clearBuilder) clearBuilder.addEventListener('click', clearPrimingBuilderItems);
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
  initFeedbackCard();

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
  if (hasPrimingCalculator) {
    updatePrimingVolume();
    renderPrimingBuilder();
  }
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
