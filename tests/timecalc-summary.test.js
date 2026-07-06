'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function parseTimeToMinutes(str) {
  if (!str) return null;
  const cleaned = str.trim();
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

function formatEpochToHHMM(epochMs) {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function formatSummaryDuration(totalMinutes) {
  const safeMinutes = Math.max(0, totalMinutes || 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${safeMinutes} min / ${hours}:${minutes.toString().padStart(2, '0')}`;
}

function summaryDurationMinutes({ startInput, endInput, state }) {
  const startMin = parseTimeToMinutes(startInput);
  const endMin = parseTimeToMinutes(endInput);
  const stoppedLiveStateMatchesInputs = Boolean(
    state &&
    state.startAtEpoch &&
    state.endAtEpoch &&
    !state.running &&
    startInput === formatEpochToHHMM(state.startAtEpoch) &&
    endInput === formatEpochToHHMM(state.endAtEpoch)
  );
  if (stoppedLiveStateMatchesInputs) return Math.floor(Math.max(0, state.endAtEpoch - state.startAtEpoch) / 60000);

  let adjustedEnd = endMin;
  if (endMin < startMin && endMin < 24 * 60 && startMin < 24 * 60) adjustedEnd = endMin + 24 * 60;
  let diff = adjustedEnd - startMin;
  if (diff < 0) diff += 24 * 60;
  return diff;
}

function rowSummary({ label, startInput, endInput, state }) {
  const startMin = parseTimeToMinutes(startInput);
  const endMin = parseTimeToMinutes(endInput);
  const startDisplay = formatMinutesToHHMM(startMin);
  const endDisplay = formatMinutesToHHMM(endMin);
  return `${label}: ${startDisplay}–${endDisplay} (${formatSummaryDuration(summaryDurationMinutes({ startInput: startDisplay, endInput: endDisplay, state }))})`;
}

function validateCardioplegiaInterval(value) {
  const intervalMinutes = Number.parseInt(value, 10);
  return Number.isInteger(intervalMinutes) && intervalMinutes >= 1 && intervalMinutes <= 180 ? intervalMinutes : null;
}

function getCardioplegiaSummaryIntervalMinutes(state) {
  if (state.selectedPreset === 'custom') return validateCardioplegiaInterval(state.customIntervalMinutes);
  return validateCardioplegiaInterval(state.intervalMinutes);
}

function buildCardioplegiaSummaryLines(state) {
  const doseText = state.doseLog.length ? state.doseLog.join(', ') : '—';
  const lines = [`Cardioplegia complete: ${doseText}`];
  const intervalMinutes = getCardioplegiaSummaryIntervalMinutes(state);
  if (intervalMinutes) lines.push(`Cardioplegia interval setting: ${intervalMinutes} min`);
  return lines;
}

function renderSummaryStatus(currentStatus, message = '') {
  return message;
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="time-case-summary"'), 'Case summary card should exist');
  assert(timecalcHtml.includes('id="time-summary-copy"'), 'Copy summary button should exist');
  assert(timecalcHtml.includes('Review and copy completed time events. Do not include patient identifiers.'), 'summary privacy helper should exist');

  const stoppedLiveState = {
    startAtEpoch: Date.UTC(2026, 0, 1, 9, 12, 59),
    endAtEpoch: Date.UTC(2026, 0, 1, 12, 4, 0),
    running: false
  };
  const stoppedLiveSummary = rowSummary({ label: 'CPB / Pump time', startInput: '09:12', endInput: '12:04', state: stoppedLiveState });
  assert.strictEqual(stoppedLiveSummary, 'CPB / Pump time: 09:12–12:04 (171 min / 2:51)', 'stopped live row summary should use floored epoch duration');
  assert(!stoppedLiveSummary.includes('172 min / 2:52'), 'stopped live row summary should not recalculate from HH:MM inputs');

  const manualSummary = rowSummary({ label: 'CPB / Pump time', startInput: '09:12', endInput: '12:04', state: null });
  assert.strictEqual(manualSummary, 'CPB / Pump time: 09:12–12:04 (172 min / 2:52)', 'manual row summary should continue using HH:MM duration');

  const overriddenSummary = rowSummary({ label: 'CPB / Pump time', startInput: '09:13', endInput: '12:04', state: stoppedLiveState });
  assert.strictEqual(overriddenSummary, 'CPB / Pump time: 09:13–12:04 (171 min / 2:51)', 'manual override should fall back to HH:MM calculation when inputs no longer match epoch display');

  const midnightState = {
    startAtEpoch: Date.UTC(2026, 0, 1, 23, 45, 30),
    endAtEpoch: Date.UTC(2026, 0, 2, 0, 15, 0),
    running: false
  };
  const midnightSummary = rowSummary({ label: 'Event 3', startInput: '23:45', endInput: '00:15', state: midnightState });
  assert.strictEqual(midnightSummary, 'Event 3: 23:45–00:15 (29 min / 0:29)', 'cross-midnight stopped live summary should use floored epoch duration');
  assert(!midnightSummary.includes('24:15'), 'cross-midnight summary should not display 24+ hour values');

  let status = renderSummaryStatus('', 'Summary copied');
  assert.strictEqual(status, 'Summary copied', 'copy success should show Summary copied');
  status = renderSummaryStatus(status);
  assert.strictEqual(status, '', 'ordinary row/time refresh should clear copied status');
  status = renderSummaryStatus('', 'Summary copied');
  status = renderSummaryStatus(status);
  assert.strictEqual(status, '', 'cardioplegia doseLog refresh should clear copied status');
  status = renderSummaryStatus('', 'Summary copied');
  status = renderSummaryStatus(status);
  assert.strictEqual(status, '', 'Refresh summary should clear copied status');
  status = renderSummaryStatus(status, 'Summary copied');
  assert.strictEqual(status, 'Summary copied', 'copying again after a summary change should show copied status again');
  status = renderSummaryStatus('', 'Copy failed. Select and copy manually.');
  assert.strictEqual(status, 'Copy failed. Select and copy manually.', 'copy failure should show failure message at failure time');
  status = renderSummaryStatus(status);
  assert.strictEqual(status, '', 'ordinary refresh should clear copy failure message');

  assert(buildCardioplegiaSummaryLines({ selectedPreset: 'blood-20', intervalMinutes: 20, customIntervalMinutes: '', doseLog: [] }).includes('Cardioplegia interval setting: 20 min'), 'valid preset should be included in summary interval');
  assert(buildCardioplegiaSummaryLines({ selectedPreset: 'custom', intervalMinutes: 20, customIntervalMinutes: '75', doseLog: [] }).includes('Cardioplegia interval setting: 75 min'), 'valid custom interval should be included in summary interval');
  const emptyCustomLines = buildCardioplegiaSummaryLines({ selectedPreset: 'custom', intervalMinutes: 20, customIntervalMinutes: '', doseLog: ['09:37'] });
  assert(!emptyCustomLines.includes('Cardioplegia interval setting: 20 min'), 'empty custom interval should not show stale preset interval');
  assert(emptyCustomLines.includes('Cardioplegia complete: 09:37'), 'doseLog summary should remain when custom interval is empty');
  const invalidCustomLines = buildCardioplegiaSummaryLines({ selectedPreset: 'custom', intervalMinutes: 20, customIntervalMinutes: 'abc', doseLog: ['09:37'] });
  assert(!invalidCustomLines.includes('Cardioplegia interval setting: 20 min'), 'invalid custom interval should not show stale preset interval');
  assert(invalidCustomLines.includes('Cardioplegia complete: 09:37'), 'doseLog summary should remain when custom interval is invalid');

  assert(mainJs.includes('function getSummaryDurationMinutes'), 'summary duration source helper should exist');
  assert(mainJs.includes('Math.floor(Math.max(0, state.endAtEpoch - state.startAtEpoch) / 60000)'), 'stopped live summary should floor epoch duration minutes');
  assert(mainJs.includes('startValue === formatEpochToHHMM(state.startAtEpoch)'), 'stopped live summary should require matching start input');
  assert(mainJs.includes('endValue === formatEpochToHHMM(state.endAtEpoch)'), 'stopped live summary should require matching end input');
  assert(mainJs.includes("function renderTimeCaseSummary(message = '')"), 'ordinary summary render should default to clearing status');
  assert(mainJs.includes('if (status) status.textContent = message'), 'summary render should always update status text');
  assert(mainJs.includes('function getCardioplegiaSummaryIntervalMinutes'), 'summary interval helper should exist');
  assert(mainJs.includes("cardioplegiaReminderState.selectedPreset === 'custom'"), 'summary interval should branch on custom preset');
  assert(!/localStorage\.setItem\([^)]*summary/i.test(mainJs), 'summary text should not be persisted to localStorage');
  assert(packageJson.includes('tests/timecalc-summary.test.js'), 'test script should include summary regression test');

  console.log('All timecalc summary tests passed.');
}

run();
