'use strict';

const fs = require('fs');
const path = require('path');

// Screening thresholds only. Findings always call for manual source review.
const thresholds = Object.freeze({
  minimumUsablePoints: 3,
  reversalMmHg: 0.25,
  kinkAbsoluteMmHg: 5,
  kinkRelative: 0.12,
  extremeKinkRelative: 0.22,
  slopeDifference: 20,
  slopeRatio: 2.5,
  extremeSlopeRatio: 4,
  sparseMaximumPoints: 8,
  sparseMinimumFlowSpan: 2,
  sparseMinimumPressureSpan: 100
});

const severityRank = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function auditSeries(entry, series) {
  if (!Array.isArray(series.points)) {
    throw new Error(`Missing points array for ${entry.model} / ${series.label}`);
  }
  const findings = [];
  const identity = {
    manufacturer: entry.manufacturer,
    model: entry.model,
    size: entry.size,
    series: series.label
  };
  function add(severity, rule, flow, diagnostics, reason) {
    findings.push({ ...identity, severity, rule, flow, diagnostics, reason });
  }

  const usable = [];
  series.points.forEach((point, index) => {
    const flow = point && point.flow;
    const pressure = point && point.pressureDrop;
    if (typeof flow !== 'number' || !Number.isFinite(flow)) {
      add('HIGH', 'invalid-flow', null, { pointIndex: index }, 'Non-finite flow; manual source review recommended.');
    }
    if (typeof pressure !== 'number' || !Number.isFinite(pressure)) {
      add('HIGH', 'invalid-pressure', Number.isFinite(flow) ? flow : null,
        { pointIndex: index }, 'Non-finite pressure; manual source review recommended.');
    }
    if (Number.isFinite(flow) && flow < 0) {
      add('HIGH', 'negative-flow', flow, { pointIndex: index },
        'Negative flow; manual source review recommended.');
    }
    if (typeof flow === 'number' && Number.isFinite(flow) && flow >= 0 &&
        typeof pressure === 'number' && Number.isFinite(pressure)) {
      usable.push({ flow, pressureMagnitude: Math.abs(pressure), pressure });
    }
  });

  usable.sort((a, b) => a.flow - b.flow);
  const distinct = [];
  for (const point of usable) {
    const previous = distinct[distinct.length - 1];
    if (previous && previous.flow === point.flow) {
      if (previous.pressure !== point.pressure) {
        add('HIGH', 'conflicting-flow', point.flow,
          { pressuresMmHg: [previous.pressure, point.pressure] },
          'Conflicting pressures at the same flow; manual source review recommended.');
      }
    } else {
      distinct.push(point);
    }
  }
  if (distinct.length < thresholds.minimumUsablePoints) {
    add('HIGH', 'too-few-points', null, { usablePoints: distinct.length },
      'Too few usable flow points; manual source review recommended.');
    return findings;
  }

  for (let index = 1; index < distinct.length; index++) {
    const left = distinct[index - 1];
    const right = distinct[index];
    const decrease = left.pressureMagnitude - right.pressureMagnitude;
    if (decrease > thresholds.reversalMmHg) {
      add('HIGH', 'local-reversal', [left.flow, right.flow],
        { decreaseMmHg: decrease },
        'Pressure magnitude decreases as flow rises; manual source review recommended.');
    }
  }

  for (let index = 1; index < distinct.length - 1; index++) {
    const left = distinct[index - 1];
    const middle = distinct[index];
    const right = distinct[index + 1];
    const expected = left.pressureMagnitude +
      (right.pressureMagnitude - left.pressureMagnitude) *
      (middle.flow - left.flow) / (right.flow - left.flow);
    const deviation = Math.abs(middle.pressureMagnitude - expected);
    // A 1 mmHg floor keeps near-zero pressure points from producing huge ratios.
    const relativeDeviation = deviation / Math.max(1, Math.abs(expected));
    if (deviation >= thresholds.kinkAbsoluteMmHg &&
        relativeDeviation >= thresholds.kinkRelative) {
      const severity = relativeDeviation >= thresholds.extremeKinkRelative ? 'HIGH' : 'MEDIUM';
      add(severity, 'local-kink', middle.flow,
        { deviationMmHg: deviation, relativeDeviation, expectedMagnitudeMmHg: expected },
        'Local point deviates from neighboring trend; manual source review recommended.');
    }

    const firstSlope = (middle.pressureMagnitude - left.pressureMagnitude) /
      (middle.flow - left.flow);
    const secondSlope = (right.pressureMagnitude - middle.pressureMagnitude) /
      (right.flow - middle.flow);
    const slopeDifference = Math.abs(secondSlope - firstSlope);
    // A small denominator floor keeps the JSON diagnostic finite at a flat segment.
    const smallerSlope = Math.min(Math.abs(firstSlope), Math.abs(secondSlope));
    const slopeRatio = Math.max(Math.abs(firstSlope), Math.abs(secondSlope)) /
      Math.max(smallerSlope, 0.1);
    if (slopeDifference >= thresholds.slopeDifference &&
        slopeRatio >= thresholds.slopeRatio) {
      const severity = slopeRatio >= thresholds.extremeSlopeRatio ? 'HIGH' : 'MEDIUM';
      add(severity, 'slope-whiplash', middle.flow,
        { firstSlope, secondSlope, slopeDifference, slopeRatio },
        'Adjacent slopes change abruptly; manual source review recommended.');
    }
  }

  const flowSpan = distinct[distinct.length - 1].flow - distinct[0].flow;
  const magnitudes = distinct.map(point => point.pressureMagnitude);
  const pressureSpan = Math.max(...magnitudes) - Math.min(...magnitudes);
  if (distinct.length <= thresholds.sparseMaximumPoints &&
      flowSpan >= thresholds.sparseMinimumFlowSpan &&
      pressureSpan >= thresholds.sparseMinimumPressureSpan) {
    add('LOW', 'sparse-curve', [distinct[0].flow, distinct[distinct.length - 1].flow],
      { usablePoints: distinct.length, flowSpan, pressureSpanMmHg: pressureSpan },
      'Consider denser re-digitization for visual fidelity; manual source review recommended.');
  }
  return findings;
}

function auditDataset(data) {
  if (!data || !Array.isArray(data.items)) {
    throw new Error('Dataset must contain an items array.');
  }
  const findings = [];
  let seriesAnalyzed = 0;
  data.items.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object' ||
        typeof entry.manufacturer !== 'string' ||
        typeof entry.model !== 'string' || typeof entry.size !== 'string') {
      throw new Error(`Invalid entry metadata at index ${index}.`);
    }
    const seriesList = entry.pressureSeries === undefined ?
      [{ label: 'Pressure drop', points: entry.points }] : entry.pressureSeries;
    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      throw new Error(`Invalid pressureSeries for entry ${index}.`);
    }
    seriesList.forEach((series, seriesIndex) => {
      if (!series || typeof series.label !== 'string') {
        throw new Error(`Invalid series metadata at entry ${index}, series ${seriesIndex}.`);
      }
      seriesAnalyzed++;
      findings.push(...auditSeries(entry, series));
    });
  });
  const curves = new Map();
  for (const finding of findings) {
    const key = JSON.stringify([finding.manufacturer, finding.model, finding.size, finding.series]);
    const current = curves.get(key);
    if (!current || severityRank[finding.severity] > severityRank[current]) {
      curves.set(key, finding.severity);
    }
  }
  const flaggedCurves = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const severity of curves.values()) flaggedCurves[severity]++;
  return { entries: data.items.length, seriesAnalyzed, flaggedCurves, findings };
}

function formatReport(report) {
  const lines = [
    'Cannula Pressure-Flow Dataset QC',
    '================================',
    `Entries: ${report.entries}`,
    `Series analyzed: ${report.seriesAnalyzed}`,
    `Unique curves flagged: HIGH ${report.flaggedCurves.HIGH}, MEDIUM ${report.flaggedCurves.MEDIUM}, LOW ${report.flaggedCurves.LOW}`
  ];
  for (const severity of ['HIGH', 'MEDIUM', 'LOW']) {
    const findings = report.findings.filter(finding => finding.severity === severity);
    if (!findings.length) continue;
    lines.push('', `[${severity}]`);
    for (const finding of findings) {
      const location = Array.isArray(finding.flow) ? finding.flow.join('–') : finding.flow;
      lines.push(`${finding.manufacturer} | ${finding.model} | ${finding.size} | ${finding.series}`);
      lines.push(`  ${finding.rule}${location === null ? '' : ` at ${location} L/min`}: ${finding.reason}`);
    }
  }
  lines.push('', 'Manual source review required.', 'No clinical data were modified.');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--json')) {
    throw new Error('Usage: node scripts/audit-cannula-pressure-data.js [--json]');
  }
  const datasetPath = path.join(__dirname, '..', 'data', 'cannula-pressure-drop.json');
  const report = auditDataset(JSON.parse(fs.readFileSync(datasetPath, 'utf8')));
  process.stdout.write(args.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Cannula data QC could not complete: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { auditDataset, auditSeries, formatReport, thresholds };
