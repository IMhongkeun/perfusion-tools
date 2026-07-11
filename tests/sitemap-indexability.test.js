const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sitemapPaths = require('../sitemap-paths');

const repoRoot = path.join(__dirname, '..');
const rootSitemap = fs.readFileSync(path.join(repoRoot, 'sitemap.xml'), 'utf8');
const distSitemap = fs.readFileSync(path.join(repoRoot, 'dist', 'sitemap.xml'), 'utf8');
const redirects = fs.readFileSync(path.join(repoRoot, '_redirects'), 'utf8');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const distIndexHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'index.html'), 'utf8');

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


function getRouteMetaBlock(html, routePath) {
  const escapedRoute = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`"${escapedRoute}": \\{([\\s\\S]*?)\\n      \\}`, 'm');
  const match = html.match(pattern);
  assert(match, `Route metadata for ${routePath} should exist.`);
  return match[1];
}

function assertRouteMetaIncludes(html, routePath, expectedSnippets) {
  const block = getRouteMetaBlock(html, routePath);
  expectedSnippets.forEach(snippet => {
    assert(block.includes(snippet), `${routePath} metadata should include ${snippet}.`);
  });
  return block;
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
assert.strictEqual(indexHtml, distIndexHtml, 'Root and dist index.html should stay synchronized.');
assert(redirects.includes('/info/      /             200'), '/info/ home rewrite rule should remain unchanged.');
assert(redirects.includes('/privacy/   /             200'), '/privacy/ rewrite should remain unchanged.');
assert(redirects.includes('/terms/     /             200'), '/terms/ rewrite should remain unchanged.');
assert(redirects.includes('/contact/   /             200'), '/contact/ rewrite should remain unchanged.');
assert(indexHtml.includes('<link rel="canonical" href="https://perfusiontools.com/" />'), 'Home canonical should remain unchanged.');
assert(indexHtml.includes('<title>Perfusion Tools – CPB & ECMO Calculators for Perfusionists</title>'), 'Home title should remain unchanged.');
assert(indexHtml.includes('canonicalPath: "/"'), 'Home route metadata should keep canonical /.');
assert(!getRouteMetaBlock(indexHtml, '/').includes('noindex'), 'Home route metadata should remain indexable.');
assert(indexHtml.includes('"@type":"ItemList"'), 'Home ItemList JSON-LD should remain unchanged.');

const infoMeta = assertRouteMetaIncludes(indexHtml, '/info', ['canonicalPath: "/"', 'robots: "noindex,follow"']);
assert(!infoMeta.includes('canonicalPath: "/info/"'), '/info metadata should not self-canonicalize.');
assert(indexHtml.includes('<a href="/info/" data-route id="nav-info"'), 'Top navigation should keep the /info/ link.');
assert(indexHtml.includes('<a href="/info/" data-route id="side-info"'), 'Sidebar navigation should keep the /info/ link.');
assert(indexHtml.includes('<a href="/info/" data-route id="mob-info"'), 'Mobile navigation should keep the /info/ link.');

assertRouteMetaIncludes(indexHtml, '/privacy', ['canonicalPath: "/privacy/"', 'robots: "noindex,follow"']);
assertRouteMetaIncludes(indexHtml, '/terms', ['canonicalPath: "/terms/"', 'robots: "noindex,follow"']);
assertRouteMetaIncludes(indexHtml, '/contact', ['canonicalPath: "/contact/"', 'robots: "noindex,follow"']);

console.log('All sitemap indexability tests passed.');
