'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert(
  mainJs.includes('const PRESSURE_DROP_EXACT_FLOW_TOLERANCE = 1e-6;'),
  'Pressure-drop exact flow tolerance should be a tiny epsilon so dense adjacent points still interpolate.'
);
assert(
  mainJs.includes('drawPressureDropChart(svg, entry.points, hasEstimate ? flowValue : NaN, hasEstimate ? interpolationResult.value : NaN, { curveMode: \'linear\' });'),
  'The active cannula pressure-drop page should render charts with the linear point-to-point path, not fitted/smoothed mode.'
);
assert(
  mainJs.includes('function buildPressureDropAxisTicks') &&
  mainJs.includes('stroke-opacity="0.10"') &&
  mainJs.includes('formatPressureDropAxisTick'),
  'Pressure-drop chart should include lightweight axis tick/gridline rendering helpers.'
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

  console.log('All cannula pressure-drop interpolation tests passed.');
}

run();
