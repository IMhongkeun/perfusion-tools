'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function parseTimeToMinutes(str) {
  if (!str) return null;
  const match = String(str).trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatDuration(totalMinutes) {
  if (totalMinutes == null || Number.isNaN(totalMinutes)) return '-';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h < 1) return `${totalMinutes} min`;
  return `${totalMinutes} min (${h}hr ${String(m).padStart(2, '0')}min)`;
}

function manualDuration(start, end) {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  let adjustedEnd = endMin;
  if (endMin < startMin && endMin < 24 * 60 && startMin < 24 * 60) adjustedEnd = endMin + 24 * 60;
  return formatDuration(adjustedEnd - startMin);
}

function liveDuration(startAtEpoch, nowEpoch) {
  const safeMs = Math.max(0, nowEpoch - startAtEpoch);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const exactTime = [hours, minutes, seconds].map(value => value.toString().padStart(2, '0')).join(':');
  const chartingMinutes = Math.floor(safeMs / 60000);
  const chartingSummary = chartingMinutes < 1 ? '<1 min' : `${chartingMinutes} min`;
  return `${exactTime} (${chartingSummary})`;
}


function manualDurationWithEndDisplay(start, end) {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  let adjustedEnd = endMin;
  if (endMin < startMin && endMin < 24 * 60 && startMin < 24 * 60) adjustedEnd = endMin + 24 * 60;
  return { duration: formatDuration(adjustedEnd - startMin), endDisplay: end };
}

function formatEpochToHHMM(epochMs) {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function liveStoppedCrossMidnight(startAtEpoch, endAtEpoch) {
  return {
    startDisplay: formatEpochToHHMM(startAtEpoch),
    endDisplay: formatEpochToHHMM(endAtEpoch),
    duration: liveDuration(startAtEpoch, endAtEpoch),
    persistedRow: { id: '1', startAtEpoch, endAtEpoch, running: false, lastUpdatedAtEpoch: endAtEpoch }
  };
}

function displayForMode({ mode, startValue, endValue, state, nowEpoch }) {
  const inputMatchesLiveState = startValue === (state.startDisplay || '') && endValue === (state.endDisplay || '');
  const canUseLiveState = mode === 'live' && inputMatchesLiveState;
  if (mode === 'live' && canUseLiveState && state.running && state.startAtEpoch) return liveDuration(state.startAtEpoch, nowEpoch);
  if (!endValue) return '-';
  return manualDuration(startValue, endValue);
}

function controlsAfterLiveStateCleared() {
  const state = { running: false };
  return { runningBadgeVisible: state.running, startDisabled: state.running, stopDisabled: !state.running };
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');

  assert.strictEqual(manualDuration('08:15', '10:45'), '150 min (2hr 30min)', 'manual duration should show readable hours and minutes');
  assert.strictEqual(manualDuration('23:30', '00:15'), '45 min', 'sub-hour manual duration should not repeat minutes');
  const manualCrossMidnight = manualDurationWithEndDisplay('23:45', '00:15');
  assert.strictEqual(manualCrossMidnight.duration, '30 min', 'manual cross-midnight duration should be calculated internally');
  assert.strictEqual(manualCrossMidnight.endDisplay, '00:15', 'manual cross-midnight input should not be rewritten to a 24+ hour display');
  assert.strictEqual(parseTimeToMinutes('24:15'), null, '24+ hour display values should not be accepted as user-facing HH:MM input');
  assert.strictEqual(liveDuration(100000, 100000 + (7 * 60000) + 30000), '00:07:30 (7 min)', 'live duration should show exact HH:MM:SS with floored minute summary');
  assert.strictEqual(liveDuration(100000, 100000 + 34000), '00:00:34 (<1 min)', 'live duration under one minute should not round up to 1 min');
  assert.strictEqual(liveDuration(100000, 100000 + 94000), '00:01:34 (1 min)', 'live duration should floor charting minutes for elapsed seconds');
  const liveCrossMidnight = liveStoppedCrossMidnight(Date.UTC(2026, 0, 1, 23, 45), Date.UTC(2026, 0, 2, 0, 15));
  assert.strictEqual(liveCrossMidnight.startDisplay, '23:45', 'live stopped cross-midnight start display should stay 24-hour clock time');
  assert.strictEqual(liveCrossMidnight.endDisplay, '00:15', 'live stopped cross-midnight end display should stay 24-hour clock time');
  assert.strictEqual(liveCrossMidnight.duration, '00:30:00 (30 min)', 'live stopped cross-midnight duration should use epoch difference');
  assert(!JSON.stringify(liveCrossMidnight.persistedRow).includes('24:15'), 'live stopped persistence should not contain 24+ hour display values');
  assert.strictEqual(manualDuration('09:00', '09:05'), '5 min', 'manual calculation should remain the source of truth when users edit inputs');
  const runningState = { running: true, startAtEpoch: 100000, endAtEpoch: null, startDisplay: '09:00', endDisplay: '' };
  assert.strictEqual(displayForMode({ mode: 'record', startValue: '09:00', endValue: '', state: runningState, nowEpoch: 100000 + 90000 }), '-', 'Record mode should keep missing-end manual display instead of live running duration');
  assert.strictEqual(displayForMode({ mode: 'live', startValue: '09:00', endValue: '', state: runningState, nowEpoch: 100000 + 90000 }), '00:01:30 (1 min)', 'returning to Live mode should show Date.now-based running duration');

  assert(timecalcHtml.includes('id="time-mode-record"'), 'Record mode toggle should exist');
  assert(timecalcHtml.includes('id="time-mode-live"'), 'Live mode toggle should exist');
  assert(timecalcHtml.includes('id="time-live-notice"'), 'Live mode safety notice should exist');
  assert(mainJs.includes("perfusiontools.timecalc.liveTimers.v1"), 'versioned localStorage key should be used');
  assert(mainJs.includes('Date.now() - state.startAtEpoch'), 'running duration should be based on Date.now and startAtEpoch');
  assert(mainJs.includes("const isLiveModeActive = timeLiveMode === 'live'"), 'updateTimeRow should explicitly gate live display on Live mode');
  assert(mainJs.includes('if (isLiveModeActive && canUseLiveState && state.running && state.startAtEpoch)'), 'running timer branch should only render in Live mode');
  assert(mainJs.includes('const chartingMinutes = Math.floor(safeMs / 60000)'), 'live charting summary should floor elapsed minutes');
  const updateTimeRowSource = mainJs.slice(mainJs.indexOf('function updateTimeRow'), mainJs.indexOf('function clearTimeLiveRow'));
  assert(!updateTimeRowSource.includes('endInput.value = formatMinutesToHHMM(adjustedEnd)'), 'manual cross-midnight calculation should not rewrite end input to 24+ hour display');
  const snapshotSource = mainJs.slice(mainJs.indexOf('function getTimeRowsSnapshot'), mainJs.indexOf('function hasTimeCaseData'));
  assert(!/startDisplay:|endDisplay:/.test(snapshotSource), 'localStorage case payload should not persist display strings that could contain 24+ hour values');
  const intervalSource = mainJs.slice(mainJs.indexOf('function initTimeLiveInterval'), mainJs.indexOf('function autoFormatTimeInput'));
  assert(intervalSource.includes("timeLiveMode === 'live' && getTimeRowState(row.id).running"), 'interval tick should only update running rows in Live mode');
  const liveFormatterSource = mainJs.slice(mainJs.indexOf('function formatDurationFromMs'), mainJs.indexOf('function saveTimeLiveState'));
  assert(!/Math\.(round|ceil)/.test(liveFormatterSource), 'live duration formatting should not round or ceil elapsed minutes');
  assert(mainJs.includes('const canUseLiveState = isLiveModeActive && inputMatchesLiveState'), 'Record mode and manual edits should fall back to manual calculation instead of live state');
  assert(mainJs.includes('startAtEpoch: now'), 'Start should store startAtEpoch');
  assert(mainJs.includes('state.endAtEpoch = now'), 'Stop should store endAtEpoch');
  assert(mainJs.includes('delete timeLiveTimers[rowId]'), 'Reset/manual override should clear row live state');
  const startClockHandlerSource = mainJs.slice(mainJs.indexOf('if (s && sNow)'), mainJs.indexOf('if (e && eNow)'));
  const endClockHandlerSource = mainJs.slice(mainJs.indexOf('if (e && eNow)'), mainJs.indexOf('if (s && e && liveStart)'));
  assert(startClockHandlerSource.includes('delete timeLiveTimers[rowId]'), 'start-time clock override should clear live state');
  assert(startClockHandlerSource.includes('updateTimeLiveControls(rowId)'), 'start-time clock override should refresh controls after missing-end early return');
  assert(endClockHandlerSource.includes('delete timeLiveTimers[rowId]'), 'end-time clock override should clear live state');
  assert(endClockHandlerSource.includes('updateTimeLiveControls(rowId)'), 'end-time clock override should refresh controls after live-state clear');
  assert.deepStrictEqual(controlsAfterLiveStateCleared(), { runningBadgeVisible: false, startDisabled: false, stopDisabled: true }, 'cleared live state should hide Running badge, enable Start, and disable Stop');
  assert(mainJs.includes('class="time-live-controls hidden'), 'Live controls should be hidden in Record mode by default');

  console.log('All timecalc live tests passed.');
}

run();
