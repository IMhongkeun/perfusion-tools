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
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 47 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatDuration(totalMinutes) {
  if (totalMinutes == null || Number.isNaN(totalMinutes)) return '-';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${totalMinutes} min (${h}:${String(m).padStart(2, '0')})`;
}

function manualDuration(start, end) {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  let adjustedEnd = endMin;
  if (endMin < startMin && endMin < 24 * 60 && startMin < 24 * 60) adjustedEnd = endMin + 24 * 60;
  return formatDuration(adjustedEnd - startMin);
}

function liveDuration(startAtEpoch, nowEpoch) {
  return formatDuration(Math.floor(Math.max(0, nowEpoch - startAtEpoch) / 60000));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');

  assert.strictEqual(manualDuration('08:15', '10:45'), '150 min (2:30)', 'manual start/end duration should remain unchanged');
  assert.strictEqual(manualDuration('23:30', '00:15'), '45 min (0:45)', 'manual cross-midnight duration should remain unchanged');
  assert.strictEqual(liveDuration(100000, 100000 + (7 * 60000) + 30000), '7 min (0:07)', 'live duration should be recalculated from epoch timestamps');

  assert(timecalcHtml.includes('id="time-mode-record"'), 'Record mode toggle should exist');
  assert(timecalcHtml.includes('id="time-mode-live"'), 'Live mode toggle should exist');
  assert(timecalcHtml.includes('id="time-live-notice"'), 'Live mode safety notice should exist');
  assert(mainJs.includes("perfusiontools.timecalc.liveTimers.v1"), 'versioned localStorage key should be used');
  assert(mainJs.includes('Date.now() - state.startAtEpoch'), 'running duration should be based on Date.now and startAtEpoch');
  assert(mainJs.includes('startAtEpoch: now'), 'Start should store startAtEpoch');
  assert(mainJs.includes('state.endAtEpoch = now'), 'Stop should store endAtEpoch');
  assert(mainJs.includes('delete timeLiveTimers[idx]'), 'Reset/manual override should clear row live state');
  assert(mainJs.includes("controls.className = 'time-live-controls hidden"), 'Live controls should be hidden in Record mode by default');

  console.log('All timecalc live tests passed.');
}

run();
