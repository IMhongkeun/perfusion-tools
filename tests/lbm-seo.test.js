'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lbmHtml = fs.readFileSync(path.join(root, 'lbm', 'index.html'), 'utf8');
const distLbmHtml = fs.readFileSync(path.join(root, 'dist', 'lbm', 'index.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sitemapXml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const robotsTxt = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
const routeRegistry = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const visibleText = stripTags(lbmHtml);
const expectedTitle = 'Lean Body Mass (LBM) Calculator | Boer & Hume Formulas';
const expectedTitleHtml = 'Lean Body Mass (LBM) Calculator | Boer &amp; Hume Formulas';
const expectedDescription = 'Calculate lean body mass from height, weight, and sex using Boer and Hume formulas. Compare estimates and review dosing-weight and clinical context.';
const expectedModifiedDate = '2026-10-04';

assert(lbmHtml.includes(`<title>${expectedTitleHtml}</title>`), 'LBM page title should exactly match the requested SERP title.');
assert(lbmHtml.includes(`<meta name="description" content="${expectedDescription}" />`), 'LBM meta description should exactly match the requested SERP description.');
assert(lbmHtml.includes(`<meta property="og:title" content="${expectedTitleHtml}" />`), 'LBM Open Graph title should stay synchronized with the page title.');
assert(lbmHtml.includes(`<meta property="og:description" content="${expectedDescription}" />`), 'LBM Open Graph description should stay synchronized with the page description.');
assert(lbmHtml.includes(`<meta name="twitter:title" content="${expectedTitleHtml}" />`), 'LBM Twitter title should stay synchronized with the page title.');
assert(lbmHtml.includes(`<meta name="twitter:description" content="${expectedDescription}" />`), 'LBM Twitter description should stay synchronized with the page description.');
assert(lbmHtml.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Lean Body Mass Calculator</h1>'), 'Visible H1 should be exactly Lean Body Mass Calculator.');
assert(visibleText.includes('Estimate lean body mass (LBM) using height, weight, sex, and the selected supported formula'), 'Top visible copy should mention LBM, height, weight, sex, and selected formula.');
assert(visibleText.includes('dosing-weight context and formula limitations'), 'Top visible copy should mention dosing-weight context and limitations.');
['Lean body mass', 'Adult estimate', 'Dosing-weight context', 'Formula limitations'].forEach(badge => {
  assert(visibleText.includes(badge), `Top badges should include ${badge}.`);
});
assert(lbmHtml.includes('<option value="Boer">Boer</option>') && lbmHtml.includes('<option value="Hume">Hume</option>'), 'LBM calculator should continue to expose Boer and Hume formula choices.');
assert(visibleText.includes('This page supports Boer and Hume adult equations.'), 'LBM page should continue to identify Boer and Hume as the supported adult equations.');
[
  'What is lean body mass?',
  'Lean body mass estimates body weight excluding most fat mass',
  'How is LBM calculated?',
  'height, weight, sex, and the selected supported formula',
  'Is lean body mass the same as ideal body weight?',
  'Ideal body weight is usually height-based',
  'Can this be used for medication dosing?',
  'does not define a medication dose by itself',
  'What are the limitations of LBM formulas?',
  'children, pregnancy, edema, ascites, amputation, extreme obesity, cachexia, or unusual body composition'
].forEach(copy => assert(visibleText.includes(copy), `FAQ/methodology should include: ${copy}`));

const jsonLdMatch = lbmHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
assert(jsonLdMatch, 'LBM page should keep JSON-LD structured data.');
const jsonLd = JSON.parse(jsonLdMatch[1]);
const faqPage = jsonLd['@graph'].find(node => node['@type'] === 'FAQPage');
const medicalWebPage = jsonLd['@graph'].find(node => node['@type'] === 'MedicalWebPage');
assert(faqPage, 'LBM JSON-LD should include FAQPage structured data.');
assert(medicalWebPage, 'LBM JSON-LD should include MedicalWebPage structured data.');
assert.strictEqual(medicalWebPage.name, expectedTitle, 'LBM MedicalWebPage name should stay synchronized with the page title.');
assert.strictEqual(medicalWebPage.dateModified, expectedModifiedDate, 'LBM MedicalWebPage dateModified should reflect the metadata update date.');
faqPage.mainEntity.forEach(question => {
  assert(visibleText.includes(question.name), `FAQPage question should match visible FAQ: ${question.name}`);
  assert(visibleText.includes(question.acceptedAnswer.text), `FAQPage answer should match visible FAQ: ${question.name}`);
});

assert(!/<meta\s+name=["'](?:robots|googlebot)["'][^>]*noindex/i.test(lbmHtml), 'LBM page should not contain robots/googlebot noindex metadata.');
assert(!/noindex/i.test(robotsTxt), 'Root robots.txt should not block LBM indexing with noindex.');
assert(lbmHtml.includes('<link rel="canonical" href="https://perfusiontools.com/lbm/" />'), 'LBM page canonical should point to /lbm/.');
assert(sitemapXml.includes('<loc>https://perfusiontools.com/lbm/</loc>'), 'Sitemap should include /lbm/.');
assert(indexHtml.includes(`title: "${expectedTitle}"`), 'Home route metadata registry should include the updated LBM title.');
assert(indexHtml.includes(`description: "${expectedDescription}"`), 'Home route metadata registry should include the updated LBM description.');
assert(routeRegistry.includes("{ path: '/lbm/', label: 'LBM' }") && routeRegistry.includes("'/lbm/': 'lbm'"), 'Main route registry should include /lbm/.');
assert(visibleText.includes('does not define a medication dose by itself'), 'LBM dosing-weight disclaimer should remain present.');
assert(visibleText.includes('LBM formulas are population-based estimates'), 'LBM clinical limitation language should remain present.');
assert(!/define a medication dose(?! by itself)|replace clinical judgment|standalone pediatric pump-flow target/i.test(visibleText.replace('does not define a medication dose by itself', '')), 'LBM page should not claim to define medication dosing or unsupported pediatric use.');
assert.strictEqual(distLbmHtml, lbmHtml, 'Built dist/lbm/index.html should remain synchronized with the source LBM page.');

console.log('All LBM SEO/indexability tests passed.');
