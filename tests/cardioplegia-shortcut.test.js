'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function isCrossClampLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  if (!normalized) return false;
  return normalized.includes('cross-clamp') ||
    normalized.includes('cross clamp') ||
    normalized.includes('x-clamp') ||
    normalized.includes('x clamp') ||
    normalized.includes('aortic clamp') ||
    normalized === 'acc' ||
    normalized.includes(' acc ') ||
    normalized.startsWith('acc ') ||
    normalized.endsWith(' acc');
}

function completeDose(state, nowEpoch) {
  const intervalMinutes = state.intervalMinutes;
  const completedAtEpoch = nowEpoch;
  const nextDueAtEpoch = completedAtEpoch + intervalMinutes * 60000;
  return {
    ...state,
    lastCompletedAtEpoch: completedAtEpoch,
    nextDueAtEpoch,
    doseLog: state.doseLog.concat(completedAtEpoch)
  };
}

function formatClock(epochMs) {
  const date = new Date(epochMs);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function shouldShowShortcut({ mode, rows, dismissed }) {
  return mode === 'live' && !dismissed && rows.some(row => row.running && row.eventType === 'x-clamp');
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(!timecalcHtml.includes('id="cardioplegia-shortcut"'), 'the automatic x-clamp popup should be removed');
  assert(mainJs.includes('id="cardioplegia-reminder-toggle"'), 'the x-clamp row should provide the compact reminder control instead');
  assert(mainJs.includes('aria-controls="cardioplegia-reminder" aria-expanded="false"'), 'inline reminder control should expose its expanded state accessibly');
  assert(mainJs.includes("{ id: 'row-xclamp', eventType: 'x-clamp' }"), 'Row 2 should expose stable x-clamp event type for shortcut logic');

  assert.strictEqual(isCrossClampLabel('Aortic cross-clamp'), true, 'Aortic cross-clamp label should be recognized');
  assert.strictEqual(isCrossClampLabel('x-clamp'), true, 'x-clamp label should be recognized');
  assert.strictEqual(isCrossClampLabel('ACC'), true, 'ACC label should be recognized');
  assert.strictEqual(isCrossClampLabel('CPB start'), false, 'general CPB row should not trigger shortcut');
  assert.strictEqual(isCrossClampLabel('Cooling'), false, 'general cooling row should not trigger shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: false, rows: [{ eventType: 'x-clamp', running: true }] }), true, 'x-clamp Start should show shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: false, rows: [{ label: 'Clamp changed by user', eventType: 'x-clamp', running: true }] }), true, 'Row 2 stable event type should keep shortcut working after label edits');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: false, rows: [{ label: 'Aortic cross-clamp custom text', eventType: 'custom', running: true }] }), false, 'custom rows should not trigger shortcut from label text');
  assert.strictEqual(shouldShowShortcut({ mode: 'record', dismissed: false, rows: [{ eventType: 'x-clamp', running: true }] }), false, 'Record mode should not show shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: true, rows: [{ eventType: 'x-clamp', running: true }] }), false, 'dismissed shortcut should stay hidden');

  const state = completeDose({ intervalMinutes: 20, doseLog: [] }, 100000);
  assert.strictEqual(state.lastCompletedAtEpoch, 100000, 'shortcut complete should save completedAtEpoch');
  assert.strictEqual(state.nextDueAtEpoch, 100000 + 20 * 60000, 'shortcut complete should calculate nextDueAtEpoch from interval');
  assert.deepStrictEqual(state.doseLog, [100000], 'shortcut complete should append doseLog');
  const confirmationText = `Cardioplegia completed at ${formatClock(state.lastCompletedAtEpoch)} · Next due ${formatClock(state.nextDueAtEpoch)}`;
  assert(/Cardioplegia completed at \d{2}:\d{2} · Next due \d{2}:\d{2}/.test(confirmationText), 'shortcut confirmation should use 24-hour HH:MM text');
  assert(!/(오전|오후|AM|PM)/i.test(confirmationText), 'shortcut confirmation should not include localized AM/PM text');

  assert(mainJs.includes('function getTimeRowEventType'), 'main code should read stable row event type');
  assert(mainJs.includes("const reminderToggle = getTimeRowEventType(rowId) === 'x-clamp'"), 'only the stable x-clamp row should bind the inline reminder toggle');
  assert(mainJs.includes('cardioplegiaReminderExpanded = !cardioplegiaReminderExpanded'), 'inline control should toggle the reminder card');
  assert(mainJs.includes("toggleButton.setAttribute('aria-expanded', String(shouldShow))"), 'inline control should synchronize its accessible expanded state');
  assert(mainJs.includes("function getPreferredScrollBehavior"), 'scroll helper should respect reduced motion settings');
  assert(mainJs.includes("prefers-reduced-motion: reduce"), 'scroll helper should check prefers-reduced-motion');
  assert(mainJs.includes("root.scrollIntoView({ behavior: getPreferredScrollBehavior(), block: 'center' })"), 'View reminder and shortcut completion should scroll to reminder card');
  assert(mainJs.includes("root.focus({ preventScroll: true })"), 'reminder card should receive focus without extra scrolling');
  assert(mainJs.includes("root.classList.add('ring-2', 'ring-accent-400'"), 'View reminder should briefly highlight the reminder card');
  const startHandlerSource = mainJs.slice(mainJs.indexOf("liveStart.addEventListener('click'"), mainJs.indexOf("liveStop.addEventListener('click'"));
  assert(!startHandlerSource.includes('highlightCardioplegiaReminder();'), 'x-clamp Start alone should not auto-scroll to the reminder card');
  assert(mainJs.includes('cardioplegiaReminderExpanded = false'), 'New case should collapse the reminder card');
  assert(packageJson.includes('tests/cardioplegia-shortcut.test.js'), 'test script should include shortcut regression test');

  const shortcutSource = mainJs.slice(mainJs.indexOf('function isCrossClampLabel'), mainJs.indexOf('function setupContactActions'));
  assert(!/Notification|wakeLock|serviceWorker|vibrate|Audio\(|new Audio|navigator\.serviceWorker/.test(shortcutSource), 'shortcut should not add notifications, wake lock, service worker, vibration, or audio');
  assert(!/unsafe|myocardial injury|recommended interval|mandatory/i.test(shortcutSource + timecalcHtml), 'shortcut should avoid clinical-risk or recommendation wording');

  console.log('All cardioplegia shortcut tests passed.');
}

run();
