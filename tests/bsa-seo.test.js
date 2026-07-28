const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(repoRoot, ...parts), 'utf8');
const html = read('bsa', 'index.html');
const gdpHtml = read('gdp', 'index.html');
const heparinHtml = read('heparin', 'index.html');
const mainJs = read('main.js');

function normalizeText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function getJsonLdNodes(source) {
  return Array.from(source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))
    .map((match) => JSON.parse(match[1]))
    .flatMap((block) => block['@graph'] || [block]);
}

function loadBsaRuntime(source) {
  const start = source.indexOf('const BSA =');
  const end = source.indexOf('function updateBsaUnitUi');
  assert(start >= 0 && end > start, 'BSA runtime should be extractable from main.js.');
  const context = { module: { exports: {} } };
  vm.runInNewContext(`${source.slice(start, end)}\nmodule.exports = { computeBSA };`, context);
  return context.module.exports;
}

const staticTitle = 'BSA Calculator for CPB Flow Indexing | Perfusion Tools';
const staticDescription = 'Calculate body surface area with Mosteller, Du Bois, and Haycock formulas to support CPB flow indexing and perfusion planning.';
const socialTitle = 'BSA Calculator for Perfusion Flow Guidance | Perfusion Tools';
const socialDescription = 'Calculate Body Surface Area for CPB flow planning using multiple formulas and indexed flow guidance.';
const routeDescription = 'Body Surface Area (BSA) calculator for perfusionists with Mosteller, Du Bois, Haycock, and Boyd formulas plus CPB flow guidance by cardiac index.';
const headingDescription = 'Calculate BSA first, then estimate indexed pump flow targets (CI 1.0-3.0) for clinical perfusion planning.';
const h1 = 'BSA Calculator for Perfusion Flow Guidance in CPB';

for (const exactMarkup of [
  `<title>${staticTitle}</title>`,
  `<meta name="description" content="${staticDescription}" />`,
  '<link rel="canonical" href="https://perfusiontools.com/bsa/" />',
  `<meta property="og:title" content="${socialTitle}" />`,
  `<meta property="og:description" content="${socialDescription}" />`,
  '<meta property="og:url" content="https://perfusiontools.com/bsa/" />',
  `<meta name="twitter:title" content="${socialTitle}" />`,
  `<meta name="twitter:description" content="${socialDescription}" />`,
  `title: '${socialTitle}'`, `h1: '${h1}'`, `description: '${routeDescription}'`,
  `headingDescription: '${headingDescription}'`, "canonicalPath: '/bsa/'",
  `<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">${h1}</h1>`
]) assert(html.includes(exactMarkup), `BSA metadata/UI contract should include: ${exactMarkup}`);

const workedExample = html.match(/<h2 class="calculator-lower-title">Worked example: BSA and CPB pump flow<\/h2>([\s\S]*?)<\/section>/);
assert(workedExample, 'BSA and CPB pump flow worked example should exist.');
for (const value of ['170 cm', '70 kg', 'Mosteller', '1.8181', '1.82 m²', '2.4 L/min/m²', '4.3635', '4.36 L/min', '62.3', '62 mL/kg/min']) {
  assert(workedExample[1].includes(value), `Worked example should include ${value}.`);
}
for (const value of ['BSA = √((height × weight) ÷ 3600)', 'Pump flow = BSA × cardiac index', 'mL/kg/min = (pump flow × 1000) ÷ weight', 'unrounded internal BSA', 'full-precision BSA', 'temperature', 'hemoglobin or hematocrit', 'venous oxygen saturation', 'lactate', 'perfusion pressure', 'oxygen-delivery assessment', 'patient condition', 'institutional protocol']) {
  assert(workedExample[1].includes(value), `Worked example should include ${value}.`);
}
assert(html.indexOf('Methodology & clinical notes') < html.indexOf('Worked example: BSA and CPB pump flow'));
assert(html.indexOf('Worked example: BSA and CPB pump flow') < html.indexOf('Extended clinical notes & evidence'));

const runtime = loadBsaRuntime(mainJs);
const exampleBsa = runtime.computeBSA(170, 70, 'Mosteller');
const exampleFlow = exampleBsa * 2.4;
const exampleMlKgMin = Math.round((exampleFlow * 1000) / 70);
assert.strictEqual(exampleBsa.toFixed(2), '1.82');
assert.strictEqual(exampleFlow.toFixed(2), '4.36');
assert.strictEqual(exampleMlKgMin, 62);
assert(mainJs.includes('const flowLpm = ci * bsaVal;'), 'Flow rows should use unrounded BSA.');
assert(mainJs.includes('flowLpm.toFixed(2)'), 'Flow should display to two decimals.');
assert(mainJs.includes('Math.round((flowLpm * 1000) / weightKg)'), 'mL/kg/min should use Math.round.');

const expectedQuestions = [
  'What is BSA used for during cardiopulmonary bypass?',
  'How is BSA calculated with the Mosteller formula?',
  'How do you calculate CPB pump flow from BSA and cardiac index?',
  'Does BSA alone determine adequate CPB flow?'
];
const faqSection = html.match(/<h2 class="calculator-lower-title">BSA and CPB flow FAQ<\/h2>([\s\S]*?)<\/section>/);
assert(faqSection, 'Visible BSA FAQ should exist.');
const visibleQuestions = Array.from(faqSection[1].matchAll(/<p class="calculator-faq-question">([\s\S]*?)<\/p>/g)).map((match) => normalizeText(match[1]));
const visibleAnswers = Array.from(faqSection[1].matchAll(/<p class="calculator-faq-answer">([\s\S]*?)<\/p>/g)).map((match) => normalizeText(match[1]));
assert.deepStrictEqual(visibleQuestions, expectedQuestions);
assert.strictEqual(visibleAnswers.length, 4);
assert(html.indexOf('Extended clinical notes & evidence') < html.indexOf('BSA and CPB flow FAQ'));
assert(html.indexOf('BSA and CPB flow FAQ') < html.indexOf('Related tools'));

const nodes = getJsonLdNodes(html);
const faqNodes = nodes.filter((node) => node['@type'] === 'FAQPage');
assert.strictEqual(faqNodes.length, 1, 'Exactly one FAQPage should exist.');
assert.deepStrictEqual(faqNodes[0].mainEntity.map((item) => item.name), expectedQuestions);
assert.deepStrictEqual(faqNodes[0].mainEntity.map((item) => normalizeText(item.acceptedAnswer.text)), visibleAnswers);
const medicalPage = nodes.find((node) => node['@type'] === 'MedicalWebPage');
const webApp = nodes.find((node) => node['@type'] === 'WebApplication');
const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');
assert.strictEqual(medicalPage.dateModified, '2026-07-26');
assert.strictEqual(medicalPage.url, 'https://perfusiontools.com/bsa/');
assert.strictEqual(webApp.name, 'BSA Calculator');
assert.strictEqual(webApp.url, 'https://perfusiontools.com/bsa/');
assert.strictEqual(breadcrumb.itemListElement[1].item, 'https://perfusiontools.com/bsa/');

const selector = html.match(/<select[^>]*id="bsa-method-standalone"[\s\S]*?<\/select>/);
assert(selector, 'Standalone formula selector should exist.');
assert.deepStrictEqual(Array.from(selector[0].matchAll(/<option value="([^"]+)"/g)).map((match) => match[1]), ['Mosteller', 'DuBois', 'Haycock', 'Boyd']);

const bsaLink = '<a href="/bsa/" class="text-accent-600 dark:text-accent-400 hover:underline">BSA Calculator</a>';
const gdpExample = gdpHtml.match(/Worked example: calculating DO₂i during CPB([\s\S]*?)<\/section>/);
assert(gdpExample && gdpExample[1].includes(`Calculate body surface area from height and weight with the ${bsaLink} before using BSA in the DO₂i equation.`));
for (const preserved of ['0.0031 × PaO₂', '11.34 mL O₂/dL', '284 mL/min/m²']) assert(gdpExample[1].includes(preserved));
assert(heparinHtml.includes(`Use the ${bsaLink} to verify body surface area when reviewing BSA-capped dose sensitivity.`));

for (const page of ['bsa', 'gdp', 'heparin']) {
  assert.strictEqual(read('dist', page, 'index.html'), read(page, 'index.html'), `${page} source and dist should match.`);
}

console.log('All BSA SEO tests passed.');
