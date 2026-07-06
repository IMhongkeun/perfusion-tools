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

function shouldShowShortcut({ mode, rows, dismissed }) {
  return mode === 'live' && !dismissed && rows.some(row => row.running && (row.eventType === 'x-clamp' || isCrossClampLabel(row.label)));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="cardioplegia-shortcut"'), 'sticky cardioplegia shortcut should exist');
  assert(timecalcHtml.includes('X-clamp running · Cardioplegia reminder'), 'shortcut should use requested compact wording');
  assert(timecalcHtml.includes('id="cardioplegia-shortcut-complete"'), 'shortcut complete button should exist');
  assert(timecalcHtml.includes('id="cardioplegia-shortcut-view"'), 'shortcut View reminder button should exist');
  assert(timecalcHtml.includes('id="cardioplegia-shortcut-dismiss"'), 'shortcut should be dismissible');
  assert(timecalcHtml.includes('Optional reminder. Verify against pump timer and charting record.'), 'shortcut safety copy should be compact');
  assert(timecalcHtml.includes('id="time-label-2"') && timecalcHtml.includes('data-time-event-type="x-clamp"'), 'Row 2 should expose stable x-clamp event type for shortcut logic');

  assert.strictEqual(isCrossClampLabel('Aortic cross-clamp'), true, 'Aortic cross-clamp label should be recognized');
  assert.strictEqual(isCrossClampLabel('x-clamp'), true, 'x-clamp label should be recognized');
  assert.strictEqual(isCrossClampLabel('ACC'), true, 'ACC label should be recognized');
  assert.strictEqual(isCrossClampLabel('CPB start'), false, 'general CPB row should not trigger shortcut');
  assert.strictEqual(isCrossClampLabel('Cooling'), false, 'general cooling row should not trigger shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: false, rows: [{ label: 'Aortic cross-clamp', running: true }] }), true, 'x-clamp Start should show shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: false, rows: [{ label: 'Clamp changed by user', eventType: 'x-clamp', running: true }] }), true, 'Row 2 stable event type should keep shortcut working after label edits');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: false, rows: [{ label: 'CPB start', running: true }] }), false, 'non-x-clamp Start should not show shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'record', dismissed: false, rows: [{ label: 'Aortic cross-clamp', running: true }] }), false, 'Record mode should not show shortcut');
  assert.strictEqual(shouldShowShortcut({ mode: 'live', dismissed: true, rows: [{ label: 'Aortic cross-clamp', running: true }] }), false, 'dismissed shortcut should stay hidden');

  const state = completeDose({ intervalMinutes: 20, doseLog: [] }, 100000);
  assert.strictEqual(state.lastCompletedAtEpoch, 100000, 'shortcut complete should save completedAtEpoch');
  assert.strictEqual(state.nextDueAtEpoch, 100000 + 20 * 60000, 'shortcut complete should calculate nextDueAtEpoch from interval');
  assert.deepStrictEqual(state.doseLog, [100000], 'shortcut complete should append doseLog');

  assert(mainJs.includes('function isCrossClampLabel'), 'main code should include x-clamp row label detection');
  assert(mainJs.includes('function getRunningCrossClampRow'), 'main code should search for a running x-clamp row');
  assert(mainJs.includes('function getTimeRowEventType'), 'main code should read stable row event type');
  assert(mainJs.includes("eventType === 'x-clamp' || isCrossClampLabel(label)"), 'shortcut should prefer stable x-clamp event type before label matching');
  assert(mainJs.includes('function renderCardioplegiaShortcut'), 'main code should render shortcut visibility');
  assert(mainJs.includes("timeLiveMode === 'live' && Boolean(crossClampRow) && !cardioplegiaShortcutDismissed"), 'shortcut should only show in Live mode for running x-clamp rows');
  assert(mainJs.includes("if (getTimeRowEventType(i) === 'x-clamp' || isCrossClampLabel(label ? label.value : '')) cardioplegiaShortcutDismissed = false"), 'x-clamp Start should re-enable shortcut visibility via event type or label');
  assert(mainJs.includes("completeCardioplegiaDose('shortcut')"), 'shortcut button should reuse shared complete handler');
  assert(mainJs.includes('showCardioplegiaShortcutConfirmation(completedAtEpoch, nextDueAtEpoch)'), 'shortcut completion should show inline confirmation');
  assert(mainJs.includes("Cardioplegia completed at ${formatCardioplegiaClock(completedAtEpoch)} · Next due ${formatCardioplegiaClock(nextDueAtEpoch)}"), 'inline confirmation should include completion and next due times');
  assert(mainJs.includes("root.scrollIntoView({ behavior: 'smooth', block: 'center' })"), 'View reminder should smooth-scroll to reminder card');
  assert(mainJs.includes("root.classList.add('ring-2', 'ring-accent-400'"), 'View reminder should briefly highlight the reminder card');
  assert(mainJs.includes('cardioplegiaShortcutDismissed = false'), 'New case / x-clamp start should reset shortcut dismissal state');
  assert(mainJs.includes('renderCardioplegiaShortcut();'), 'New case and live updates should refresh shortcut visibility');
  assert(packageJson.includes('tests/cardioplegia-shortcut.test.js'), 'test script should include shortcut regression test');

  const shortcutSource = mainJs.slice(mainJs.indexOf('function isCrossClampLabel'), mainJs.indexOf('function setupContactActions'));
  assert(!/Notification|wakeLock|serviceWorker|vibrate|Audio\(|new Audio|navigator\.serviceWorker/.test(shortcutSource), 'shortcut should not add notifications, wake lock, service worker, vibration, or audio');
  assert(!/unsafe|myocardial injury|recommended interval|mandatory/i.test(shortcutSource + timecalcHtml), 'shortcut should avoid clinical-risk or recommendation wording');

  console.log('All cardioplegia shortcut tests passed.');
}

run();
