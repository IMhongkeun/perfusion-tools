'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const measurementId = 'G-WZYBQ2VC7E';
const standaloneRoutes = [
  '/',
  '/bsa/',
  '/gdp/',
  '/predicted-hct/',
  '/priming-volume/',
  '/heparin/',
  '/z-score/',
  '/cannula-pressure-drop/',
  '/lbm/',
  '/unit-converter/',
  '/timecalc/',
  '/quick-reference/'
];
const rewrittenRoutes = ['/info/', '/privacy/', '/terms/', '/contact/'];

function routeToHtmlPath(root, route) {
  return route === '/' ? path.join(root, 'index.html') : path.join(root, route.slice(1), 'index.html');
}

function countMatches(contents, pattern) {
  return Array.from(contents.matchAll(pattern)).length;
}

const analyticsSource = fs.readFileSync(path.join(repoRoot, 'analytics.js'), 'utf8');
const analyticsOutput = fs.readFileSync(path.join(repoRoot, 'dist', 'analytics.js'), 'utf8');
assert.strictEqual(analyticsOutput, analyticsSource, 'Source and dist analytics.js must remain synchronized.');
assert.strictEqual(countMatches(analyticsSource, /const gaMeasurementId = 'G-[A-Z0-9]+';/g), 1, 'Analytics must declare exactly one GA4 Measurement ID.');
assert(analyticsSource.includes(`const gaMeasurementId = '${measurementId}';`), 'Analytics must use the intended GA4 Measurement ID.');
assert.strictEqual(countMatches(analyticsSource, /googletagmanager\.com\/gtag\/js/g), 1, 'gtag.js must be loaded exactly once.');
assert.strictEqual(countMatches(analyticsSource, /window\.gtag\('config', gaMeasurementId\)/g), 1, 'GA4 must be configured exactly once.');
assert.strictEqual(countMatches(analyticsSource, /window\.gtag\('event', 'page_view'/g), 1, 'The shared script must expose one SPA page-view sender.');

for (const route of standaloneRoutes) {
  const sourcePath = routeToHtmlPath(repoRoot, route);
  const outputPath = routeToHtmlPath(path.join(repoRoot, 'dist'), route);
  const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
  const outputHtml = fs.readFileSync(outputPath, 'utf8');

  assert.strictEqual(outputHtml, sourceHtml, `${route} source and dist HTML must remain synchronized.`);
  assert.strictEqual(countMatches(sourceHtml, /<script src="\/analytics\.js"><\/script>/g), 1, `${route} must load shared analytics exactly once.`);
  assert.strictEqual(countMatches(sourceHtml, /googletagmanager\.com\/gtag\/js|gtag\s*\(\s*['"]config['"]/g), 0, `${route} must not contain a duplicate inline GA implementation.`);
}

const redirects = fs.readFileSync(path.join(repoRoot, '_redirects'), 'utf8');
for (const route of rewrittenRoutes) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert(new RegExp(`^${escapedRoute}\\s+/\\s+200$`, 'm').test(redirects), `${route} must continue to rewrite to the tracked root document.`);
}

const allMeasurementIds = new Set(
  [analyticsSource, ...standaloneRoutes.map(route => fs.readFileSync(routeToHtmlPath(repoRoot, route), 'utf8'))]
    .flatMap(contents => Array.from(contents.matchAll(/G-[A-Z0-9]+/g), match => match[0]))
);
assert.deepStrictEqual([...allMeasurementIds], [measurementId], 'All GA4 references must use one consistent Measurement ID.');

const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
assert(mainJs.includes("current !== target && typeof window.trackAnalyticsPageView === 'function'"), 'SPA navigation must send a page view only when the route changes.');
assert.strictEqual(countMatches(mainJs, /window\.trackAnalyticsPageView\(\)/g), 2, 'Push-state and popstate navigation must each have one page-view call site.');
assert(mainJs.includes("window.addEventListener('popstate'"), 'Browser history navigation must remain tracked.');

console.log(`GA4 coverage verified for ${standaloneRoutes.length + rewrittenRoutes.length} public routes.`);
