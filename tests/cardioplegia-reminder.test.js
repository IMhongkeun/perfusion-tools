'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const CARDIOPLEGIA_PRESETS = {
  'interval-30': 30,
  'interval-60': 60,
  'interval-90': 90
};

function validateCardioplegiaInterval(value) {
  const intervalMinutes = Number.parseInt(value, 10);
  return Number.isInteger(intervalMinutes) && intervalMinutes >= 1 && intervalMinutes <= 180 ? intervalMinutes : null;
}

function normalizePreset(selectedPreset, intervalMinutes, customIntervalMinutes = '') {
  const validInterval = validateCardioplegiaInterval(intervalMinutes) || 30;
  if (Object.hasOwn(CARDIOPLEGIA_PRESETS, selectedPreset)) return { selectedPreset, intervalMinutes: CARDIOPLEGIA_PRESETS[selectedPreset], customIntervalMinutes: '' };
  if (selectedPreset === 'custom') {
    const custom = validateCardioplegiaInterval(customIntervalMinutes) || validInterval;
    return { selectedPreset: 'custom', intervalMinutes: custom, customIntervalMinutes: String(custom) };
  }
  const migratedPreset = `interval-${validInterval}`;
  return Object.hasOwn(CARDIOPLEGIA_PRESETS, migratedPreset)
    ? { selectedPreset: migratedPreset, intervalMinutes: validInterval, customIntervalMinutes: '' }
    : { selectedPreset: 'custom', intervalMinutes: validInterval, customIntervalMinutes: String(validInterval) };
}

function completeDose(state, nowEpoch) {
  const intervalMinutes = validateCardioplegiaInterval(state.intervalMinutes);
  const completedAtEpoch = nowEpoch;
  const nextDueAtEpoch = completedAtEpoch + intervalMinutes * 60000;
  return {
    ...state,
    lastCompletedAtEpoch: completedAtEpoch,
    nextDueAtEpoch,
    doseLog: state.doseLog.concat(completedAtEpoch)
  };
}

function undoLast(state) {
  const doseLog = state.doseLog.slice(0, -1);
  const latestCompletedAtEpoch = doseLog[doseLog.length - 1] || null;
  const intervalMinutes = validateCardioplegiaInterval(state.intervalMinutes);
  return {
    ...state,
    doseLog,
    lastCompletedAtEpoch: latestCompletedAtEpoch,
    nextDueAtEpoch: latestCompletedAtEpoch && intervalMinutes ? latestCompletedAtEpoch + intervalMinutes * 60000 : null
  };
}

function resetTimer(state) {
  return { ...state, lastCompletedAtEpoch: null, nextDueAtEpoch: null };
}

function clearLog(state) {
  return { ...state, doseLog: [] };
}

function getCardioplegiaStatus(state, nowMs) {
  if (!state.lastCompletedAtEpoch || !state.nextDueAtEpoch) return { label: 'Not started', remainingMs: null };
  const remainingMs = state.nextDueAtEpoch - nowMs;
  if (remainingMs > 5 * 60000) return { label: 'On schedule', remainingMs };
  if (remainingMs > 0) return { label: 'Due soon', remainingMs };
  if (Math.abs(remainingMs) < 60000) return { label: 'Due', remainingMs };
  return { label: 'Overdue', remainingMs };
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="cardioplegia-reminder"'), 'optional reminder card should exist');
  assert(mainJs.includes('id="cardioplegia-reminder-toggle"'), 'compact reminder toggle should be rendered with the x-clamp row');
  assert(mainJs.includes("row.eventType === 'x-clamp'"), 'reminder toggle should stay attached to the stable #2 x-clamp event');
  assert(timecalcHtml.includes('Cardioplegia reminder'), 'card title should be present');
  assert(timecalcHtml.includes('Optional reminder from dose completion. Verify against pump timer, charting record, and local myocardial protection protocol.'), 'compact safety copy should be present');
  assert(timecalcHtml.includes('Cardioplegia complete'), 'single primary complete action should be present');
  assert(!timecalcHtml.includes('Start infusion'), 'dual-step Start infusion action should not be present');
  assert(!timecalcHtml.includes('Complete infusion'), 'dual-step Complete infusion action should not be present');
  assert(!/Pause|Resume/.test(timecalcHtml), 'pause/resume controls should not be present');

  Object.entries(CARDIOPLEGIA_PRESETS).forEach(([preset, minutes]) => {
    assert(timecalcHtml.includes(`data-preset="${preset}"`), `${preset} quick preset should be present`);
    assert.strictEqual(minutes, CARDIOPLEGIA_PRESETS[preset], `${preset} interval should be stable`);
  });
  assert(timecalcHtml.includes('data-preset="custom"'), 'custom interval preset should be present');
  assert.strictEqual((timecalcHtml.match(/class="cardioplegia-preset/g) || []).length, 4, 'only 30, 60, 90, and Custom presets should be shown');
  assert(timecalcHtml.includes('id="cardioplegia-custom-fields" class="hidden'), 'custom input should remain collapsed until Custom is selected');
  assert(mainJs.includes("if (shouldShow && crossClampRow) crossClampRow.after(root)"), 'expanded reminder should render directly between the x-clamp and optional rows');
  assert.strictEqual(validateCardioplegiaInterval('1'), 1, 'custom interval lower bound should be valid');
  assert.strictEqual(validateCardioplegiaInterval('180'), 180, 'custom interval upper bound should be valid');
  assert.strictEqual(validateCardioplegiaInterval('0'), null, 'custom interval below range should be invalid');
  assert.strictEqual(validateCardioplegiaInterval('181'), null, 'custom interval above range should be invalid');
  assert.deepStrictEqual(normalizePreset('blood-30', 30), { selectedPreset: 'interval-30', intervalMinutes: 30, customIntervalMinutes: '' }, 'legacy 30-minute preset should migrate to the visible 30-minute option');
  assert.deepStrictEqual(normalizePreset('del-nido-60', 60), { selectedPreset: 'interval-60', intervalMinutes: 60, customIntervalMinutes: '' }, 'legacy 60-minute preset should migrate to the visible 60-minute option');
  assert.deepStrictEqual(normalizePreset('blood-20', 20), { selectedPreset: 'custom', intervalMinutes: 20, customIntervalMinutes: '20' }, 'removed intervals should migrate to a visible Custom value');

  let state = { selectedPreset: 'interval-30', intervalMinutes: 30, customIntervalMinutes: '', lastCompletedAtEpoch: null, nextDueAtEpoch: null, doseLog: [] };
  state = completeDose(state, 100000);
  assert.strictEqual(state.lastCompletedAtEpoch, 100000, 'complete action should save completedAtEpoch');
  assert.strictEqual(state.nextDueAtEpoch, 100000 + 30 * 60000, 'nextDueAtEpoch should be completion plus interval minutes');
  assert.deepStrictEqual(state.doseLog, [100000], 'complete action should append epoch timestamp to doseLog');
  state = completeDose(state, 200000);
  assert.deepStrictEqual(state.doseLog, [100000, 200000], 'subsequent complete action should append another dose');
  state = undoLast(state);
  assert.deepStrictEqual(state.doseLog, [100000], 'Undo last should remove latest log entry');
  assert.strictEqual(state.lastCompletedAtEpoch, 100000, 'Undo last should restore previous completedAtEpoch');
  assert.strictEqual(state.nextDueAtEpoch, 100000 + 30 * 60000, 'Undo last should restore previous next due from interval');
  const resetState = resetTimer(state);
  assert.strictEqual(resetState.lastCompletedAtEpoch, null, 'Reset timer should clear current countdown last completed');
  assert.strictEqual(resetState.nextDueAtEpoch, null, 'Reset timer should clear current countdown next due');
  assert.deepStrictEqual(resetState.doseLog, [100000], 'Reset timer should keep doseLog');
  assert.deepStrictEqual(clearLog(state).doseLog, [], 'Clear log should only empty doseLog');
  assert.strictEqual(clearLog(state).lastCompletedAtEpoch, 100000, 'Clear log should keep current countdown active');

  const activeState = { ...state, lastCompletedAtEpoch: 100000, nextDueAtEpoch: 100000 + 30 * 60000 };
  assert.strictEqual(getCardioplegiaStatus({ ...activeState, lastCompletedAtEpoch: null, nextDueAtEpoch: null }, 100000).label, 'Not started', 'missing completion should be Not started');
  assert.strictEqual(getCardioplegiaStatus(activeState, activeState.nextDueAtEpoch - 6 * 60000).label, 'On schedule', 'remaining >5 min should be On schedule');
  assert.strictEqual(getCardioplegiaStatus(activeState, activeState.nextDueAtEpoch - 5 * 60000).label, 'Due soon', 'remaining <=5 min should be Due soon');
  assert.strictEqual(getCardioplegiaStatus(activeState, activeState.nextDueAtEpoch + 30000).label, 'Due', 'overdue under 60s should be Due');
  assert.strictEqual(getCardioplegiaStatus(activeState, activeState.nextDueAtEpoch + 60000).label, 'Overdue', 'overdue 60s or more should be Overdue');

  assert(mainJs.includes("perfusiontools.timecalc.cardioplegiaReminder.v2"), 'reminder should use a v2 versioned storage key');
  assert(mainJs.includes('function normalizeCardioplegiaPreset'), 'saved legacy preset IDs should be normalized before rendering');
  assert(mainJs.includes("perfusiontools.timecalc.liveTimers.v1"), 'v1 live timer storage key should remain separate');
  assert(mainJs.includes('const completedAtEpoch = Date.now()'), 'complete action should record Date.now as completedAtEpoch');
  assert(mainJs.includes('const nextDueAtEpoch = completedAtEpoch + intervalMinutes * 60000'), 'next due should be derived from completion time and selected interval');
  assert(mainJs.includes('cardioplegiaReminderState.doseLog.push(completedAtEpoch)'), 'doseLog should store epoch timestamps');
  assert(mainJs.includes('const remainingMs = cardioplegiaReminderState.nextDueAtEpoch - nowMs'), 'countdown should be recalculated from Date.now-based current time');
  assert(mainJs.includes("const shouldShow = timeLiveMode === 'live' && cardioplegiaReminderExpanded"), 'reminder card should open only from its Live-mode toggle');
  assert(packageJson.includes('tests/cardioplegia-reminder.test.js'), 'test script should include reminder regression test');
  const reminderSource = mainJs.slice(mainJs.indexOf('const CARDIOPLEGIA_REMINDER_STORAGE_KEY'), mainJs.indexOf('function initTimeCalculator'));
  assert(!/Notification|wakeLock|serviceWorker|vibrate|Audio\(|new Audio|navigator\.serviceWorker/.test(reminderSource), 'reminder should not add browser notification, wake lock, service worker, vibration, or audio APIs');
  assert(!/unsafe|danger|myocardial injury|safe time|recommended interval/i.test(reminderSource + timecalcHtml), 'reminder should avoid clinical-risk or recommendation wording');

  console.log('All cardioplegia reminder tests passed.');
}

run();
