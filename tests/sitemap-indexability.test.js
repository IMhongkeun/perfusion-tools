const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sitemapPaths = require('../sitemap-paths');

const repoRoot = path.join(__dirname, '..');
const rootSitemap = fs.readFileSync(path.join(repoRoot, 'sitemap.xml'), 'utf8');
const distSitemap = fs.readFileSync(path.join(repoRoot, 'dist', 'sitemap.xml'), 'utf8');
const redirects = fs.readFileSync(path.join(repoRoot, '_redirects'), 'utf8');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

const expectedIndexablePaths = [
  '/',
  '/bsa/',
  '/lbm/',
  '/gdp/',
  '/heparin/',
  '/predicted-hct/',
  '/z-score/',
  '/priming-volume/',
  '/timecalc/',
  '/unit-converter/',
  '/quick-reference/',
  '/cannula-pressure-drop/'
];

function extractLocs(xml) {
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'Sitemap should have an XML declaration.');
  assert(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Sitemap should include the sitemap urlset namespace.');
  assert(xml.trim().endsWith('</urlset>'), 'Sitemap should close the urlset element.');
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(match => match[1]);
}

function assertSitemapUrls(xml, label) {
  const locs = extractLocs(xml);
  expectedIndexablePaths.forEach(routePath => {
    assert(locs.includes(`https://perfusiontools.com${routePath}`), `${label} sitemap should include ${routePath}.`);
  });
  assert(!locs.includes('https://perfusiontools.com/info/'), `${label} sitemap should not include /info/ because it is a home rewrite, not a standalone indexable page.`);
  assert(!locs.includes('https://perfusiontools.com/privacy/'), `${label} sitemap should not include /privacy/ rewrite.`);
  assert(!locs.includes('https://perfusiontools.com/terms/'), `${label} sitemap should not include /terms/ rewrite.`);
  assert(!locs.includes('https://perfusiontools.com/contact/'), `${label} sitemap should not include /contact/ rewrite.`);
}

assert.deepStrictEqual(sitemapPaths, expectedIndexablePaths, 'Sitemap path registry should contain only canonical indexable pages.');
assertSitemapUrls(rootSitemap, 'Root');
assertSitemapUrls(distSitemap, 'Dist');
assert.strictEqual(rootSitemap, distSitemap, 'Root and dist sitemap.xml should stay synchronized.');
assert(redirects.includes('/info/      /             200'), '/info/ home rewrite rule should remain unchanged.');
assert(redirects.includes('/privacy/   /             200'), '/privacy/ rewrite should remain unchanged.');
assert(redirects.includes('/terms/     /             200'), '/terms/ rewrite should remain unchanged.');
assert(redirects.includes('/contact/   /             200'), '/contact/ rewrite should remain unchanged.');
assert(indexHtml.includes('<link rel="canonical" href="https://perfusiontools.com/" />'), 'Home canonical should remain unchanged.');
assert(indexHtml.includes('<title>Perfusion Tools – CPB & ECMO Calculators for Perfusionists</title>'), 'Home title should remain unchanged.');
assert(indexHtml.includes('"@type":"ItemList"'), 'Home ItemList JSON-LD should remain unchanged.');

console.log('All sitemap indexability tests passed.');
