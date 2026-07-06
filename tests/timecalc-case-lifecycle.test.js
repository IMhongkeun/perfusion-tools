'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STALE_MS = 18 * 60 * 60 * 1000;

function hasCaseRows(rows) {
  return Object.values(rows || {}).some(row => row.label || row.startDisplay || row.endDisplay || row.startAtEpoch || row.endAtEpoch || row.running);
}

function hasCaseData(caseData) {
  return Boolean(caseData && (
    hasCaseRows(caseData.rows) ||
    caseData.cardioplegia?.lastCompletedAtEpoch ||
    caseData.cardioplegia?.nextDueAtEpoch ||
    (Array.isArray(caseData.cardioplegia?.doseLog) && caseData.cardioplegia.doseLog.length > 0)
  ));
}

function clearCaseData(appState) {
  return {
    preferences: { ...appState.preferences },
    caseData: null,
    legacyLiveTimers: null,
    legacyCardioplegiaReminder: null
  };
}

function isStale(caseData, nowMs) {
  return nowMs - (caseData.lastUpdatedAtEpoch || 0) > STALE_MS;
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="time-new-case"'), 'New case / Clear all button should exist');
  assert(timecalcHtml.includes('New case / Clear all'), 'clear-all button label should be visible');
  assert(timecalcHtml.includes('id="time-case-prompt"'), 'previous case prompt should exist');
  assert(timecalcHtml.includes('Previous case data found. Continue previous timers or start a new case?'), 'previous case prompt copy should be present');
  assert(timecalcHtml.includes('id="time-case-continue"'), 'Continue action should exist');
  assert(timecalcHtml.includes('id="time-case-start-new"'), 'Start new case action should exist');

  const preferences = { mode: 'live', selectedPreset: 'blood-30', intervalMinutes: 30, customIntervalMinutes: '45' };
  const caseData = {
    caseStartedAtEpoch: 1000,
    lastUpdatedAtEpoch: 2000,
    rows: { 1: { label: 'CPB', startDisplay: '08:00', endDisplay: '', startAtEpoch: 1000, endAtEpoch: null, running: true } },
    cardioplegia: { lastCompletedAtEpoch: 5000, nextDueAtEpoch: 5000 + 30 * 60000, doseLog: [5000] }
  };
  assert(hasCaseData(caseData), 'stored rows and cardioplegia log should count as case data');
  const cleared = clearCaseData({ preferences, caseData, legacyLiveTimers: caseData, legacyCardioplegiaReminder: caseData.cardioplegia });
  assert.strictEqual(cleared.caseData, null, 'New case should clear case data');
  assert.deepStrictEqual(cleared.preferences, preferences, 'New case should keep interval/mode preferences');
  assert.strictEqual(cleared.legacyLiveTimers, null, 'New case should clear legacy live timer data');
  assert.strictEqual(cleared.legacyCardioplegiaReminder, null, 'New case should clear legacy cardioplegia data');

  assert.strictEqual(isStale({ lastUpdatedAtEpoch: 1000 }, 1000 + STALE_MS), false, 'case data exactly 18 hours old should not be stale');
  assert.strictEqual(isStale({ lastUpdatedAtEpoch: 1000 }, 1001 + STALE_MS), true, 'case data older than 18 hours should be stale');

  assert(mainJs.includes("const TIME_CASE_STORAGE_KEY = 'perfusiontools.timecalc.caseData.v2'"), 'case data should use a dedicated versioned key');
  assert(mainJs.includes("const TIME_PREFERENCES_STORAGE_KEY = 'perfusiontools.timecalc.preferences.v2'"), 'preferences should use a dedicated versioned key');
  assert(mainJs.includes('const TIME_CASE_STALE_MS = 18 * 60 * 60 * 1000'), 'stale case threshold should be 18 hours');
  assert(mainJs.includes('caseStartedAtEpoch'), 'case data should include caseStartedAtEpoch');
  assert(mainJs.includes('lastUpdatedAtEpoch: Date.now()'), 'case data should include lastUpdatedAtEpoch');
  assert(mainJs.includes('function saveTimePreferencesState()'), 'preference persistence should be split from case persistence');
  assert(mainJs.includes('function saveTimeCaseData()'), 'case persistence should be split from preference persistence');
  assert(mainJs.includes('function clearTimecalcCaseData'), 'clear-all case lifecycle function should exist');
  assert(mainJs.includes('localStorage.removeItem(TIME_CASE_STORAGE_KEY)'), 'new case should remove current case storage');
  assert(mainJs.includes('localStorage.removeItem(TIME_LIVE_STORAGE_KEY)'), 'new case should remove legacy v1 live timer storage');
  assert(mainJs.includes('localStorage.removeItem(CARDIOPLEGIA_REMINDER_STORAGE_KEY)'), 'new case should remove legacy v2 cardioplegia case storage');
  assert(mainJs.includes('showTimeCasePrompt(caseData, pendingTimeCaseIsStale)'), 'load should show previous-case prompt when stored case data exists');
  assert(mainJs.includes('applyTimeCaseData(pendingTimeCaseData)'), 'Continue should restore stored case data');
  assert(mainJs.includes("Previous case data is old. Continue previous timers or start a new case?"), 'stale prompt should call out old case data');
  assert(mainJs.includes('pendingTimeCaseIsStale = Date.now() - (caseData.lastUpdatedAtEpoch || 0) > TIME_CASE_STALE_MS'), 'stale detection should use lastUpdatedAtEpoch');
  assert(packageJson.includes('tests/timecalc-case-lifecycle.test.js'), 'test script should include case lifecycle regression test');

  console.log('All timecalc case lifecycle tests passed.');
}

run();
