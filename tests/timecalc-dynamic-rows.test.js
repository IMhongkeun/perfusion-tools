'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DEFAULT_ROWS = [
  { id: 'row-cpb', eventType: 'cpb' },
  { id: 'row-xclamp', eventType: 'x-clamp' },
  { id: 'row-custom-default', eventType: 'custom' }
];

function addRow(rows, id) {
  if (rows.length >= 10) return rows;
  return rows.concat({ id, eventType: 'custom' });
}

function removeRow(rows, timers, rowId, confirmed = true) {
  const index = rows.findIndex(row => row.id === rowId);
  if (index < 3 || index === -1) return { rows, timers, removed: false };
  if (timers[rowId]?.running && !confirmed) return { rows, timers, removed: false };
  const nextTimers = { ...timers };
  delete nextTimers[rowId];
  return { rows: rows.filter(row => row.id !== rowId), timers: nextTimers, removed: true };
}

function buildSnapshot(rows, timers) {
  return rows.map((row, index) => ({
    id: row.id,
    order: index,
    eventType: row.eventType,
    startAtEpoch: timers[row.id]?.startAtEpoch || null,
    endAtEpoch: timers[row.id]?.endAtEpoch || null,
    running: Boolean(timers[row.id]?.running),
    lastUpdatedAtEpoch: timers[row.id] ? 2000 : null
  }));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  assert(timecalcHtml.includes('id="time-rows"'), 'time rows container should exist');
  assert(!timecalcHtml.includes('id="time-label-4"'), 'initial static markup should not show five fixed rows');
  assert(timecalcHtml.includes('id="time-add-row"'), 'Add event button should exist below rows');
  assert(timecalcHtml.includes('+ Add event'), 'Add event label should be visible');

  assert(mainJs.includes('const TIME_MIN_ROWS = 3'), 'minimum row count should be 3');
  assert(mainJs.includes('const TIME_MAX_ROWS = 10'), 'maximum row count should be 10');
  assert(mainJs.includes("{ id: 'row-cpb', eventType: 'cpb' }"), 'Row 1 should have stable CPB id/event type');
  assert(mainJs.includes("{ id: 'row-xclamp', eventType: 'x-clamp' }"), 'Row 2 should have stable x-clamp id/event type');
  assert(mainJs.includes("{ id: 'row-custom-default', eventType: 'custom' }"), 'Row 3 should have stable custom id/event type');
  assert(mainJs.includes("if (eventType === 'cpb') return 'CPB / Pump time'"), 'Row 1 default label should be CPB / Pump time');
  assert(mainJs.includes("if (eventType === 'x-clamp') return 'Aortic cross-clamp'"), 'Row 2 default label should be Aortic cross-clamp');
  assert(mainJs.includes("const placeholder = row.eventType === 'custom' ? 'Optional event' : 'Label'"), 'custom rows should use Optional event placeholder');
  assert(mainJs.includes('timeRows.length >= TIME_MAX_ROWS'), 'Add event should block at 10 rows');
  assert(mainJs.includes("statusEl.textContent = atMax ? 'Maximum 10 events' : ''"), 'maximum row message should be compact');
  assert(mainJs.includes("if (state?.running && !window.confirm('Remove this running event timer?')) return false"), 'running row removal should require confirmation');
  assert(mainJs.includes('if (rowIndex < TIME_MIN_ROWS || rowIndex === -1) return false'), 'first three rows should not be removable');

  let rows = DEFAULT_ROWS.slice();
  assert.strictEqual(rows.length, 3, 'initial row count should be 3');
  rows = addRow(rows, 'row-custom-a');
  assert.strictEqual(rows.length, 4, 'Add event should increase row count');
  for (let i = rows.length; i < 10; i++) rows = addRow(rows, `row-custom-${i}`);
  assert.strictEqual(rows.length, 10, 'row count should reach max 10');
  assert.strictEqual(addRow(rows, 'row-custom-overflow').length, 10, 'Add event should be blocked at max 10');

  const timers = {
    'row-cpb': { running: true, startAtEpoch: 1000 },
    'row-custom-a': { running: false, startAtEpoch: 2000, endAtEpoch: 3000 },
    'row-custom-4': { running: true, startAtEpoch: 4000 }
  };
  assert.strictEqual(removeRow(rows, timers, 'row-cpb').removed, false, 'Row 1 cannot be removed');
  assert.strictEqual(removeRow(rows, timers, 'row-xclamp').removed, false, 'Row 2 cannot be removed');
  assert.strictEqual(removeRow(rows, timers, 'row-custom-default').removed, false, 'Row 3 default custom row cannot be removed');
  assert.strictEqual(removeRow(rows, timers, 'row-custom-4', false).removed, false, 'running custom row removal can be cancelled');
  const removed = removeRow(rows, timers, 'row-custom-a');
  assert.strictEqual(removed.removed, true, 'custom rows above minimum can be removed');
  assert(removed.timers['row-cpb'], 'removing one row should not clear another row timer');
  assert(!removed.timers['row-custom-a'], 'removing a row should clear only that row timer state');

  const snapshot = buildSnapshot(DEFAULT_ROWS.concat({ id: 'row-custom-extra', eventType: 'custom' }), {
    'row-xclamp': { running: true, startAtEpoch: 5000 }
  });
  assert.deepStrictEqual(snapshot[1], { id: 'row-xclamp', order: 1, eventType: 'x-clamp', startAtEpoch: 5000, endAtEpoch: null, running: true, lastUpdatedAtEpoch: 2000 }, 'persisted rows should store id/order/eventType/epoch state');
  const snapshotText = JSON.stringify(snapshot);
  assert(!snapshotText.includes('Patient') && !snapshotText.includes('startDisplay') && !snapshotText.includes('endDisplay') && !snapshotText.includes('label'), 'persisted rows should not store labels or raw display strings');

  assert(mainJs.includes('timeRows = getDefaultTimeRows()'), 'New case should reset row structure to default 3 rows');
  assert(mainJs.includes('normalizeStoredTimeRows(caseData.rows)'), 'Continue should restore stored dynamic row structure');
  assert(mainJs.includes('renderTimeRows();'), 'row structure changes should rerender dynamic rows');
  assert(mainJs.includes("if (getTimeRowEventType(rowId) === 'x-clamp') cardioplegiaShortcutDismissed = false"), 'only stable x-clamp row start should re-enable shortcut');
  assert(!mainJs.includes("eventType === 'x-clamp' || isCrossClampLabel(label)"), 'custom row labels should not trigger the x-clamp shortcut');
  assert(packageJson.includes('tests/timecalc-dynamic-rows.test.js'), 'test script should include dynamic row regression test');

  console.log('All timecalc dynamic row tests passed.');
}

run();
