const assert = require('assert');
const fs = require('fs');
const path = require('path');

function getJsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function decodeHtml(text) {
  return text
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');
}

function getVisibleFaq(html) {
  const faqSection = html.match(/<h2 class="calculator-lower-title">FAQ<\/h2>([\s\S]*?)<\/section>/);
  assert(faqSection, 'visible FAQ section should exist');

  return [...faqSection[1].matchAll(/<div class="calculator-faq-item">\s*<p class="calculator-faq-question">([\s\S]*?)<\/p>\s*<p class="calculator-faq-answer">([\s\S]*?)<\/p>\s*<\/div>/g)]
    .map((match) => ({
      question: decodeHtml(match[1].trim()),
      answer: decodeHtml(match[2].trim())
    }));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(repoRoot, 'z-score', 'index.html'), 'utf8');
  const distHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'z-score', 'index.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(repoRoot, 'phn-echo', 'index.html'), 'utf8');
  const redirects = fs.readFileSync(path.join(repoRoot, '_redirects'), 'utf8');

  assert(html.includes('<title>Pediatric Echocardiography Z-Score Calculator | PHN/Lopez & Detroit</title>'), 'z-score title should target pediatric echocardiography and supported models');
  assert(html.includes('Calculate pediatric echocardiography Z-scores using PHN/Lopez and Detroit models. Includes BSA method, reference notes, and model-specific limitations.'), 'z-score meta description should mention PHN/Lopez, Detroit, BSA notes, and limitations');
  assert(html.includes('<h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Pediatric Echocardiography Z-Score Calculator</h1>'), 'visible H1 should use Pediatric Echocardiography Z-Score Calculator');
  assert(html.includes('<link rel="canonical" href="https://perfusiontools.com/z-score/" />'), 'z-score canonical should remain /z-score/');
  assert(html.includes('PHN / Lopez 2017'), 'top copy should mention PHN / Lopez 2017');
  assert(html.includes('Detroit / Pettersen 2008'), 'top copy should mention Detroit / Pettersen 2008');
  assert(html.includes('Selectable BSA method'), 'supported method badges should use neutral selectable BSA wording');
  assert(!html.includes('PHN / Lopez 2017 uses Mosteller BSA'), 'page should not claim PHN / Lopez has a fixed Mosteller BSA behavior');
  assert(!html.includes('The selected model determines the BSA method used for interpretation'), 'page should not claim selected Z-score model determines BSA method');
  assert(html.includes('Pediatric echo reference'), 'supported model badges should mention pediatric echo reference');
  assert(html.includes('Which BSA formula is used?'), 'FAQ should include BSA formula question');
  assert(html.includes('The built-in height/weight BSA calculator uses the formula selected in the BSA method selector.'), 'FAQ should describe BSA method selector behavior');
  assert(html.includes('The selected Z-score reference model does not automatically determine the BSA formula.'), 'FAQ should clarify model selection does not determine BSA formula');
  assert(html.includes('Why can different pediatric echo Z-score calculators give different results?'), 'FAQ should include calculator difference question');
  assert(html.includes('Can this calculator be used for adult patients?'), 'FAQ should include adult-use warning question');
  assert(html.includes('should not be used to interpret adult cardiac measurements'), 'adult-use FAQ should warn against adult interpretation');
  assert(html.includes('even when the calculated BSA falls within the model’s numeric input range'), 'limitations copy should warn adults are out of scope even if BSA is numerically in range');
  assert(html.includes('Detroit / Pettersen results are calculated for BSA ≤2.0 m²'), 'visible methodology should use the Detroit BSA ≤2.0 m² boundary');
  assert(html.includes('BSA &gt;2.0 m²'), 'visible FAQ should use the Detroit BSA >2.0 m² boundary');
  assert(html.includes('Detroit / Pettersen results are not calculated above BSA 2.0 m².'), 'visible warning should explain Detroit extrapolation is blocked');
  assert(!html.includes('BSA &lt; 2.0 m²'), 'page should not use the old strict BSA <2.0 m² Detroit boundary');
  assert(!html.includes('BSA < 2.0 m²'), 'JSON-LD should not use the old strict BSA <2.0 m² Detroit boundary');

  const faqLd = getJsonLdBlocks(html).find((block) => block['@type'] === 'FAQPage');
  assert(faqLd, 'FAQPage JSON-LD should exist');
  const faqQuestions = faqLd.mainEntity.map((entry) => entry.name);
  const visibleFaq = getVisibleFaq(html);
  const visibleFaqText = visibleFaq.flatMap((entry) => [entry.question, entry.answer]).join(' ');
  const faqLdText = JSON.stringify(faqLd);
  assert(!/Boston|BCH/.test(visibleFaqText), 'visible FAQ should not contain unsupported Boston/BCH search-intent copy');
  assert(!/Boston|BCH/.test(faqLdText), 'FAQPage JSON-LD should not contain unsupported Boston/BCH search-intent copy');
  assert.deepStrictEqual(
    visibleFaq,
    faqLd.mainEntity.map((entry) => ({ question: entry.name, answer: entry.acceptedAnswer.text })),
    'visible FAQ and FAQPage JSON-LD should remain synchronized'
  );
  assert(faqQuestions.includes('What Z-score models are available?'), 'FAQPage JSON-LD should include supported models question');
  assert(faqQuestions.includes('Which BSA formula is used?'), 'FAQPage JSON-LD should include BSA formula question');
  const bsaFaq = faqLd.mainEntity.find((entry) => entry.name === 'Which BSA formula is used?');
  assert(bsaFaq.acceptedAnswer.text.includes('formula selected in the BSA method selector'), 'FAQPage JSON-LD should describe BSA selector behavior');
  assert(bsaFaq.acceptedAnswer.text.includes('does not automatically determine the BSA formula'), 'FAQPage JSON-LD should clarify model selection does not determine BSA formula');
  assert(faqQuestions.includes('Why can different pediatric echo Z-score calculators give different results?'), 'FAQPage JSON-LD should include calculator difference question');
  assert(faqQuestions.includes('Can this calculator be used for adult patients?'), 'FAQPage JSON-LD should include adult-use warning question');
  const ageFaq = faqLd.mainEntity.find((entry) => entry.name === 'What age range is appropriate for this calculator?');
  assert(ageFaq.acceptedAnswer.text.includes('BSA ≤2.0 m²'), 'FAQPage JSON-LD should use the Detroit BSA ≤2.0 m² boundary');
  assert(ageFaq.acceptedAnswer.text.includes('BSA >2.0 m²'), 'FAQPage JSON-LD should explain Detroit results are not calculated above the boundary');

  const adultFaq = faqLd.mainEntity.find((entry) => entry.name === 'Can this calculator be used for adult patients?');
  assert(adultFaq.acceptedAnswer.text.includes('should not be used to interpret adult cardiac measurements'), 'FAQPage JSON-LD should warn against adult interpretation');
  assert(adultFaq.acceptedAnswer.text.includes('Even if an adult patient’s BSA falls within the accepted numeric range'), 'FAQPage JSON-LD should warn adult interpretation is invalid even if BSA is in range');

  assert.strictEqual(distHtml, html, 'source and dist z-score pages should stay synchronized');
  assert(redirects.includes('/phn-echo   /z-score/     301'), 'legacy /phn-echo route should keep its 301 redirect');
  assert(redirects.includes('/phn-echo/  /z-score/     301'), 'legacy /phn-echo/ route should keep its 301 redirect');
  assert(legacyHtml.includes('<meta name="robots" content="noindex,follow" />'), 'legacy page should remain noindex,follow');
  assert(legacyHtml.includes('<link rel="canonical" href="https://perfusiontools.com/z-score/" />'), 'legacy page canonical should remain /z-score/');

  console.log('All z-score SEO tests passed.');
}

run();
