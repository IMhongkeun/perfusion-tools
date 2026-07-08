const fs = require('fs');
const assert = require('assert');

const html = fs.readFileSync('gdp/index.html', 'utf8');

function getJsonLdBlocks(source) {
  const regex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  return Array.from(source.matchAll(regex)).map((match) => JSON.parse(match[1]));
}

assert(
  html.includes('Goal-Directed Perfusion DO2i Calculator') || html.includes('DO2i Calculator'),
  'GDP page title or metadata should include Goal-Directed Perfusion or DO2i Calculator.'
);
assert(/CPB[\s\S]{0,120}oxygen delivery|oxygen delivery[\s\S]{0,120}CPB/i.test(html), 'Metadata or visible copy should include CPB and oxygen delivery.');
assert(html.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Goal-Directed Perfusion DO2i Calculator</h1>'), 'Visible H1 should be exact.');
assert(html.includes('flow index'), 'Top copy should mention flow index.');
assert(html.includes('hemoglobin'), 'Top copy should mention hemoglobin.');
assert(html.includes('SaO2'), 'Top copy should mention SaO2.');
assert(html.includes('PaO2'), 'Top copy should mention PaO2.');

const expectedFaq = [
  'What is DO2i during CPB?',
  'How is DO2i calculated?',
  'Why does hemoglobin affect oxygen delivery more than PaO2?',
  'Does this calculator define a transfusion threshold?',
  'Can this replace blood gas monitoring during CPB?'
];
expectedFaq.forEach((question) => assert(html.includes(question), `Visible FAQ should include: ${question}`));
assert(html.includes('estimates oxygen delivery normalized to body surface area'), 'FAQ should define DO2i.');
assert(html.includes('flow index multiplied by arterial oxygen content'), 'FAQ should explain DO2i formula.');
assert(html.includes('Most arterial oxygen content is carried by hemoglobin'), 'FAQ should explain hemoglobin vs PaO2.');
assert(html.includes('does not define a transfusion threshold'), 'FAQ should include transfusion-threshold limitation.');
assert(html.includes('interpreted alongside measured blood gas values'), 'FAQ should include blood gas monitoring limitation.');

const blocks = getJsonLdBlocks(html);
const graphBlock = blocks.find((block) => Array.isArray(block['@graph']));
assert(graphBlock, 'GDP page should include graph JSON-LD.');
const faqLd = graphBlock['@graph'].find((node) => node['@type'] === 'FAQPage');
assert(faqLd, 'FAQPage JSON-LD should exist.');
const jsonQuestions = faqLd.mainEntity.map((entity) => entity.name);
expectedFaq.forEach((question) => assert(jsonQuestions.includes(question), `FAQPage JSON-LD should match visible FAQ: ${question}`));

assert(!html.includes('defines a transfusion threshold.'), 'Page should not affirm that calculator defines a transfusion threshold.');
assert(!html.includes('replace blood gas monitoring during CPB?</p>\n                  <p class="calculator-faq-answer">Yes'), 'Page should not claim to replace blood gas monitoring.');

console.log('All GDP SEO tests passed.');
