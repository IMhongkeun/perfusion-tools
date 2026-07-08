'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lbmHtml = fs.readFileSync(path.join(root, 'lbm', 'index.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sitemapXml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const robotsTxt = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
const routeRegistry = fs.readFileSync(path.join(root, 'main.js'), 'utf8');

function stripTags(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const visibleText = stripTags(lbmHtml);

assert(lbmHtml.includes('<title>Lean Body Mass Calculator | LBM &amp; Dosing Weight Estimate</title>'), 'LBM page title should include Lean Body Mass Calculator and dosing-weight context.');
assert(lbmHtml.includes('Estimate lean body mass from height, weight, and sex using supported adult body-composition formulas. Includes formula notes, dosing-weight context, and clinical limitations.'), 'LBM meta description should explain inputs, formulas, dosing-weight context, and limitations.');
assert(lbmHtml.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Lean Body Mass Calculator</h1>'), 'Visible H1 should be exactly Lean Body Mass Calculator.');
assert(visibleText.includes('Estimate lean body mass (LBM) using height, weight, sex, and the selected supported formula'), 'Top visible copy should mention LBM, height, weight, sex, and selected formula.');
assert(visibleText.includes('dosing-weight context and formula limitations'), 'Top visible copy should mention dosing-weight context and limitations.');
['Lean body mass', 'Adult estimate', 'Dosing-weight context', 'Formula limitations'].forEach(badge => {
  assert(visibleText.includes(badge), `Top badges should include ${badge}.`);
});
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
assert(faqPage, 'LBM JSON-LD should include FAQPage structured data.');
faqPage.mainEntity.forEach(question => {
  assert(visibleText.includes(question.name), `FAQPage question should match visible FAQ: ${question.name}`);
  assert(visibleText.includes(question.acceptedAnswer.text), `FAQPage answer should match visible FAQ: ${question.name}`);
});

assert(!/<meta\s+name=["'](?:robots|googlebot)["'][^>]*noindex/i.test(lbmHtml), 'LBM page should not contain robots/googlebot noindex metadata.');
assert(!/noindex/i.test(robotsTxt), 'Root robots.txt should not block LBM indexing with noindex.');
assert(lbmHtml.includes('<link rel="canonical" href="https://perfusiontools.com/lbm/" />'), 'LBM page canonical should point to /lbm/.');
assert(sitemapXml.includes('<loc>https://perfusiontools.com/lbm/</loc>'), 'Sitemap should include /lbm/.');
assert(indexHtml.includes('title: "Lean Body Mass Calculator | LBM & Dosing Weight Estimate"'), 'Home route metadata registry should include updated LBM title.');
assert(routeRegistry.includes("{ path: '/lbm/', label: 'LBM' }") && routeRegistry.includes("'/lbm/': 'lbm'"), 'Main route registry should include /lbm/.');
assert(!/define a medication dose(?! by itself)|replace clinical judgment|standalone pediatric pump-flow target/i.test(visibleText.replace('does not define a medication dose by itself', '')), 'LBM page should not claim to define medication dosing or unsupported pediatric use.');

console.log('All LBM SEO/indexability tests passed.');
