'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const pageHtml = fs.readFileSync(path.join(root, 'quick-reference', 'index.html'), 'utf8');
const distPageHtml = fs.readFileSync(path.join(root, 'dist', 'quick-reference', 'index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const dataJs = fs.readFileSync(path.join(root, 'quickReferenceData.js'), 'utf8');

function extractQuickReferenceDataBlock(source) {
  const match = source.match(/^window\.quickReferenceData = \{[\s\S]*?^\};/m);
  assert(match, 'quickReferenceData block should exist.');
  return match[0];
}

function loadQuickReferenceData(block) {
  const sandbox = { window: {} };
  vm.runInNewContext(block, sandbox);
  return sandbox.window.quickReferenceData;
}

// The bundled copy in main.js and the standalone data file must stay identical.
const mainBlock = extractQuickReferenceDataBlock(mainJs);
const dataBlock = extractQuickReferenceDataBlock(dataJs);
assert.strictEqual(mainBlock, dataBlock, 'main.js and quickReferenceData.js quick reference data should match.');

// The visible review date must match what initQuickReference() writes into the same element.
const reviewedMatch = pageHtml.match(/<span id="quick-reference-last-reviewed">([0-9-]+)<\/span>/);
assert(reviewedMatch, 'Quick Reference page should show an evidence review date element.');
const data = loadQuickReferenceData(mainBlock);
const cardDates = [];
data.tabs.forEach(tab => (tab.cards || []).forEach(card => {
  if (card.lastReviewed) cardDates.push(card.lastReviewed);
}));
assert(cardDates.length > 0, 'At least one tab card should carry a lastReviewed date.');
const latestCardDate = cardDates.sort().slice(-1)[0];
assert.strictEqual(reviewedMatch[1], latestCardDate, 'Static review date should match the latest lastReviewed date in the data.');

// Evidence section structure.
assert(pageHtml.includes('id="quick-reference-evidence"'), 'Sources & evidence levels section should exist.');
for (const groupTitle of ['ACP — adult', 'ACP — pediatric', 'RCP', 'HCA', 'MUF']) {
  assert(pageHtml.includes(`<summary>${groupTitle}</summary>`), `Evidence group "${groupTitle}" should exist.`);
}

const evidenceTags = pageHtml.match(/class="qr-evidence qr-evidence-[a-z]+"/g) || [];
assert(evidenceTags.length > 0, 'Evidence tags should be present.');
evidenceTags.forEach(tag => {
  assert(/qr-evidence-(guideline|published|practice)"/.test(tag), `Unknown evidence tag: ${tag}`);
});

// Every in-page citation must point to an existing reference entry, and every entry should be cited.
const citedIds = new Set((pageHtml.match(/href="#(qr-ref-\d+)"/g) || []).map(href => href.slice(7, -1)));
const referenceIds = new Set((pageHtml.match(/id="(qr-ref-\d+)"/g) || []).map(attr => attr.slice(4, -1)));
assert(referenceIds.size > 0, 'Reference list should exist.');
citedIds.forEach(id => assert(referenceIds.has(id), `Citation ${id} should have a matching reference entry.`));
referenceIds.forEach(id => assert(citedIds.has(id), `Reference ${id} should be cited at least once.`));

// External links open safely.
const blankTargetLinks = pageHtml.match(/<a [^>]*target="_blank"[^>]*>/g) || [];
blankTargetLinks.forEach(link => {
  assert(link.includes('rel="noopener noreferrer"'), `External link should use rel="noopener noreferrer": ${link}`);
  assert(/href="https:\/\//.test(link), `External link should use https: ${link}`);
});

// Generated output stays in sync with the source page.
assert.strictEqual(distPageHtml, pageHtml, 'dist/quick-reference/index.html should match the source page after build.');

console.log('Quick reference evidence tests passed.');
