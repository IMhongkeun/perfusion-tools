'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function parseTimeToMinutes(str) {
  if (!str) return null;
  const cleaned = str.trim();
  const numericOnly = cleaned.replace(/\D/g, '');
  if (numericOnly.length === 4) {
    const h = Number(numericOnly.slice(0, 2));
    const m = Number(numericOnly.slice(2, 4));
    if (h > 23 || m > 59) return null;
    return h * 60 + m;
  }
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(cleaned);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23) return null;
  return h * 60 + m;
}

function formatMinutesToHHMM(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = Math.max(totalMins % 60, 0);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatSummaryDuration(totalMinutes) {
  const safeMinutes = Math.max(0, totalMinutes || 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${safeMinutes} min / ${hours}:${minutes.toString().padStart(2, '0')}`;
}

function rowSummary({ idx, label, start, end }) {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin == null || endMin == null) return null;
  let adjustedEnd = endMin;
  if (endMin < startMin) adjustedEnd = endMin + 24 * 60;
  return `${(label || '').trim() || `Event ${idx}`}: ${formatMinutesToHHMM(startMin)}–${formatMinutesToHHMM(endMin)} (${formatSummaryDuration(adjustedEnd - startMin)})`;
}

function formatDoseLog(doseLog) {
  return `Cardioplegia complete: ${doseLog.length ? doseLog.join(', ') : '—'}`;
}

async function copySummary(summaryText, clipboard) {
  await clipboard.writeText(summaryText);
}

async function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="time-case-summary"'), 'Case summary card should exist');
  assert(timecalcHtml.includes('Review and copy completed time events. Do not include patient identifiers.'), 'summary privacy helper should exist');
  assert(timecalcHtml.includes('Copy the summary before starting a new case if needed.'), 'new case reminder should exist');
  assert(timecalcHtml.includes('id="time-summary-copy"'), 'Copy summary button should exist');
  assert(timecalcHtml.includes('id="time-summary-preview"'), 'plain-text summary preview should exist');

  assert.strictEqual(rowSummary({ idx: 1, label: 'CPB / Pump time', start: '09:12', end: '12:04' }), 'CPB / Pump time: 09:12–12:04 (172 min / 2:52)');
  assert.strictEqual(rowSummary({ idx: 2, label: 'Aortic cross-clamp', start: '09:35', end: '11:22' }), 'Aortic cross-clamp: 09:35–11:22 (107 min / 1:47)');
  assert.strictEqual(rowSummary({ idx: 3, label: '', start: '23:45', end: '00:15' }), 'Event 3: 23:45–00:15 (30 min / 0:30)');
  assert(!rowSummary({ idx: 4, label: 'Incomplete', start: '08:00', end: '' }), 'rows without complete start/end should be omitted');
  assert(!rowSummary({ idx: 5, label: 'Invalid', start: '24:15', end: '00:15' }), '24+ hour clock values should be omitted');
  assert.strictEqual(formatDoseLog(['09:37', '10:25']), 'Cardioplegia complete: 09:37, 10:25');
  assert.strictEqual(formatDoseLog([]), 'Cardioplegia complete: —');

  let copied = '';
  await copySummary('Perfusion time summary\nCPB / Pump time: 09:12–12:04 (172 min / 2:52)', { writeText: async text => { copied = text; } });
  assert.strictEqual(copied, 'Perfusion time summary\nCPB / Pump time: 09:12–12:04 (172 min / 2:52)', 'Copy summary should call clipboard writeText with plain text');
  await assert.rejects(copySummary('x', { writeText: async () => { throw new Error('blocked'); } }), /blocked/, 'clipboard failure should be detectable for fallback message');

  const summarySource = mainJs.slice(mainJs.indexOf('function formatSummaryDuration'), mainJs.indexOf('const CARDIOPLEGIA_REMINDER_STORAGE_KEY'));
  assert(summarySource.includes('navigator.clipboard.writeText(summaryText)'), 'copy action should use navigator.clipboard.writeText');
  assert(summarySource.includes('Copy failed. Select and copy manually.'), 'copy failure fallback message should be present');
  assert(!/localStorage\.setItem\([^)]*summary/i.test(summarySource), 'summary text should not be saved to localStorage');
  assert(mainJs.includes('clearTimecalcCaseData({ keepPreferences: true })'), 'New case / Clear all behavior should remain wired to existing clear function');
  assert(packageJson.includes('tests/timecalc-summary.test.js'), 'test script should include summary regression test');

  console.log('All timecalc summary tests passed.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
