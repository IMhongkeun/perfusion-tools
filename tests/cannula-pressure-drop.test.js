'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const pressureDropData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cannula-pressure-drop.json'), 'utf8')).items;
assert(
  mainJs.includes('const PRESSURE_DROP_EXACT_FLOW_TOLERANCE = 1e-6;'),
  'Pressure-drop exact flow tolerance should be a tiny epsilon so dense adjacent points still interpolate.'
);
assert(
  mainJs.includes('drawPressureDropChart(svg, entry.points, hasEstimate ? flowValue : NaN, hasEstimate ? interpolationResult.value : NaN, { curveMode: \'linear\' });'),
  'The active cannula pressure-drop page should render charts with the linear point-to-point path, not fitted/smoothed mode.'
);

assert(
  mainJs.includes('function createPressureDropSearchableSelect') &&
  mainJs.includes("panel.style.maxWidth = 'min(520px, calc(100vw - 32px))';") &&
  mainJs.includes("panel.style.maxHeight = '320px';") &&
  mainJs.includes("item.className = `block w-full overflow-hidden text-ellipsis whitespace-nowrap"),
  'Model/cannula lookup should use a constrained searchable combobox with truncating one-line options.'
);
assert(
  mainJs.includes("selectNode.dispatchEvent(new Event('change', { bubbles: true }))") &&
  mainJs.includes("['manufacturer', controls.manufacturerSelect]") &&
  mainJs.includes("['model', controls.modelSelect]") &&
  mainJs.includes("['category', controls.categorySelect]"),
  'Searchable model combobox should preserve existing select-driven filtering for model and category/type controls.'
);
const pressureDropPageHtml = fs.readFileSync(path.join(__dirname, '..', 'cannula-pressure-drop', 'index.html'), 'utf8');
assert(
  pressureDropPageHtml.includes('.pressure-drop-combobox-panel') &&
  pressureDropPageHtml.includes('width: calc(100vw - 32px) !important;') &&
  pressureDropPageHtml.includes('text-overflow: ellipsis;') &&
  pressureDropPageHtml.includes('white-space: nowrap;'),
  'Pressure-drop combobox CSS should prevent horizontal overflow and truncate long selected/option labels.'
);

assert(
  mainJs.includes('function buildPressureDropAxisTicks') &&
  mainJs.includes('stroke-opacity="0.10"') &&
  mainJs.includes('formatPressureDropAxisTick'),
  'Pressure-drop chart should include lightweight axis tick/gridline rendering helpers.'
);
assert(
  mainJs.includes('>Flow [L/min]</text>') &&
  mainJs.includes('>Pressure drop [mmHg]</text>') &&
  mainJs.includes('transform="rotate(-90 14 ${plotMiddleY.toFixed(1)})"') &&
  mainJs.includes('text-anchor="end" fill="currentColor" opacity="0.65">Flow [L/min]</text>') &&
  !mainJs.includes('>Pressure drop (mmHg)</text>') &&
  mainJs.includes('Target flow: ${targetFlow.toFixed(1)} L/min') &&
  mainJs.includes('Est. pressure drop: ${estimatedPressureDrop.toFixed(1)} mmHg'),
  'Pressure-drop chart should use bracketed axis units with a rotated y-axis label while keeping target tooltip text unchanged.'
);
assert(
  mainJs.includes("svg.setAttribute('viewBox', '0 0 420 200');") &&
  mainJs.includes('const width = 420; const height = 200;'),
  'Pressure-drop chart SVG viewBox should match the drawing height so the x-axis label is not clipped.'
);
assert(
  mainJs.includes("svg.classList.add('block', 'w-full', 'h-auto'") || mainJs.includes("svg.classList.add('block', 'w-full', 'h-auto',"),
  'Pressure-drop chart SVG should remain constrained to the container width for narrow viewports.'
);

const pressureDropExactFlowTolerance = 1e-6;

function buildPressureDropAxisTicks(minValue, maxValue, tickCount = 4) {
  const safeMin = Number.isFinite(minValue) ? minValue : 0;
  const safeMax = Number.isFinite(maxValue) ? maxValue : safeMin;
  const count = Math.max(Math.floor(tickCount), 2);
  if (Math.abs(safeMax - safeMin) < Number.EPSILON) return [safeMin];
  return Array.from({ length: count }, (_, index) => {
    const ratio = index / (count - 1);
    return safeMin + ((safeMax - safeMin) * ratio);
  }).filter(Number.isFinite);
}

function getValidPressureDropPoints(points) {
  if (!Array.isArray(points)) return [];
  return points
    .filter(point => Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop))
    .sort((a, b) => a.flow - b.flow);
}

function findExactPressureDropPoint(points, targetFlow) {
  if (!Number.isFinite(targetFlow)) return null;
  const validPoints = getValidPressureDropPoints(points);
  return validPoints.find(point => Math.abs(point.flow - targetFlow) <= pressureDropExactFlowTolerance + Number.EPSILON) || null;
}

function interpolatePressureDrop(points, targetFlow) {
  if (!Number.isFinite(targetFlow)) return { state: 'invalid', value: null };
  const validPoints = getValidPressureDropPoints(points);
  if (!validPoints.length) return { state: 'no_points', value: null };

  const minFlow = validPoints[0].flow;
  const maxFlow = validPoints[validPoints.length - 1].flow;
  if (targetFlow < minFlow || targetFlow > maxFlow) return { state: 'out_of_range', value: null, minFlow, maxFlow };

  const exactPoint = findExactPressureDropPoint(validPoints, targetFlow);
  if (exactPoint) return { state: 'exact', value: exactPoint.pressureDrop, flow: exactPoint.flow, minFlow, maxFlow };

  for (let i = 0; i < validPoints.length - 1; i += 1) {
    const left = validPoints[i];
    const right = validPoints[i + 1];
    if (targetFlow > left.flow && targetFlow < right.flow) {
      const ratio = (targetFlow - left.flow) / (right.flow - left.flow);
      return {
        state: 'interpolated',
        value: left.pressureDrop + ((right.pressureDrop - left.pressureDrop) * ratio),
        minFlow,
        maxFlow
      };
    }
  }

  return { state: 'out_of_range', value: null, minFlow, maxFlow };
}


function getPressureDropSizeOptionValue(entry) {
  const connectionSite = entry.connectionSite || '';
  const connectorSize = entry.connectorSize || '';
  const cannulaOrderCode = entry.cannulaOrderCode || '';
  const outerDiameterFr = Number.isFinite(entry.outerDiameterFr) ? entry.outerDiameterFr : '';
  return `${entry.size || ''}||${connectionSite}||${connectorSize}||${cannulaOrderCode}||${outerDiameterFr}`;
}

function getPressureDropConnectionOptionValue(entry) {
  const connectionSite = entry.connectionSite || '__not_specified__';
  const connectorSize = entry.connectorSize || '';
  const cannulaOrderCode = entry.cannulaOrderCode || '';
  return `${connectionSite}||${connectorSize}||${cannulaOrderCode}`;
}

function getPressureDropConnectionOptionLabel(value) {
  const [connectionSite = '__not_specified__', connectorSize = '', cannulaOrderCode = ''] = String(value || '').split('||');
  const parts = [connectionSite === '__not_specified__' ? 'Not specified' : connectionSite, connectorSize, cannulaOrderCode].filter(Boolean);
  return parts.join(' — ');
}

function normalizePressureDropFilterLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizePressureDropKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function getPressureDropGroupLabel(category) {
  const normalized = normalizePressureDropKey(category);
  if (normalized.includes('cardioplegia')) return 'Cardioplegia cannula';
  if (normalized.includes('vent')) return 'Vent cannula';
  if (normalized.includes('arterial')) return 'Arterial cannula';
  if (normalized.includes('venous')) return 'Venous cannula';
  if (normalized.includes('aortic')) return 'Aortic cannula';
  return String(category || '').trim().replace(/\s+/g, ' ') || 'Specialty cannula';
}

function getPressureDropCategoryFilterValue(category) {
  return normalizePressureDropFilterLabel(getPressureDropGroupLabel(category));
}

function getUniquePressureDropCategoryOptionPairs(entries) {
  const optionMap = new Map();
  entries.forEach(entry => {
    const label = getPressureDropGroupLabel(entry.category);
    const key = normalizePressureDropFilterLabel(label);
    if (!key || optionMap.has(key)) return;
    optionMap.set(key, { value: key, label });
  });
  return Array.from(optionMap.values())
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
}

function getPressureDropLookupMatches(entries, filters = {}) {
  return entries.filter(entry => {
    if (filters.manufacturer && entry.manufacturer !== filters.manufacturer) return false;
    if (filters.model && entry.model !== filters.model) return false;
    if (filters.category && getPressureDropCategoryFilterValue(entry.category) !== filters.category) return false;
    if (filters.size && entry.size !== filters.size) return false;
    if (filters.connectionSite && getPressureDropConnectionOptionValue(entry) !== filters.connectionSite) return false;
    return true;
  });
}

function nearlyEqual(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance;
}

function run() {
  const densePoints = [
    { flow: 0.33, pressureDrop: 49.9 },
    { flow: 0.34, pressureDrop: 54.6 }
  ];
  const flowTicks = buildPressureDropAxisTicks(0.33, 0.34, 4);
  assert.strictEqual(flowTicks.length, 4);
  assert(flowTicks.every(Number.isFinite), 'Axis ticks should only contain finite numbers.');
  assert(nearlyEqual(flowTicks[0], 0.33), 'Axis ticks should preserve the minimum endpoint.');
  assert(nearlyEqual(flowTicks[flowTicks.length - 1], 0.34), 'Axis ticks should preserve the maximum endpoint.');

  const equalRangeTicks = buildPressureDropAxisTicks(5, 5, 4);
  assert.deepStrictEqual(equalRangeTicks, [5], 'Equal chart ranges should produce one finite axis tick and avoid NaN.');

  const exactLeft = interpolatePressureDrop(densePoints, 0.33);
  assert.strictEqual(exactLeft.state, 'exact');
  assert.strictEqual(exactLeft.value, 49.9);

  const exactLeftWithFloatNoise = interpolatePressureDrop(densePoints, 0.3300000001);
  assert.strictEqual(exactLeftWithFloatNoise.state, 'exact');
  assert.strictEqual(exactLeftWithFloatNoise.value, 49.9);

  const exactRight = interpolatePressureDrop(densePoints, 0.34);
  assert.strictEqual(exactRight.state, 'exact');
  assert.strictEqual(exactRight.value, 54.6);

  const midpoint = interpolatePressureDrop(densePoints, 0.335);
  assert.strictEqual(midpoint.state, 'interpolated');
  assert(nearlyEqual(midpoint.value, 52.25), `0.335 L/min should interpolate to 52.25 mmHg, got ${midpoint.value}`);

  const belowRange = interpolatePressureDrop(densePoints, 0.329);
  assert.strictEqual(belowRange.state, 'out_of_range');
  assert.strictEqual(belowRange.value, null);
  assert.strictEqual(belowRange.minFlow, 0.33);
  assert.strictEqual(belowRange.maxFlow, 0.34);

  const aboveRange = interpolatePressureDrop(densePoints, 0.341);
  assert.strictEqual(aboveRange.state, 'out_of_range');
  assert.strictEqual(aboveRange.value, null);
  assert.strictEqual(aboveRange.minFlow, 0.33);
  assert.strictEqual(aboveRange.maxFlow, 0.34);

  const nearLeft = interpolatePressureDrop(densePoints, 0.331);
  assert.strictEqual(nearLeft.state, 'interpolated');
  assert(!nearlyEqual(nearLeft.value, 49.9), '0.331 L/min must not return the 0.33 L/min exact point');

  const nearRight = interpolatePressureDrop(densePoints, 0.339);
  assert.strictEqual(nearRight.state, 'interpolated');
  assert(!nearlyEqual(nearRight.value, 54.6), '0.339 L/min must not return the 0.34 L/min exact point');


  const dlpQuarterInch = {
    manufacturer: 'Medtronic',
    model: 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip',
    category: 'Adult venous',
    size: '12 Fr / 4.0 mm',
    connectionSite: 'Single stage venous',
    connectorSize: '1/4 inch / 0.64 cm',
    cannulaOrderCode: '67312',
    outerDiameterFr: 12
  };
  const dlpThreeEighthsInch = {
    ...dlpQuarterInch,
    connectorSize: '3/8 inch / 0.95 cm',
    cannulaOrderCode: '69312'
  };

  assert.notStrictEqual(
    getPressureDropSizeOptionValue(dlpQuarterInch),
    getPressureDropSizeOptionValue(dlpThreeEighthsInch),
    'DLP 12 Fr connector variants should have unique legacy size lookup keys.'
  );
  assert.notStrictEqual(
    getPressureDropConnectionOptionValue(dlpQuarterInch),
    getPressureDropConnectionOptionValue(dlpThreeEighthsInch),
    'DLP 12 Fr connector variants should have unique connection lookup keys.'
  );
  assert.strictEqual(
    getPressureDropConnectionOptionLabel(getPressureDropConnectionOptionValue(dlpQuarterInch)),
    'Single stage venous — 1/4 inch / 0.64 cm — 67312'
  );
  assert.strictEqual(
    getPressureDropConnectionOptionLabel(getPressureDropConnectionOptionValue(dlpThreeEighthsInch)),
    'Single stage venous — 3/8 inch / 0.95 cm — 69312'
  );


  const getingeEntries = pressureDropData.filter(entry => entry.manufacturer === 'Getinge / Maquet');
  const getingeCategoryOptions = getUniquePressureDropCategoryOptionPairs(getingeEntries);
  assert.deepStrictEqual(
    getingeCategoryOptions.map(option => option.label),
    Array.from(new Set(getingeCategoryOptions.map(option => option.label))),
    'Getinge / Maquet category/type options should not show duplicate human-readable labels.'
  );
  assert(getingeCategoryOptions.some(option => option.label === 'Arterial cannula'), 'Getinge / Maquet should include one arterial category option.');
  assert(getingeCategoryOptions.some(option => option.label === 'Venous cannula'), 'Getinge / Maquet should include one venous category option.');


  const getingeArterialMatches = getPressureDropLookupMatches(pressureDropData, {
    manufacturer: 'Getinge / Maquet',
    category: 'arterial cannula',
    model: 'HLS Arterial Cannula'
  });
  const getingeHlsSizeLabels = getingeArterialMatches.map(entry => entry.size).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  assert.deepStrictEqual(
    getingeHlsSizeLabels,
    [
      'PAS 1315 · 13 Fr / 4.3 mm · 15 cm',
      'PAS 1515 · 15 Fr / 5.0 mm · 15 cm',
      'PAS 1715 · 17 Fr / 5.7 mm · 15 cm',
      'PAS 1915 · 19 Fr / 6.3 mm · 15 cm',
      'PAS 2115 · 21 Fr / 7.0 mm · 15 cm',
      'PAS 2315 · 23 Fr / 7.7 mm · 15 cm'
    ],
    'Getinge / Maquet HLS arterial cannula lookup should group PAS 1315 with the other HLS arterial PAS sizes.'
  );
  const getingeArterialModelOptions = Array.from(new Set(getingeArterialMatches.map(entry => entry.model)));
  assert.deepStrictEqual(getingeArterialModelOptions, ['HLS Arterial Cannula'], 'Getinge / Maquet HLS arterial entries should expose one canonical model option.');
  const pas1315 = getingeArterialMatches.find(entry => entry.cannulaOrderCode === 'PAS 1315');
  assert(pas1315, 'PAS 1315 should remain available after canonical model regrouping.');
  const pas1315Exact = interpolatePressureDrop(pas1315.points, 0.2);
  assert.strictEqual(pas1315Exact.state, 'exact');
  assert.strictEqual(pas1315Exact.value, 2.7, 'PAS 1315 should still use its own unchanged pressure-flow curve points.');

  const messyCategoryEntries = [
    { manufacturer: 'Messy', model: 'Arterial A', category: ' arterial   cannula ', size: '16 Fr' },
    { manufacturer: 'Messy', model: 'Arterial B', category: 'ARTERIAL CANNULA', size: '18 Fr' },
    { manufacturer: 'Messy', model: 'Venous A', category: ' venous     cannula ', size: '20 Fr' }
  ];
  assert.deepStrictEqual(
    getUniquePressureDropCategoryOptionPairs(messyCategoryEntries),
    [
      { value: 'arterial cannula', label: 'Arterial cannula' },
      { value: 'venous cannula', label: 'Venous cannula' }
    ],
    'Category labels should be deduplicated across whitespace and casing differences.'
  );
  assert.deepStrictEqual(
    getPressureDropLookupMatches(messyCategoryEntries, { manufacturer: 'Messy', category: 'arterial cannula' }).map(entry => entry.model),
    ['Arterial A', 'Arterial B'],
    'Selecting a deduplicated category/type option should filter the model list to matching raw categories.'
  );

  const veryLongModelName = 'Very Long Pediatric Arterial Cannula Model Name With Extra Manufacturer Descriptor That Used To Stretch Native Select Menus';
  const lookupEntries = [
    { manufacturer: 'Acme', model: veryLongModelName, category: 'Adult arterial', size: '18 Fr' },
    { manufacturer: 'Acme', model: 'Short Venous Model', category: 'Adult venous', size: '22 Fr' },
    { manufacturer: 'Other', model: veryLongModelName, category: 'Adult arterial', size: '20 Fr' }
  ];
  assert.deepStrictEqual(
    getPressureDropLookupMatches(lookupEntries, { manufacturer: 'Acme', model: veryLongModelName }),
    [lookupEntries[0]],
    'Selecting a long model label through the combobox should still filter to the same dataset entry.'
  );
  assert.deepStrictEqual(
    getPressureDropLookupMatches(lookupEntries, { manufacturer: 'Acme', category: 'venous cannula' }),
    [lookupEntries[1]],
    'Category/type filtering should keep working after the model select UI is wrapped.'
  );

  console.log('All cannula pressure-drop interpolation and dropdown UX tests passed.');
}

run();
