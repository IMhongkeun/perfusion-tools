'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const STALE_MS = 18 * 60 * 60 * 1000;

function hasCaseRows(rows) {
  return Array.isArray(rows) && rows.some(row => row.startAtEpoch || row.endAtEpoch || row.running || rows.length !== 3);
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


function buildMinimalCaseRows(rows) {
  return rows.map((row, index) => ({
    id: row.id,
    order: index,
    eventType: row.eventType || 'custom',
    startAtEpoch: row.startAtEpoch || null,
    endAtEpoch: row.endAtEpoch || null,
    running: Boolean(row.running),
    lastUpdatedAtEpoch: row.lastUpdatedAtEpoch || null
  }));
}

function formatEpochToHHMM(epochMs) {
  if (!epochMs) return '';
  const date = new Date(epochMs);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="time-new-case"'), 'New case / Clear all button should exist');
  assert(timecalcHtml.includes('id="time-rows"'), 'dynamic rows container should exist');
  assert(timecalcHtml.includes('id="time-add-row"'), 'Add event button should exist');
  assert(!timecalcHtml.includes('id="time-label-4"'), 'fixed five-row markup should not be present');
  assert(timecalcHtml.includes('id="time-case-actions"'), 'New case / Clear all should live in a separate action row');
  assert(timecalcHtml.includes('border-t border-slate-200/80'), 'privacy/local storage notice should be visually separated with a subtle divider');
  assert(timecalcHtml.includes('aria-label="New case / Clear all"'), 'the single clear-all icon button should have an accessible label');
  assert(!timecalcHtml.includes('id="transplant-reset"'), 'Transplant should not render a duplicate calculator clear button');
  assert(timecalcHtml.includes('id="time-case-prompt"'), 'previous case prompt should exist');
  assert(timecalcHtml.includes('Previous case data found. Continue previous timers or start a new case?'), 'previous case prompt copy should be present');
  assert(timecalcHtml.includes('id="time-case-continue"'), 'Continue action should exist');
  assert(timecalcHtml.includes('id="time-case-start-new"'), 'Start new case action should exist');

  const preferences = { mode: 'live', selectedPreset: 'blood-30', intervalMinutes: 30, customIntervalMinutes: '45' };
  const caseData = {
    caseStartedAtEpoch: 1000,
    lastUpdatedAtEpoch: 2000,
    rows: [{ id: 'row-cpb', order: 0, eventType: 'cpb', label: 'Patient Jane Doe CPB', startDisplay: '08:00', endDisplay: '', startAtEpoch: 1000, endAtEpoch: null, running: true }, { id: 'row-xclamp', order: 1, eventType: 'x-clamp', label: 'Manual note', startDisplay: '09:00', endDisplay: '09:05', startAtEpoch: null, endAtEpoch: null, running: false }, { id: 'row-custom-default', order: 2, eventType: 'custom' }, { id: 'row-custom-extra', order: 3, eventType: 'custom' }],
    cardioplegia: { lastCompletedAtEpoch: 5000, nextDueAtEpoch: 5000 + 30 * 60000, doseLog: [5000] }
  };
  assert(hasCaseData(caseData), 'stored rows and cardioplegia log should count as case data');
  const minimalRows = buildMinimalCaseRows(caseData.rows);
  assert.deepStrictEqual(minimalRows[0], { id: 'row-cpb', order: 0, eventType: 'cpb', startAtEpoch: 1000, endAtEpoch: null, running: true, lastUpdatedAtEpoch: null }, 'case storage should keep stable id/order/eventType and epoch-based live timer fields');
  assert.strictEqual(minimalRows.length, 4, 'case storage should keep dynamic row structure for restore');
  assert(!JSON.stringify(minimalRows).includes('Patient Jane Doe'), 'case storage should not include user-entered labels or PHI');
  assert(!JSON.stringify(minimalRows).includes('08:00'), 'case storage should not include raw startDisplay/manual input values');
  assert.strictEqual(formatEpochToHHMM(Date.UTC(2026, 0, 1, 8, 5)), '08:05', 'restored display should be regenerated from epoch as HH:MM');
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
  const snapshotSource = mainJs.slice(mainJs.indexOf('function getTimeRowsSnapshot'), mainJs.indexOf('function hasTimeCaseData'));
  assert(!/labelInput|startInput|endInput|startDisplay:|endDisplay:|label:/.test(snapshotSource), 'case snapshot should not persist labels or raw input display values');
  assert(mainJs.includes('function formatEpochToHHMM'), 'restore path should regenerate HH:MM display from epoch values');
  assert(mainJs.includes('function saveTimePreferencesState()'), 'preference persistence should be split from case persistence');
  assert(mainJs.includes('function saveTimeCaseData()'), 'case persistence should be split from preference persistence');
  assert(mainJs.includes('function clearTimecalcCaseData'), 'clear-all case lifecycle function should exist');
  assert(mainJs.includes('function getDefaultTimeLabel'), 'main code should centralize default row labels');
  assert(mainJs.includes("if (eventType === 'cpb') return 'CPB / Pump time'"), 'New case should be able to restore Row 1 default label');
  assert(mainJs.includes("if (eventType === 'x-clamp') return 'Aortic cross-clamp'"), 'New case should be able to restore Row 2 default label');
  assert(mainJs.includes('timeRows = getDefaultTimeRows()'), 'clear paths should reset dynamic rows to default 3');
  assert(mainJs.includes("actionsEl.classList.add('hidden')"), 'previous case prompt should hide the standalone New case action row');
  assert(mainJs.includes("actionsEl.classList.remove('hidden')"), 'hiding the previous case prompt should restore the standalone New case action row');
  assert(mainJs.includes('localStorage.removeItem(TIME_CASE_STORAGE_KEY)'), 'new case should remove current case storage');
  assert(mainJs.includes('localStorage.removeItem(TIME_LIVE_STORAGE_KEY)'), 'new case should remove legacy v1 live timer storage');
  assert(mainJs.includes('localStorage.removeItem(CARDIOPLEGIA_REMINDER_STORAGE_KEY)'), 'new case should remove legacy v2 cardioplegia case storage');
  assert(mainJs.includes('showTimeCasePrompt(caseData, pendingTimeCaseIsStale)'), 'load should show previous-case prompt when stored case data exists');
  assert(mainJs.includes('applyTimeCaseData(pendingTimeCaseData)'), 'Continue should restore stored case data');
  assert(mainJs.includes("Previous case data is old. Continue previous timers or start a new case?"), 'stale prompt should call out old case data');
  assert(mainJs.includes('pendingTimeCaseIsStale = Date.now() - (caseData.lastUpdatedAtEpoch || 0) > TIME_CASE_STALE_MS'), 'stale detection should use lastUpdatedAtEpoch');
  assert(packageJson.includes('tests/timecalc-case-lifecycle.test.js'), 'test script should include case lifecycle regression test');
  const homeHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
  assert(timecalcHtml.includes('Do not enter patient identifiers. Live timer data is stored only in this browser'), 'timecalc Live mode notice should warn against patient identifiers and explain local browser storage');
  assert(homeHtml.includes('Timecalc Live timer/case data and Transplant case times are stored locally in this browser'), 'privacy copy should explain Live and Transplant local persistence');
  assert(homeHtml.includes('Use New case / Clear all to remove stored case data.'), 'privacy copy should explain clear path');

  console.log('All timecalc case lifecycle tests passed.');
}

run();
