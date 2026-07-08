const assert = require('assert');
const fs = require('fs');
const path = require('path');

function getJsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(repoRoot, 'predicted-hct', 'index.html'), 'utf8');

  assert(html.includes('<title>Predicted Hematocrit Calculator | CPB Hemodilution Estimate</title>'), 'title should include Predicted Hematocrit Calculator');
  assert(html.includes('CPB') && html.toLowerCase().includes('hemodilution'), 'metadata or visible copy should include CPB and hemodilution');
  assert(html.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Predicted Hematocrit Calculator</h1>'), 'visible H1 should say Predicted Hematocrit Calculator');
  assert(html.includes('Estimate hematocrit after CPB priming, hemodilution, RBC transfusion, or volume addition/removal using volume-balance assumptions.'), 'top copy should mention CPB priming, hemodilution, RBC transfusion, volume change, and volume-balance assumptions');
  assert(html.includes('What is a hemodilution calculator?'), 'FAQ should include hemodilution question');
  assert(html.includes('Can this predict the exact intraoperative hematocrit?'), 'FAQ should include exactness limitation question');
  assert(html.includes('Does this replace clinical judgment or blood gas measurement?'), 'FAQ should include clinical judgment and blood gas limitation question');
  assert(!html.includes('predict the exact intraoperative hematocrit?</p>\n                  <p class="calculator-faq-answer">Yes'), 'page should not claim exact prediction');
  assert(!html.includes('replace clinical judgment or blood gas measurement?</p>\n                  <p class="calculator-faq-answer">Yes'), 'page should not claim replacement of measured values');

  const faqLd = getJsonLdBlocks(html).find((block) => block['@type'] === 'FAQPage');
  assert(faqLd, 'FAQPage JSON-LD should exist');
  const visibleQuestions = [...html.matchAll(/<p class="calculator-faq-question">([\s\S]*?)<\/p>/g)].map((match) => match[1]);
  const jsonQuestions = faqLd.mainEntity.map((entry) => entry.name);
  for (const question of jsonQuestions) {
    assert(visibleQuestions.includes(question), `FAQPage JSON-LD question should match visible FAQ: ${question}`);
  }
  assert(jsonQuestions.includes('How is predicted hematocrit calculated?'), 'FAQPage JSON-LD should include formula question');
  assert(jsonQuestions.includes('What is a hemodilution calculator?'), 'FAQPage JSON-LD should include hemodilution question');
  assert(jsonQuestions.includes('Can this predict the exact intraoperative hematocrit?'), 'FAQPage JSON-LD should include exactness question');
  assert(jsonQuestions.includes('Does this replace clinical judgment or blood gas measurement?'), 'FAQPage JSON-LD should include blood gas limitation question');
  assert(jsonQuestions.includes('How does priming volume affect hematocrit?'), 'FAQPage JSON-LD should include priming volume question');

  console.log('All predicted Hct SEO tests passed.');
}

run();
