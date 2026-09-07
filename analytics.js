'use strict';

const gaMeasurementId = 'G-WZYBQ2VC7E';

window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag() {
  window.dataLayer.push(arguments);
};

const gaScript = document.createElement('script');
gaScript.async = true;
gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
document.head.appendChild(gaScript);

window.gtag('js', new Date());
window.gtag('config', gaMeasurementId);

// Informational views use history.pushState without a document reload.
// Send only page-level browser metadata after those route changes.
window.trackAnalyticsPageView = function trackAnalyticsPageView() {
  window.gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: `${window.location.pathname}${window.location.search}`,
    page_title: document.title
  });
};

// Calculator events intentionally accept identifiers only. Keeping the route and
// mode allowlists here prevents callers from accidentally forwarding form state,
// result text, or any other arbitrary properties to GA4.
const calculatorAnalyticsModes = Object.freeze({
  predicted_hct: new Set(['pre', 'onpump']),
  unit_converter: new Set(['flow', 'pressure', 'cannula']),
  timecalc: new Set(['record', 'live', 'transplant'])
});
const calculatorAnalyticsSlugs = new Set([
  'bsa', 'gdp', 'heparin', 'predicted_hct', 'priming_volume', 'z_score',
  'cannula_pressure_drop', 'lbm', 'unit_converter', 'timecalc'
]);
const calculatorAnalyticsState = { started: new Set(), completed: new Set() };

function sendCalculatorEvent(eventName, calculatorSlug, calculatorMode) {
  if (!calculatorAnalyticsSlugs.has(calculatorSlug) || typeof window.gtag !== 'function') return false;
  const parameters = { calculator_slug: calculatorSlug };
  const allowedModes = calculatorAnalyticsModes[calculatorSlug];
  if (allowedModes && allowedModes.has(calculatorMode)) parameters.calculator_mode = calculatorMode;
  try {
    window.gtag('event', eventName, parameters);
    return true;
  } catch (_) {
    return false;
  }
}

window.perfusionCalculatorAnalytics = Object.freeze({
  start(calculatorSlug, calculatorMode, isTrustedInteraction) {
    if (isTrustedInteraction !== true || calculatorAnalyticsState.started.has(calculatorSlug)) return false;
    if (!sendCalculatorEvent('calculator_start', calculatorSlug, calculatorMode)) return false;
    calculatorAnalyticsState.started.add(calculatorSlug);
    return true;
  },
  complete(calculatorSlug, calculatorMode) {
    const contextKey = `${calculatorSlug}:${calculatorMode || 'default'}`;
    if (!calculatorAnalyticsState.started.has(calculatorSlug) || calculatorAnalyticsState.completed.has(contextKey)) return false;
    if (!sendCalculatorEvent('calculation_complete', calculatorSlug, calculatorMode)) return false;
    calculatorAnalyticsState.completed.add(contextKey);
    return true;
  },
  copy(calculatorSlug, calculatorMode, isTrustedInteraction) {
    if (isTrustedInteraction !== true) return false;
    return sendCalculatorEvent('result_copy', calculatorSlug, calculatorMode);
  }
});
