const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const sitemapPaths = require('../sitemap-paths');
const { generateSitemap, getPageLastmod } = require('../generate-sitemap');

const repoRoot = path.join(__dirname, '..');
const rootSitemap = fs.readFileSync(path.join(repoRoot, 'sitemap.xml'), 'utf8');
const distSitemap = fs.readFileSync(path.join(repoRoot, 'dist', 'sitemap.xml'), 'utf8');
const redirects = fs.readFileSync(path.join(repoRoot, '_redirects'), 'utf8');
const indexHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const distIndexHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'index.html'), 'utf8');
const bsaHtml = fs.readFileSync(path.join(repoRoot, 'bsa', 'index.html'), 'utf8');
const distBsaHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'bsa', 'index.html'), 'utf8');

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

function getLastmodForLoc(xml, loc) {
  const urlBlocks = Array.from(xml.matchAll(/<url>([\s\S]*?)<\/url>/g))
    .map((match) => match[1]);
  const block = urlBlocks.find((entry) => entry.includes(`<loc>${loc}</loc>`));
  assert(block, `Sitemap entry should exist for ${loc}.`);

  const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/);
  return lastmodMatch ? lastmodMatch[1] : null;
}

function getJsonLdNodes(html) {
  return Array.from(
    html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
  )
    .map((match) => JSON.parse(match[1]))
    .flatMap((block) => block['@graph'] || [block]);
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

const bsaUrl = 'https://perfusiontools.com/bsa/';
const rootBsaLastmod = getLastmodForLoc(rootSitemap, bsaUrl);
const distBsaLastmod = getLastmodForLoc(distSitemap, bsaUrl);
assert.strictEqual(rootBsaLastmod, distBsaLastmod);
assert.strictEqual(bsaHtml, distBsaHtml, 'Source and dist BSA HTML should remain synchronized.');

const bsaNodes = getJsonLdNodes(bsaHtml);
const bsaMedicalPage = bsaNodes.find((node) => node['@type'] === 'MedicalWebPage');
assert(bsaMedicalPage, 'BSA MedicalWebPage structured data should exist.');
assert.strictEqual(bsaMedicalPage.url, bsaUrl);
assert.strictEqual(rootBsaLastmod, bsaMedicalPage.dateModified);

for (const routePath of expectedIndexablePaths) {
  const sourcePath = path.join(repoRoot, routePath.slice(1), 'index.html');
  const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
  const medicalPage = getJsonLdNodes(sourceHtml).find(node => node['@type'] === 'MedicalWebPage');
  const expectedLastmod = medicalPage && medicalPage.dateModified ? medicalPage.dateModified : null;
  assert.strictEqual(getLastmodForLoc(rootSitemap, `https://perfusiontools.com${routePath}`), expectedLastmod,
    `${routePath} lastmod should match source MedicalWebPage.dateModified, or be omitted when absent.`);
}

assert.strictEqual(generateSitemap(), rootSitemap, 'Generated sitemap should match tracked output.');
assert.strictEqual(generateSitemap(), generateSitemap(), 'Repeated generation should be byte-identical.');
const generatorSource = fs.readFileSync(path.join(repoRoot, 'generate-sitemap.js'), 'utf8');
function generateOnDate(today) {
  const context = {
    require: createRequire(path.join(repoRoot, 'generate-sitemap.js')),
    __dirname: repoRoot, module: { exports: {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [today])); }
      static now() { return Date.parse(today); }
    }
  };
  vm.runInNewContext(generatorSource, context);
  return context.module.exports.generateSitemap();
}
assert.strictEqual(generateOnDate('2026-10-04T00:00:00Z'), rootSitemap);
assert.strictEqual(generateOnDate('2027-01-15T00:00:00Z'), rootSitemap,
  'A later build calendar date must not change sitemap dates.');

const jsonLd = block => `<script type="application/ld+json">${JSON.stringify(block)}</script>`;
const datedPage = { '@type': 'MedicalWebPage', dateModified: '2026-10-04' };
assert.strictEqual(getPageLastmod(jsonLd(datedPage), 'fixture.html'), '2026-10-04');
assert.strictEqual(getPageLastmod(jsonLd({ '@graph': [datedPage] }), 'fixture.html'), '2026-10-04');
assert.strictEqual(getPageLastmod(jsonLd([datedPage]), 'fixture.html'), '2026-10-04');
assert.strictEqual(getPageLastmod(jsonLd({ ...datedPage, '@type': ['WebPage', 'MedicalWebPage'] }), 'fixture.html'), '2026-10-04');
assert.strictEqual(getPageLastmod('<script data-test="metadata" type=\'application/ld+json\'>' + JSON.stringify(datedPage) + '</script>', 'fixture.html'), '2026-10-04');
for (const block of [{ '@type': 'WebPage', dateModified: '2026-10-04' }, { '@type': 'MedicalWebPage' }]) {
  assert.strictEqual(getPageLastmod(jsonLd(block), 'fixture.html'), null);
}
assert.strictEqual(getPageLastmod('<html></html>', 'fixture.html'), null);
for (const dateModified of ['2026-02-29', '2026-13-01', '2026-04-31', '2026-10-04T00:00:00Z', '2026-1-4', 20261004]) {
  assert.strictEqual(getPageLastmod(jsonLd({ ...datedPage, dateModified }), 'fixture.html'), null);
}
assert.strictEqual(getPageLastmod(jsonLd({ ...datedPage, dateModified: '2028-02-29' }), 'fixture.html'), '2028-02-29');
assert.throws(() => getPageLastmod('<script type="application/ld+json">{broken}</script>', 'fixture.html'), /Malformed JSON-LD in fixture\.html/);
assert.throws(() => getPageLastmod(jsonLd(datedPage) + '<script type="application/ld+json">{broken}</script>', 'fixture.html'), /Malformed JSON-LD/,
  'Malformed later blocks must not be ignored after finding a date.');
assert.throws(() => generateSitemap(path.join(repoRoot, 'tests', 'sitemap-indexability.test.js')), /Cannot read sitemap source.*index\.html/);

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
