const assert = require('assert');
const fs = require('fs');
const path = require('path');

function getJsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function normalizeText(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(repoRoot, 'predicted-hct', 'index.html'), 'utf8');
  const primingHtml = fs.readFileSync(path.join(repoRoot, 'priming-volume', 'index.html'), 'utf8');
  const gdpHtml = fs.readFileSync(path.join(repoRoot, 'gdp', 'index.html'), 'utf8');
  const expectedTitle = 'Predicted Hematocrit Calculator | CPB Hemodilution Estimate';
  const expectedDescription = 'Estimate predicted hematocrit after CPB priming, hemodilution, transfusion, or volume changes. Includes formula notes, assumptions, and clinical limitations.';
  const expectedQuestion = 'How do you calculate post-dilutional hematocrit after CPB priming?';

  assert(html.includes(`<title>${expectedTitle}</title>`), 'title should remain unchanged');
  assert(html.includes(`<meta name="description" content="${expectedDescription}" />`), 'meta description should remain unchanged');
  assert(html.includes('<link rel="canonical" href="https://perfusiontools.com/predicted-hct/" />'), 'canonical URL should remain unchanged');
  assert(html.includes('CPB') && html.toLowerCase().includes('hemodilution'), 'metadata or visible copy should include CPB and hemodilution');
  assert(html.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Predicted Hematocrit Calculator</h1>'), 'visible H1 should say Predicted Hematocrit Calculator');
  assert.strictEqual((html.match(new RegExp(`title: '${expectedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) || []).length, 2, 'both routeMeta entries should preserve the exact title');
  assert.strictEqual((html.match(new RegExp(`description: '${expectedDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g')) || []).length, 2, 'both routeMeta entries should preserve the exact description');
  assert.strictEqual((html.match(/h1: 'Predicted Hematocrit Calculator'/g) || []).length, 2, 'both routeMeta entries should preserve the exact H1');
  assert.strictEqual((html.match(/canonicalPath: '\/predicted-hct\/'/g) || []).length, 2, 'both routeMeta entries should preserve the canonical path');
  assert(html.includes('Estimate hematocrit after CPB priming, hemodilution, RBC transfusion, or volume addition/removal using volume-balance assumptions.'), 'top copy should mention CPB priming, hemodilution, RBC transfusion, volume change, and volume-balance assumptions');

  const workedExample = html.match(/<h2 class="calculator-lower-title">Worked example: predicted Hct after CPB priming<\/h2>([\s\S]*?)<\/section>/);
  assert(workedExample, 'worked-example heading should exist');
  for (const value of ['70 kg', '70 mL/kg', '4,900 mL', '1,960 mL', '6,100 mL', '32.1%']) {
    assert(workedExample[1].includes(value), `worked example should include ${value}`);
  }
  assert(/complete[- ]mixing/i.test(workedExample[1]), 'worked example should state its complete-mixing limitation');
  assert(/measured blood gas or laboratory hematocrit/i.test(workedExample[1]), 'worked example should require confirmation with measured blood gas or laboratory hematocrit');

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
  assert(jsonQuestions.includes(expectedQuestion), 'FAQPage JSON-LD should include the post-dilutional question');
  const visibleFaqMatch = html.match(new RegExp(`<p class="calculator-faq-question">${expectedQuestion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}<\\/p>\\s*<p class="calculator-faq-answer">([\\s\\S]*?)<\\/p>`));
  const jsonFaq = faqLd.mainEntity.find((entry) => entry.name === expectedQuestion);
  assert(visibleFaqMatch && jsonFaq, 'post-dilutional FAQ should be visible and structured');
  assert.strictEqual(normalizeText(visibleFaqMatch[1]), normalizeText(jsonFaq.acceptedAnswer.text), 'visible and JSON-LD post-dilutional answers should remain synchronized');
  assert(/product volume/i.test(jsonFaq.acceptedAnswer.text) && /red cell volume/i.test(jsonFaq.acceptedAnswer.text), 'post-dilutional answer should explain RBC product and red cell volume');

  const medicalWebPage = getJsonLdBlocks(html).flatMap((block) => block['@graph'] || []).find((entry) => entry['@type'] === 'MedicalWebPage');
  assert(medicalWebPage, 'MedicalWebPage JSON-LD should exist');
  assert.strictEqual(medicalWebPage.dateModified, '2026-07-25', 'MedicalWebPage dateModified should reflect the content update');

  const clinicalInterpretation = primingHtml.match(/6\. Clinical interpretation<\/h3>([\s\S]*?)7\. Practical limitations/);
  assert(clinicalInterpretation, 'Priming Volume Clinical interpretation section should exist');
  assert(clinicalInterpretation[1].includes('<a href="/predicted-hct/" class="text-accent-600 dark:text-accent-400 hover:underline">CPB hemodilution calculator</a>'), 'Clinical interpretation should contextually link the CPB hemodilution calculator');

  const modelAssumptions = gdpHtml.match(/Model assumptions<\/h4>([\s\S]*?)How to use required flow output/);
  assert(modelAssumptions, 'GDP Model assumptions section should exist');
  assert(modelAssumptions[1].includes('<a href="/predicted-hct/" class="text-accent-600 dark:text-accent-400 hover:underline">Predicted Hematocrit Calculator</a>'), 'GDP Model assumptions should contextually link the Predicted Hematocrit Calculator');
  assert(/Hemodilution[\s\S]*hemoglobin[\s\S]*arterial oxygen content/.test(modelAssumptions[1]), 'GDP link context should mention hemodilution, hemoglobin, and arterial oxygen content');

  for (const page of ['predicted-hct', 'priming-volume', 'gdp']) {
    const source = fs.readFileSync(path.join(repoRoot, page, 'index.html'));
    const dist = fs.readFileSync(path.join(repoRoot, 'dist', page, 'index.html'));
    assert(source.equals(dist), `${page} source and dist HTML should match`);
  }

  console.log('All predicted Hct SEO tests passed.');
}

run();
