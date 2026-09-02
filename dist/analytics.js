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
