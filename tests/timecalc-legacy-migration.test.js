'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const TIME_MAX_ROWS = 10;
const TIME_DEFAULT_ROWS = [
  { id: 'row-cpb', eventType: 'cpb' },
  { id: 'row-xclamp', eventType: 'x-clamp' },
  { id: 'row-custom-default', eventType: 'custom' }
];

function getDefaultTimeRowForOrder(order) {
  if (order === 0) return { id: 'row-cpb', eventType: 'cpb' };
  if (order === 1) return { id: 'row-xclamp', eventType: 'x-clamp' };
  if (order === 2) return { id: 'row-custom-default', eventType: 'custom' };
  return { id: `row-custom-legacy-${order + 1}`, eventType: 'custom' };
}

function normalizeStoredTimeRowEntry(row, order, preserveStoredId = true) {
  const defaultRow = getDefaultTimeRowForOrder(order);
  const eventType = row?.eventType === 'cpb' || row?.eventType === 'x-clamp' ? row.eventType : defaultRow.eventType;
  const id = preserveStoredId && typeof row?.id === 'string' && row.id ? row.id : defaultRow.id;
  return {
    id,
    order,
    eventType,
    startAtEpoch: Number.isFinite(row?.startAtEpoch) ? row.startAtEpoch : null,
    endAtEpoch: Number.isFinite(row?.endAtEpoch) ? row.endAtEpoch : null,
    running: Boolean(row?.running),
    lastUpdatedAtEpoch: Number.isFinite(row?.lastUpdatedAtEpoch) ? row.lastUpdatedAtEpoch : null
  };
}

function normalizeStoredTimeRows(rows) {
  const sourceRows = [];
  if (Array.isArray(rows)) {
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object') return;
      sourceRows.push(normalizeStoredTimeRowEntry(row, Number.isFinite(row.order) ? row.order : index, true));
    });
  } else if (rows && typeof rows === 'object') {
    const entries = Object.entries(rows);
    const hasZeroKey = entries.some(([key]) => Number(key) === 0);
    entries.forEach(([key, row], entryIndex) => {
      if (!row || typeof row !== 'object') return;
      const numericKey = Number(key);
      const order = Number.isFinite(row.order)
        ? row.order
        : (Number.isFinite(numericKey) ? numericKey - (hasZeroKey ? 0 : 1) : entryIndex);
      if (order < 0) return;
      sourceRows.push(normalizeStoredTimeRowEntry(row, order, false));
    });
  } else {
    return [];
  }
  const seen = new Set();
  return sourceRows.sort((a, b) => a.order - b.order).filter(row => {
    if (!row.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).slice(0, TIME_MAX_ROWS);
}

function ensureMinimumTimeRows(rows) {
  const normalized = Array.isArray(rows) ? rows.slice(0, TIME_MAX_ROWS) : [];
  for (let order = 0; order < 3; order++) {
    const defaultRow = getDefaultTimeRowForOrder(order);
    if (normalized.some(row => row.id === defaultRow.id)) continue;
    normalized.push({ ...defaultRow, order, startAtEpoch: null, endAtEpoch: null, running: false, lastUpdatedAtEpoch: null });
  }
  return normalized.slice(0, TIME_MAX_ROWS).sort((a, b) => a.order - b.order).map((row, index) => ({ ...row, order: index }));
}

function hasNonDefaultTimeRows(rows) {
  const normalized = ensureMinimumTimeRows(normalizeStoredTimeRows(rows));
  if (normalized.length !== TIME_DEFAULT_ROWS.length) return true;
  return normalized.some((row, index) => row.id !== TIME_DEFAULT_ROWS[index].id || row.eventType !== TIME_DEFAULT_ROWS[index].eventType);
}

function hasTimeCaseRows(rows) {
  const normalized = normalizeStoredTimeRows(rows);
  return normalized.some(row => row.startAtEpoch || row.endAtEpoch || row.running) || hasNonDefaultTimeRows(normalized);
}

function buildNewPayloadRows(rows) {
  return ensureMinimumTimeRows(normalizeStoredTimeRows(rows)).map((row, index) => ({
    id: row.id,
    order: index,
    eventType: row.eventType,
    startAtEpoch: row.startAtEpoch || null,
    endAtEpoch: row.endAtEpoch || null,
    running: Boolean(row.running),
    lastUpdatedAtEpoch: row.lastUpdatedAtEpoch || null
  }));
}

function run() {
  const repoRoot = path.join(__dirname, '..');
  const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
  const packageJson = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');

  const legacyRunning = {
    1: { label: 'Patient Doe CPB', startDisplay: '09:00', startAtEpoch: 1000, running: true },
    2: { label: 'Edited xclamp', startAtEpoch: 2000, endAtEpoch: 5000, running: false },
    4: { label: 'Custom note', startDisplay: '10:00', endDisplay: '10:10', startAtEpoch: 6000, endAtEpoch: 7000, running: false }
  };
  const legacyZeroBased = {
    0: { startAtEpoch: 1000, running: true },
    1: { startAtEpoch: 2000, endAtEpoch: 3000, running: false }
  };
  const legacyEmpty = {
    1: { label: 'Manual label only', startDisplay: '09:00', endDisplay: '09:05' }
  };

  assert.strictEqual(hasTimeCaseRows({ 1: { startAtEpoch: 1000, running: true } }), true, 'legacy object row with running timer should count as case rows');
  assert.strictEqual(hasTimeCaseRows({ 1: { startAtEpoch: 1000, endAtEpoch: 2000, running: false } }), true, 'legacy object row with completed epoch timer should count as case rows');
  assert.strictEqual(hasTimeCaseRows(legacyEmpty), false, 'legacy object row with only labels/raw displays should not count as case rows');

  const normalized = ensureMinimumTimeRows(normalizeStoredTimeRows(legacyRunning));
  assert.deepStrictEqual(normalized[0], { id: 'row-cpb', order: 0, eventType: 'cpb', startAtEpoch: 1000, endAtEpoch: null, running: true, lastUpdatedAtEpoch: null }, 'legacy row 1 should map to row-cpb');
  assert.strictEqual(normalized[1].id, 'row-xclamp', 'legacy row 2 should map to row-xclamp');
  assert.strictEqual(normalized[1].eventType, 'x-clamp', 'legacy row 2 should map to x-clamp eventType');
  assert.strictEqual(normalized[3].id, 'row-custom-legacy-4', 'legacy custom rows should map to stable custom legacy ids');
  assert.strictEqual(normalized[3].startAtEpoch, 6000, 'legacy custom timer state should be preserved');

  const zeroBased = ensureMinimumTimeRows(normalizeStoredTimeRows(legacyZeroBased));
  assert.strictEqual(zeroBased[0].id, 'row-cpb', 'legacy row 0 should map to row-cpb');
  assert.strictEqual(zeroBased[1].id, 'row-xclamp', 'legacy row 1 should map to row-xclamp when zero-based keys are present');

  const payloadRows = buildNewPayloadRows(legacyRunning);
  assert(Array.isArray(payloadRows), 'after restore/save rows should be array format');
  const payloadText = JSON.stringify(payloadRows);
  assert(!payloadText.includes('Patient Doe') && !payloadText.includes('startDisplay') && !payloadText.includes('endDisplay') && !payloadText.includes('label'), 'new payload should omit labels and raw display strings');

  assert(mainJs.includes('function normalizeStoredTimeRows(rows)'), 'main code should normalize stored rows');
  assert(mainJs.includes('} else if (rows && typeof rows === \'object\')'), 'normalizer should accept legacy object rows');
  assert(mainJs.includes('const normalized = normalizeStoredTimeRows(rows)'), 'hasTimeCaseRows should normalize before checking rows');
  assert(mainJs.includes('const normalizedRows = ensureMinimumTimeRows(normalizeStoredTimeRows(caseData.rows))'), 'apply path should use normalized rows');
  assert(mainJs.includes('rows: normalizeStoredTimeRows(saved.rows)'), 'read path should return normalized rows');
  assert(packageJson.includes('tests/timecalc-legacy-migration.test.js'), 'test script should include legacy migration regression test');

  console.log('All timecalc legacy migration tests passed.');
}

run();
