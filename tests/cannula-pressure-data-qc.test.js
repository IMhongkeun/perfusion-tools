'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { auditDataset, hasFatalFindings, main, thresholds } = require('../scripts/audit-cannula-pressure-data');

const datasetPath = path.join(__dirname, '..', 'data', 'cannula-pressure-drop.json');
const entry = points => ({ manufacturer: 'Test', model: 'Fixture', size: '1 Fr', points });
const points = values => values.map(([flow, pressureDrop]) => ({ flow, pressureDrop }));
const audit = values => auditDataset({ items: [entry(points(values))] }).findings;
const auditWithTypeReport = (values, semanticType) => auditDataset({ items: [{
  manufacturer: 'Test', model: 'Fixture', size: '1 Fr',
  pressureSeries: [{ id: semanticType, label: semanticType, semanticType, points: points(values) }]
}] });
const auditWithType = (values, semanticType) => auditWithTypeReport(values, semanticType).findings;
const hasRule = (findings, rule) => findings.some(finding => finding.rule === rule);
const localMetrics = ([leftFlow, leftPressure], [middleFlow, middlePressure], [rightFlow, rightPressure]) => {
  const leftMagnitude = Math.abs(leftPressure);
  const middleMagnitude = Math.abs(middlePressure);
  const rightMagnitude = Math.abs(rightPressure);
  const expectedMagnitude = leftMagnitude + (rightMagnitude - leftMagnitude) *
    (middleFlow - leftFlow) / (rightFlow - leftFlow);
  const firstSlope = (middleMagnitude - leftMagnitude) / (middleFlow - leftFlow);
  const secondSlope = (rightMagnitude - middleMagnitude) / (rightFlow - middleFlow);
  const smallerSlope = Math.min(Math.abs(firstSlope), Math.abs(secondSlope));
  return {
    localDeviationMmHg: Math.abs(middleMagnitude - expectedMagnitude),
    slopeDifference: Math.abs(secondSlope - firstSlope),
    slopeRatio: Math.max(Math.abs(firstSlope), Math.abs(secondSlope)) / Math.max(smallerSlope, 0.1)
  };
};

assert.equal(audit([[0, 0], [1, 10], [2, 20], [3, 30]]).length, 0);
assert(!hasRule(audit([[0, 0], [1, 10], [2, 9.9], [3, 20]]), 'local-reversal'));
assert(hasRule(audit([[0, 0], [1, 10], [2, 8], [3, 20]]), 'local-reversal'));
assert.equal(thresholds.slopeMinimumLocalDeviationMmHg, 3);

// Strong low-flow convexity can change slopes sharply while staying close to the neighboring linear trend.
const smoothConvexValues = [[0, 0], [0.6, 0.2], [0.7, 2.8], [1.7, 50]];
const smoothConvexMetrics = localMetrics(...smoothConvexValues.slice(0, 3));
assert(smoothConvexMetrics.slopeDifference > thresholds.slopeDifference);
assert(smoothConvexMetrics.slopeRatio > thresholds.slopeRatio);
assert(smoothConvexMetrics.localDeviationMmHg < thresholds.slopeMinimumLocalDeviationMmHg);
const smoothInfusion = auditWithType(smoothConvexValues, 'infusion');
assert(!hasRule(smoothInfusion, 'slope-whiplash'), 'Smooth convex positive-pressure curve must not trigger slope-whiplash below 3 mmHg.');
assert(!hasRule(smoothInfusion, 'unexpected-pressure-sign'));
const smoothDrainageValues = smoothConvexValues.map(([flow, pressure]) => [flow, -pressure]);
const smoothDrainageMetrics = localMetrics(...smoothDrainageValues.slice(0, 3));
assert(smoothDrainageMetrics.slopeDifference > thresholds.slopeDifference);
assert(smoothDrainageMetrics.slopeRatio > thresholds.slopeRatio);
assert(smoothDrainageMetrics.localDeviationMmHg < thresholds.slopeMinimumLocalDeviationMmHg);
const smoothDrainage = auditWithType(smoothDrainageValues, 'drainage');
assert(!hasRule(smoothDrainage, 'slope-whiplash'), 'Smooth convex negative-pressure curve must not trigger slope-whiplash below 3 mmHg.');
assert(!hasRule(smoothDrainage, 'unexpected-pressure-sign'), 'Negative drainage pressure must retain its valid sign semantics.');

// Below-floor geometry is suppressed, while a clearly displaced point above the floor can still trigger.
const aboveFloorMetrics = localMetrics([0, 0], [0.6, 0.2], [0.7, 4.8]);
assert(aboveFloorMetrics.localDeviationMmHg > thresholds.slopeMinimumLocalDeviationMmHg + 0.5);
const aboveFloorFindings = auditWithType([[0, 0], [0.6, 0.2], [0.7, 4.8], [1.7, 70]], 'infusion');
const aboveFloorWhiplash = aboveFloorFindings.find(finding => finding.rule === 'slope-whiplash' && finding.flow === 0.6);
assert(aboveFloorWhiplash, 'A genuine artifact above the floor must remain detectable.');
assert(aboveFloorWhiplash.diagnostics.localDeviationMmHg >= thresholds.slopeMinimumLocalDeviationMmHg);

// Separate true artifacts protect both existing severity bands after the new floor is applied.
const mediumArtifactFindings = audit([[0, 0], [1, 10], [2, 20], [3, 55], [4, 65]]);
const mediumArtifact = mediumArtifactFindings.find(finding => finding.rule === 'slope-whiplash' && finding.flow === 2);
assert(mediumArtifact && mediumArtifact.severity === 'MEDIUM');
assert(mediumArtifact.diagnostics.slopeRatio >= thresholds.slopeRatio);
assert(mediumArtifact.diagnostics.slopeRatio < thresholds.extremeSlopeRatio);
assert(mediumArtifact.diagnostics.localDeviationMmHg > thresholds.slopeMinimumLocalDeviationMmHg);
const highArtifactFindings = audit([[0, 0], [1, 10], [2, 20], [3, 70], [4, 80]]);
const highArtifact = highArtifactFindings.find(finding => finding.rule === 'slope-whiplash' && finding.flow === 2);
assert(highArtifact && highArtifact.severity === 'HIGH');
assert(highArtifact.diagnostics.slopeRatio >= thresholds.extremeSlopeRatio);
assert(highArtifact.diagnostics.localDeviationMmHg > thresholds.slopeMinimumLocalDeviationMmHg);

// Local-kink and local-reversal remain independent of the whiplash floor.
const kinkFindings = audit([[0, 0], [1, 10], [2, 50], [3, 30], [4, 40]]);
const preservedKink = kinkFindings.find(finding => finding.rule === 'local-kink' && finding.flow === 2);
assert(preservedKink && preservedKink.severity === 'HIGH');
assert.deepStrictEqual(preservedKink.diagnostics, {
  deviationMmHg: 30, relativeDeviation: 1.5, expectedMagnitudeMmHg: 20
});
const reversalFindings = audit([[0, 0], [1, 10], [2, 8], [3, 20]]);
assert(hasRule(reversalFindings, 'local-reversal'));

// Both semantic sign checks remain fatal.
const wrongSignInfusionReport = auditWithTypeReport([[0, -10], [1, -20], [2, -30]], 'infusion');
const wrongSignDrainageReport = auditWithTypeReport([[0, 10], [1, 20], [2, 30]], 'drainage');
assert(hasFatalFindings(wrongSignInfusionReport));
assert(hasFatalFindings(wrongSignDrainageReport));
assert(hasRule(wrongSignInfusionReport.findings, 'unexpected-pressure-sign'));
assert(hasRule(wrongSignDrainageReport.findings, 'unexpected-pressure-sign'));
assert(audit([[0, 0], [1, 40], [2, 100]]).some(finding =>
  finding.rule === 'sparse-curve' && finding.severity === 'LOW'), 'Sparse-curve QC must remain active.');

assert(hasRule(audit([[0, 0], [1, 20], [2, 75], [3, 85]]), 'slope-whiplash'));
assert(!hasRule(audit([[0, 0], [1, -10], [2, -20], [3, -30]]), 'local-reversal'));
assert(hasRule(audit([[0, 0], [1, -10], [2, -8], [3, -20]]), 'local-reversal'));
assert(!hasRule(auditWithType([[0, 1], [1, 10], [2, 20]], 'infusion'), 'unexpected-pressure-sign'));
assert(hasRule(auditWithType([[0, -10], [1, -20], [2, -30]], 'infusion'), 'unexpected-pressure-sign'));
assert(!hasRule(auditWithType([[0, 0], [1, -10], [2, -20]], 'drainage'), 'unexpected-pressure-sign'));
assert(!hasRule(auditWithType([[0, -1], [1, 0.2], [2, -10]], 'drainage'), 'unexpected-pressure-sign'));
assert(hasRule(auditWithType([[0, 10], [1, 20], [2, 30]], 'drainage'), 'unexpected-pressure-sign'));
assert(!hasRule(audit([[0, 0], [1, 10], [2, 20]]), 'unexpected-pressure-sign'));
assert(audit([[0, 0], [1, 40], [2, 100]]).some(finding =>
  finding.rule === 'sparse-curve' && finding.severity === 'LOW'));
const multiSeries = auditDataset({ items: [{
  manufacturer: 'Test', model: 'Dual', size: '1 Fr',
  pressureSeries: [
    { label: 'Infusion', points: points([[0, 0], [1, 10], [2, 20]]) },
    { label: 'Drainage', points: points([[0, 0], [1, -10], [2, -8]]) }
  ]
}] });
assert.equal(multiSeries.seriesAnalyzed, 2);
assert(multiSeries.findings.some(finding => finding.series === 'Drainage' && finding.rule === 'local-reversal'));
assert(!multiSeries.findings.some(finding => finding.series === 'Infusion' && finding.rule === 'local-reversal'));
for (const pressureSeries of [[], null, undefined]) {
  const fallbackEntry = { ...entry(points([[0, 0], [1, 10], [2, 20]])), pressureSeries };
  const fallbackReport = auditDataset({ items: [fallbackEntry] });
  assert.equal(fallbackReport.seriesAnalyzed, 1);
  assert.equal(fallbackReport.findings.length, 0);
}
assert(hasRule(audit([[0, 0], [1, 10], [1, 12], [2, 20]]), 'conflicting-flow'));
assert.equal(audit([[3, 30], [0, 0], [2, 20], [1, 10]]).length, 0);
assert(hasRule(audit([[0, 0], [-1, 1], [1, 10], [2, 20]]), 'negative-flow'));
assert(hasRule(audit([[0, 0], [NaN, 1], [1, Infinity], [2, 20]]), 'invalid-flow'));
assert(hasRule(audit([[0, 0], [NaN, 1], [1, Infinity], [2, 20]]), 'invalid-pressure'));
assert(hasRule(audit([[0, 0], [1, 10]]), 'too-few-points'));

const orderCodeVariants = auditDataset({ items: ['A-100', 'B-200'].map(cannulaOrderCode => ({
  manufacturer: 'Test', model: 'Same model', size: '10 Fr', cannulaOrderCode,
  points: points([[0, 0], [1, 50], [2, 100]])
})) });
assert.equal(orderCodeVariants.flaggedCurves.LOW, 2);
assert.deepStrictEqual(
  [...new Set(orderCodeVariants.findings.map(finding => finding.cannulaOrderCode))].sort(),
  ['A-100', 'B-200']
);

const outputSink = { output: '', write(value) { this.output += value; } };
const cleanFixture = { items: [entry(points([[0, 0], [1, 10], [2, 20]]))] };
assert.equal(main([], { data: cleanFixture, output: outputSink }), 0);
assert(outputSink.output.includes('Cannula Pressure-Flow Dataset QC'));
assert.equal(main([], {
  data: { items: [entry(points([[0, 0], [1, 10], [2, 8], [3, 20]]))] },
  output: { write() {} }
}), 0, 'Heuristic-only findings must not fail the CLI.');
const invalidReport = auditDataset({ items: [entry(points([[0, 0], [1, 10], [2, 20]]))] });
assert.equal(hasFatalFindings(invalidReport), false);
for (const invalidPoints of [
  [{ flow: NaN, pressureDrop: 1 }, { flow: 1, pressureDrop: 2 }, { flow: 2, pressureDrop: 3 }],
  [{ flow: 0, pressureDrop: NaN }, { flow: 1, pressureDrop: 2 }, { flow: 2, pressureDrop: 3 }],
  [{ flow: -1, pressureDrop: 1 }, { flow: 1, pressureDrop: 2 }, { flow: 2, pressureDrop: 3 }],
  [{ flow: 0, pressureDrop: 1 }, { flow: 0, pressureDrop: 2 }, { flow: 2, pressureDrop: 3 }]
]) {
  assert.equal(hasFatalFindings({ findings: audit(invalidPoints.map(point => [point.flow, point.pressureDrop])) }), true);
}
const wrongSignData = { items: [{
  manufacturer: 'Test', model: 'Wrong sign', size: '1 Fr',
  pressureSeries: [{ label: 'Infusion', semanticType: 'infusion', points: points([[0, -10], [1, -20], [2, -30]]) }]
}] };
const wrongSignReport = auditDataset(wrongSignData);
assert.equal(hasFatalFindings(wrongSignReport), true);
const invalidOutput = { output: '', write(value) { this.output += value; } };
assert.equal(main([], {
  data: { items: [entry([{ flow: 0, pressureDrop: 0 }, { flow: NaN, pressureDrop: 10 },
    { flow: 2, pressureDrop: 20 }])] },
  output: invalidOutput
}), 1, 'Objective invalid data must produce a failure exit code.');
assert(invalidOutput.output.includes('invalid-flow'), 'The CLI must print its report before returning failure status.');
assert.equal(main([], { data: wrongSignData, output: { write() {} } }), 1);

const before = fs.readFileSync(datasetPath);
const realData = JSON.parse(before.toString('utf8'));
assert(Array.isArray(realData.items) && realData.items.length > 0);
const realReport = auditDataset(realData);
assert.equal(realReport.entries, realData.items.length);
assert(realReport.seriesAnalyzed >= realReport.entries);
assert(!hasFatalFindings(realReport), 'The current production dataset should pass objective validity checks.');
assert(Array.isArray(realReport.findings));
for (const finding of realReport.findings) {
  assert(['HIGH', 'MEDIUM', 'LOW'].includes(finding.severity));
  assert(typeof finding.rule === 'string' && finding.rule.length > 0);
  assert(typeof finding.manufacturer === 'string' && finding.manufacturer.length > 0);
  assert(typeof finding.model === 'string' && finding.model.length > 0);
  assert(typeof finding.size === 'string' && finding.size.length > 0);
  assert(typeof finding.series === 'string' && finding.series.length > 0);
  assert(typeof finding.reason === 'string' && finding.reason.length > 0);
}
assert.deepStrictEqual(fs.readFileSync(datasetPath), before);
console.log('Cannula pressure data QC tests passed.');
