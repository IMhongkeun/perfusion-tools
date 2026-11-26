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

// Displayed values must follow the evidence review (2026-11-27).
const tabsById = Object.fromEntries(data.tabs.map(tab => [tab.id, tab]));
const hcaTab = tabsById.tca;
assert.strictEqual(hcaTab.durationColumnLabel, 'Model-estimated arrest time without cerebral perfusion', 'HCA time column should be labeled as a model estimate without cerebral perfusion.');
const hcaFootnotes = (hcaTab.footnotes || []).join(' ');
assert(hcaFootnotes.includes('McCullough') && hcaFootnotes.includes('not clinically validated'), 'HCA footnote should cite the model and state it is not a validated limit.');
assert(hcaFootnotes.includes('5 × 2.3^((37 − T)/10)'), 'HCA footnote should state how calculated values were derived.');
assert(hcaFootnotes.includes('do not directly apply when ACP is used'), 'HCA footnote should separate hypothermia-only estimates from ACP.');
hcaTab.tableRows.forEach(row => {
  assert(!/<18[^)]*\(Profound\)/.test(row.temperature), 'Profound should not be defined as <18°C.');
  assert(!/conservative/i.test(row.duration), 'HCA durations should not be described as conservative safe limits.');
  assert(!('severity' in row), 'HCA rows should not carry safe/caution/high severity markers.');
  assert(!/≤40 min possible/.test(row.notes), 'HCA notes should not combine temperature and ACP time into a safety claim.');
  assert(!/shorter CPB time|less coagulopathy/i.test(row.notes), 'HCA summary rows should not present comparative benefits of a temperature range.');
  assert(!/coagulopathy|rarely used/i.test(row.notes) && !/bleeding risk/i.test(row.tooltip || ''), 'HCA summary rows should not state unsupported temperature-specific risks.');
});
assert(!/severityMap|rounded-full \$\{severityClass\}/.test(mainJs), 'HCA table should not render severity color dots.');
const rcpPressure = tabsById.rcp.cards.find(card => card.id === 'rcp-svc-pressure');
assert.strictEqual(rcpPressure.value, '~20–25', 'RCP SVC pressure should show the ~20–25 mmHg maintenance reference.');
const pediatricDuration = tabsById.acp.profiles.pediatric.find(card => card.id === 'acp-peds-duration');
assert.strictEqual(pediatricDuration.value, 'No fixed limit', 'Pediatric ACP duration should not show an unsourced fixed range.');
const mufTab = tabsById.muf;
assert(!/strongly recommended/i.test(mufTab.tableColumns.pediatric), 'Pediatric MUF should follow the current "should be considered" wording.');
const mufHct = mufTab.tableRows.find(row => row.id === 'muf-target-hct');
assert.strictEqual(mufHct.adult, 'No established endpoint', 'Adult MUF should not show an unsourced Hct endpoint.');
assert(mainJs.includes("tab.durationColumnLabel || 'Safe Duration (min)'"), 'HCA table should render the data-driven duration column label.');

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
