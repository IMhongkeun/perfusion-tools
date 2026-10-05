'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { auditDataset, hasFatalFindings, main } = require('../scripts/audit-cannula-pressure-data');

const datasetPath = path.join(__dirname, '..', 'data', 'cannula-pressure-drop.json');
const entry = points => ({ manufacturer: 'Test', model: 'Fixture', size: '1 Fr', points });
const points = values => values.map(([flow, pressureDrop]) => ({ flow, pressureDrop }));
const audit = values => auditDataset({ items: [entry(points(values))] }).findings;
const auditWithType = (values, semanticType) => auditDataset({ items: [{
  manufacturer: 'Test', model: 'Fixture', size: '1 Fr',
  pressureSeries: [{ id: semanticType, label: semanticType, semanticType, points: points(values) }]
}] }).findings;
const hasRule = (findings, rule) => findings.some(finding => finding.rule === rule);

assert.equal(audit([[0, 0], [1, 10], [2, 20], [3, 30]]).length, 0);
assert(!hasRule(audit([[0, 0], [1, 10], [2, 9.9], [3, 20]]), 'local-reversal'));
assert(hasRule(audit([[0, 0], [1, 10], [2, 8], [3, 20]]), 'local-reversal'));
assert(hasRule(audit([[0, 0], [1, 10], [2, 50], [3, 30], [4, 40]]), 'local-kink'));
assert(hasRule(audit([[0, 0], [1, 10], [2, 20], [3, 75], [4, 85]]), 'slope-whiplash'));
const smoothConvex = audit([[0, 0], [1, 5], [2, 15], [3, 30], [4, 50]]);
assert(!smoothConvex.some(finding => finding.severity === 'HIGH'));
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
