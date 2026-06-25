'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
assert(
  mainJs.includes('const PRESSURE_DROP_EXACT_FLOW_TOLERANCE = 1e-6;'),
  'Pressure-drop exact flow tolerance should be a tiny epsilon so dense adjacent points still interpolate.'
);

const pressureDropExactFlowTolerance = 1e-6;

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

function nearlyEqual(actual, expected, tolerance = 1e-9) {
  return Math.abs(actual - expected) <= tolerance;
}

function run() {
  const densePoints = [
    { flow: 0.33, pressureDrop: 49.9 },
    { flow: 0.34, pressureDrop: 54.6 }
  ];

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

  const nearLeft = interpolatePressureDrop(densePoints, 0.331);
  assert.strictEqual(nearLeft.state, 'interpolated');
  assert(!nearlyEqual(nearLeft.value, 49.9), '0.331 L/min must not return the 0.33 L/min exact point');

  const nearRight = interpolatePressureDrop(densePoints, 0.339);
  assert.strictEqual(nearRight.state, 'interpolated');
  assert(!nearlyEqual(nearRight.value, 54.6), '0.339 L/min must not return the 0.34 L/min exact point');

  console.log('All cannula pressure-drop interpolation tests passed.');
}

run();
