const fs = require('fs');
const path = require('path');
const assert = require('assert');

const repoRoot = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const html = read('gdp', 'index.html');
const bsaHtml = read('bsa', 'index.html');
const predictedHctHtml = read('predicted-hct', 'index.html');
const mainJs = read('main.js');

function getJsonLdNodes(source) {
  const blocks = Array.from(source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))
    .map((match) => JSON.parse(match[1]));
  return blocks.flatMap((block) => block['@graph'] || [block]);
}

function normalizeText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const title = 'Goal-Directed Perfusion DO2i Calculator | CPB Oxygen Delivery';
const description = 'Calculate indexed oxygen delivery during cardiopulmonary bypass using flow index, hemoglobin, SaO2, and PaO2. Includes DO2i formula notes and clinical limitations.';
const headingDescription = 'Calculate indexed oxygen delivery during CPB using flow index, hemoglobin, arterial oxygen saturation (SaO2), and PaO2 in a goal-directed perfusion context.';

assert(html.includes(`<title>${title}</title>`), 'GDP title should remain exact.');
assert(html.includes(`<meta name="description" content="${description}" />`), 'GDP meta description should remain exact.');
assert(html.includes('<link rel="canonical" href="https://perfusiontools.com/gdp/" />'), 'GDP canonical should remain exact.');
assert(html.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Goal-Directed Perfusion DO2i Calculator</h1>'), 'Visible H1 should remain exact.');
assert(html.includes(`<meta property="og:title" content="${title}" />`), 'Open Graph title should remain exact.');
assert(html.includes(`<meta property="og:description" content="${description}" />`), 'Open Graph description should remain exact.');
assert(html.includes('<meta property="og:url" content="https://perfusiontools.com/gdp/" />'), 'Open Graph URL should remain exact.');
assert(html.includes(`<meta name="twitter:title" content="${title}" />`), 'Twitter title should remain exact.');
assert(html.includes(`<meta name="twitter:description" content="${description}" />`), 'Twitter description should remain exact.');
assert.strictEqual((html.match(new RegExp(`title: '${escapeRegExp(title)}'`, 'g')) || []).length, 2, 'Both routeMeta titles should remain exact.');
assert.strictEqual((html.match(new RegExp(`description: '${escapeRegExp(description)}'`, 'g')) || []).length, 2, 'Both routeMeta descriptions should remain exact.');
assert.strictEqual((html.match(/h1: 'Goal-Directed Perfusion DO2i Calculator'/g) || []).length, 2, 'Both routeMeta H1 values should remain exact.');
assert(html.includes(`headingDescription: '${headingDescription}'`), 'routeMeta heading description should remain exact.');
assert.strictEqual((html.match(/canonicalPath: '\/gdp\/'/g) || []).length, 2, 'Both routeMeta canonical paths should remain exact.');
assert(html.includes('flow index') && html.includes('hemoglobin') && html.includes('SaO2') && html.includes('PaO2'), 'Top copy should preserve calculation inputs.');
assert(html.includes('>Calculate DO₂i &amp; Required Flow</h2>'), 'Calculator card should use a concise, action-oriented heading.');
assert(!html.includes('aria-label="DO2i calculator features"'), 'Repeated calculator intro and keyword chips should be removed from visible markup.');
assert(!html.includes('GDP / DO₂i Calculator</h2>'), 'Calculator card should not repeat the full calculator title.');
assert(html.includes('>CaO<sub>2</sub></div>'), 'Arterial oxygen content result label should preserve the lowercase a with semantic subscript markup.');
assert(!html.includes('uppercase tracking-wider text-slate-300">CaO'), 'CaO2 result styling should not visually capitalize the arterial lowercase a.');

const workedExample = html.match(/<h2 class="calculator-lower-title">Worked example: calculating DO₂i during CPB<\/h2>([\s\S]*?)<\/section>/);
assert(workedExample, 'Worked DO₂i example heading should exist.');
for (const value of ['1.80 m²', '4.50 L/min', '8.0 g/dL', '100%', '1.00', '200 mmHg', '2.50 L/min/m²', '11.34 mL O₂/dL', '283.5 mL/min/m²', '284 mL/min/m²']) {
  assert(workedExample[1].includes(value), `Worked example should include ${value}.`);
}
for (const formula of ['Flow index = Pump flow ÷ BSA', 'CaO₂ = (1.34 × Hb × SaO₂) + (0.0031 × PaO₂)', 'CaO₂ = (1.34 × 8.0 × 1.00) + (0.0031 × 200)', 'DO₂i = Flow index × CaO₂ × 10']) {
  assert(workedExample[1].includes(formula), `Worked example should include ${formula}.`);
}
assert(/×10 factor|× 10/.test(`${workedExample[1]} ${html}`), 'Page should explain or show the ×10 conversion.');
for (const context of ['measured blood gas', 'venous oxygen saturation', 'lactate', 'perfusion pressure', 'temperature', 'clinical context']) {
  assert(workedExample[1].toLowerCase().includes(context), `Worked-example limitation should mention ${context}.`);
}
assert(!/284 mL\/min\/m²[\s\S]{0,80}(universally )?(safe|adequate|optimal|insufficient)|284 mL\/min\/m²[\s\S]{0,80}transfusion (trigger|recommendation)/i.test(workedExample[1]), 'Example must not characterize 284 as universal or a transfusion trigger.');
assert(html.indexOf('DO₂i model assumptions & limitations') < html.indexOf('Worked example: calculating DO₂i during CPB'), 'Worked example should follow model assumptions.');
assert(html.indexOf('Worked example: calculating DO₂i during CPB') < html.indexOf('Extended clinical notes & evidence'), 'Worked example should precede extended notes.');

const expectedFaq = [
  'What is DO2i during CPB?',
  'How is DO2i calculated?',
  'Why does hemoglobin affect oxygen delivery more than PaO2?',
  'Does this calculator define a transfusion threshold?',
  'Can this replace blood gas monitoring during CPB?'
];
const visibleQuestions = Array.from(html.matchAll(/<p class="calculator-faq-question">([\s\S]*?)<\/p>/g)).map((match) => normalizeText(match[1]));
assert.deepStrictEqual(visibleQuestions, expectedFaq, 'Visible GDP FAQ should preserve exactly five questions in order.');
const nodes = getJsonLdNodes(html);
const faqLd = nodes.find((node) => node['@type'] === 'FAQPage');
assert(faqLd, 'FAQPage JSON-LD should exist.');
assert.deepStrictEqual(faqLd.mainEntity.map((entity) => entity.name), expectedFaq, 'FAQ JSON-LD should preserve exactly five questions in order.');
const faqMatch = html.match(/<p class="calculator-faq-question">How is DO2i calculated\?<\/p>\s*<p class="calculator-faq-answer">([\s\S]*?)<\/p>/);
const faqJson = faqLd.mainEntity.find((entity) => entity.name === 'How is DO2i calculated?');
assert(faqMatch && faqJson, 'The formula FAQ should remain visible and structured.');
assert.strictEqual(normalizeText(faqMatch[1]), normalizeText(faqJson.acceptedAnswer.text), 'Visible and JSON-LD formula answers should stay synchronized.');
for (const concept of ['pump flow divided by BSA', 'CaO₂ = (1.34 × Hb × SaO₂) + (0.0031 × PaO₂)', 'percent to a fraction', 'DO₂i = flow index × CaO₂ × 10', '×10 factor']) {
  assert(normalizeText(faqMatch[1]).includes(concept), `Visible formula answer should include ${concept}.`);
  assert(normalizeText(faqJson.acceptedAnswer.text).includes(concept), `Structured formula answer should include ${concept}.`);
}
const runtimeCaO2 = mainJs.match(/function calcCaO2\(hb, sao2pct, pao2\) \{([\s\S]*?)\n\}/);
assert(runtimeCaO2, 'calcCaO2 runtime implementation should exist.');
assert(runtimeCaO2[1].includes('0.0031 * (pao2 || 0)'), 'calcCaO2 should retain the canonical 0.0031 dissolved-oxygen coefficient.');
const formulaCard = html.match(/<h3[^>]*>Formula used<\/h3>([\s\S]*?)<\/div>\s*<\/div>/);
assert(formulaCard && formulaCard[1].includes('(0.0031 × PaO₂)'), 'Visible Formula used card should match the runtime coefficient.');
assert(workedExample[1].includes('(0.0031 × PaO₂)') && workedExample[1].includes('(0.0031 × 200)'), 'Worked example should match the runtime coefficient.');
assert(normalizeText(faqMatch[1]).includes('(0.0031 × PaO₂)'), 'Visible FAQ should match the runtime coefficient.');
assert(normalizeText(faqJson.acceptedAnswer.text).includes('(0.0031 × PaO₂)'), 'FAQ JSON-LD should match the runtime coefficient.');
const exampleCaO2 = (1.34 * 8.0 * 1.00) + (0.0031 * 200);
const exampleDo2i = (4.50 / 1.80) * exampleCaO2 * 10;
assert.strictEqual(exampleCaO2.toFixed(2), '11.34');
assert.strictEqual(exampleDo2i.toFixed(1), '283.5');
assert.strictEqual(Math.round(exampleDo2i), 284);
assert(html.includes('does not define a transfusion threshold'), 'FAQ should preserve transfusion-threshold limitation.');
assert(html.includes('interpreted alongside measured blood gas values'), 'FAQ should preserve blood-gas limitation.');

const medicalPage = nodes.find((node) => node['@type'] === 'MedicalWebPage');
const webApp = nodes.find((node) => node['@type'] === 'WebApplication');
const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');
assert(medicalPage && webApp && faqLd && breadcrumb, 'Required GDP structured-data nodes should remain present.');
assert.strictEqual(medicalPage.dateModified, '2026-07-26', 'MedicalWebPage dateModified should match the content update.');
assert.strictEqual(medicalPage.url, 'https://perfusiontools.com/gdp/', 'MedicalWebPage URL should remain canonical.');
assert.strictEqual(webApp.name, 'Goal-Directed Perfusion DO2i Calculator', 'WebApplication name should remain unchanged.');
assert.strictEqual(webApp.url, 'https://perfusiontools.com/gdp/', 'WebApplication URL should remain unchanged.');
assert.strictEqual(breadcrumb.itemListElement[1].item, 'https://perfusiontools.com/gdp/', 'Breadcrumb URL should remain unchanged.');

const assumptions = html.match(/Model assumptions<\/h4>([\s\S]*?)How to use required flow output/);
assert(assumptions, 'GDP Model assumptions should exist.');
assert(assumptions[1].includes('<a href="/predicted-hct/" class="text-accent-600 dark:text-accent-400 hover:underline">Predicted Hematocrit Calculator</a>'), 'GDP Model assumptions should preserve the Predicted Hematocrit Calculator link.');
assert(/Hemodilution[\s\S]*hemoglobin[\s\S]*arterial oxygen content/.test(assumptions[1]), 'GDP link context should preserve hemodilution, hemoglobin, and arterial oxygen content.');

const bsaContext = bsaHtml.match(/Clinical context in CPB<\/h4>([\s\S]*?)Obesity considerations/);
assert(bsaContext, 'BSA Clinical context in CPB should exist.');
assert(bsaContext[1].includes('<a href="/gdp/" class="text-accent-600 dark:text-accent-400 hover:underline">DO₂i Calculator</a>'), 'BSA context should link to GDP with the exact anchor.');
assert(/calculated BSA[\s\S]*pump flow[\s\S]*indexed oxygen delivery/.test(bsaContext[1]), 'BSA link context should mention calculated BSA, pump flow, and indexed oxygen delivery.');

const limitations = predictedHctHtml.match(/<h3[^>]*>Limitations<\/h3>([\s\S]*?)<\/div>/);
assert(limitations, 'Predicted Hct Limitations should exist.');
assert(limitations[1].includes('<a href="/gdp/" class="text-accent-600 dark:text-accent-400 hover:underline">GDP / DO₂i Calculator</a>'), 'Predicted Hct limitations should link to GDP with the exact anchor.');
assert(/hemoglobin[\s\S]*pump flow[\s\S]*indexed oxygen delivery/.test(limitations[1]), 'Predicted Hct link context should mention hemoglobin, pump flow, and indexed oxygen delivery.');
assert(limitations[1].includes('It does not estimate oxygen delivery.'), 'Predicted Hct oxygen-delivery limitation should remain present.');

for (const page of ['gdp', 'bsa', 'predicted-hct']) {
  assert(fs.readFileSync(path.join(repoRoot, page, 'index.html')).equals(fs.readFileSync(path.join(repoRoot, 'dist', page, 'index.html'))), `${page} source and dist HTML should match.`);
}

console.log('All GDP SEO tests passed.');
