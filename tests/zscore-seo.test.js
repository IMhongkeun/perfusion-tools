const assert = require('assert');
const fs = require('fs');
const path = require('path');

function getJsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(repoRoot, 'z-score', 'index.html'), 'utf8');

  assert(html.includes('<title>Pediatric Echocardiography Z-Score Calculator | PHN/Lopez & Detroit</title>'), 'z-score title should target pediatric echocardiography and supported models');
  assert(html.includes('Calculate pediatric echocardiography Z-scores using PHN/Lopez and Detroit models. Includes BSA method, reference notes, and model-specific limitations.'), 'z-score meta description should mention PHN/Lopez, Detroit, BSA notes, and limitations');
  assert(html.includes('Pediatric Echocardiography Z-Score Calculator'), 'visible H1 should use Pediatric Echocardiography Z-Score Calculator');
  assert(html.includes('PHN / Lopez 2017'), 'top copy should mention PHN / Lopez 2017');
  assert(html.includes('Detroit / Pettersen 2008'), 'top copy should mention Detroit / Pettersen 2008');
  assert(html.includes('Selectable BSA method'), 'supported method badges should use neutral selectable BSA wording');
  assert(!html.includes('PHN / Lopez 2017 uses Mosteller BSA'), 'page should not claim PHN / Lopez has a fixed Mosteller BSA behavior');
  assert(!html.includes('The selected model determines the BSA method used for interpretation'), 'page should not claim selected Z-score model determines BSA method');
  assert(html.includes('Pediatric echo reference'), 'supported model badges should mention pediatric echo reference');
  assert(html.includes('Is this the same as the Boston or BCH Z-score calculator?'), 'FAQ should include Boston/BCH comparison question');
  assert(html.includes('Boston / BCH Z-score models are not currently implemented here'), 'Boston/BCH FAQ should be phrased as a limitation, not support');
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
  assert(!html.includes('Boston / BCH</span>'), 'Boston/BCH should not be listed as a supported model badge');

  const faqLd = getJsonLdBlocks(html).find((block) => block['@type'] === 'FAQPage');
  assert(faqLd, 'FAQPage JSON-LD should exist');
  const faqQuestions = faqLd.mainEntity.map((entry) => entry.name);
  assert(faqQuestions.includes('What Z-score models are available?'), 'FAQPage JSON-LD should include supported models question');
  assert(faqQuestions.includes('Is this the same as the Boston or BCH Z-score calculator?'), 'FAQPage JSON-LD should include Boston/BCH limitation question');
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

  console.log('All z-score SEO tests passed.');
}

run();
