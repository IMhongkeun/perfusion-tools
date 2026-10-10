'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const pressureDropData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'cannula-pressure-drop.json'), 'utf8')).items;
const aorticArchCurvedModel = 'Aortic Arch Cannulae — Curved Tip with Suture Flange, Wire-reinforced Tubing';
const aorticArchCurvedProducts = [
  ['14 Fr', 4.5, 23, '1/4 inch', 'A212-45C (connector without luer vent); A212-45B (connector with luer vent down); no connector with luer vent up listed for this size', 3.04],
  ['16 Fr', 5.2, 23, '3/8 inch', 'A212-52C (connector without luer vent); A212-52B (connector with luer vent down); A212-52A (connector with luer vent up)', 4.55],
  ['20 Fr', 6.5, 23, '3/8 inch', 'A212-65C (connector without luer vent); A212-65B (connector with luer vent down); A212-65A (connector with luer vent up)', 7.52],
  ['22 Fr', 7.3, 23, '3/8 inch', 'A212-73C (connector without luer vent); A212-73B (connector with luer vent down); A212-73A (connector with luer vent up)', 9],
  ['24 Fr', 8.0, 24, '3/8 inch', 'A212-80C (connector without luer vent); A212-80B (connector with luer vent down); A212-80A (connector with luer vent up)', 9]
];
const aorticArchCurvedEntries = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova' && entry.model === aorticArchCurvedModel);
assert.strictEqual(aorticArchCurvedEntries.length, aorticArchCurvedProducts.length);
for (const [size, tipMm, lengthCm, connector, productCodes, finalFlow] of aorticArchCurvedProducts) {
  const matches = aorticArchCurvedEntries.filter(entry => entry.size === size);
  assert.strictEqual(matches.length, 1, `${size} Curved Tip with Suture Flange entry must exist exactly once.`);
  const entry = matches[0];
  assert.strictEqual(entry.category, 'Adult arterial');
  assert.strictEqual(entry.connectionSite, 'Aortic arch');
  assert.strictEqual(entry.connectorSize, connector);
  assert.strictEqual(entry.overallLengthCm, lengthCm);
  assert(entry.notes.includes(`Tip size: ${tipMm.toFixed(1)} mm.`));
  assert(entry.notes.includes(`Effective length: ${lengthCm} cm.`));
  assert(entry.notes.includes('Quantity per box: 10.'));
  assert(entry.notes.includes('Available coated: Depends on Country Registration.'));
  const listedCodes = productCodes.match(/A212-\d+[A-C]/g) || [];
  listedCodes.forEach(code => assert(entry.notes.includes(`${code} =`)));
  if (size === '14 Fr') assert(!entry.cannulaOrderCode.includes('A212-45A'), '14 Fr must not gain an A-suffix luer-vent-up code.');
  assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
  entry.points.forEach((point, index) => {
    assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  const flowText = finalFlow === 9 ? '9.0' : String(finalFlow);
  assert.strictEqual(entry.referenceFlowRangeLabel, `0–${flowText}`);
  assert(entry.outOfRangeMessage.includes(`0 to ${flowText} L/min`));
  assert(entry.outOfRangeMessage.includes('Pressure drop is not estimated'));
  assert(entry.notes.includes('Extrapolation: false'));
  assert(entry.notes.includes(`Source range: 0 to ${flowText} L/min.`));
  assert(entry.notes.includes('100 mmHg'), 'Adult arterial pressure-drop caution wording must remain present.');
  assert(entry.digitizationNote.includes('manufacturer-published LivaNova Aortic Arch Cannulae'));
  assert(entry.digitizationNote.includes('calibrated automatic WebPlotDigitizer extraction'));
  assert(entry.digitizationNote.includes('(0,0) source-origin anchor'));
  assert(entry.digitizationNote.includes('No fitted curve, smoothing, or extrapolation'));
  if (finalFlow === 9) assert(entry.digitizationNote.includes('final flow coordinate was normalized to 9.0 L/min'));
}
const hlsArterialProducts = [
  ['PAS 1315', 13, 4.3, 15, 2.94],
  ['PAS 1515', 15, 5.0, 15, 3.96],
  ['PAS 1715', 17, 5.7, 15, 5.56],
  ['PAS 1915', 19, 6.3, 15, 7],
  ['PAS 2115', 21, 7.0, 15, 7],
  ['PAS 2315', 23, 7.7, 15, 7],
  ['PAL 1523', 15, 5.0, 23, 3.52],
  ['PAL 1723', 17, 5.7, 23, 5.02],
  ['PAL 1923', 19, 6.3, 23, 6.39],
  ['PAL 2123', 21, 7.0, 23, 7],
  ['PAL 2323', 23, 7.7, 23, 7]
];
const hlsArterialEntries = pressureDropData.filter(entry => entry.manufacturer === 'Getinge / Maquet' &&
  entry.model === 'HLS Arterial Cannula');
assert.strictEqual(hlsArterialEntries.length, hlsArterialProducts.length);
for (const [code, fr, mm, lengthCm, maximumFlow] of hlsArterialProducts) {
  const matches = hlsArterialEntries.filter(entry => entry.cannulaOrderCode === code);
  assert.strictEqual(matches.length, 1, `${code} must have one distinct HLS arterial dataset.`);
  const entry = matches[0];
  assert.strictEqual(entry.size, `${code} · ${fr} Fr / ${mm.toFixed(1)} mm · ${lengthCm} cm`);
  assert.strictEqual(entry.cannulaOrderCodeLabel, 'Type / Catalog number');
  assert(entry.notes.includes(`${fr} Fr (${mm.toFixed(1)} mm) outer diameter`) ||
    entry.notes.includes(`${fr} Fr / ${mm.toFixed(1)} mm`));
  assert(entry.notes.toLowerCase().includes(`${lengthCm} cm insertion length`) ||
    entry.notes.toLowerCase().includes(`insertion length: ${lengthCm} cm`));
  assert(entry.notes.toLowerCase().includes('side holes: 2') || entry.notes.includes('2 side holes'));
  assert(entry.notes.toLowerCase().includes('perforation length: 1 cm') || entry.notes.includes('1 cm perforation length'));
  assert(entry.notes.includes(`BE-${code}`));
  assert(entry.notes.includes('3/8'));
  if (code.startsWith('PAL')) {
    assert.strictEqual(entry.outerDiameterFr, fr);
    assert.strictEqual(entry.outerDiameterMm, mm);
    assert.strictEqual(entry.connectorSize, '3/8" LL');
    assert.strictEqual(entry.cartonQuantity, 1);
  }
  assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
  entry.points.forEach((point, index) => {
    assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  assert.strictEqual(entry.points.at(-1).flow, maximumFlow);
  assert.strictEqual(entry.referenceFlowRangeLabel, `0–${maximumFlow}`);
  assert(entry.outOfRangeMessage.includes(`${maximumFlow} L/min`));
}
for (const fr of [15, 17, 19, 21, 23]) {
  const sameFrEntries = hlsArterialEntries.filter(entry => entry.size.includes(`· ${fr} Fr /`));
  assert.strictEqual(sameFrEntries.length, 2, `${fr} Fr PAS and PAL cannulas must remain separate.`);
  assert.deepStrictEqual(new Set(sameFrEntries.map(entry => entry.cannulaOrderCode.split(' ')[0])), new Set(['PAS', 'PAL']));
}
const nextGenModels = [
  'Bio-Medicus NextGen Femoral Arterial Cannula',
  'Bio-Medicus NextGen Jugular Venous Cannula'
];
const lighthouseModel = 'Single Stage Right Angle Lighthouse Tip Venous Return Cannulae — Right Angle Lighthouse Tip, Wire-reinforced Tubing';
const lighthouseProducts = [
  ['RV-41012', 12, '1/4 inch', 2.5],
  ['RV-41014', 14, '1/4 inch', 2.5],
  ['RV-41016', 16, '1/4 inch', 2.5],
  ['RV-41018', 18, '1/4 inch–3/8 inch', 3],
  ['RV-41020', 20, '1/4 inch–3/8 inch', 3.5],
  ['RV-41022', 22, '1/4 inch–3/8 inch', 3.5],
  ['RV-41024', 24, '1/4 inch–3/8 inch', 4],
  ['RV-41026', 26, '3/8 inch', 4],
  ['RV-41028', 28, '3/8 inch', 4],
  ['RV-41030', 30, '3/8 inch', 5.5],
  ['RV-41032', 32, '3/8 inch', 5.5],
  ['RV-41034', 34, '3/8 inch', 5.5],
  ['RV-41036', 36, '1/2 inch', 6],
  ['RV-41038', 38, '3/8 inch', 6]
];
const lighthouseEntries = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova' &&
  entry.model === lighthouseModel);
assert.strictEqual(lighthouseEntries.length, lighthouseProducts.length);
for (const [code, fr, connector, tipLengthCm] of lighthouseProducts) {
  const matches = lighthouseEntries.filter(entry => entry.cannulaOrderCode === code);
  assert.strictEqual(matches.length, 1, `${code} must have one Lighthouse dataset.`);
  const entry = matches[0];
  assert.strictEqual(entry.size, `${fr} Fr`);
  assert.strictEqual(entry.connectorSize, connector);
  assert(entry.notes.includes(`Tip length: ${tipLengthCm} cm.`));
  assert(entry.notes.includes(`Connector acceptance: ${connector}.`));
  assert(entry.notes.includes(`Catalog number: ${code}.`));
  assert(entry.notes.includes('Quantity per box: 10.'));
  assert(entry.notes.includes('Available coated: no.'));
  assert(entry.digitizationNote.includes('calibrated automatic WebPlotDigitizer extraction'));
  assert(entry.digitizationNote.includes('(0,0) source-origin anchor'));
  assert(entry.digitizationNote.includes('No fitted curve, smoothing, or extrapolation'));
  if (code === 'RV-41012') {
    assert.strictEqual(entry.points.length, 29);
    for (const flow of [0.56, 0.68, 0.84]) {
      assert(!entry.points.some(point => point.flow === flow), `RV-41012 must omit the reviewed ${flow} L/min digitization artifact.`);
    }
    assert(entry.digitizationNote.includes('three closely spaced automatic-extraction points'));
    assert(entry.digitizationNote.includes('0.01 L/min spacing produced unstable local slope estimates'));
    assert(entry.digitizationNote.includes('inconsistent with the visibly smooth manufacturer curve'));
  }
  if (code === 'RV-41036') {
    assert(entry.digitizationNote.includes('Three low-flow color-extraction artifact points'));
    assert(entry.connectorSize.includes('1/2 inch'));
  }
  if (code === 'RV-41038') assert.strictEqual(entry.connectorSize, '3/8 inch');
  if (code === 'RV-41022') assert.strictEqual(entry.connectorSize, '1/4 inch–3/8 inch');
  assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
  entry.points.forEach((point, index) => {
    assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  const finalFlow = entry.points.at(-1).flow;
  const endpointLabel = finalFlow === 6 ? '6.0' : String(finalFlow);
  assert.strictEqual(entry.referenceFlowRangeLabel, `0–${finalFlow}`);
  assert(entry.notes.includes(`Source range: 0 to ${endpointLabel} L/min.`));
  assert(entry.outOfRangeMessage.includes(`0 to ${endpointLabel} L/min`));
}
const conicalTipConnector = 'Coronary Ostia Perfusion Cannulae — Conical Tip, Stainless Steel Shaft and 1/4" Tubing Connector';
const conicalTipLuer = 'Coronary Ostia Perfusion Cannulae — Conical Tip, Stainless Steel Shaft and Female Luer Lock Connector';
const conicalTipProducts = [
  [conicalTipLuer, '9 Fr', 'P618-30 (45° tip); P616-30 (90° tip)'],
  [conicalTipLuer, '11 Fr', 'P618-35 (45° tip); P616-35 (90° tip)'],
  [conicalTipLuer, '12 Fr', 'P618-40 (45° tip); P616-40 (90° tip)'],
  [conicalTipLuer, '14 Fr', 'P618-45 (45° tip); P616-45 (90° tip)'],
  [conicalTipLuer, '15 Fr', 'P618-50 (45° tip); P616-50 (90° tip)'],
  [conicalTipConnector, '9 Fr', 'P608-30 (45° tip); P606-30 (90° tip)'],
  [conicalTipConnector, '11 Fr', 'P608-35 (45° tip); P606-35 (90° tip)'],
  [conicalTipConnector, '12 Fr', 'P608-40 (45° tip); P606-40 (90° tip)']
];
const conicalTipEntries = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova' &&
  [conicalTipConnector, conicalTipLuer].includes(entry.model));
assert.strictEqual(conicalTipEntries.length, conicalTipProducts.length);
for (const [model, size, catalogNumbers] of conicalTipProducts) {
  const matches = conicalTipEntries.filter(entry => entry.model === model && entry.size === size);
  assert.strictEqual(matches.length, 1, `${model} ${size} must exist exactly once.`);
  const entry = matches[0];
  assert.strictEqual(entry.cannulaOrderCode, catalogNumbers);
  assert.strictEqual(entry.category, 'Cardioplegia');
  assert.strictEqual(entry.connectionSite, 'Coronary ostia perfusion');
  assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
  entry.points.forEach((point, index) => {
    assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  const finalFlow = entry.points.at(-1).flow;
  assert.strictEqual(entry.referenceFlowRangeLabel, `0–${finalFlow}`);
  assert(entry.outOfRangeMessage.includes(`0 to ${finalFlow} L/min`));
  assert(entry.outOfRangeMessage.includes('Pressure drop is not estimated'));
  assert(entry.notes.includes('Extrapolation: false'));
  assert(entry.digitizationNote.includes('calibrated automatic WebPlotDigitizer extraction'));
  assert(entry.digitizationNote.includes('(0,0) source-origin anchor'));
  assert(entry.digitizationNote.includes('anti-aliased line pixel below 0.03 L/min was omitted'));
  assert(entry.digitizationNote.includes('No fitted curve, smoothing, or extrapolation'));
}
assert.notStrictEqual(conicalTipConnector, conicalTipLuer, '1/4 inch and female luer lock connector products must remain distinct variants.');
for (const [code, artifact] of [
  ['P618-40 (45° tip); P616-40 (90° tip)', '0.12 L/min, 3.6 mmHg; 0.42 L/min, 11 mmHg'],
  ['P618-45 (45° tip); P616-45 (90° tip)', '0.38 L/min, 7.7 mmHg'],
  ['P608-30 (45° tip); P606-30 (90° tip)', '0.34 L/min, 39.6 mmHg']
]) {
  const entry = conicalTipEntries.find(item => item.cannulaOrderCode === code);
  assert(artifact.split('; ').every(point => entry.digitizationNote.includes(point)), `${code} must document the reviewed omitted artifacts.`);
}

const hlsVenousProducts = [
  ['PVL 2155', 21, 7.0, 55, 20, 20],
  ['PVL 2355', 23, 7.7, 55, 20, 20],
  ['PVL 2555', 25, 8.3, 55, 24, 20],
  ['PVL 2955', 29, 9.7, 55, 32, 20],
  ['PVS 1938', 19, 6.3, 38, 12, 10],
  ['PVS 2138', 21, 7.0, 38, 12, 10],
  ['PVS 2338', 23, 7.7, 38, 16, 10],
  ['PVS 2538', 25, 8.3, 38, 20, 10]
];
const hlsVenousEntries = pressureDropData.filter(entry => entry.manufacturer === 'Getinge / Maquet' &&
  entry.model === 'HLS Venous Cannula');
assert.strictEqual(hlsVenousEntries.length, hlsVenousProducts.length);
for (const [code, fr, mm, insertionLengthCm, sideHoles, perforationLengthCm] of hlsVenousProducts) {
  const matches = hlsVenousEntries.filter(entry => entry.cannulaOrderCode === code);
  assert.strictEqual(matches.length, 1, `${code} must have one distinct HLS venous dataset.`);
  const entry = matches[0];
  assert.strictEqual(entry.size, code);
  assert.strictEqual(entry.category, code.startsWith('PVS') ? 'venous' : 'femoral venous');
  assert.strictEqual(entry.cannulaOrderCodeLabel, 'Type / Catalog number');
  assert.strictEqual(entry.dataStatus, 'Digitized curve');
  assert(entry.notes.includes(`${fr} Fr (${mm.toFixed(1)} mm) outer diameter`));
  assert(entry.notes.includes(`${insertionLengthCm} cm insertion length`));
  assert(entry.notes.includes(`${sideHoles} side holes`));
  assert(entry.notes.includes(`${perforationLengthCm} cm perforation length`));
  assert(entry.notes.includes('3/8" connector'));
  assert(entry.notes.includes(`BE-${code}`));
  assert.strictEqual(entry.testMedium, 'H2O at room temperature');
  assert(entry.digitizationNote.includes('calibrated automatic WebPlotDigitizer extraction'));
  assert(entry.digitizationNote.includes('(0,0) source-origin anchor'));
  assert(entry.digitizationNote.includes('No fitted curve, smoothing, or extrapolation'));
  if (code.startsWith('PVS')) {
    assert.strictEqual(entry.outerDiameterFr, fr);
    assert.strictEqual(entry.outerDiameterMm, mm);
    assert.strictEqual(entry.insertableLength, `${insertionLengthCm} cm`);
    assert.strictEqual(entry.connectorSize, '3/8"');
    assert.strictEqual(entry.cartonQuantity, 1);
    assert(entry.notes.includes('One cannula per carton'));
    assert(!Object.hasOwn(entry, 'connectionSite'), 'PVS entries should not imply an unsupported anatomical site.');
  }
  assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
  entry.points.forEach((point, index) => {
    assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  const finalFlow = entry.points.at(-1).flow;
  assert.match(entry.referenceFlowRangeLabel, /^0–\d+(?:\.\d+)?$/);
  assert.strictEqual(entry.referenceFlowRangeLabel, `0–${finalFlow}`);
  assert(entry.outOfRangeMessage.includes(`${finalFlow} L/min`));
}
for (const fr of [21, 23, 25]) {
  const matchingSizes = hlsVenousProducts.filter(([, sizeFr]) => sizeFr === fr);
  assert.strictEqual(matchingSizes.length, 2, `${fr} Fr PVS and PVL products must remain distinct.`);
  assert.notStrictEqual(matchingSizes[0][0], matchingSizes[1][0]);
}
// Medtronic catalog page 24; the supplied CSV contains only the arterial 8 Fr curve.
const pediatric8Entries = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' &&
  entry.model === 'Bio-Medicus NextGen Pediatric Arterial Cannula' && entry.size === '8 Fr');
assert.strictEqual(pediatric8Entries.length, 1, 'Preserve one documented pediatric arterial 8 Fr dataset.');
const pediatric8 = pediatric8Entries[0];
assert.strictEqual(pediatric8.category, 'femoral arterial');
assert.strictEqual(pediatric8.size, '8 Fr');
assert.strictEqual(pediatric8.cannulaOrderCode, '96820-108');
assert.strictEqual(pediatric8.outerDiameterFr, 8);
assert.strictEqual(pediatric8.outerDiameterMm, 2.7);
assert.strictEqual(pediatric8.overallLengthCm, 22.9);
assert.strictEqual(pediatric8.tipLengthCm, 10);
assert.strictEqual(pediatric8.connectorSize, '1/4 in (non-vented)');
assert.strictEqual(pediatric8.testMedium, 'Water');
assert.strictEqual(pediatric8.dataStatus, 'digitized-curve');
assert(pediatric8.sourceLabel.includes('page 24') && pediatric8.sourceUrl.endsWith('cannulae-us-product-catalog.pdf'));
assert(pediatric8.digitizationNote.includes('No synthetic (0,0) anchor was added.'));
assert.strictEqual(pediatric8.points.length, 39);
assert.deepStrictEqual(pediatric8.points[0], { flow: 0.011, pressureDrop: 1.5 });
assert.deepStrictEqual(pediatric8.points.at(-1), { flow: 0.904, pressureDrop: 197.9 });
assert(pediatric8.points.some(point => point.flow === 0.491 && point.pressureDrop === 59.4));
assert(!pediatric8.points.some(point => point.flow === 0));
for (let index = 1; index < pediatric8.points.length; index++) {
  const prior = pediatric8.points[index - 1], next = pediatric8.points[index];
  assert(next.flow > prior.flow && next.pressureDrop >= prior.pressureDrop);
  assert(Math.abs(next.flow * 1000 - Math.round(next.flow * 1000)) < 1e-8);
  assert(Math.abs(next.pressureDrop * 10 - Math.round(next.pressureDrop * 10)) < 1e-8);
}
assert.strictEqual(pediatric8.referenceFlowRangeLabel, '0.011–0.904');
assert(pediatric8.outOfRangeMessage.includes('0.904 L/min'));

// Medtronic catalog p.24 / user-supplied 10 Fr arterial curve.
const pediatric10Entries = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' &&
  entry.model === 'Bio-Medicus NextGen Pediatric Arterial Cannula' && entry.size === '10 Fr');
assert.strictEqual(pediatric10Entries.length, 1, '10 Fr pediatric arterial SKU must be unique.');
const pediatric10 = pediatric10Entries[0];
assert.strictEqual(pediatric10.category, 'femoral arterial');
assert.strictEqual(pediatric10.size, '10 Fr');
assert.strictEqual(pediatric10.cannulaOrderCode, '96820-110');
assert.strictEqual(pediatric10.outerDiameterFr, 10);
assert.strictEqual(pediatric10.outerDiameterMm, 3.3);
assert.strictEqual(pediatric10.overallLengthCm, 22.9);
assert.strictEqual(pediatric10.tipLengthCm, 10.5);
assert.strictEqual(pediatric10.wallThicknessMm, 0.38);
assert.strictEqual(pediatric10.connectorSize, '1/4 in (non-vented)');
assert.strictEqual(pediatric10.testMedium, 'Water');
assert.strictEqual(pediatric10.dataStatus, 'digitized-curve');
assert.strictEqual(pediatric10.sourceUrl, pediatric8.sourceUrl);
assert(pediatric10.sourceLabel.includes('page 24'));
assert(pediatric10.digitizationNote.includes('No synthetic (0,0) anchor was added.'));
assert.strictEqual(pediatric10.points.length, 54);
assert.deepStrictEqual(pediatric10.points[0], { flow: 0.011, pressureDrop: 1.5 });
assert.deepStrictEqual(pediatric10.points.at(-1), { flow: 1.789, pressureDrop: 196.9 });
assert(pediatric10.points.some(point => point.flow === 0.975 && point.pressureDrop === 66.2));
assert(!pediatric10.points.some(point => point.flow === 0));
assert.strictEqual(pediatric10.referenceFlowRangeLabel, '0.011–1.789');
assert(pediatric10.outOfRangeMessage.includes('1.789 L/min'));
assert(Math.abs(pediatric10.points.reduce((sum, point) => sum + point.flow, 0) - 52.274) < 1e-9);
assert(Math.abs(pediatric10.points.reduce((sum, point) => sum + point.pressureDrop, 0) - 4345.3) < 1e-9);
for (let index = 1; index < pediatric10.points.length; index++) {
  const prior = pediatric10.points[index - 1], next = pediatric10.points[index];
  assert(next.flow > prior.flow && next.pressureDrop >= prior.pressureDrop,
    '10 Fr flow must strictly increase and pressure drop must not reverse.');
  assert(Math.abs(next.flow * 1000 - Math.round(next.flow * 1000)) < 1e-8);
  assert(Math.abs(next.pressureDrop * 10 - Math.round(next.pressureDrop * 10)) < 1e-8);
}

// Catalog p.24: second user-supplied NextGen Pediatric Arterial curve (12 Fr).
const pediatric12Entries = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' &&
  entry.model === 'Bio-Medicus NextGen Pediatric Arterial Cannula' && entry.size === '12 Fr');
assert.strictEqual(pediatric12Entries.length, 1, 'The pediatric 12 Fr arterial SKU must not be duplicated.');
const pediatric12 = pediatric12Entries[0];
assert.strictEqual(pediatric12.category, 'femoral arterial');
assert.strictEqual(pediatric12.cannulaOrderCode, '96820-112');
assert.strictEqual(pediatric12.outerDiameterFr, 12);
assert.strictEqual(pediatric12.outerDiameterMm, 4);
assert.strictEqual(pediatric12.overallLengthCm, 22.9);
assert.strictEqual(pediatric12.tipLengthCm, 11);
assert.strictEqual(pediatric12.connectorSize, '1/4 in (non-vented)');
assert.strictEqual(pediatric12.testMedium, 'Water');
assert.strictEqual(pediatric12.dataStatus, 'digitized-curve');
assert.strictEqual(pediatric12.sourceUrl, pediatric8.sourceUrl);
assert(pediatric12.sourceLabel.includes('page 24'));
assert.strictEqual(pediatric12.points.length, 54);
assert.deepStrictEqual(pediatric12.points[0], { flow: 0.011, pressureDrop: 1.7 });
assert.deepStrictEqual(pediatric12.points.at(-1), { flow: 1.991, pressureDrop: 95.2 });
assert(pediatric12.points.some(point => point.flow === 1.173 && point.pressureDrop === 36.9));
assert(pediatric12.digitizationNote.includes('No synthetic (0,0) anchor was added.'));
assert(!pediatric12.points.some(point => point.flow === 0));
assert.strictEqual(pediatric12.referenceFlowRangeLabel, '0.011–1.991');
assert(pediatric12.outOfRangeMessage.includes('1.991 L/min'));
for (let index = 1; index < pediatric12.points.length; index++) {
  const previous = pediatric12.points[index - 1], current = pediatric12.points[index];
  assert(current.flow > previous.flow && current.pressureDrop >= previous.pressureDrop,
    'Pediatric 12 Fr must have strictly increasing flow and nondecreasing pressure loss.');
  assert(Math.abs(current.flow * 1000 - Math.round(current.flow * 1000)) < 1e-8);
  assert(Math.abs(current.pressureDrop * 10 - Math.round(current.pressureDrop * 10)) < 1e-8);
}
assert.deepStrictEqual(new Set(pressureDropData.filter(entry =>
  entry.model === 'Bio-Medicus NextGen Pediatric Arterial Cannula').map(entry => entry.cannulaOrderCode)),
  new Set(['96820-108', '96820-110', '96820-112']), 'Do not invent unprovided pediatric 14 Fr or venous curves.');

const nextGenSizes = ['15 Fr', '17 Fr', '19 Fr', '21 Fr', '23 Fr', '25 Fr'];
for (const model of nextGenModels) {
  for (const size of nextGenSizes) {
    const matches = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' &&
      entry.model === model && entry.size === size);
    assert.strictEqual(matches.length, 1, `${model} ${size} must have one distinct dataset.`);
    const entry = matches[0];
    assert(!entry.pressureSeries, `${model} ${size} must remain a separate single-series entry.`);
    assert(Array.isArray(entry.points) && entry.points.length >= 3);
    assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
    entry.points.forEach((point, index) => {
      assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
      assert(point.pressureDrop >= 0);
      if (index > 0) {
        assert(point.flow > entry.points[index - 1].flow);
        assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
      }
    });
    const maximumFlow = entry.points.at(-1).flow;
    assert.strictEqual(entry.referenceFlowRangeLabel, `0–${maximumFlow}`);
    assert(entry.outOfRangeMessage.includes(`${maximumFlow} L/min`));
  }
}
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
  mainJs.includes("panel.style.width = '100%';") &&
  mainJs.includes("panel.style.maxHeight = '320px';") &&
  mainJs.includes("item.className = `block w-full min-w-0 break-words whitespace-normal"),
  'Model/cannula lookup should use a constrained searchable combobox with wrapping options.'
);
assert(
  mainJs.includes("selectNode.dispatchEvent(new Event('change', { bubbles: true }))") &&
  mainJs.includes("['manufacturer', controls.manufacturerSelect]") &&
  mainJs.includes("['model', controls.modelSelect]") &&
  mainJs.includes("['category', controls.categorySelect]"),
  'Searchable model combobox should preserve existing select-driven filtering for model and category/type controls.'
);
const pressureDropPageHtml = fs.readFileSync(path.join(__dirname, '..', 'cannula-pressure-drop', 'index.html'), 'utf8');

const uniqueSorted = values => [...new Set(values.filter(Boolean))].sort();
const pressureDropSummaryHtml = pressureDropPageHtml.slice(
  pressureDropPageHtml.indexOf('id="available-cannula-pressure-drop-datasets"'),
  pressureDropPageHtml.indexOf('<h2 class="calculator-lower-title">Methodology</h2>')
);
const pressureDropManufacturers = uniqueSorted(pressureDropData.map(entry => entry.manufacturer));
const pressureDropCategories = uniqueSorted(pressureDropData.map(entry => entry.category));
const pressureDropFrenchSizes = pressureDropData.flatMap(entry => (
  [...String(entry.size || '').matchAll(/(\d+)\s*Fr/g)].map(match => Number(match[1]))
));
const pressureDropSizeRange = `${Math.min(...pressureDropFrenchSizes)}–${Math.max(...pressureDropFrenchSizes)} Fr`;
assert(
  pressureDropPageHtml.includes('.pressure-drop-combobox-panel') &&
  pressureDropPageHtml.includes('.pressure-drop-combobox-panel { min-width: 0; }') &&
  pressureDropPageHtml.includes('overflow-wrap: anywhere;'),
  'Pressure-drop combobox CSS should prevent horizontal overflow and wrap long options.'
);
assert(
  pressureDropPageHtml.includes('<title>Cannula Pressure Drop Calculator | CPB &amp; Perfusion Flow Resistance</title>') &&
  pressureDropPageHtml.includes('Estimate cannula pressure drop from manufacturer pressure-flow data for perfusion cannulas') &&
  pressureDropPageHtml.includes('<link rel="canonical" href="https://perfusiontools.com/cannula-pressure-drop/" />'),
  'Cannula pressure-drop page should expose unique title, description, and exact canonical URL metadata.'
);
assert(
  pressureDropPageHtml.includes('id="pressure-drop-single-tab"') &&
  pressureDropPageHtml.includes('id="pressure-drop-target-tab"') &&
  pressureDropPageHtml.includes('id="pressure-drop-target-location-note"') &&
  !pressureDropPageHtml.includes('pressure-drop-compare-'),
  'Only target-flow comparison and single lookup remain; location fallback has a visible note.'
);
const heroStart = pressureDropPageHtml.indexOf('id="page-heading"');
const calculatorStart = pressureDropPageHtml.indexOf('id="pressure-drop-reference-root"');
assert(heroStart >= 0 && calculatorStart > heroStart &&
  pressureDropPageHtml.slice(heroStart, calculatorStart).includes('Compare cannula pressure drop at your target flow') &&
  !pressureDropPageHtml.slice(heroStart, calculatorStart).includes('Manufacturer pressure-flow reference</h2>') &&
  !pressureDropPageHtml.includes('Filter, then compare') &&
  pressureDropPageHtml.includes('href="#pressure-drop-methodology"') &&
  pressureDropPageHtml.indexOf('id="pressure-drop-catalog-search"') <
    pressureDropPageHtml.indexOf('id="pressure-drop-target-flow"'),
  'The calculator should follow a short heading without the redundant introductory cards.');
assert(
  pressureDropPageHtml.includes('available manufacturer pressure-flow curves or tables') &&
  pressureDropPageHtml.includes('linear interpolation between adjacent source points') &&
  pressureDropPageHtml.includes('Compare at Target Flow applies one shared flow') &&
  pressureDropPageHtml.includes('The dataset includes manufacturer pressure-flow information') &&
  pressureDropPageHtml.includes('Methodology') &&
  pressureDropPageHtml.includes('Clinical interpretation'),
  'Clinical source, interpolation, and comparison limitations must remain documented below the calculator.'
);
assert(
  pressureDropPageHtml.includes('blood viscosity, hematocrit, temperature, cannula position') &&
  pressureDropPageHtml.includes('connector size, tubing configuration') &&
  pressureDropPageHtml.includes('should not be extrapolated') &&
  pressureDropPageHtml.includes('limited to the currently included manufacturer datasets'),
  'Cannula pressure-drop limitations should describe clinical factors, source-range limits, and dataset coverage limits.'
);
assert(
  pressureDropPageHtml.includes('What is cannula pressure drop?') &&
  pressureDropPageHtml.includes('How is pressure drop estimated on this page?') &&
  pressureDropPageHtml.includes('Can this calculator be used outside the listed flow range?') &&
  pressureDropPageHtml.includes('Does this replace manufacturer instructions or clinical judgment?') &&
  pressureDropPageHtml.includes('Why can measured circuit pressure differ from the chart value?'),
  'Cannula pressure-drop page should include compact FAQ/AEO content for key user questions.'
);
assert(
  pressureDropPageHtml.includes('Getinge / Maquet HLS cannula entries are commonly interpreted in an ECMO context') &&
  pressureDropPageHtml.includes('intended ECMO configuration'),
  'Cannula pressure-drop lower content should describe HLS cannula interpretation in an ECMO context without making a product recommendation.'
);
assert(
  pressureDropPageHtml.includes('measured arterial line pressure is not determined by cannula pressure drop alone') &&
  pressureDropPageHtml.includes('oxygenator pressure gradient') &&
  pressureDropPageHtml.includes('arterial filter pressure gradient') &&
  pressureDropPageHtml.includes('patient MAP/afterload') &&
  pressureDropPageHtml.includes('Is cannula pressure drop the same as CPB arterial line pressure?'),
  'Cannula pressure-drop lower content should distinguish cannula pressure drop from total CPB arterial line pressure and list circuit/patient factors.'
);
assert(
  pressureDropPageHtml.includes('Practical pressure monitoring during CPB and ECMO') &&
  pressureDropPageHtml.includes('Arterial pressure monitoring') &&
  pressureDropPageHtml.includes('Arterial cannula pressure test after cannulation') &&
  pressureDropPageHtml.includes('A sudden rise in arterial line pressure with reduced systemic pressure') &&
  pressureDropPageHtml.includes('arterial filter pressure gradient') &&
  pressureDropPageHtml.includes('oxygenator pressure gradient'),
  'Cannula pressure-drop page should include practical arterial pressure monitoring and arterial cannula pressure-test guidance.'
);
assert(
  pressureDropPageHtml.includes('Venous pressure and drainage monitoring') &&
  pressureDropPageHtml.includes('reservoir level, venous line chatter') &&
  pressureDropPageHtml.includes('patient CVP') &&
  pressureDropPageHtml.includes('VAVD setting') &&
  pressureDropPageHtml.includes('Very negative venous line pressure'),
  'Cannula pressure-drop page should include practical venous drainage and pressure monitoring guidance.'
);
assert(
  pressureDropPageHtml.includes('VAVD precautions') &&
  pressureDropPageHtml.includes('Monitor reservoir pressure when VAVD is used') &&
  pressureDropPageHtml.includes('avoid excessive negative pressure') &&
  pressureDropPageHtml.includes('How should venous pressure-drop data be used?'),
  'Cannula pressure-drop page should include VAVD precautions and matching FAQ content.'
);
assert(
  pressureDropPageHtml.includes('href="/quick-reference/"') &&
  pressureDropPageHtml.includes('href="/unit-converter/"') &&
  pressureDropPageHtml.includes('href="/bsa/"'),
  'Cannula pressure-drop related tools should link to Quick Reference, Unit Converter, and BSA Calculator.'
);


assert(
  pressureDropPageHtml.includes('id="available-cannula-pressure-drop-datasets"') &&
  pressureDropSummaryHtml.includes(`${pressureDropData.length} datasets`) &&
  pressureDropSummaryHtml.includes(pressureDropManufacturers.join(', ')) &&
  pressureDropCategories.every(category => pressureDropSummaryHtml.includes(category)) &&
  pressureDropSummaryHtml.includes(pressureDropSizeRange) &&
  pressureDropManufacturers.every(manufacturer => pressureDropSummaryHtml.includes(`<strong>${manufacturer}</strong>`)) &&
  pressureDropSummaryHtml.includes('Model availability includes') &&
  pressureDropSummaryHtml.includes('representative size range') &&
  !/<table|pressureDrop|\"flow\"|data points/i.test(pressureDropSummaryHtml),
  'Cannula pressure-drop page should include an indexable dataset summary synchronized with manufacturer, category, model, and size availability.'
);
assert(
  pressureDropPageHtml.includes('"@type":"FAQPage"') &&
  pressureDropPageHtml.includes('"name":"What is cannula pressure drop?"') &&
  pressureDropPageHtml.includes('"name":"How is pressure drop estimated on this page?"') &&
  pressureDropPageHtml.includes('"name":"Can this calculator be used outside the listed flow range?"') &&
  pressureDropPageHtml.includes('"name":"Does this replace manufacturer instructions or clinical judgment?"') &&
  pressureDropPageHtml.includes('"name":"Why can measured circuit pressure differ from the chart value?"'),
  'Cannula pressure-drop FAQPage JSON-LD should match the visible FAQ questions.'
);
assert(
  !/selects? the best cannula|defines? a universal safe pressure threshold|reliable estimate outside|does replace manufacturer instructions/i.test(pressureDropPageHtml),
  'Cannula pressure-drop copy should not claim to select the best cannula, define a universal safe pressure threshold, extrapolate reliably, or replace manufacturer instructions.'
);

const medtronicCatalogUrl = 'https://www.medtronic.com/content/dam/medtronic-wide/public/united-states/products/cardiac-vascular/cardiovascular/cannulae/cannulae-us-product-catalog.pdf';
const medtronicEntries = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic');
assert(medtronicEntries.length > 0, 'Medtronic pressure-drop entries should remain available.');
assert(
  medtronicEntries.every(entry => entry.sourceUrl === medtronicCatalogUrl),
  'Every Medtronic pressure-drop entry should link to the public Medtronic Cannula Catalog PDF because individual cannula PDF links are unavailable.'
);
assert(
  medtronicEntries.every(entry => entry.sourceUrl !== 'Uploaded Medtronic Cannula Catalog 2020' && entry.sourceUrl !== ''),
  'Medtronic source URLs should not use upload placeholders or blank links.'
);
assert(
  !/<meta\s+name=["'](?:robots|googlebot)["'][^>]*noindex/i.test(pressureDropPageHtml),
  'Cannula pressure-drop page should not include robots/googlebot noindex metadata.'
);

assert(
  mainJs.includes('function buildPressureDropAxisTicks') &&
  mainJs.includes('stroke-opacity="0.10"') &&
  mainJs.includes('formatPressureDropAxisTick'),
  'Pressure-drop chart should include lightweight axis tick/gridline rendering helpers.'
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
assert(
  mainJs.includes('function getPressureDropComparisonResult') &&
  mainJs.includes('interpolatePressureDrop(entry.points, flowValue)') &&
  !mainJs.includes('function interpolatePressureDropComparison'),
  'Comparison mode should reuse the shared interpolation helper without duplicating calculation logic.'
);
assert(
  !mainJs.includes('function createPressureDropComparisonTable') &&
  !mainJs.includes('selectedComparisonKeys') &&
  mainJs.includes("remove.textContent = '×'") &&
  mainJs.includes('createPressureDropTargetFlowChart'),
  'The redundant same-family view and its controls are gone; selected curves use compact removal controls.'
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

const aorticRootCurves = [
  ['AR-11012', 'without Vent Line', '12 Ga / 9 Fr', '14Ga', '14 Ga - Green', 15, '0.106–0.60', 34],
  ['AR-11014', 'without Vent Line', '14 Ga / 7 Fr', '16Ga', '16 Ga - White', 15, '0.106–0.60', 34],
  ['AR-11016', 'without Vent Line', '16 Ga / 5 Fr', '18Ga', '18 Ga - Pink', 15, '0.106–0.40', 24],
  ['AR-11018', 'without Vent Line', '18 Ga / 4 Fr', '20Ga', '20 Ga - Gold', 12.5, '0.106–0.60', 35],
  ['AR-11112', 'with Vent Line', '12 Ga / 9 Fr', '14Ga', '14 Ga - Green', 15, '0.104–0.60', 34],
  ['AR-11114', 'with Vent Line', '14 Ga / 7 Fr', '16Ga', '16 Ga - White', 15, '0.107–0.60', 34],
  ['AR-11116', 'with Vent Line', '16 Ga / 5 Fr', '18Ga', '18 Ga - Pink', 15, '0.107–0.40', 24]
];
const aorticRootCodes = new Set(aorticRootCurves.map(([code]) => code));
const aorticRootEntries = pressureDropData.filter(entry => aorticRootCodes.has(entry.cannulaOrderCode));
assert.strictEqual(aorticRootEntries.length, aorticRootCurves.length);
assert.deepStrictEqual(
  aorticRootCurves.filter(([, configuration]) => configuration === 'without Vent Line').map(([code]) => code),
  aorticRootEntries.filter(entry => entry.model.toLowerCase().includes('without vent line')).map(entry => entry.cannulaOrderCode).sort((a, b) => a.localeCompare(b))
);
assert.deepStrictEqual(
  aorticRootCurves.filter(([, configuration]) => configuration === 'with Vent Line').map(([code]) => code),
  aorticRootEntries.filter(entry => entry.model === 'Aortic Root Cannula with Vent Line').map(entry => entry.cannulaOrderCode).sort((a, b) => a.localeCompare(b))
);
assert.strictEqual(aorticRootEntries.filter(entry => entry.cannulaOrderCode === 'AR-11116').length, 1);
assert(!aorticRootEntries.some(entry => entry.cannulaOrderCode === 'AR-11118' || entry.model === 'Aortic Root Cannula with Vent Line' && entry.size === '18 Ga / 4 Fr'));
for (const [code, configuration, size, graphLabel, needle, lengthCm, range, pointCount] of aorticRootCurves) {
  const entry = aorticRootEntries.find(item => item.cannulaOrderCode === code);
  assert.strictEqual(entry.size, size);
  assert.strictEqual(entry.connectionSite, 'Aortic root');
  assert.strictEqual(entry.category, 'Aortic root / cardioplegia');
  assert.strictEqual(entry.overallLengthCm, lengthCm);
  assert.strictEqual(entry.points.length, pointCount);
  assert(entry.digitizationNote.includes(`Graph label ${graphLabel} refers to insertion needle gauge`));
  assert(entry.digitizationNote.includes(`insertion needle ${needle}`));
  assert(entry.digitizationNote.includes(`primary catalog number ${code}`));
  assert(entry.digitizationNote.includes('corrected source-axis calibration'));
  assert(entry.digitizationNote.includes('No synthetic zero-flow anchor was added'));
  assert(entry.digitizationNote.includes('No smoothing, fitted curve, or extrapolation'));
  assert(entry.notes.includes(`Source graph label: ${graphLabel}.`));
  assert(entry.notes.includes(`Insertion needle: ${needle}.`));
  assert(entry.notes.includes(`Primary catalog number for this ${configuration.toLowerCase()} dataset: ${code}.`));
  assert(entry.notes.includes(`Effective length: ${lengthCm} cm.`));
  assert(entry.notes.includes('Quantity per box: 10.'));
  assert(entry.notes.includes('Available coated: no.'));
  assert(entry.notes.includes('Extrapolation: false.'));
  assert(entry.notes.includes('No synthetic zero-flow anchor was added.'));
  assert(!/zero-flow anchor was added for physiologic interpolation/i.test(entry.notes));
  assert.strictEqual(entry.referenceFlowRangeLabel, range);
  const [minimumText, maximumText] = range.split('–');
  const minimum = Number(minimumText), maximum = Number(maximumText);
  assert.strictEqual(entry.points[0].flow, minimum);
  assert.strictEqual(entry.points.at(-1).flow, maximum);
  assert(entry.outOfRangeMessage.includes(`${minimumText} to ${maximumText} L/min`));
  assert(entry.outOfRangeMessage.includes('Pressure drop is not estimated'));
  assert(!entry.points.some(point => point.flow === 0 && point.pressureDrop === 0));
  entry.points.forEach((point, index) => {
    assert(Math.abs(point.flow * 1000 - Math.round(point.flow * 1000)) < 1e-8, `${code} flow precision should remain at 0.001 L/min.`);
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  assert.strictEqual(interpolatePressureDrop(entry.points, minimum - 0.001).state, 'out_of_range');
  assert.strictEqual(interpolatePressureDrop(entry.points, maximum + 0.001).state, 'out_of_range');
}
const nextGenBicavalModel = 'Bio-Medicus NextGen Femoral Bi-caval Venous Cannula';
const nextGenBicavalContracts = [
  ['15 Fr', 5.0, 64.8, 48.9, '96670-115', '96600-115', '0–3.39', 35],
  ['17 Fr', 5.7, 64.8, 48.9, '96670-117', '96600-117', '0–4.66', 40],
  ['19 Fr', 6.3, 69.9, 54.0, '96670-119', '96600-119', '0–6', 46],
  ['21 Fr', 7.0, 69.9, 54.0, '96670-121', '96600-121', '0–6', 46],
  ['23 Fr', 7.7, 76.2, 60.0, '96670-123', '96600-123', '0–6', 46],
  ['25 Fr', 8.3, 76.2, 60.0, '96670-125', '96600-125', '0–6', 46],
  ['27 Fr', 9.0, 76.2, 60.0, '96670-127', '96600-127', '0–6', 46],
  ['29 Fr', 9.7, 76.2, 60.0, '96670-129', '96600-129', '0–6', 46]
];
const nextGenBicavalEntries = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' && entry.model === nextGenBicavalModel);
assert.strictEqual(nextGenBicavalEntries.length, nextGenBicavalContracts.length, 'Exactly eight NextGen Femoral Bi-caval Venous datasets should remain.');
const nextGenBicavalAudit = require('../scripts/audit-cannula-pressure-data').auditDataset({ items: pressureDropData });
for (const [size, outerDiameterMm, overallLengthCm, tipLengthCm, singlesCode, kitCode, range, pointCount] of nextGenBicavalContracts) {
  const matches = nextGenBicavalEntries.filter(entry => entry.size === size);
  assert.strictEqual(matches.length, 1, `${size} should exist exactly once.`);
  const entry = matches[0];
  assert.strictEqual(entry.outerDiameterMm, outerDiameterMm);
  assert.strictEqual(entry.overallLengthCm, overallLengthCm);
  assert.strictEqual(entry.tipLengthCm, tipLengthCm);
  assert.strictEqual(entry.cannulaOrderCode, singlesCode);
  assert.strictEqual(entry.cannulaKitOrderCode, kitCode);
  assert.strictEqual(entry.connectorSize, 'Non-vented 3/8 in (0.95 cm)');
  assert.strictEqual(entry.cartonQuantity, '1 per carton');
  assert.strictEqual(entry.testMedium, 'Water');
  assert.strictEqual(entry.points.length, pointCount);
  assert.deepStrictEqual(entry.points[0], { flow: 0, pressureDrop: 0 });
  assert.strictEqual(entry.referenceFlowRangeLabel, range);
  const finalFlow = Number(range.split('–')[1]);
  assert.strictEqual(entry.points.at(-1).flow, finalFlow);
  assert(entry.outOfRangeMessage.includes(`0 to ${finalFlow} L/min`));
  assert(entry.outOfRangeMessage.includes('Pressure loss is not estimated'));
  assert(entry.digitizationNote.includes('manufacturer-published Bio-Medicus NextGen Femoral Bi-caval Venous pressure-loss chart'));
  assert(entry.digitizationNote.includes('calibrated automatic WebPlotDigitizer extraction'));
  assert(entry.digitizationNote.includes('manufacturer curve visibly begins at the graph origin'));
  assert(entry.digitizationNote.includes('(0,0) source-origin anchor is retained'));
  assert(entry.digitizationNote.includes('near-origin anti-aliased line pixel below 0.10 L/min was omitted'));
  assert(entry.digitizationNote.includes('flow to 0.01 L/min; pressure loss to 0.1 mmHg'));
  assert(entry.digitizationNote.includes('No fitted curve or smoothing was applied'));
  assert(entry.digitizationNote.includes(`Do not extrapolate outside the digitized source range of 0–${finalFlow} L/min`));
  assert(!entry.points.some(point => point.flow > 0 && point.flow < 0.1), `${size} must not restore the omitted anti-aliased pixel.`);
  entry.points.forEach((point, index) => {
    assert(Math.abs(point.flow * 100 - Math.round(point.flow * 100)) < 1e-8, `${size} flow should be rounded to 0.01 L/min.`);
    assert(point.pressureDrop >= 0);
    if (index > 0) {
      assert(point.flow > entry.points[index - 1].flow);
      assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
    }
  });
  if (size === '15 Fr') assert.strictEqual(finalFlow, 3.39);
  if (size === '17 Fr') assert.strictEqual(finalFlow, 4.66);
  if (['19 Fr', '21 Fr', '23 Fr', '25 Fr', '27 Fr', '29 Fr'].includes(size)) assert.strictEqual(finalFlow, 6);
  assert.strictEqual(interpolatePressureDrop(entry.points, finalFlow + 0.01).state, 'out_of_range');
  const shapeFindings = nextGenBicavalAudit.findings.filter(finding => finding.cannulaOrderCode === singlesCode &&
    ['local-reversal', 'local-kink', 'slope-whiplash', 'sparse-curve'].includes(finding.rule));
  assert.deepStrictEqual(shapeFindings, [], `${size} should have no curve-shape QC findings.`);
}
const livaNovaDatasetCount = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova').length;
assert(mainJs.includes(`Browse ${pressureDropData.length} manufacturer pressure-flow datasets for cannula selection.`));

const retrogradeF14Model = 'Retrograde Cardioplegia Cannulae — Self-Inflating PVC Balloon';
const retrogradeF14Entries = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova' &&
  entry.model === retrogradeF14Model && entry.size === '14 Fr');
assert.strictEqual(retrogradeF14Entries.length, 1, 'The shared F14 curve must remain one dataset for all balloon variants.');
const retrogradeF14 = retrogradeF14Entries[0];
const retrogradeF14CatalogCodes = [
  'RCS-11114', 'RCS-12114', 'RCS-13114',
  'RCS-11214', 'RCS-12214', 'RCS-13214',
  'RCS-11314', 'RCS-12314', 'RCS-13314'
];
assert.deepStrictEqual(retrogradeF14.cannulaOrderCode.split('; '), retrogradeF14CatalogCodes);
assert.deepStrictEqual(retrogradeF14.points[0], { flow: 0.05, pressureDrop: 0.5 });
assert.strictEqual(retrogradeF14.points.at(-1).flow, 0.6);
assert(!retrogradeF14.points.some(point => point.flow === 0 && point.pressureDrop === 0), 'The unsupported synthetic origin must not return.');
retrogradeF14.points.forEach((point, index) => {
  assert(Number.isFinite(point.flow) && Number.isFinite(point.pressureDrop));
  assert(point.flow >= 0.05 && point.pressureDrop >= 0);
  if (index > 0) {
    assert(point.flow > retrogradeF14.points[index - 1].flow);
    assert(point.pressureDrop >= retrogradeF14.points[index - 1].pressureDrop);
  }
});
assert.strictEqual(retrogradeF14.referenceFlowRangeLabel, '0.05–0.60');
assert(retrogradeF14.outOfRangeMessage.includes('0.05 to 0.60 L/min'));
assert(retrogradeF14.outOfRangeMessage.includes('Pressure drop is not estimated'));
assert(!/zero-flow anchor was added|physiologic interpolation/i.test(retrogradeF14.digitizationNote));
assert(retrogradeF14.digitizationNote.includes('visible source curve begins at approximately 0.05 L/min'));
assert(retrogradeF14.digitizationNote.includes('no synthetic zero-flow anchor is included'));
assert(retrogradeF14.notes.includes('Source range: 0.05 to 0.60 L/min.'));
assert(!/zero-flow anchor was added|physiologic interpolation/i.test(retrogradeF14.notes));
assert.strictEqual(interpolatePressureDrop(retrogradeF14.points, 0.049).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(retrogradeF14.points, 0.05).state, 'exact');
assert.strictEqual(interpolatePressureDrop(retrogradeF14.points, 0.6).state, 'exact');
assert.strictEqual(interpolatePressureDrop(retrogradeF14.points, 0.601).state, 'out_of_range');


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
  if (normalized.includes('aortic root')) return 'Aortic root / cardioplegia';
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

function getPressureDropComparisonKey(entry) {
  return [
    entry.lookupId,
    entry.manufacturer,
    getPressureDropCategoryFilterValue(entry.category),
    entry.model,
    getPressureDropSizeOptionValue(entry),
    getPressureDropConnectionOptionValue(entry)
  ].filter(Boolean).join('||');
}

function getPressureDropComparisonSizeLabel(entry) {
  if (entry.size) return entry.size;
  return entry.cannulaOrderCode || 'Unknown size';
}

function shouldApplyPressureDropHighWarning(entry) {
  const noteText = normalizePressureDropFilterLabel([
    entry?.notes,
    entry?.note,
    entry?.dataNote,
    entry?.digitizationNote,
    entry?.sourceNote,
    entry?.validationNote
  ].filter(Boolean).join(' '));
  if (noteText.includes('100 mmhg') && (noteText.includes('not apply') || noteText.includes('do not apply'))) return false;
  return getPressureDropCategoryFilterValue(entry?.category) === 'arterial cannula';
}

function getPressureDropComparisonResult(entry, flowValue) {
  const interpolationResult = interpolatePressureDrop(entry.points, flowValue);
  if (interpolationResult.state === 'exact' || interpolationResult.state === 'interpolated') {
    const isHighPressure = shouldApplyPressureDropHighWarning(entry) && interpolationResult.value > 100;
    return {
      warningText: isHighPressure ? 'High pressure drop warning (>100 mmHg).' : (interpolationResult.state === 'exact' ? 'Digitized source point.' : 'Linearly interpolated between adjacent source points.'),
      isHighPressure
    };
  }
  return { warningText: interpolationResult.state, isHighPressure: false };
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
  const getingeHlsVenousMatches = getPressureDropLookupMatches(pressureDropData, {
    manufacturer: 'Getinge / Maquet',
    category: 'venous cannula',
    model: 'HLS Venous Cannula'
  });
  assert.deepStrictEqual(
    getingeHlsVenousMatches.map(entry => entry.cannulaOrderCode).sort(),
    hlsVenousProducts.map(([code]) => code).sort(),
    'The broad venous category should include all distinct HLS venous products without asserting an anatomical site.'
  );


  const getingeArterialMatches = getPressureDropLookupMatches(pressureDropData, {
    manufacturer: 'Getinge / Maquet',
    category: 'arterial cannula',
    model: 'HLS Arterial Cannula'
  });
  const getingeHlsSizeLabels = getingeArterialMatches.map(entry => entry.size).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  assert.deepStrictEqual(
    getingeHlsSizeLabels,
    hlsArterialProducts.map(([code, fr, mm, lengthCm]) =>
      `${code} · ${fr} Fr / ${mm.toFixed(1)} mm · ${lengthCm} cm`
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    'Getinge / Maquet HLS arterial cannula lookup should include all PAS and PAL products.'
  );
  const getingeArterialModelOptions = Array.from(new Set(getingeArterialMatches.map(entry => entry.model)));
  assert.deepStrictEqual(getingeArterialModelOptions, ['HLS Arterial Cannula'], 'Getinge / Maquet HLS arterial entries should expose one canonical model option.');
  const pas1315 = getingeArterialMatches.find(entry => entry.cannulaOrderCode === 'PAS 1315');
  assert(pas1315, 'PAS 1315 should remain available after canonical model regrouping.');
  const pas1315Exact = interpolatePressureDrop(pas1315.points, pas1315.points[1].flow);
  assert.strictEqual(pas1315Exact.state, 'exact');
  assert.strictEqual(pas1315Exact.value, pas1315.points[1].pressureDrop);
  assert.strictEqual(
    getPressureDropComparisonSizeLabel(pas1315),
    'PAS 1315 · 13 Fr / 4.3 mm · 15 cm',
    'PAS 1315 comparison primary label should not append family, connector, or duplicate order-code text.'
  );
  assert(!mainJs.includes('Arterial HLS cannula · 3/8 inch LL · PAS 1315'), 'PAS 1315-only secondary header text should not be rendered in the comparison UI.');
  hlsArterialProducts.filter(([code]) => code !== 'PAS 1315').forEach(([orderCode]) => {
    const entry = getingeArterialMatches.find(item => item.cannulaOrderCode === orderCode);
    assert(entry, `${orderCode} should remain available for label regression coverage.`);
    assert.strictEqual(
      getPressureDropComparisonSizeLabel(entry),
      entry.size,
      `${orderCode} comparison primary label should use the same concise size field formatter as PAS 1315.`
    );
  });
  const pas1715 = getingeArterialMatches.find(entry => entry.cannulaOrderCode === 'PAS 1715');
  const [firstPoint, secondPoint] = pas1715.points.slice(1, 3);
  assert.strictEqual(interpolatePressureDrop(pas1715.points, firstPoint.flow).state, 'exact', 'Comparison warning/status should still be able to identify exact digitized source points.');
  assert.strictEqual(interpolatePressureDrop(pas1715.points, (firstPoint.flow + secondPoint.flow) / 2).state, 'interpolated', 'Comparison warning/status should still be able to distinguish interpolated values.');

  const comparisonEntries = getingeArterialMatches
    .filter(entry => ['PAS 1915', 'PAS 2115', 'PAS 2315'].includes(entry.cannulaOrderCode))
    .map((entry, index) => ({ ...entry, lookupId: `test-hls-${index}` }));
  assert.strictEqual(comparisonEntries.length, 3, 'Same-family comparison should support selecting multiple Getinge / Maquet HLS arterial PAS sizes.');
  assert.strictEqual(new Set(comparisonEntries.map(entry => entry.manufacturer)).size, 1, 'Comparison entries should share one manufacturer.');
  assert.strictEqual(new Set(comparisonEntries.map(entry => getPressureDropCategoryFilterValue(entry.category))).size, 1, 'Comparison entries should share one category/type.');
  assert.strictEqual(new Set(comparisonEntries.map(entry => entry.model)).size, 1, 'Comparison entries should share one model/family.');
  const comparisonKeys = comparisonEntries.map(getPressureDropComparisonKey);
  assert.strictEqual(new Set(comparisonKeys).size, comparisonEntries.length, 'Comparison keys should uniquely identify size/code variants and prevent duplicate selections.');
  const targetFiveResults = comparisonEntries.map(entry => interpolatePressureDrop(entry.points, 5.0));
  assert(targetFiveResults.every(result => result.state === 'exact' || result.state === 'interpolated'), 'Changing the shared target flow to 5.0 L/min should compute all selected comparison ΔP values.');
  const targetFourResults = comparisonEntries.map(entry => interpolatePressureDrop(entry.points, 4.0));
  assert(
    targetFiveResults.some((result, index) => !nearlyEqual(result.value, targetFourResults[index].value)),
    'Changing target flow should update comparison ΔP values rather than reusing stale results.'
  );
  const outOfRangeComparison = interpolatePressureDrop(comparisonEntries[0].points, 99);
  assert.strictEqual(outOfRangeComparison.state, 'out_of_range', 'Out-of-range comparison flow should not extrapolate.');
  assert.strictEqual(outOfRangeComparison.value, null, 'Out-of-range comparison flow should return no pressure-drop value.');
  assert.strictEqual(comparisonKeys.slice(0, 5).length <= 4, true, 'Comparison UI should limit selections to a maximum of four cannulas.');

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

  const livaNovaEntries = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova');
  const livaNovaRootEntries = livaNovaEntries.filter(entry => /aortic root/i.test(entry.model || ''));
  assert.strictEqual(livaNovaRootEntries.length, 9, 'LivaNova root-related entries should remain present.');
  assert(
    livaNovaRootEntries.every(entry => getPressureDropCategoryFilterValue(entry.category) === 'aortic root / cardioplegia'),
    'All LivaNova root-related entries should be classified as Aortic root / cardioplegia.'
  );
  assert(
    getPressureDropLookupMatches(livaNovaEntries, { category: 'arterial cannula' }).every(entry => !/aortic root/i.test(entry.model || '')),
    'LivaNova Aortic Root Cannula and Aortic Root Long Needle entries should not appear under Arterial cannula.'
  );
  const livaNovaRootMatches = getPressureDropLookupMatches(livaNovaEntries, { category: 'aortic root / cardioplegia' });
  assert.deepStrictEqual(
    Array.from(new Set(livaNovaRootMatches.map(entry => entry.model))).sort(),
    [
      'Aortic Root Cannula / without Vent Line',
      'Aortic Root Cannula with Vent Line',
      'Aortic Root Cannula without Vent Line',
      'Aortic Root Long Needle'
    ].sort(),
    'The root-specific category should expose the LivaNova root cannula and root long needle models.'
  );
  assert(
    getPressureDropLookupMatches(livaNovaEntries, { category: 'arterial cannula' }).some(entry => entry.model === 'Aortic Arch Cannulae — Curved Tip with Suture Flange, Wire-reinforced Tubing'),
    'LivaNova Aortic Arch Cannulae should remain classified as Arterial cannula.'
  );
  assert(
    getPressureDropLookupMatches(livaNovaEntries, { category: 'arterial cannula' }).some(entry => entry.model === 'Optiflow Aortic Arch Cannulae — Curved Tip, Wire-reinforced Tubing'),
    'LivaNova Optiflow Aortic Arch Cannulae should remain classified as Arterial cannula.'
  );
  assert(
    getPressureDropLookupMatches(livaNovaEntries, { category: 'arterial cannula' }).some(entry => entry.model === 'Arterial Femoral Cannulae — Polyurethane tubing with suture ring, with introducer'),
    'LivaNova Arterial Femoral Cannulae should remain classified as Arterial cannula.'
  );
  const longNeedleContracts = [
    ['AR-17012', '12 Ga / 9 Fr', '12Ga', '14 Ga - Green', 35, '0.106–0.60', 36],
    ['AR-17014', '14 Ga / 7 Fr', '14Ga', '16 Ga - White', 35, '0.104–0.60', 35]
  ];
  const longNeedleEntries = livaNovaEntries.filter(entry => entry.model === 'Aortic Root Long Needle');
  assert.strictEqual(longNeedleEntries.length, 2, 'Exactly two Aortic Root Long Needle datasets should remain.');
  const auditReport = require('../scripts/audit-cannula-pressure-data').auditDataset({ items: pressureDropData });
  for (const [code, size, graphLabel, insertionNeedle, lengthCm, range, pointCount] of longNeedleContracts) {
    const matches = longNeedleEntries.filter(entry => entry.cannulaOrderCode === code);
    assert.strictEqual(matches.length, 1, `${code} should exist exactly once.`);
    const entry = matches[0];
    assert.strictEqual(entry.size, size);
    assert.strictEqual(entry.category, 'Aortic root / cardioplegia');
    assert.strictEqual(entry.connectionSite, 'Aortic root');
    assert.strictEqual(entry.overallLengthCm, lengthCm);
    assert.strictEqual(entry.cartonQuantity, 10);
    assert.strictEqual(entry.points.length, pointCount);
    assert(entry.digitizationNote.includes(`Graph label ${graphLabel} corresponds directly to cannula-tip outer diameter`));
    assert(entry.digitizationNote.includes(`insertion needle ${insertionNeedle}`));
    assert(entry.digitizationNote.includes('source x-axis is 100–600 mL/min'));
    assert(entry.digitizationNote.includes('converted to L/min by dividing by 1000'));
    assert(entry.digitizationNote.includes('no additional X-axis remapping'));
    assert(entry.digitizationNote.includes('No synthetic zero-flow anchor was added'));
    assert(entry.digitizationNote.includes('No fitted curve or smoothing was applied'));
    assert(entry.notes.includes(`Source graph label: ${graphLabel}.`));
    assert(entry.notes.includes(`Cannula tip outer diameter: ${size}.`));
    assert(entry.notes.includes(`Insertion needle: ${insertionNeedle}.`));
    assert(entry.notes.includes('Source X axis: 100–600 mL/min; flow converted to L/min by division by 1000'));
    assert(entry.notes.includes('No synthetic zero-flow anchor was added.'));
    assert(!/zero-flow anchor was added for physiologic interpolation/i.test(entry.notes));
    assert.strictEqual(entry.referenceFlowRangeLabel, range);
    const [minimumText, maximumText] = range.split('–');
    const minimum = Number(minimumText), maximum = Number(maximumText);
    assert.strictEqual(entry.points[0].flow, minimum);
    assert.strictEqual(entry.points.at(-1).flow, maximum);
    assert(entry.outOfRangeMessage.includes(`${minimumText} to ${maximumText} L/min`));
    assert(entry.outOfRangeMessage.includes('Pressure drop is not estimated'));
    assert(!entry.points.some(point => point.flow === 0 && point.pressureDrop === 0));
    entry.points.forEach((point, index) => {
      assert(Math.abs(point.flow * 1000 - Math.round(point.flow * 1000)) < 1e-8);
      assert(point.pressureDrop >= 0);
      if (index > 0) {
        assert(point.flow > entry.points[index - 1].flow);
        assert(point.pressureDrop >= entry.points[index - 1].pressureDrop);
      }
    });
    assert.strictEqual(interpolatePressureDrop(entry.points, minimum - 0.001).state, 'out_of_range');
    assert.strictEqual(interpolatePressureDrop(entry.points, maximum + 0.001).state, 'out_of_range');
    const shapeFindings = auditReport.findings.filter(finding => finding.cannulaOrderCode === code &&
      ['local-reversal', 'local-kink', 'slope-whiplash', 'sparse-curve'].includes(finding.rule));
    assert.deepStrictEqual(shapeFindings, [], `${code} should remain free of curve-shape QC findings.`);
  }

  const livaNovaArterialHighDrop = livaNovaEntries.find(entry => entry.model === 'Arterial Femoral Cannulae — Polyurethane tubing with suture ring, with introducer' && entry.size === '19 Fr');
  assert(livaNovaArterialHighDrop, 'A LivaNova arterial high-pressure example should remain available.');
  const arterialHighDropResult = getPressureDropComparisonResult(livaNovaArterialHighDrop, 5.26);
  assert.strictEqual(arterialHighDropResult.isHighPressure, true, 'Arterial cannula ΔP above 100 mmHg should retain the high-pressure warning.');
  assert.strictEqual(arterialHighDropResult.warningText, 'High pressure drop warning (>100 mmHg).');

  const livaNovaRapFv = livaNovaEntries.find(entry => entry.model === 'RAP FV Femoral Venous Cannulae' && entry.cannulaOrderCode === '200-100');
  assert(livaNovaRapFv, 'LivaNova RAP FV F22/22 venous example should remain available.');
  const rapFvFirstFlow = livaNovaRapFv.points[0].flow;
  const rapFvLastPoint = livaNovaRapFv.points.at(-1);
  assert.strictEqual(interpolatePressureDrop(livaNovaRapFv.points, rapFvFirstFlow - 0.01).state, 'out_of_range');
  assert.strictEqual(interpolatePressureDrop(livaNovaRapFv.points, rapFvLastPoint.flow + 0.01).state, 'out_of_range');
  assert.strictEqual(interpolatePressureDrop(livaNovaRapFv.points, rapFvLastPoint.flow).value, rapFvLastPoint.pressureDrop);
  const venousHighDropFixture = {
    ...livaNovaRapFv,
    points: [{ flow: 1, pressureDrop: 0 }, { flow: 2, pressureDrop: 120 }]
  };
  const rapFvComparisonResult = getPressureDropComparisonResult(venousHighDropFixture, 2);
  assert.strictEqual(shouldApplyPressureDropHighWarning(livaNovaRapFv), false, 'Venous dataset note should suppress the arterial-only 100 mmHg threshold.');
  assert.strictEqual(rapFvComparisonResult.isHighPressure, false, 'Venous cannula ΔP above 100 mmHg must not show the arterial high-pressure warning.');
  assert.strictEqual(rapFvComparisonResult.warningText, 'Digitized source point.', 'Venous high ΔP should keep the normal exact/interpolated status text.');

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

// Avalon Elite source-series, product-table, and chart behavior invariants.
const avalonModel = 'Avalon Elite Bi-Caval Dual-Lumen Catheter';
const avalonProductContracts = [
  ['13 Fr', '10013-CE', '70107.3603', 4.3, '11 cm (4.3 in)', '1/4 in'],
  ['16 Fr', '10016-CE', '70107.3604', 5.3, '14 cm (5.5 in)', '1/4 in'],
  ['19 Fr', '10019-CE', '70107.3605', 6.4, '21 cm (8.3 in)', '1/4 in'],
  ['20 Fr', '10020-CE', '70107.3606', 6.7, '31 cm (12.2 in)', '3/8 in'],
  ['23 Fr', '10023-CE', '70107.3607', 7.7, '31 cm (12.2 in)', '3/8 in'],
  ['27 Fr', '10027-CE', '70107.3608', 9.0, '31 cm (12.2 in)', '3/8 in'],
  ['31 Fr', '10031-CE', '70107.3609', 10.3, '31 cm (12.2 in)', '3/8 in']
];
const avalonProducts = pressureDropData.filter(entry => entry.manufacturer === 'Getinge / Maquet' && entry.model === avalonModel);
assert.strictEqual(avalonProducts.length, 7, 'Avalon must remain seven selectable catheter products.');
assert.strictEqual(avalonProducts.reduce((count, product) => count + product.pressureSeries.length, 0), 14);
const avalonCodes = new Set(avalonProductContracts.map(([, productCode]) => productCode));
const avalonAudit = require('../scripts/audit-cannula-pressure-data').auditDataset({ items: pressureDropData });
for (const [size, productCode, sapCode, outerDiameterMm, insertableLength, connectorSize] of avalonProductContracts) {
  const matches = avalonProducts.filter(entry => entry.cannulaOrderCode === productCode);
  assert.strictEqual(matches.length, 1, `${productCode} must appear once.`);
  const product = matches[0];
  assert.strictEqual(product.size, size);
  assert.strictEqual(product.sapCode, sapCode);
  assert.strictEqual(product.outerDiameterMm, outerDiameterMm);
  assert.strictEqual(product.insertableLength, insertableLength);
  assert.strictEqual(product.connectorSize, connectorSize);
  assert.strictEqual(product.orderUnit, '1/Carton');
  assert.strictEqual(product.metadata.orderUnit, '1/Carton');
  assert.strictEqual(product.metadata.productCode, productCode);
  assert.strictEqual(product.metadata.sapCode, sapCode);
  assert.strictEqual(product.testMedium, 'H2O at ambient temperature');
  assert.strictEqual(product.pressureSeries.length, 2, `${size} remains one product with two series.`);
  const infusion = product.pressureSeries.find(series => series.id === 'infusion');
  const drainage = product.pressureSeries.find(series => series.id === 'drainage');
  assert(infusion && drainage);
  assert.strictEqual(infusion.label, 'Infusion');
  assert.strictEqual(infusion.semanticType, 'infusion');
  assert.strictEqual(infusion.lineStyle, 'solid');
  assert.strictEqual(drainage.label, 'Drainage');
  assert.strictEqual(drainage.semanticType, 'drainage');
  assert.strictEqual(drainage.lineStyle, 'dashed');
  for (const series of [infusion, drainage]) {
    assert(series.points.length >= 2);
    assert.deepStrictEqual(series.points[0], { flow: 0, pressureDrop: 0 });
    series.points.forEach((point, index) => {
      assert(Math.abs(point.flow * 100 - Math.round(point.flow * 100)) < 1e-8);
      assert(Math.abs(point.pressureDrop * 10 - Math.round(point.pressureDrop * 10)) < 1e-8);
      if (index > 0) {
        assert(point.flow > series.points[index - 1].flow);
      }
    });
    const endpoint = series.points.at(-1).flow;
    assert.strictEqual(interpolatePressureDrop(series.points, endpoint).state, 'exact');
    assert.strictEqual(interpolatePressureDrop(series.points, endpoint + 0.01).state, 'out_of_range');
  }
  assert(product.digitizationNote.includes('manufacturer-published Avalon Elite pressure-drop-vs-flow graph'));
  assert(product.digitizationNote.includes(connectorSize === '1/4 in' ? '1/4-in connector graph' : '3/8-in connector graph'));
  assert(product.digitizationNote.includes('calibrated automatic WebPlotDigitizer extraction'));
  assert(product.digitizationNote.includes('H2O at ambient temperature'));
  assert(product.digitizationNote.includes('Infusion and Drainage were digitized separately'));
  assert(product.digitizationNote.includes('manufacturer sign convention'));
  assert(product.digitizationNote.includes('(0,0) source-origin anchor is retained'));
  assert(product.digitizationNote.includes('Only clear wrong-sign x-axis or anti-aliased pixels were removed'));
  assert(product.digitizationNote.includes('No fitted curve or smoothing'));
  assert(product.digitizationNote.includes('no extrapolation is made beyond any digitized series endpoint'));
}

// Hard-coded checks against the current manufacturer re-digitization protect every independent curve.
const avalonValueRegressions = [
  ['13 Fr', 'infusion', 0.52, 103.8, 0.535, 108.6],
  ['13 Fr', 'drainage', 0.70, -51.0, 0.745, -57.2],
  ['16 Fr', 'infusion', 0.78, 103.4, 0.80, 109.0],
  ['16 Fr', 'drainage', 1.07, -44.2, 1.12, -47.8],
  ['19 Fr', 'infusion', 1.08, 70.3, 1.125, 77.05],
  ['19 Fr', 'drainage', 1.24, -30.6, 1.285, -32.75],
  ['20 Fr', 'infusion', 1.25, 110.4, 1.28, 115.25],
  ['20 Fr', 'drainage', 1.55, -57.4, 1.59, -60.65],
  ['23 Fr', 'infusion', 1.87, 97.4, 1.91, 101.65],
  ['23 Fr', 'drainage', 2.02, -48.1, 2.11, -51.95],
  ['27 Fr', 'infusion', 2.43, 77.7, 2.52, 83.95],
  ['27 Fr', 'drainage', 2.63, -29.7, 2.715, -31.8],
  ['31 Fr', 'infusion', 3.15, 64.4, 3.24, 68.3],
  ['31 Fr', 'drainage', 2.92, -15.5, 3.01, -16.45]
];
assert.strictEqual(avalonValueRegressions.length, 14, 'Every Avalon pressure series must have value-level coverage.');
for (const [size, seriesId, exactFlow, exactPressure, interpolationFlow, expectedInterpolation] of avalonValueRegressions) {
  const product = avalonProducts.find(entry => entry.size === size);
  const series = product.pressureSeries.find(entry => entry.id === seriesId);
  assert(series, `${size} ${seriesId} series must exist for the value regression.`);
  assert(series.points.some(point => point.flow === exactFlow && point.pressureDrop === exactPressure),
    `${size} ${seriesId} must retain source point (${exactFlow}, ${exactPressure}).`);
  const exactResult = interpolatePressureDrop(series.points, exactFlow);
  assert.strictEqual(exactResult.state, 'exact');
  assert.strictEqual(exactResult.value, exactPressure);
  const interpolationResult = interpolatePressureDrop(series.points, interpolationFlow);
  assert.strictEqual(interpolationResult.state, 'interpolated', `${size} ${seriesId} must interpolate within range.`);
  assert(Math.abs(interpolationResult.value - expectedInterpolation) < 1e-8,
    `${size} ${seriesId} interpolation at ${interpolationFlow} L/min must remain ${expectedInterpolation} mmHg.`);
}

const avalonFindings = avalonAudit.findings.filter(finding => avalonCodes.has(finding.cannulaOrderCode));
assert(avalonFindings.every(finding => finding.rule === 'slope-whiplash'), 'Avalon findings should remain the documented slope-whiplash heuristic only.');
for (const finding of avalonFindings) {
  const product = avalonProducts.find(entry => entry.cannulaOrderCode === finding.cannulaOrderCode);
  const series = product.pressureSeries.find(item => item.label === finding.series);
  const sorted = [...series.points].sort((a, b) => a.flow - b.flow);
  const middleIndex = sorted.findIndex(point => point.flow === finding.flow);
  assert(middleIndex > 0 && middleIndex < sorted.length - 1);
  const left = sorted[middleIndex - 1], middle = sorted[middleIndex], right = sorted[middleIndex + 1];
  const expected = Math.abs(left.pressureDrop) +
    (Math.abs(right.pressureDrop) - Math.abs(left.pressureDrop)) *
    (middle.flow - left.flow) / (right.flow - left.flow);
  assert(Math.abs(Math.abs(middle.pressureDrop) - expected) < 3, 'Whiplash points should stay within the documented sub-3 mmHg local deviation.');
}
const avalon31Drainage = avalonProducts.find(entry => entry.cannulaOrderCode === '10031-CE').pressureSeries.find(series => series.id === 'drainage');
assert(!avalonAudit.findings.some(finding => finding.cannulaOrderCode === '10031-CE' && finding.series === 'Drainage' && finding.rule === 'local-reversal'));
// Execute the production renderer and assert the SVG behavior directly.
const chartRendererSource = mainJs.slice(
  mainJs.indexOf('const PRESSURE_DROP_PRODUCT_COLORS'),
  mainJs.indexOf('\nfunction getPressureDropProductFamily')
);
const chartRuntime = vm.runInNewContext(`${chartRendererSource}; ({
  drawPressureDropSeriesChart,
  drawPressureDropChart,
  getPressureDropLegendLayout,
  productColors: PRESSURE_DROP_PRODUCT_COLORS
})`, {
  getValidPressureDropPoints,
  buildPressureDropAxisTicks,
  formatPressureDropAxisTick: (value, range = 0) => {
    const decimals = Math.abs(range) > 0 && Math.abs(range) < 1 ? 2 : (Math.abs(range) < 10 ? 1 : 0);
    return value.toFixed(decimals).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
  },
  formatSignedPressureDrop: (value, decimals = 1) => {
    const roundedValue = Math.abs(value) < 0.5 * (10 ** -decimals) ? 0 : value;
    return `${roundedValue > 0 ? '+' : ''}${roundedValue.toFixed(decimals)}`;
  },
  Number, Math, String, Array
});
const renderedSvg = { dataset: {}, innerHTML: '' };
chartRuntime.drawPressureDropSeriesChart(renderedSvg, [
  { id: 'empty', label: 'Empty leading series', lineStyle: 'solid', points: [] },
  { id: 'drainage', label: 'Drainage', displayLabel: '23 Fr — Drainage', semanticType: 'drainage', lineStyle: 'dashed', colorIndex: 2, points: [
    { flow: 1, pressureDrop: -10 }, { flow: 2, pressureDrop: -20 }
  ] }
], 1.5, [{ state: 'no_points', value: NaN }, { state: 'interpolated', value: -15 }], { curveMode: 'linear' });
assert(renderedSvg.innerHTML.includes('23 Fr — Drainage; Target flow: 1.50 L/min; Signed pressure: -15.0 mmHg'), 'Rendered tooltip must preserve lumen identity and signed pressure.');
assert(!renderedSvg.innerHTML.includes('data-raw-pressure-point="true"'), 'Raw points must be hidden by default.');
assert(renderedSvg.innerHTML.includes('<path '), 'The renderer must output line paths.');
assert(renderedSvg.innerHTML.includes('data-series-id="drainage"'), 'Empty leading series must not shift estimate/marker association.');
assert(renderedSvg.innerHTML.includes('stroke-dasharray="7 4"'), 'Drainage path must remain dashed.');
assert(!renderedSvg.innerHTML.includes('Empty leading series; Target flow'), 'Empty series must not receive another series estimate.');
assert(renderedSvg.innerHTML.includes('Flow [L/min]') && renderedSvg.innerHTML.includes('Pressure drop [mmHg]'), 'Rendered axes must retain bracketed units.');
assert.strictEqual(new Set(Array.from(chartRuntime.productColors)).size, 4, 'Product indexes must map to distinct colors.');

const visibleRawPointsSvg = { dataset: {}, innerHTML: '' };
const visibleSeries = [
  { id: 'infusion', label: 'Infusion', displayLabel: '23 Fr — Infusion', lineStyle: 'solid', colorIndex: 0, points: [{ flow: 1, pressureDrop: 10 }, { flow: 2, pressureDrop: 20 }] },
  { id: 'drainage', label: 'Drainage', displayLabel: '23 Fr — Drainage', lineStyle: 'dashed', colorIndex: 0, points: [{ flow: 1, pressureDrop: -10 }, { flow: 2, pressureDrop: -20 }] }
];
chartRuntime.drawPressureDropSeriesChart(visibleRawPointsSvg, visibleSeries, 1.5, [{ value: 15 }, { value: -15 }], { curveMode: 'linear', showRawPoints: true });
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(/data-raw-pressure-point="true"/g) || []).length, 4, 'Raw-point toggle must render all source points.');
assert(visibleRawPointsSvg.innerHTML.includes('23 Fr — Infusion; Flow: 1.00 L/min; Signed pressure: +10.0 mmHg'));
assert(visibleRawPointsSvg.innerHTML.includes('23 Fr — Drainage; Flow: 1.00 L/min; Signed pressure: -10.0 mmHg'));
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(/data-series-id=/g) || []).length, 2, 'Both target-flow markers must render.');
assert(visibleRawPointsSvg.innerHTML.includes(' r="2"') && visibleRawPointsSvg.innerHTML.includes(' r="4"'), 'Raw markers must be smaller than target-flow markers.');
const firstProductColor = chartRuntime.productColors[0];
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(new RegExp(`<path[^>]+stroke="${firstProductColor}"`, 'g')) || []).length, 2, 'Both lumens of one product must share its product color.');
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(new RegExp(`data-series-id="(?:infusion|drainage)"[^>]+fill="${firstProductColor}"`, 'g')) || []).length, 2, 'Both target markers must share their product color.');
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(new RegExp(`data-raw-pressure-point="true"[^>]+stroke="${firstProductColor}"`, 'g')) || []).length, 4, 'Both raw-point groups must share their product color.');
assert(visibleRawPointsSvg.innerHTML.includes('23 Fr — Infusion') && visibleRawPointsSvg.innerHTML.includes('23 Fr — Drainage'), 'Legend labels must retain both lumen identities.');
const infusionPath = visibleRawPointsSvg.innerHTML.match(/23 Fr — Infusion pressure series"><path([^>]*)>/)?.[1];
const drainagePath = visibleRawPointsSvg.innerHTML.match(/23 Fr — Drainage pressure series"><path([^>]*)>/)?.[1];
assert(infusionPath && !infusionPath.includes('stroke-dasharray'), 'Infusion path must remain solid.');
assert(drainagePath && drainagePath.includes('stroke-dasharray="7 4"'), 'Drainage path must remain dashed.');

const legacySvg = { dataset: {}, innerHTML: '' };
chartRuntime.drawPressureDropChart(legacySvg, [{ flow: 1, pressureDrop: 10 }, { flow: 2, pressureDrop: 20 }], 1.5, 15, { curveMode: 'linear' });
assert(legacySvg.innerHTML.includes(`<path d="M`) && legacySvg.innerHTML.includes(`stroke="${firstProductColor}"`), 'Legacy single-series chart must retain the first product color.');

const comparedSeries = Array.from({ length: 4 }, (_, productIndex) => ([
  { id: `p${productIndex}-infusion`, label: `P${productIndex} Infusion`, colorIndex: productIndex, lineStyle: 'solid', points: [{ flow: 1, pressureDrop: 10 }, { flow: 2, pressureDrop: 20 }] },
  { id: `p${productIndex}-drainage`, label: `P${productIndex} Drainage`, colorIndex: productIndex, lineStyle: 'dashed', points: [{ flow: 1, pressureDrop: -10 }, { flow: 2, pressureDrop: -20 }] }
])).flat();
const comparisonColorSvg = { dataset: {}, innerHTML: '' };
chartRuntime.drawPressureDropSeriesChart(comparisonColorSvg, comparedSeries, 1.5, comparedSeries.map((_, index) => ({ value: index % 2 ? -15 : 15 })), { curveMode: 'linear' });
chartRuntime.productColors.forEach(color => {
  assert.strictEqual((comparisonColorSvg.innerHTML.match(new RegExp(`<path[^>]+stroke="${color}"`, 'g')) || []).length, 2, `Each compared product color ${color} must be shared by its two lumen paths.`);
});
assert.strictEqual(new Set(Array.from(chartRuntime.productColors)).size, 4, 'Compared products must retain distinct colors.');
[2, 4, 6, 8].forEach(entryCount => {
  const layout = chartRuntime.getPressureDropLegendLayout(entryCount);
  assert.strictEqual(layout.positions.length, entryCount);
  assert.strictEqual(new Set(Array.from(layout.positions, position => `${position.x},${position.y}`)).size, entryCount, `${entryCount} legend entries must have unique positions.`);
  assert(layout.topPadding > Math.max(...Array.from(layout.positions, position => position.y)), `${entryCount} entries must be above the dynamically padded plot.`);
});

const normalizeSeriesSource = mainJs.slice(mainJs.indexOf('function normalizePressureDropSeries'), mainJs.indexOf('function normalizePressureDropEntry'));
const normalizePressureDropSeriesRuntime = vm.runInNewContext(`${normalizeSeriesSource}; normalizePressureDropSeries`);
const identicalDuplicates = normalizePressureDropSeriesRuntime({ points: [
  { flow: 1, pressureDrop: 10 },
  { flow: 1, pressureDrop: 10 }
] });
assert.strictEqual(identicalDuplicates.points.length, 1);
assert.throws(
  () => normalizePressureDropSeriesRuntime({ points: [{ flow: 1, pressureDrop: 10 }, { flow: 1, pressureDrop: 11 }] }),
  /conflicting pressures/
);
console.log('Avalon Elite product, pressure-series, and QC invariants passed.');

// Phase 1: execute the production classifier, interpolation, selection controller
// and SVG renderer together. Existing Avalon value/rendering coverage stays above.
function pressureProductionFunction(name) {
  const start = mainJs.indexOf(`function ${name}(`);
  assert(start >= 0, `Production function ${name} must exist`);
  const nextDeclaration = /\n(?:function |async function |const |let )/g;
  nextDeclaration.lastIndex = start + 1;
  const next = nextDeclaration.exec(mainJs)?.index;
  return mainJs.slice(start, next ?? mainJs.length);
}
class PressureTestNode {
  constructor(tagName = 'div') {
    this.tagName = tagName; this.children = []; this.dataset = {}; this.style = {};
    this.attributes = {}; this.listeners = {}; this.value = ''; this.className = '';
    this.classList = {
      contains: name => this.className.split(' ').includes(name),
      add: (...names) => { this.className += ` ${names.join(' ')}`; },
      toggle: (name, on) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        if (on) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      }
    };
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); return node; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  dispatch(name, event = {}) { this.listeners[name]?.({ key: '', preventDefault() {}, ...event }); }
  dispatchEvent(event) { this.dispatch(event.type, event); }
  focus() { targetTestDocument.activeElement = this; }
  getBoundingClientRect() { return { left: 0, width: 420 }; }
  querySelectorAll(selector) {
    if (selector === '[data-product-key]') return pressureDescendants(this, node => Boolean(node.dataset.productKey));
    assert.strictEqual(selector, 'input[type="checkbox"]');
    return pressureDescendants(this, node => node.type === 'checkbox');
  }
  set innerHTML(value) { this.children = []; this.html = value; this.text = ''; }
  get innerHTML() { return this.html || ''; }
  set textContent(value) { this.children = []; this.text = String(value); }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(' '); }
}
function pressureDescendants(node, predicate) {
  return node.children.flatMap(child => [ ...(predicate(child) ? [child] : []), ...pressureDescendants(child, predicate) ]);
}
const targetNodes = Object.fromEntries(['view', 'flow', 'category', 'location', 'manufacturer', 'model', 'sort', 'results', 'summary', 'chart', 'location-note']
  .map(name => [`pressure-drop-target-${name}`, new PressureTestNode()]));
targetNodes['pressure-drop-catalog-search'] = new PressureTestNode('input');
targetNodes['pressure-drop-catalog-matches'] = new PressureTestNode();
targetNodes['pressure-drop-target-category'].value = 'arterial';
targetNodes['pressure-drop-target-sort'].value = 'pressure';
const targetTestDocument = {
  createElement: tag => new PressureTestNode(tag),
  createElementNS: (_, tag) => new PressureTestNode(tag),
  createTextNode: text => { const node = new PressureTestNode('#text'); node.textContent = text; return node; }
};
const targetFunctionNames = [
  'normalizePressureDropFilterLabel', 'getPressureDropGroupLabel', 'getPressureDropCategoryFilterValue',
  'getPressureDropConnectionOptionValue', 'shouldApplyPressureDropHighWarning',
  'getPressureDropComparisonResult', 'hasValidPressureDropEstimate', 'isPressureDropAnalyticsReady',
  'parsePressureDropFlowInput', 'getPressureDropResultStateText', 'getPressureDropResultValueText',
  'formatPressureDropFlowValue', 'getPressureDropRangeText', 'formatSignedPressureDrop',
  'buildPressureDropAxisTicks', 'formatPressureDropAxisTick', 'getPressureDropSourceNode', 'getPressureDropProductFamily',
  'getUniquePressureDropOptionPairs', 'setPressureDropSelectOptionPairs', 'createPressureDropRawPointsToggle'
];
const targetRuntime = vm.runInNewContext([
  mainJs.slice(mainJs.indexOf('function normalizePressureDropKey'), mainJs.indexOf('function fitPressureDropPowerLaw')),
  chartRendererSource,
  ...targetFunctionNames.map(pressureProductionFunction),
  mainJs.slice(mainJs.indexOf('const PRESSURE_DROP_CENTRAL_VENOUS_SKUS'), mainJs.indexOf('async function initCannulaPressureDropPage')),
  `; ({ classifyPressureDropComparisonEntry, getPressureDropTargetFlowKey, getPressureDropTargetFlowMatches,
    parsePressureDropTargetFlow, getPressureDropTargetFlowResult, getPressureDropTargetFlowRows,
    getPressureDropComparisonFr, getPressureDropComparisonSizeLabel, updatePressureDropTargetFlowSelection, createPressureDropTargetFlowChart,
    getPressureDropTargetFlowIdentity, getPressureDropTargetFlowSeries, getPressureDropTargetFlowModelOptions, createPressureDropTargetFlowTable,
    initPressureDropTargetFlowComparison, isPressureDropAnalyticsReady, drawPressureDropSeriesChart,
    searchPressureDropCatalog, getPressureDropExploredFlow, getPressureDropManufacturerFlowLimit,
    getPressureDropManufacturerLimitLabel })`
].join('\n'), {
  document: targetTestDocument,
  el: id => targetNodes[id], isElementVisible: node => Boolean(node && !node.classList.contains('hidden')),
  createPressureDropSearchableSelect: () => ({ refresh: () => {} }),
  Event: class { constructor(type) { this.type = type; } }
});
const classifyComparison = targetRuntime.classifyPressureDropComparisonEntry;
const classificationCounts = {};
pressureDropData.forEach(entry => {
  const classification = classifyComparison(entry);
  const group = `${classification.category}/${classification.location}`;
  classificationCounts[group] = (classificationCounts[group] || 0) + 1;
});
assert.strictEqual(Object.values(classificationCounts).reduce((sum, count) => sum + count, 0), pressureDropData.length);
assert.strictEqual(classificationCounts['venous/jugular'],
  pressureDropData.filter(entry => entry.category === 'jugular venous').length);
const pediatricClassification = targetRuntime.classifyPressureDropComparisonEntry(pediatric8);
assert.strictEqual(pediatricClassification.eligible, true);
assert.strictEqual(pediatricClassification.category, 'arterial');
assert.strictEqual(pediatricClassification.location, 'femoral');
assert(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial', location: 'femoral' }).includes(pediatric8));
assert(!targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous' }).includes(pediatric8));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, '8Fr Medtronic').includes(pediatric8));
const pediatric12Classification = targetRuntime.classifyPressureDropComparisonEntry(pediatric12);
assert.strictEqual(pediatric12Classification.eligible, true);
assert.strictEqual(pediatric12Classification.category, 'arterial');
assert.strictEqual(pediatric12Classification.location, 'femoral');
assert(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial', location: 'femoral' }).includes(pediatric12));
assert(!targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous' }).includes(pediatric12));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, '12Fr Medtronic').includes(pediatric12));
const pediatric10Classification = targetRuntime.classifyPressureDropComparisonEntry(pediatric10);
assert.strictEqual(pediatric10Classification.eligible, true);
assert.strictEqual(pediatric10Classification.category, 'arterial');
assert.strictEqual(pediatric10Classification.location, 'femoral');
assert(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial', location: 'femoral' }).includes(pediatric10));
assert(!targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous' }).includes(pediatric10));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, '10Fr Medtronic').includes(pediatric10));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, '96820-110').includes(pediatric10));

const documentedCentralVenousModels = {
  LivaNova: [
    'Single Stage Right Angle Lighthouse Tip Venous Return Cannulae — Right Angle Lighthouse Tip, Wire-reinforced Tubing',
    'Dual Stage Venous Return Cannulae — Wire-reinforced Tubing',
    'Triple Stage Venous Return — Wire-reinforced Tubing'
  ],
  Medtronic: [
    'DLP Single Stage Venous Cannulae', 'DLP Malleable Single Stage Venous Cannulae',
    'DLP Right Angle Single Stage Venous Cannulae',
    'DLP Single Stage Venous Cannulae with Right Angle Metal Tip'
  ]
};
const operationalCentralVenousSkus = new Set(['V122-24', 'V122-28', 'V122-32', 'V122-34', 'V122-36',
  'V900-01', 'V900-02', 'V152-32', 'V152-36']);
const newlyFemoralSkus = new Set(['PVS 1938', 'PVS 2138', 'PVS 2338', 'PVS 2538']);
const documentedCentralVenous = pressureDropData.filter(entry =>
  documentedCentralVenousModels[entry.manufacturer]?.includes(entry.model) ||
    (entry.manufacturer === 'LivaNova' && operationalCentralVenousSkus.has(entry.cannulaOrderCode)));
const centralVenous = targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous', location: 'central' });
assert(documentedCentralVenous.length > 0);
assert.deepStrictEqual(new Set(centralVenous), new Set(documentedCentralVenous), 'Only documented central families enter the Central filter');
assert.strictEqual(new Set(centralVenous.map(targetRuntime.getPressureDropTargetFlowKey)).size, centralVenous.length, 'A documented family is never duplicated');
for (const [manufacturer, models] of Object.entries(documentedCentralVenousModels)) {
  for (const model of models) {
    const family = pressureDropData.filter(entry => entry.manufacturer === manufacturer && entry.model === model);
    assert(family.length > 0 && family.every(entry => centralVenous.includes(entry)), `Documented central family ${model}`);
  }
}
assert(centralVenous.some(entry => entry.cannulaOrderCode === 'RV-41026'), 'Right-angle lighthouse SVC/IVC family');
assert(centralVenous.some(entry => entry.cannulaOrderCode === '66124'), 'Straight DLP SVC/IVC family');
assert.strictEqual(classifyComparison({ ...centralVenous.find(entry => entry.cannulaOrderCode === '66124'),
  category: 'femoral venous', connectionSite: 'Femoral venous' }).location, 'femoral',
  'A SKU with explicit femoral access would override the family mapping');
assert.strictEqual(classifyComparison({ ...centralVenous.find(entry => entry.cannulaOrderCode === 'V122-24'),
  category: 'femoral venous', connectionSite: 'Femoral venous' }).location, 'femoral',
  'Explicit femoral metadata overrides the operational central SKU mapping');
assert(centralVenous.some(entry => entry.cannulaOrderCode?.includes('RDS-61137')), 'Dual-stage RA/caval family');
assert(centralVenous.some(entry => entry.cannulaOrderCode?.includes('RTS-11029')), 'Triple-stage RA/caval family');
const femoralOnly = pressureDropData.filter(entry => /Femoral/i.test(entry.model));
assert(femoralOnly.length > 0 && femoralOnly.every(entry => !centralVenous.includes(entry)));
assert(avalonProducts.every(entry => !centralVenous.includes(entry) && classifyComparison(entry).location === 'jugular'));
const unspecifiedVenous = targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous', location: 'other' });
assert.strictEqual(unspecifiedVenous.length, 0, 'All non-femoral conventional venous cannulas are classified as Central.');
assert([...operationalCentralVenousSkus].every(code => centralVenous.some(entry => entry.cannulaOrderCode === code)));
assert([...operationalCentralVenousSkus].every(code => !unspecifiedVenous.some(entry => entry.cannulaOrderCode === code)));
const femoralVenous = targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous', location: 'femoral' });
assert([...newlyFemoralSkus].every(code => femoralVenous.some(entry => entry.cannulaOrderCode === code)));
assert([...newlyFemoralSkus].every(code => !centralVenous.some(entry => entry.cannulaOrderCode === code)));
assert(unspecifiedVenous.every(entry => !centralVenous.includes(entry)));
const centralAtFour = targetRuntime.getPressureDropTargetFlowRows(pressureDropData, { category: 'venous', location: 'central' }, 4);
assert.strictEqual(centralAtFour.length, centralVenous.length);
assert(centralAtFour.some(row => row.result.inRange) && centralAtFour.some(row => row.result.interpolationResult.state === 'out_of_range'));
assert.strictEqual(targetRuntime.getPressureDropTargetFlowRows(pressureDropData, { category: 'venous', location: 'central' }, 1000).length, centralVenous.length,
  'Out-of-range curves remain anatomically eligible');
assert(pressureDropData.filter(entry => classifyComparison(entry).category === 'specialty')
  .every(entry => /cardioplegia|aortic root/i.test(entry.category)));
assert(avalonProducts.every(entry => classifyComparison(entry).eligible && classifyComparison(entry).category === 'venous' && classifyComparison(entry).location === 'jugular' && classifyComparison(entry).configuration === 'Dual-lumen VV ECMO'));
assert.strictEqual(classifyComparison({ category: 'arterial cardioplegia', model: 'Ambiguous' }).eligible, false);
assert.strictEqual(classifyComparison({ category: 'arterial', model: 'EOPA Central', connectionSite: '1/4 in' }).location, 'other');
const verifiedCentralModels = ['EOPA 3D Arterial Cannulae', 'Select 3D II Arterial Cannulae'];
const eopaEntries = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' && /EOPA/.test(entry.model));
assert.strictEqual(eopaEntries.length, 6);
assert.strictEqual(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial', location: 'central', manufacturer: 'Medtronic' })
  .filter(entry => verifiedCentralModels.includes(entry.model)).length, 5);
assert(eopaEntries.every(entry => classifyComparison(entry).eligible));
assert(eopaEntries.filter(entry => /3D/.test(entry.model)).every(entry => classifyComparison(entry).location === 'central'));
assert(eopaEntries.filter(entry => !/3D/.test(entry.model)).every(entry => classifyComparison(entry).location === 'other'));
assert(eopaEntries.filter(entry => !/3D/.test(entry.model)).every(entry => targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial', location: 'other' }).includes(entry)));
assert(eopaEntries.filter(entry => !/3D/.test(entry.model)).every(entry => !targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial', location: 'central' }).includes(entry)), 'Undocumented sites must not be presented as central');
assert.strictEqual(classifyComparison({ category: 'venous', model: 'Bi-caval' }).location, 'other');
assert.strictEqual(classifyComparison({ category: 'venous', connectionSite: 'Right atrium' }).location, 'central');
assert.strictEqual(classifyComparison({ category: 'femoral arterial' }).location, 'femoral');
assert.strictEqual(classifyComparison({ category: 'femoral venous' }).location, 'femoral');
assert.strictEqual(classifyComparison({ category: 'jugular venous' }).location, 'jugular');
assert.strictEqual(classifyComparison({ category: 'arterial', connectionSite: '3/8 in' }).location, 'other');
for (const model of verifiedCentralModels) {
  const family = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' && entry.model === model);
  assert(family.length > 0 && family.every(entry => classifyComparison(entry).location === 'central'));
}
assert(pressureDropData.filter(entry => entry.model === 'Select Series Angled Tip Arterial Cannulae')
  .every(entry => classifyComparison(entry).location === 'other'));
assert.strictEqual(classifyComparison({ category: 'femoral venous', connectionSite: 'Jugular venous' }).location, 'jugular', 'Explicit anatomical site takes precedence');
assert.strictEqual(classifyComparison({ category: 'arterial', connectionSite: 'Femoral venous' }).eligible, false, 'Conflicting type/site metadata is ambiguous');
assert.strictEqual(classifyComparison({ category: 'arterial', connectionSite: 'Aortic root' }).eligible, false);
assert.strictEqual(new Set(pressureDropData.map(targetRuntime.getPressureDropTargetFlowKey)).size, 192);
const aorticArch24 = pressureDropData.filter(entry => entry.manufacturer === 'LivaNova' &&
  entry.size === '24 Fr' && entry.model.startsWith('Aortic Arch Cannulae —'));
assert.strictEqual(aorticArch24.length, 2);
assert.notStrictEqual(targetRuntime.getPressureDropTargetFlowModelOptions(aorticArch24)[0].label,
  targetRuntime.getPressureDropTargetFlowModelOptions(aorticArch24)[1].label,
  'Straight and curved aortic-arch cannulas must be visually distinguishable');
const catalogEntry = pressureDropData[0];
assert.strictEqual(targetRuntime.getPressureDropTargetFlowKey(catalogEntry), targetRuntime.getPressureDropTargetFlowKey({ ...catalogEntry, lookupId: 'reordered' }));

for (const input of ['', '.', '0', '-1', 'NaN', 'Infinity', '1e309', '4.5junk', '1.2.3']) {
  assert(Number.isNaN(targetRuntime.parsePressureDropTargetFlow(input)), `${input} must not yield a usable flow`);
}
assert.strictEqual(targetRuntime.parsePressureDropTargetFlow('4,5'), 4.5);
assert.strictEqual(targetRuntime.parsePressureDropTargetFlow('100000'), 100000, 'No arbitrary clinical maximum');
const maxFlowEntry = pressureDropData.find(entry => entry.manufacturer === 'LivaNova' &&
  entry.model.startsWith('Optiflow Aortic Arch Cannulae — Straight Tip') && entry.size === '24 Fr');
assert(maxFlowEntry && maxFlowEntry.points.at(-1).flow === 9, 'The digitized curve retains its 9 L/min endpoint');
assert.strictEqual(targetRuntime.getPressureDropManufacturerFlowLimit(maxFlowEntry, 8)?.aboveVerifiedLimit, false);
const aboveVerified = targetRuntime.getPressureDropManufacturerFlowLimit(maxFlowEntry, 8.3);
assert.strictEqual(aboveVerified?.maxFlowLMin, 8);
assert.strictEqual(aboveVerified?.verifiedSku, 'A292-80C');
assert.strictEqual(aboveVerified?.partialSkuCoverage, true, 'Other connector variants must not be inferred');
assert.strictEqual(aboveVerified?.aboveVerifiedLimit, true);
assert(targetRuntime.getPressureDropManufacturerLimitLabel(aboveVerified).includes('other variants unverified'));
assert.strictEqual(targetRuntime.getPressureDropManufacturerFlowLimit(pressureDropData[0], 100), null,
  'Unknown manufacturer limits must remain unknown');
const maxFlowResult = targetRuntime.getPressureDropTargetFlowResult(maxFlowEntry, 8.3);
assert(maxFlowResult.inRange && maxFlowResult.aboveVerifiedManufacturerMax);
assert(Math.abs(maxFlowResult.magnitude - 41.8) < 0.1, 'Existing interpolation is unchanged');
const compactLimited = targetRuntime.createPressureDropTargetFlowTable([{
  entry: maxFlowEntry, key: targetRuntime.getPressureDropTargetFlowKey(maxFlowEntry),
  identity: maxFlowEntry.size, result: maxFlowResult
}], [], () => {});
assert(/LivaNova\s*·\s*24 Fr/.test(compactLimited.textContent),
  'Compact rows retain manufacturer and size without overwriting the manufacturer label');
assert(compactLimited.textContent.includes('⚠ Flow caution') && compactLimited.textContent.includes('A292-80C'),
  'Compact status stays concise while SKU-specific flow evidence remains in details');
const compactLimitedDetails = pressureDescendants(compactLimited, node => node.tagName === 'details');
assert.strictEqual(compactLimitedDetails.length, 1);
assert(!compactLimitedDetails[0].open, 'Manufacturer evidence is collapsed by default');
assert.strictEqual(targetRuntime.getPressureDropTargetFlowResult(maxFlowEntry, 9.1).interpolationResult.state, 'out_of_range');
const targetFixtures = [
  { manufacturer: 'Medtronic', model: 'A', category: 'femoral arterial', size: '19 Fr', points: [{ flow: 1, pressureDrop: 10 }, { flow: 5, pressureDrop: 90 }] },
  { manufacturer: 'Getinge / Maquet', model: 'B', category: 'femoral arterial', size: '21 Fr', points: [{ flow: 0, pressureDrop: 0 }, { flow: 5, pressureDrop: 50 }] },
  { manufacturer: 'LivaNova', model: 'C', category: 'femoral arterial', size: '15 Fr', points: [{ flow: 0, pressureDrop: 0 }, { flow: 4, pressureDrop: 70 }] },
  { manufacturer: 'Medtronic', model: 'D', category: 'venous', size: '23 Fr', points: [{ flow: 1, pressureDrop: -10 }, { flow: 5, pressureDrop: -90 }] }
];
const arterialFilters = { category: 'arterial', location: 'femoral' };
const fixtureRows = targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 4.5);
assert.deepStrictEqual(Array.from(fixtureRows, row => row.entry.manufacturer), ['Getinge / Maquet', 'Medtronic', 'LivaNova']);
assert.strictEqual(fixtureRows[0].result.interpolationResult.value, 45);
assert.strictEqual(fixtureRows[1].result.interpolationResult.value, 80);
assert.strictEqual(fixtureRows[2].result.interpolationResult.state, 'out_of_range');
assert.strictEqual(fixtureRows[2].result.magnitude, null, 'Out-of-range products get no substituted endpoint');
for (const [entry, flow, expectedStatus] of [
  [targetFixtures[0], NaN, 'Enter a positive target flow'],
  [{ ...targetFixtures[0], points: [] }, 3, 'No digitized curve'],
  [targetFixtures[0], 6, 'Out of range'],
  [targetFixtures[0], 1, 'Exact source point'],
  [targetFixtures[0], 3, 'Interpolated']
]) {
  const table = targetRuntime.createPressureDropTargetFlowTable([{
    entry, key: targetRuntime.getPressureDropTargetFlowKey(entry), identity: entry.size,
    result: targetRuntime.getPressureDropTargetFlowResult(entry, flow)
  }], [], () => {});
  const details = pressureDescendants(table, node => node.tagName === 'details')[0];
  const sourceStatus = pressureDescendants(details, node => node.tagName === 'p' && node.textContent.startsWith('Source range:'))[0];
  assert(sourceStatus.textContent.endsWith(` · ${expectedStatus}`),
    `Expanded Details must distinguish ${expectedStatus} from a range violation.`);
}
for (const [flow, expected] of [[1, 10], [5, 90]]) {
  const result = targetRuntime.getPressureDropTargetFlowResult(targetFixtures[0], flow);
  assert.strictEqual(result.interpolationResult.state, 'exact'); assert.strictEqual(result.magnitude, expected);
}
for (const flow of [0.99, 5.01]) assert.strictEqual(targetRuntime.getPressureDropTargetFlowResult(targetFixtures[0], flow).inRange, false);
const signedResult = targetRuntime.getPressureDropTargetFlowResult(targetFixtures[3], 4.5);
assert.strictEqual(signedResult.interpolationResult.value, -80); assert.strictEqual(signedResult.magnitude, 80);
const highArterial = { ...targetFixtures[0], model: 'High arterial source', points: [{ flow: 1, pressureDrop: 20 }, { flow: 5, pressureDrop: 120 }] };
const highResult = targetRuntime.getPressureDropTargetFlowResult(highArterial, 5);
assert.strictEqual(highResult.isHighPressure, true);
assert(highResult.warningText.includes('High pressure drop warning (>100 mmHg).'));
const lowerResult = targetRuntime.getPressureDropTargetFlowResult(highArterial, 4);
assert.strictEqual(lowerResult.isHighPressure, false);
const venousHighMagnitude = { ...highArterial, category: 'venous', points: [{ flow: 1, pressureDrop: -20 }, { flow: 5, pressureDrop: -120 }] };
assert.strictEqual(targetRuntime.getPressureDropTargetFlowResult(venousHighMagnitude, 5).isHighPressure, false);
const outOfRangeHigh = targetRuntime.getPressureDropTargetFlowResult(highArterial, 6);
assert.strictEqual(outOfRangeHigh.isHighPressure, false);
assert.strictEqual(outOfRangeHigh.magnitude, null);
const interpolatedHigh = targetRuntime.getPressureDropTargetFlowResult(highArterial, 4.5);
assert.strictEqual(interpolatedHigh.interpolationResult.state, 'interpolated');
assert.strictEqual(interpolatedHigh.isHighPressure, true);
const highOutOfRangeRows = pressureDescendants(targetRuntime.createPressureDropTargetFlowTable([{ entry: highArterial, key: 'high-out', identity: '19 Fr', result: outOfRangeHigh }], [], () => {}), node => node.tagName === 'tr');
assert(!pressureDescendants(highOutOfRangeRows[0], node => node.className.includes('text-amber-700')).length, 'Out-of-range values never get high-pressure emphasis');
const warningRows = [highArterial, venousHighMagnitude].map(entry => ({
  entry, key: targetRuntime.getPressureDropTargetFlowKey(entry), identity: entry.size,
  result: targetRuntime.getPressureDropTargetFlowResult(entry, 5)
}));
const warningTableRows = pressureDescendants(targetRuntime.createPressureDropTargetFlowTable(warningRows, [], () => {}), node => node.tagName === 'tr');
assert(!warningTableRows[0].textContent.includes('High pressure drop warning'), 'High arterial pressure uses color rather than a warning paragraph');
assert(pressureDescendants(warningTableRows[0], node => node.attributes['aria-label']?.includes('High pressure drop warning')).length, 'Warning remains available to assistive technology');
assert(!warningTableRows[1].textContent.includes('High pressure drop warning'), 'Venous results retain their own semantics');
assert.deepStrictEqual(Array.from(targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 3, 'size'), row => row.entry.size), ['15 Fr', '19 Fr', '21 Fr']);
const fullFemoralSizeSort = targetRuntime.getPressureDropTargetFlowRows(pressureDropData, arterialFilters, 4.5, 'size');
assert(fullFemoralSizeSort.every((row, index) => !index || targetRuntime.getPressureDropComparisonFr(fullFemoralSizeSort[index - 1].entry) <=
  targetRuntime.getPressureDropComparisonFr(row.entry)), 'Size ascending must be globally ordered, including Out of range entries.');
assert.deepStrictEqual(Array.from(targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 3, 'manufacturer'), row => row.entry.manufacturer), ['Getinge / Maquet', 'LivaNova', 'Medtronic']);
assert.deepStrictEqual(Array.from(targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 3, 'model'), row => row.entry.model), ['A', 'B', 'C']);
const actualFemoralRows = targetRuntime.getPressureDropTargetFlowRows(pressureDropData, arterialFilters, 4.5);
assert.strictEqual(actualFemoralRows.length, 27);
assert.strictEqual(new Set(Array.from(actualFemoralRows, row => row.entry.manufacturer)).size, 3);
const filteredFamily = targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { ...arterialFilters, manufacturer: 'Medtronic', model: nextGenModels[0] });
assert.strictEqual(filteredFamily.length, 6);
assert.strictEqual(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { ...arterialFilters, manufacturer: 'LivaNova', model: nextGenModels[0] }).length, 0);

// All seven real Avalon SKUs retain both original series, but target-flow uses Drainage only.
const targetAvalonCodes = new Set(avalonProducts.map(entry => entry.cannulaOrderCode));
assert.strictEqual(targetAvalonCodes.size, 7);
const avalonRows = targetRuntime.getPressureDropTargetFlowRows(pressureDropData,
  { category: 'venous', location: 'jugular', manufacturer: 'Getinge / Maquet', model: avalonModel }, 1);
assert.strictEqual(avalonRows.length, 7);
for (const row of avalonRows) {
  const original = row.entry.pressureSeries;
  assert.deepStrictEqual(original.map(series => series.id), ['infusion', 'drainage']);
  assert.strictEqual(targetRuntime.getPressureDropTargetFlowSeries(row.entry), original[1]);
  assert.strictEqual(row.result.series, original[1]);
  assert.strictEqual(row.result.lumenLabel, 'Drainage ΔP');
  assert.strictEqual(row.result.interpolationResult.value,
    interpolatePressureDrop(original[1].points, 1).value);
  assert.notStrictEqual(row.result.interpolationResult.value,
    interpolatePressureDrop(original[0].points, 1).value);
  assert(targetAvalonCodes.has(row.entry.cannulaOrderCode));
}
assert.strictEqual(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'arterial' })
  .filter(entry => avalonProducts.includes(entry)).length, 0);
for (const location of ['central', 'femoral']) {
  assert.strictEqual(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous', location })
    .filter(entry => avalonProducts.includes(entry)).length, 0);
}
assert.strictEqual(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous' })
  .filter(entry => avalonProducts.includes(entry)).length, 7);
const ambiguousAvalon = { ...avalonProducts[0], pressureSeries: [avalonProducts[0].pressureSeries[0]] };
assert.strictEqual(targetRuntime.getPressureDropTargetFlowSeries(ambiguousAvalon), null);
assert.strictEqual(targetRuntime.getPressureDropTargetFlowResult(ambiguousAvalon, 1).unavailableReason, 'Drainage series not identified');
const mislabeledAvalon = { ...avalonProducts[0], pressureSeries: avalonProducts[0].pressureSeries.map(series =>
  series.id === 'drainage' ? { ...series, semanticType: 'infusion' } : series) };
assert.strictEqual(targetRuntime.getPressureDropTargetFlowSeries(mislabeledAvalon), null);
const reorderedAvalon = { ...avalonProducts[0], pressureSeries: [...avalonProducts[0].pressureSeries].reverse() };
assert.strictEqual(targetRuntime.getPressureDropTargetFlowSeries(reorderedAvalon).id, 'drainage');
const unavailableRow = { entry: ambiguousAvalon, key: 'ambiguous', identity: ambiguousAvalon.size,
  result: targetRuntime.getPressureDropTargetFlowResult(ambiguousAvalon, 1) };
const unavailableTable = targetRuntime.createPressureDropTargetFlowTable([unavailableRow], [], () => {});
assert(unavailableTable.textContent.includes('Not comparable') && unavailableTable.textContent.includes('Drainage series not identified'));
const unavailableChart = targetRuntime.createPressureDropTargetFlowChart([ambiguousAvalon], 1, false, () => {}, () => {});
assert(unavailableChart.textContent.includes('Drainage series not identified'));
assert(!pressureDescendants(unavailableChart, node => node.tagName === 'svg')[0].innerHTML.includes('Infusion'));
const outsideAvalon = targetRuntime.getPressureDropTargetFlowResult(avalonProducts[0], 100);
assert.strictEqual(outsideAvalon.interpolationResult.state, 'out_of_range');
assert.strictEqual(outsideAvalon.magnitude, null);
const avalonTable = targetRuntime.createPressureDropTargetFlowTable(avalonRows.slice(0, 1), [], () => {});
assert(avalonTable.textContent.includes('Dual-lumen VV ECMO'));
assert(pressureDescendants(avalonTable, node => node.attributes['aria-label']?.includes('Drainage ΔP')).length);
const avalonChart = targetRuntime.createPressureDropTargetFlowChart([avalonProducts[0]], 1, false, () => {}, () => {}, pressureDropData);
assert(avalonChart.textContent.includes('Drainage') && avalonChart.textContent.includes('Dual-lumen VV ECMO'));
assert(!pressureDescendants(avalonChart, node => node.tagName === 'svg')[0].innerHTML.includes('Infusion'));
const modelOptions = targetRuntime.getPressureDropTargetFlowModelOptions(pressureDropData.filter(entry => entry.manufacturer === 'Getinge / Maquet'));
assert(modelOptions.some(option => option.value === avalonModel && option.label === 'Avalon Elite · Dual-lumen ECMO'));
const collisionOptions = targetRuntime.getPressureDropTargetFlowModelOptions([
  { manufacturer: 'LivaNova', model: 'Same Family — Curved Tip, Wire-reinforced Tubing' },
  { manufacturer: 'LivaNova', model: 'Same Family — Straight Tip, Wire-reinforced Tubing' }
]);
assert.strictEqual(new Set(collisionOptions.map(option => option.value)).size, 2);
assert.strictEqual(new Set(collisionOptions.map(option => option.label)).size, 2, 'Short labels must not merge distinct models');

const dlpModel = 'DLP Single Stage Venous Cannulae with Right Angle Metal Tip';
const dlpVariants = pressureDropData.filter(entry => entry.manufacturer === 'Medtronic' && entry.model === dlpModel && entry.size === '18 Fr / 6.0 mm');
assert.deepStrictEqual(new Set(dlpVariants.map(entry => entry.cannulaOrderCode)), new Set(['69318', '67318']));
const dlpRows = targetRuntime.getPressureDropTargetFlowRows(pressureDropData, { category: 'venous', manufacturer: 'Medtronic', model: dlpModel }, 2)
  .filter(row => dlpVariants.includes(row.entry));
assert.strictEqual(dlpRows.length, 2);
assert.notStrictEqual(dlpRows[0].key, dlpRows[1].key, 'Variants must retain separate stable selection keys');
for (const row of dlpRows) {
  assert(row.identity.includes(row.entry.cannulaOrderCode));
  assert(row.identity.includes(row.entry.connectorSize));
}
let variantSelection = [];
for (const row of dlpRows) variantSelection = targetRuntime.updatePressureDropTargetFlowSelection(variantSelection, row.key, true, new Set(dlpRows.map(item => item.key)));
assert.strictEqual(variantSelection.length, 2);
const dlpTableRows = pressureDescendants(targetRuntime.createPressureDropTargetFlowTable(dlpRows, variantSelection, () => {}), node => node.tagName === 'tr');
for (const [index, row] of dlpRows.entries()) {
  assert(dlpTableRows[index].textContent.includes(row.entry.cannulaOrderCode), 'Desktop table and mobile card show catalog code');
  assert(dlpTableRows[index].textContent.includes(row.entry.connectorSize), 'Desktop table and mobile card show connector');
  assert(rowCheckbox(dlpTableRows[index]).attributes['aria-label'].includes(row.entry.cannulaOrderCode));
}
const dlpOverlay = targetRuntime.createPressureDropTargetFlowChart(dlpVariants, 2, false, () => {}, () => {}, pressureDropData);
const dlpSvg = pressureDescendants(dlpOverlay, node => node.tagName === 'svg')[0];
assert.strictEqual((dlpSvg.innerHTML.match(/data-series-id=/g) || []).length, 2);
for (const variant of dlpVariants) {
  assert(dlpOverlay.textContent.includes(variant.cannulaOrderCode) && dlpOverlay.textContent.includes(variant.connectorSize), 'External legend identifies variant');
  assert(dlpSvg.innerHTML.includes(variant.cannulaOrderCode), 'SVG tooltip identifies variant');
  assert(pressureDescendants(dlpOverlay, node => node.tagName === 'button').some(node => node.attributes['aria-label']?.includes(variant.cannulaOrderCode)), 'Removal control identifies variant');
}
const rap = pressureDropData.find(entry => /RAP FV/.test(entry.model) && /23 Fr distal \/ 25 Fr proximal/.test(entry.size));
assert(rap, 'Real RAP catalog size remains available');
const rapRow = targetRuntime.getPressureDropTargetFlowRows([rap], { category: 'venous' }, 2)[0];
const rapTable = targetRuntime.createPressureDropTargetFlowTable([rapRow], [], () => {});
const compactRows = pressureDescendants(rapTable, node => node.tagName === 'tr');
assert.strictEqual(compactRows.length, 1);
assert(pressureDescendants(compactRows[0], node => node.className.includes('grid-cols-')).length === 1,
  'The card uses one responsive summary grid with full-width expandable details.');
assert(pressureDescendants(compactRows[0], node => node.tagName === 'td').length === 1,
  'Desktop details must not be confined to a narrow rightmost table cell.');
const collapsedSource = pressureDescendants(compactRows[0], node => node.tagName === 'details');
assert.strictEqual(collapsedSource.length, 1, 'Source and metadata should be collapsed under one Details control.');
assert(!collapsedSource[0].open, 'Technical details must not be expanded by default.');
assert(pressureDescendants(compactRows[0], node => node.tagName === 'summary').some(node => node.textContent === 'Details'));
assert(!compactRows[0].textContent.includes('Compare curve  Compare curve'), 'Avoid repeated visible compare labels.');
const rapSegments = pressureDescendants(rapTable, node => node.className.includes('whitespace-nowrap'));
assert.deepStrictEqual(rapSegments.map(node => node.textContent), ['23 Fr distal', '25 Fr proximal']);
assert(/23 Fr distal\s*\/\s*25 Fr proximal/.test(rapTable.textContent));
const rapLegend = targetRuntime.createPressureDropTargetFlowChart([rap], 2, false, () => {}, () => {});
assert.deepStrictEqual(pressureDescendants(rapLegend, node => node.className.includes('whitespace-nowrap')).map(node => node.textContent), ['23 Fr distal', '25 Fr proximal']);
assert.strictEqual(targetRuntime.searchPressureDropCatalog(pressureDropData, '' ).length, 0);
assert.strictEqual(targetRuntime.searchPressureDropCatalog(pressureDropData, 'unfindable-model-123').length, 0);
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, 'EOPA').some(entry => /EOPA/.test(entry.model)));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, 'Avalon').some(entry => entry.model === avalonModel));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, 'RAP 23 Fr').some(entry => entry === rap));
assert.deepStrictEqual(new Set(targetRuntime.searchPressureDropCatalog(pressureDropData, '67318').map(entry => entry.cannulaOrderCode)), new Set(['67318']));
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, 'Medtronic').length > 1);

// Explicit French-size searches must match nominal Fr, never unrelated lengths or codes.
const exact15FrEntries = targetRuntime.searchPressureDropCatalog(pressureDropData, '15Fr');
assert(exact15FrEntries.length > 0, '15Fr must match documented 15 Fr cannulas.');
const exact15FrKeys = new Set(exact15FrEntries.map(targetRuntime.getPressureDropTargetFlowKey));
for (const spelling of ['15 Fr', '15fr', '15 FR', '15   Fr']) {
  const keys = new Set(targetRuntime.searchPressureDropCatalog(pressureDropData, spelling).map(targetRuntime.getPressureDropTargetFlowKey));
  assert.deepStrictEqual(keys, exact15FrKeys, `${spelling} must be equivalent to 15Fr.`);
}
assert(exact15FrEntries.every(entry => targetRuntime.getPressureDropComparisonFr(entry) === 15),
  'Fr searches must compare the nominal French size rather than arbitrary catalog text.');
const pas1315 = pressureDropData.find(entry => entry.cannulaOrderCode === 'PAS 1315');
assert(pas1315 && pas1315.size.includes('13 Fr') && pas1315.size.includes('15 cm'),
  'Preserve the real 13 Fr / 15 cm HLS regression fixture.');
assert(!exact15FrEntries.includes(pas1315), '15Fr must not include a 13 Fr cannula just because its length is 15 cm.');
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, 'PAS 1315').includes(pas1315),
  'Order-code search must still locate PAS 1315.');
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, '15').includes(pas1315),
  'Bare-number queries must preserve legacy text-search behavior.');
const sizeCollisionFixtures = ['13 Fr / 15 cm', '15 Fr', '115 Fr', '150 Fr', '15.5 Fr'].map((size, index) => ({
  manufacturer: 'Test manufacturer', model: `Size fixture ${index}`, category: 'femoral arterial', size
}));
assert.deepStrictEqual(Array.from(targetRuntime.searchPressureDropCatalog(sizeCollisionFixtures, '15Fr')), [sizeCollisionFixtures[1]],
  '15Fr must not match a different Fr, a decimal size, or an unrelated 15 cm length.');
const medtronic15 = targetRuntime.searchPressureDropCatalog(pressureDropData, 'Medtronic 15Fr');
assert(medtronic15.length > 0, 'A size query must combine with manufacturer text.');
assert.deepStrictEqual(new Set(medtronic15.map(targetRuntime.getPressureDropTargetFlowKey)),
  new Set(targetRuntime.searchPressureDropCatalog(pressureDropData, '15 Fr Medtronic').map(targetRuntime.getPressureDropTargetFlowKey)),
  'Mixed model/manufacturer and Fr queries must be order-independent.');
const pvl29 = pressureDropData.find(entry => entry.cannulaOrderCode === 'PVL 2955');
assert(pvl29 && targetRuntime.getPressureDropComparisonFr(pvl29) === 29);
assert.strictEqual(targetRuntime.getPressureDropComparisonSizeLabel(pvl29), 'PVL 2955 · 29 Fr');
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, 'PVL 29 Fr').includes(pvl29),
  'Catalog search includes French sizes derived from verified notes, not only the raw size code.');
assert(targetRuntime.searchPressureDropCatalog(pressureDropData, '29 Fr').includes(pvl29));
const pvlRow = targetRuntime.getPressureDropTargetFlowRows([pvl29], { category: 'venous' }, 2)[0];
const pvlTable = targetRuntime.createPressureDropTargetFlowTable([pvlRow], [], () => {});
assert(pvlTable.textContent.includes('PVL 2955 · 29 Fr'), 'Comparison rows show catalog code and derived French size together.');
assert(!pvlTable.textContent.includes('Variant PVL 2955'), 'Derived size text must not be mistaken for a connector variant.');
assert.strictEqual(targetRuntime.getPressureDropExploredFlow(58, { left: 0, width: 420 }, { plotLeft: '58', plotRight: '402', minFlow: '1', maxFlow: '5' }), 1);
assert.strictEqual(targetRuntime.getPressureDropExploredFlow(402, { left: 0, width: 420 }, { plotLeft: '58', plotRight: '402', minFlow: '1', maxFlow: '5' }), 5);
assert.strictEqual(targetRuntime.getPressureDropExploredFlow(230, { left: 100, width: 420 }, { plotLeft: '58', plotRight: '402', minFlow: '1', maxFlow: '5' }), 1.8, 'Page offset is converted through SVG bounds');

// Hard-coded cross-manufacturer catalog regressions at the same target flow.
const pediatricAt05 = targetRuntime.getPressureDropTargetFlowResult(pediatric8, 0.5);
assert(pediatricAt05.inRange, '8 Fr source curve must interpolate at 0.5 L/min.');
assert(Math.abs(pediatricAt05.interpolationResult.value -
  (59.4 + (64.7 - 59.4) * (0.5 - 0.491) / (0.517 - 0.491))) < 1e-8);
for (const flow of [0.01, 0.905]) {
  const result = targetRuntime.getPressureDropTargetFlowResult(pediatric8, flow);
  assert(!result.inRange && result.interpolationResult.state === 'out_of_range',
    'Do not extrapolate beyond pediatric digitized manufacturer curve endpoints.');
}

const pediatric12At12 = targetRuntime.getPressureDropTargetFlowResult(pediatric12, 1.2);
assert(pediatric12At12.inRange);
assert(Math.abs(pediatric12At12.interpolationResult.value -
  (36.9 + (38.9 - 36.9) * (1.2 - 1.173) / (1.206 - 1.173))) < 1e-8);
for (const flow of [0.01, 1.992]) {
  const result = targetRuntime.getPressureDropTargetFlowResult(pediatric12, flow);
  assert(!result.inRange && result.interpolationResult.state === 'out_of_range',
    'No extrapolation outside the pediatric 12 Fr digitized source range.');
}

const pediatric10At1 = targetRuntime.getPressureDropTargetFlowResult(pediatric10, 1.0);
assert(pediatric10At1.inRange);
assert(Math.abs(pediatric10At1.interpolationResult.value -
  (66.2 + (69.8 - 66.2) * (1.0 - 0.975) / (1.005 - 0.975))) < 1e-8);
for (const flow of [0.01, 1.79]) {
  const result = targetRuntime.getPressureDropTargetFlowResult(pediatric10, flow);
  assert(!result.inRange && result.interpolationResult.state === 'out_of_range',
    'No extrapolation outside pediatric arterial 10 Fr digitized source range.');
}

const actualNextGen19 = actualFemoralRows.find(row => row.entry.model === nextGenModels[0] && row.entry.size === '19 Fr');
const actualHls19 = actualFemoralRows.find(row => row.entry.cannulaOrderCode === 'PAS 1915');
// Independently calculated from (4.36,64.7)/(4.52,69.4) and
// (4.29,69.5)/(4.51,77.3); do not derive expected values from the runtime.
assert(Math.abs(actualNextGen19.result.interpolationResult.value - 68.8125) < 1e-8);
assert(Math.abs(actualHls19.result.interpolationResult.value - 76.94545454545455) < 1e-8);

const allKeys = new Set(pressureDropData.map(targetRuntime.getPressureDropTargetFlowKey));
const fiveKeys = [...allKeys].slice(0, 5);
let selection = [];
fiveKeys.forEach(key => { selection = targetRuntime.updatePressureDropTargetFlowSelection(selection, key, true, allKeys); });
assert.strictEqual(selection.length, 4);
assert.strictEqual(targetRuntime.updatePressureDropTargetFlowSelection(selection, fiveKeys[0], true, allKeys).length, 4);
selection = targetRuntime.updatePressureDropTargetFlowSelection(selection, fiveKeys[1], false, allKeys);
assert.strictEqual(selection.length, 3);
assert.strictEqual(targetRuntime.updatePressureDropTargetFlowSelection(selection, fiveKeys[4], true, allKeys).length, 4);
assert.strictEqual(targetRuntime.updatePressureDropTargetFlowSelection(selection, 'missing', true, allKeys).length, 3);

// Execute UI event handlers; verify flow preservation, filters, readiness and
// chart association instead of inspecting main.js source strings.
const controller = targetRuntime.initPressureDropTargetFlowComparison(pressureDropData, () => {});
assert(controller);
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'false');
assert.strictEqual(targetNodes['pressure-drop-target-manufacturer'].value, '');
const targetFlowInput = targetNodes['pressure-drop-target-flow'];
targetFlowInput.value = '4.5'; targetFlowInput.dispatch('input');
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'true');
assert.strictEqual(targetNodes['pressure-drop-target-location-note'].textContent, '');
assert(currentRows().some(row => row.textContent.includes('EOPA')), 'All locations includes EOPA without inventing a central site');
const locationInput = targetNodes['pressure-drop-target-location'];
locationInput.value = 'femoral'; locationInput.dispatch('change');
assert(targetNodes['pressure-drop-target-location-note'].textContent.includes('EOPA'));
locationInput.value = 'other'; locationInput.dispatch('change');
assert(currentRows().some(row => row.textContent.includes('EOPA')), 'Other / Unspecified exposes EOPA');
locationInput.value = 'femoral'; locationInput.dispatch('change');
function currentRows() { return pressureDescendants(targetNodes['pressure-drop-target-results'], node => node.tagName === 'tr'); }
function rowCheckbox(row) { return pressureDescendants(row, node => node.type === 'checkbox')[0]; }
const initialKeys = currentRows().map(row => row.dataset.productKey);
assert.strictEqual(initialKeys.length, 27);
assert(currentRows().some(row => row.textContent.includes('Out of range')));
for (const row of currentRows().slice(0, 4)) {
  const box = rowCheckbox(row);
  box.focus(); box.checked = true; box.dispatch('change');
  assert.strictEqual(targetTestDocument.activeElement.dataset.productKey, row.dataset.productKey, 'Selection rerender preserves keyboard focus');
}
targetTestDocument.activeElement = null;
assert.strictEqual(currentRows().filter(row => rowCheckbox(row).checked).length, 4);
assert(currentRows().filter(row => !rowCheckbox(row).checked).every(row => rowCheckbox(row).disabled));
const targetSort = targetNodes['pressure-drop-target-sort'];
targetSort.value = 'size'; targetSort.dispatch('change');
assert.strictEqual(currentRows().filter(row => rowCheckbox(row).checked).length, 4);
assert.deepStrictEqual(new Set(currentRows().map(row => row.dataset.productKey)), new Set(initialKeys));
const manufacturerInput = targetNodes['pressure-drop-target-manufacturer'];
manufacturerInput.value = 'Medtronic'; manufacturerInput.dispatch('change');
assert(currentRows().every(row => row.textContent.includes('Medtronic')));
assert.strictEqual(targetFlowInput.value, '4.5');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 4, 'Manufacturer filtering retains eligible chart selections');
const familyInput = targetNodes['pressure-drop-target-model'];
familyInput.value = nextGenModels[0]; familyInput.dispatch('change');
assert.strictEqual(currentRows().length, 6);
manufacturerInput.value = 'Getinge / Maquet'; manufacturerInput.dispatch('change');
assert.strictEqual(familyInput.value, '', 'Invalid family resets on manufacturer changes');
assert.strictEqual(targetFlowInput.value, '4.5');
manufacturerInput.value = ''; manufacturerInput.dispatch('change');
assert.strictEqual(currentRows().length, 27);
const removeButton = pressureDescendants(targetNodes['pressure-drop-target-chart'],
  node => node.tagName === 'button' && node.attributes['aria-label']?.startsWith('Remove '))[0];
assert(removeButton, 'Chart remove-curve control must be selected explicitly, not the raw-points toggle');
removeButton.dispatch('click');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 3);
targetFlowInput.value = '100000'; targetFlowInput.dispatch('input');
assert.strictEqual(currentRows().length, 27, 'Out-of-range-only results retain all products');
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'false');
assert(targetNodes['pressure-drop-target-results'].textContent.includes('No in-range estimates'));
targetNodes['pressure-drop-target-location'].value = 'central'; locationInput.dispatch('change');
targetNodes['pressure-drop-target-category'].value = 'venous'; targetNodes['pressure-drop-target-category'].dispatch('change');
assert.strictEqual(locationInput.value, '', 'Category changes must reset semantically different Central locations.');
assert.strictEqual(currentRows().length, targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous' }).length,
  'Switching category starts from all valid venous locations.');
locationInput.value = 'femoral'; locationInput.dispatch('change');
assert.strictEqual(currentRows().length, targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { category: 'venous', location: 'femoral' }).length);
assert.strictEqual(currentRows().length, 23, 'Four PVS products join the original 19 femoral venous entries.');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 0, 'Category switch clears incompatible curves');
targetNodes['pressure-drop-target-model'].value = 'not a product'; controller.refresh();
assert(targetNodes['pressure-drop-target-results'].textContent.includes('No matching cannulas'));
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'false');
// Recover from an invalid family and exercise the full Venous → Jugular → Getinge → Avalon cascade.
targetNodes['pressure-drop-target-model'].value = '';
targetNodes['pressure-drop-target-category'].value = 'venous'; targetNodes['pressure-drop-target-category'].dispatch('change');
locationInput.value = 'jugular'; locationInput.dispatch('change');
manufacturerInput.value = 'Getinge / Maquet'; manufacturerInput.dispatch('change');
familyInput.value = avalonModel; familyInput.dispatch('change');
targetFlowInput.value = '1'; targetFlowInput.dispatch('input');
assert.strictEqual(currentRows().length, 7);
assert.strictEqual(targetFlowInput.value, '1');
assert(currentRows().every(row => row.textContent.includes('Dual-lumen VV ECMO')));
const firstAvalonBox = rowCheckbox(currentRows()[0]); firstAvalonBox.checked = true; firstAvalonBox.dispatch('change');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 1);
manufacturerInput.value = ''; manufacturerInput.dispatch('change');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 1);
targetNodes['pressure-drop-target-category'].value = 'arterial'; targetNodes['pressure-drop-target-category'].dispatch('change');
assert.strictEqual(familyInput.value, '');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 0);
assert.strictEqual(targetFlowInput.value, '1');

let specialtySelection = null;
const searchController = targetRuntime.initPressureDropTargetFlowComparison(pressureDropData, () => {}, entry => { specialtySelection = entry; });
const catalogSearch = targetNodes['pressure-drop-catalog-search'];
const catalogMatches = targetNodes['pressure-drop-catalog-matches'];
catalogSearch.value = 'Medtronic'; catalogSearch.dispatch('input');
assert.strictEqual(catalogMatches.children.length, pressureDropData.filter(entry => entry.manufacturer === 'Medtronic').length,
  'Broad manufacturer search must not silently truncate the suggestion list at 50.');
catalogSearch.dispatch('keydown', { key: 'Enter' });
const matchingMedtronicArterial = targetRuntime.searchPressureDropCatalog(pressureDropData, 'Medtronic')
  .filter(entry => classifyComparison(entry).eligible && classifyComparison(entry).category === 'arterial');
assert.deepStrictEqual(new Set(currentRows().map(row => row.dataset.productKey)),
  new Set(matchingMedtronicArterial.map(targetRuntime.getPressureDropTargetFlowKey)),
  'Enter applies the visible cannula category so arterial and venous pressure drops are not mixed.');
assert(targetNodes['pressure-drop-target-summary'].textContent.includes('Arterial'));
catalogSearch.value = 'EOPA'; catalogSearch.dispatch('input');
assert(catalogMatches.children.some(item => item.textContent.includes('EOPA')));
assert(!catalogMatches.classList.contains('hidden'));
const matchingEopa = targetRuntime.searchPressureDropCatalog(pressureDropData, 'EOPA')
  .filter(entry => classifyComparison(entry).eligible);
catalogSearch.dispatch('keydown', { key: 'Enter' });
assert(catalogMatches.classList.contains('hidden'), 'Enter dismisses autocomplete suggestions.');
assert.strictEqual(currentRows().length, matchingEopa.length, 'Enter lists all EOPA catalog matches, not just the first suggestion.');
assert.deepStrictEqual(new Set(currentRows().map(row => row.dataset.productKey)),
  new Set(matchingEopa.map(targetRuntime.getPressureDropTargetFlowKey)),
  'The full search result list is independent of the currently selected anatomical location.');
assert(targetNodes['pressure-drop-target-summary'].textContent.includes('Search: "EOPA"'));
assert.strictEqual(targetFlowInput.value, '1', 'Enter search must preserve target-flow input.');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 0,
  'Enter search should not automatically select a single curve.');

// Search suggestions and Enter-to-filter must share exact French-size matching.
const eligible15FrArterial = exact15FrEntries.filter(entry => {
  const classification = classifyComparison(entry);
  return classification.eligible && classification.category === 'arterial';
});
for (const spelling of ['15Fr', '15 Fr']) {
  catalogSearch.value = spelling; catalogSearch.dispatch('input');
  assert.deepStrictEqual(new Set(catalogMatches.children.map(node => node.dataset.productKey)), exact15FrKeys,
    `Autocomplete must show the exact same 15 Fr products for "${spelling}".`);
  assert(!catalogMatches.children.some(node => node.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(pas1315)),
    'Autocomplete must exclude the 13 Fr HLS cannula with 15 cm length.');
  catalogSearch.dispatch('keydown', { key: 'Enter' });
  assert.deepStrictEqual(new Set(currentRows().map(row => row.dataset.productKey)),
    new Set(eligible15FrArterial.map(targetRuntime.getPressureDropTargetFlowKey)),
    `Enter-to-filter must use exact 15 Fr and the active arterial category for "${spelling}".`);
}
for (const spelling of ['Medtronic 15Fr', '15 Fr Medtronic']) {
  catalogSearch.value = spelling; catalogSearch.dispatch('input');
  assert.deepStrictEqual(new Set(catalogMatches.children.map(node => node.dataset.productKey)),
    new Set(medtronic15.map(targetRuntime.getPressureDropTargetFlowKey)),
    'Combined Fr/manufacturer query suggestions must be consistent.');
  catalogSearch.dispatch('keydown', { key: 'Enter' });
  assert.deepStrictEqual(new Set(currentRows().map(row => row.dataset.productKey)),
    new Set(medtronic15.filter(entry => {
      const classification = classifyComparison(entry);
      return classification.eligible && classification.category === 'arterial';
    }).map(targetRuntime.getPressureDropTargetFlowKey)),
    'Combined size/manufacturer search must also work in committed comparison rows.');
}
const eopa = pressureDropData.find(entry => entry.model === 'EOPA Arterial Cannulae');
searchController.selectSearchEntry(eopa);
assert.strictEqual(targetNodes['pressure-drop-target-category'].value, 'arterial');
assert.strictEqual(targetNodes['pressure-drop-target-location'].value, 'other');
assert.strictEqual(targetNodes['pressure-drop-target-manufacturer'].value, 'Medtronic');
assert.strictEqual(targetNodes['pressure-drop-target-model'].value, eopa.model);
assert.strictEqual(targetFlowInput.value, '1', 'Search keeps the committed target flow');
assert(currentRows().some(row => row.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(eopa)));
assert(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li')
  .some(item => item.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(eopa)));
catalogSearch.value = 'EOPA 3D'; catalogSearch.dispatch('input'); catalogSearch.dispatch('keydown', { key: 'Enter' });
assert(currentRows().every(row => row.textContent.includes('EOPA 3D')),
  'Entering a narrower search must replace only the displayed result list.');
assert(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li')
  .some(item => item.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(eopa)),
  'Search must preserve explicitly selected curves from another family.');
catalogSearch.dispatch('keydown', { key: 'Escape' });
catalogSearch.value = '67318'; catalogSearch.dispatch('input');
assert.strictEqual(catalogMatches.children.length, 1, 'Order-code search returns the exact connector variant');
catalogMatches.children[0].dispatch('click');
assert.strictEqual(targetNodes['pressure-drop-target-category'].value, 'venous');
assert(currentRows().some(row => row.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(dlpVariants.find(entry => entry.cannulaOrderCode === '67318'))));
catalogSearch.value = 'no-such-cannula'; catalogSearch.dispatch('input');
assert.strictEqual(catalogMatches.textContent.trim(), 'No matching cannulas');
catalogSearch.dispatch('keydown', { key: 'Escape' });
assert(catalogMatches.classList.contains('hidden'));
const specialty = pressureDropData.find(entry => classifyComparison(entry).category === 'specialty');
assert(specialty);
catalogSearch.value = specialty.cannulaOrderCode; catalogSearch.dispatch('input');
catalogSearch.dispatch('keydown', { key: 'Enter' });
assert.strictEqual(currentRows().length, 0, 'Specialty-only Enter search has no standard comparison rows.');
assert(!catalogMatches.classList.contains('hidden'), 'Specialty suggestions remain available after Enter.');
const specialtyChoice = catalogMatches.children.find(item => item.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(specialty));
assert(specialtyChoice, 'The matching Specialty cannula remains directly selectable.');
specialtyChoice.dispatch('click');
assert.strictEqual(specialtySelection, specialty, 'Specialty uses the existing Single Lookup route');
assert.strictEqual(targetFlowInput.value, '1');
targetNodes['pressure-drop-target-category'].value = 'venous'; targetNodes['pressure-drop-target-category'].dispatch('change');
locationInput.value = 'central'; locationInput.dispatch('change');
manufacturerInput.value = ''; manufacturerInput.dispatch('change');
familyInput.value = ''; familyInput.dispatch('change');
assert.strictEqual(locationInput.children.find(option => option.value === 'central').textContent, 'Central (RA / SVC / IVC)');
assert.strictEqual(currentRows().length, centralVenous.length);
assert(currentRows().some(row => row.textContent.includes('Right Angle')));
assert(currentRows().some(row => row.textContent.includes('Dual Stage')));
assert(currentRows().some(row => row.textContent.includes('Out of range')), 'At 1 L/min, eligible central rows retain source-range status');
manufacturerInput.value = 'LivaNova'; manufacturerInput.dispatch('change');
assert.strictEqual(currentRows().length, centralVenous.filter(entry => entry.manufacturer === 'LivaNova').length);
familyInput.value = documentedCentralVenousModels.LivaNova[0]; familyInput.dispatch('change');
assert(currentRows().length > 0 && currentRows().every(row => row.textContent.includes('Right Angle Lighthouse')));
manufacturerInput.value = 'Medtronic'; manufacturerInput.dispatch('change');
assert.strictEqual(familyInput.value, '');
familyInput.value = 'DLP Single Stage Venous Cannulae'; familyInput.dispatch('change');
assert(currentRows().length > 0 && currentRows().every(row => row.textContent.includes('DLP Single Stage')));
assert.strictEqual(targetFlowInput.value, '1');
targetFlowInput.value = '1000'; targetFlowInput.dispatch('input');
assert(currentRows().length > 0 && currentRows().every(row => row.textContent.includes('Out of range')));
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'false');
targetFlowInput.value = '4'; targetFlowInput.dispatch('input');
assert(currentRows().some(row => row.textContent.includes('mmHg')));
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'true');
catalogSearch.value = 'RV-41026'; catalogSearch.dispatch('input');
assert.strictEqual(catalogMatches.children.length, 1, 'Global search still finds a central SKU through an unrelated active manufacturer');
catalogMatches.children[0].dispatch('click');
assert.strictEqual(locationInput.value, 'central');
assert.strictEqual(manufacturerInput.value, 'LivaNova');
assert(currentRows().some(row => row.dataset.productKey === targetRuntime.getPressureDropTargetFlowKey(pressureDropData.find(entry => entry.cannulaOrderCode === 'RV-41026'))));

const overlay = targetRuntime.createPressureDropTargetFlowChart([targetFixtures[0], targetFixtures[1]], 4.5, true, () => {}, () => {});
const overlaySvg = pressureDescendants(overlay, node => node.tagName === 'svg')[0];
let committedExploration = null;
const exploringChart = targetRuntime.createPressureDropTargetFlowChart([targetFixtures[0], targetFixtures[2]], 4.5, false,
  () => {}, () => {}, targetFixtures, value => { committedExploration = value; });
const exploringSvg = pressureDescendants(exploringChart, node => node.tagName === 'svg')[0];
const chartReadout = pressureDescendants(exploringChart, node => node.textContent.startsWith('Target: '))[0];
const chartSlider = pressureDescendants(exploringChart, node => node.type === 'range')[0];
const blankTargetChart = targetRuntime.createPressureDropTargetFlowChart([targetFixtures[0]], NaN, false, () => {}, () => {});
const blankTargetItem = pressureDescendants(blankTargetChart, node => node.tagName === 'li')[0];
const blankSlider = pressureDescendants(blankTargetChart, node => node.type === 'range')[0];
const blankCommit = pressureDescendants(blankTargetChart,
  node => node.tagName === 'button' && node.textContent === 'Use as target flow')[0];
assert(blankTargetItem.textContent.includes('Target: Enter a positive target flow'));
assert(blankTargetItem.textContent.includes('Enter flow'));
assert(!blankTargetItem.textContent.includes('Out of range'), 'An unset target must not be labeled as a source-range violation.');
assert(blankSlider && Number(blankSlider.min) > 0, 'Explorer must start at a positive tenth-step when the target input is blank.');
assert(blankCommit && (!blankCommit.disabled || Number(blankSlider.min) > 0),
  'The commit control must not accept a zero or negative flow.');
assert(chartSlider && chartSlider.attributes['aria-label'].includes('0.1 L/min'));
assert.strictEqual(exploringSvg.dataset.minFlow, '0');
exploringSvg.dispatch('pointermove', { clientX: 58 + 344 * (4.1 / 5) });
assert(chartReadout.textContent.includes('Target: 4.5 L/min · Exploring: 4.1 L/min'));
assert(exploringChart.textContent.includes('Out of range'), 'Each curve keeps its own source domain');
assert.strictEqual(committedExploration, null, 'Pointer movement does not commit a target');
exploringSvg.dispatch('pointerdown', { pointerType: 'mouse', clientX: 58 + 344 * (3.2 / 5) });
assert(chartReadout.textContent.includes('Pinned: 3.2 L/min'), 'Click pins the selected chart flow.');
exploringSvg.dispatch('pointermove', { pointerType: 'mouse', clientX: 58 + 344 * (4.4 / 5) });
assert(chartReadout.textContent.includes('Pinned: 3.2 L/min'), 'Moving toward the Apply button must not change pinned flow.');
const usePinnedFlow = pressureDescendants(exploringChart, node => node.textContent === 'Use as target flow')[0];
usePinnedFlow.dispatch('click');
assert.strictEqual(committedExploration, 3.2, 'Apply uses the pinned flow, not the last mouse position.');
exploringSvg.dispatch('pointerdown', { pointerType: 'touch', clientX: 58 + 344 * (3.6 / 5) });
exploringSvg.dispatch('pointermove', { pointerType: 'touch', clientX: 58 + 344 * (3.8 / 5) });
exploringSvg.dispatch('pointerup', { pointerType: 'touch', clientX: 58 + 344 * (3.8 / 5) });
assert(chartReadout.textContent.includes('Pinned: 3.8 L/min'), 'Touch release pins the final dragged flow.');
chartSlider.value = '4.0'; chartSlider.dispatch('input');
assert(exploringChart.textContent.includes('Explore: 70.0 mmHg'), 'Keyboard slider resolves exact source points');
assert(pressureDescendants(exploringChart, node => node.title?.includes('Signed pressure: +70.0 mmHg')).length >= 2,
  'Each series preserves its own signed interpolation details');
const useFlow = pressureDescendants(exploringChart, node => node.textContent === 'Use as target flow')[0];
useFlow.dispatch('click'); assert.strictEqual(committedExploration, 4);
const avalonExploration = targetRuntime.createPressureDropTargetFlowChart([avalonProducts[0]], 1, false, () => {}, () => {});
assert(avalonExploration.textContent.includes('Drainage') && !avalonExploration.textContent.includes('Infusion'));
assert(overlaySvg.innerHTML.includes('data-target-flow-line="true"'));
assert.strictEqual((overlaySvg.innerHTML.match(/data-series-id=/g) || []).length, 2);
assert(overlaySvg.innerHTML.includes('Signed pressure: +80.0 mmHg') && overlaySvg.innerHTML.includes('Signed pressure: +45.0 mmHg'));
assert.strictEqual((overlaySvg.innerHTML.match(/data-raw-pressure-point=/g) || []).length, 4);
const externalLegend = pressureDescendants(overlay, node => node.tagName === 'li');
assert(externalLegend[0].textContent.includes('Medtronic · A') && externalLegend[0].textContent.includes('19 Fr'));
assert(externalLegend[1].textContent.includes('Getinge / Maquet · B') && externalLegend[1].textContent.includes('21 Fr'));
assert.strictEqual(externalLegend[0].dataset.productKey, targetRuntime.getPressureDropTargetFlowKey(targetFixtures[0]));
assert.strictEqual(pressureDescendants(externalLegend[0], node => node.style.backgroundColor)[0].style.backgroundColor, chartRuntime.productColors[0]);
const compactOverlay = targetRuntime.createPressureDropTargetFlowChart(
  [{ ...highArterial, sourceUrl: 'https://example.com/catalog.pdf' }, venousHighMagnitude, highArterial], 5, false, () => {}, () => {});
const compactItems = pressureDescendants(compactOverlay, node => node.tagName === 'li');
assert.strictEqual(compactItems.length, 3);
assert(compactItems[0].textContent.includes('120.0 mmHg') && compactItems[0].textContent.includes('Exact'));
assert(!compactItems[0].textContent.includes('signed pressure') && !compactItems[0].textContent.includes('High pressure drop warning'));
assert(pressureDescendants(compactItems[0], node => node.title?.includes('Signed pressure: +120.0 mmHg')).length);
assert(pressureDescendants(compactItems[0], node => node.className.includes('text-amber-700')).length);
assert(!pressureDescendants(compactItems[1], node => node.className.includes('text-amber-700')).length, 'Venous magnitude has neutral styling');
assert(pressureDescendants(compactItems[0], node => node.tagName === 'a' && node.href === 'https://example.com/catalog.pdf').length);
let removedKey = null;
const removalOverlay = targetRuntime.createPressureDropTargetFlowChart([highArterial], 5, false, () => {}, key => { removedKey = key; });
const compactRemove = pressureDescendants(removalOverlay,
  node => node.tagName === 'button' && node.attributes['aria-label']?.startsWith('Remove '))[0];
assert.strictEqual(compactRemove.textContent, '×');
assert(compactRemove.attributes['aria-label'].includes('High arterial source'));
compactRemove.dispatch('click');
assert.strictEqual(removedKey, targetRuntime.getPressureDropTargetFlowKey(highArterial));
const outOfRangeOverlay = targetRuntime.createPressureDropTargetFlowChart([highArterial], 6, false, () => {}, () => {});
const outOfRangeItem = pressureDescendants(outOfRangeOverlay, node => node.tagName === 'li')[0];
assert(outOfRangeItem.textContent.includes('Out of range'));
assert(!pressureDescendants(outOfRangeItem, node => node.className.includes('text-amber-700')).length);
const noCurveOverlay = targetRuntime.createPressureDropTargetFlowChart([{ ...highArterial, points: [] }], 5, false, () => {}, () => {});
const noCurveItem = pressureDescendants(noCurveOverlay, node => node.tagName === 'li')[0];
assert(noCurveItem.textContent.includes('Target: No digitized curve'));
assert(noCurveItem.textContent.includes('No curve'));
assert(!noCurveItem.textContent.includes('Out of range'), 'Missing curve data must remain distinct from a range violation.');

const signedOverlay = targetRuntime.createPressureDropTargetFlowChart([targetFixtures[3]], 4.5, false, () => {}, () => {});
assert(!signedOverlay.textContent.includes('signed pressure'));
assert(pressureDescendants(signedOverlay, node => node.title?.includes('Signed pressure: -80.0 mmHg')).length);
assert(pressureDescendants(signedOverlay, node => node.tagName === 'svg')[0].innerHTML.includes('Signed pressure: -80.0 mmHg'));
const emptyFirst = { ...targetFixtures[0], model: 'Metadata', points: [] };
const mixedOverlay = targetRuntime.createPressureDropTargetFlowChart([emptyFirst, targetFixtures[1]], 4.5, false, () => {}, () => {});
const mixedSvg = pressureDescendants(mixedOverlay, node => node.tagName === 'svg')[0];
assert.strictEqual((mixedSvg.innerHTML.match(/data-series-id=/g) || []).length, 1);
assert(mixedSvg.innerHTML.includes('Signed pressure: +45.0 mmHg') && !mixedSvg.innerHTML.includes('+80.0'), 'Empty series must not shift target estimates');
assert(mixedSvg.innerHTML.includes(`fill="${chartRuntime.productColors[1]}"`));
const outsideOverlay = targetRuntime.createPressureDropTargetFlowChart(targetFixtures.slice(0, 3), 100, false, () => {}, () => {});
const outsideSvg = pressureDescendants(outsideOverlay, node => node.tagName === 'svg')[0];
assert.strictEqual((outsideSvg.innerHTML.match(/data-series-id=/g) || []).length, 0);
assert(!outsideSvg.innerHTML.includes('data-target-flow-line'));
assert(outsideOverlay.textContent.includes('No selected curve has an in-range estimate'));
const readyTarget = new PressureTestNode(); readyTarget.dataset.analyticsReady = 'true';
assert.strictEqual(targetRuntime.isPressureDropAnalyticsReady('target', readyTarget, readyTarget), true);
readyTarget.className = 'hidden';
assert.strictEqual(targetRuntime.isPressureDropAnalyticsReady('target', readyTarget, readyTarget), false);
console.log('Target-flow classification, interpolation, filtering, selection, chart and readiness regressions passed.');

// Run the production combobox against a small DOM model: canonical values,
// search aliases, keyboard selection/dismissal and mobile panel placement.
class ComboNode {
  constructor(tag = 'div') {
    this.tagName = tag; this.children = []; this.dataset = {}; this.style = {};
    this.attributes = {}; this.listeners = {}; this.value = ''; this.className = '';
    this.classList = {
      add: name => { this.className += ` ${name}`; },
      remove: name => { this.className = this.className.split(' ').filter(item => item !== name).join(' '); },
      contains: name => this.className.split(' ').includes(name),
      toggle: (name, active) => { this.classList[active ? 'add' : 'remove'](name); }
    };
  }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  dispatch(name, event = {}) { this.listeners[name]?.({ preventDefault() {}, ...event }); }
  dispatchEvent(event) { this.dispatch(event.type, event); }
  insertAdjacentElement(_position, node) { this.wrapper = node; }
  getBoundingClientRect() { return { left: 280, top: 170, bottom: 210 }; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  focus(options) { comboDocument.activeElement = this; this.focusOptions = options; }
  scrollIntoView() {}
  querySelectorAll(selector) { assert.strictEqual(selector, '[role="option"]'); return this.children.filter(node => node.attributes.role === 'option'); }
  get options() { return this.children; }
  set innerHTML(value) { this.children = []; }
  get textContent() { return this.text || ''; }
  set textContent(value) { this.text = String(value); }
}
const comboDocument = { activeElement: null, handlers: {}, documentElement: { clientWidth: 320, clientHeight: 600 },
  createElement: tag => new ComboNode(tag), addEventListener(name, fn) { this.handlers[name] = fn; } };
const visualViewport = { offsetTop: 0, height: 600, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } };
const comboWindow = { innerWidth: 320, innerHeight: 600, visualViewport, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; } };
const comboSelect = new ComboNode('select'); comboSelect.id = 'pressure-drop-target-model';
const longModel = 'Single Stage Right Angle Lighthouse Tip Venous Return Cannulae — Right Angle Lighthouse Tip, Wire-reinforced Tubing';
for (const [value, label, searchText] of [
  ['', 'All families / models', ''],
  [avalonModel, 'Avalon Elite · Dual-lumen ECMO', `Getinge / Maquet ${avalonModel} Avalon Elite`],
  [longModel, longModel, `LivaNova ${longModel}`]
]) {
  const option = new ComboNode('option'); option.value = value; option.textContent = label; option.dataset.searchText = searchText;
  comboSelect.appendChild(option);
}
let comboChanges = 0; comboSelect.addEventListener('change', () => { comboChanges += 1; });
const comboFactory = vm.runInNewContext(`${pressureProductionFunction('createPressureDropSearchableSelect')}; createPressureDropSearchableSelect`, {
  document: comboDocument, window: comboWindow, Event: class { constructor(type) { this.type = type; } }, setTimeout: fn => fn()
});
const combo = comboFactory(comboSelect, 'Family / model');
assert(combo && comboFactory(comboSelect, 'Family / model') === null, 'A second component cannot attach to the same select');
combo.open();
assert.strictEqual(combo.panel.style.left, '0');
assert.strictEqual(combo.panel.style.top, '100%');
assert.strictEqual(combo.panel.style.right, 'auto');
assert.strictEqual(combo.panel.style.width, '100%');
assert.strictEqual(comboDocument.activeElement, null, 'Touch opening must not autofocus and scroll the page');
combo.search.value = 'getinge'; combo.search.dispatch('input');
assert.strictEqual(combo.list.children.length, 1, 'Manufacturer alias finds the Avalon family');
combo.search.dispatch('keydown', { key: 'ArrowDown' });
combo.search.dispatch('keydown', { key: 'Enter' });
assert.strictEqual(comboSelect.value, avalonModel, 'Compact display label preserves canonical model identity');
assert.strictEqual(comboChanges, 1);
assert.strictEqual(comboDocument.activeElement, combo.button);
assert.strictEqual(combo.button.focusOptions.preventScroll, true);
combo.open(); combo.search.value = 'LivaNova'; combo.search.dispatch('input');
assert.strictEqual(combo.list.children.length, 1);
assert(combo.list.children[0].className.includes('whitespace-normal'), 'Long option wraps');
combo.search.dispatch('keydown', { key: 'Escape' });
assert(combo.panel.classList.contains('hidden'));
combo.open(); comboDocument.handlers.mousedown({ target: new ComboNode('outside') });
assert(combo.panel.classList.contains('hidden'), 'Outside click closes the menu');
comboWindow.innerWidth = 390; comboWindow.innerHeight = 250; visualViewport.height = 250;
combo.open();
assert.strictEqual(combo.panel.style.top, 'auto');
assert.strictEqual(combo.panel.style.bottom, '100%', 'Low viewport anchors above the same field');
comboWindow.handlers.scroll();
assert.strictEqual(combo.panel.style.bottom, '100%');
comboWindow.innerWidth = 320; comboWindow.innerHeight = 600;
visualViewport.height = 600;
comboWindow.handlers.resize();
assert.strictEqual(combo.panel.style.top, '100%', 'Resize restores a below-field anchor');
visualViewport.height = 250; visualViewport.handlers.resize();
assert.strictEqual(combo.panel.style.bottom, '100%', 'Keyboard viewport resize repositions above field');
visualViewport.offsetTop = 100; visualViewport.handlers.scroll();
assert.strictEqual(combo.panel.style.top, '100%', 'Visual viewport scroll recalculates the local field anchor');
visualViewport.offsetTop = 0; visualViewport.height = 600;
combo.close(); combo.button.dispatch('keydown', { key: 'Enter' });
assert.strictEqual(comboDocument.activeElement, combo.search, 'Keyboard opening focuses search without scrolling');
assert.strictEqual(combo.search.focusOptions.preventScroll, true);
combo.close(); combo.open(); combo.close(); combo.open();
assert.strictEqual(combo.panel.style.top, '100%', 'Repeated open/close cycles recalculate placement');
console.log('Searchable target model selector keyboard, search, dismissal and containment regressions passed.');

const switchStart = mainJs.indexOf('    const setPressureDropView = (view) => {');
const switchSource = mainJs.slice(switchStart, mainJs.indexOf('\n    [', switchStart));
const switchPage = new PressureTestNode();
const switchPanels = { single: new PressureTestNode(), target: new PressureTestNode() };
const switchTabs = { single: new PressureTestNode(), target: new PressureTestNode() };
const switchRenders = [];
const switchView = vm.runInNewContext(`let activePressureDropView = 'single'; ${switchSource}; setPressureDropView`, {
  page: switchPage, status: new PressureTestNode(),
  singleView: switchPanels.single, singleTab: switchTabs.single,
  targetView: switchPanels.target, targetTab: switchTabs.target,
  targetComparison: { refresh: () => switchRenders.push('target') },
  render: () => switchRenders.push('single')
});
for (const mode of ['target', 'single', 'target']) {
  Object.values(switchPanels).forEach(panel => { panel.dataset.analyticsReady = 'true'; });
  switchView(mode);
  assert.strictEqual(switchPage.dataset.pressureDropView, mode);
  Object.entries(switchPanels).forEach(([name, panel]) => {
    assert.strictEqual(panel.classList.contains('hidden'), name !== mode);
    if (name !== mode) assert.strictEqual(panel.dataset.analyticsReady, 'false');
    assert.strictEqual(switchTabs[name].attributes['aria-pressed'], String(name === mode));
  });
}
assert.deepStrictEqual(switchRenders, ['target', 'single', 'target']);
console.log('Pressure-drop mode switching and inactive readiness regressions passed.');

// Execute the production feedback resolver with the active view and its real
// readiness contract. The feedback card itself remains unique across modes.
const feedbackNodes = Object.fromEntries([
  'cannula-pressure-drop-page', 'pressure-drop-target-view', 'pressure-drop-single-view',
  'pressure-drop-target-results', 'pressure-drop-results'
].map(id => [id, new PressureTestNode()]));
const feedbackVisible = node => Boolean(node && !node.classList.contains('hidden'));
const feedbackContextSource = mainJs.slice(mainJs.indexOf('const FEEDBACK_RESULT_CONTEXTS ='), mainJs.indexOf('const FEEDBACK_STORAGE_KEY'));
const feedbackRuntime = vm.runInNewContext([
  pressureProductionFunction('resolvePressureDropFeedbackContext'),
  feedbackContextSource,
  pressureProductionFunction('resolveFeedbackResultContext'),
  '; ({ resolveFeedbackResultContext })'
].join('\n'), {
  el: id => feedbackNodes[id],
  isElementVisible: feedbackVisible,
  isPressureDropAnalyticsReady: targetRuntime.isPressureDropAnalyticsReady,
  isFeedbackResultReady: () => false,
  isPositiveNumericResult: () => false,
  isLbmFeedbackReady: () => false,
  isZScoreFeedbackReady: () => false,
  resolveTimeFeedbackContext: () => null,
  resolveHctFeedbackContext: () => null,
  resolveUnitConverterFeedbackContext: () => null,
  document: { querySelector: () => null }
});
for (const [mode, viewId, resultId] of [
  ['target', 'pressure-drop-target-view', 'pressure-drop-target-results'],
  ['single', 'pressure-drop-single-view', 'pressure-drop-results']
]) {
  feedbackNodes['cannula-pressure-drop-page'].dataset.pressureDropView = mode;
  for (const panelId of ['pressure-drop-target-view', 'pressure-drop-single-view']) {
    feedbackNodes[panelId].className = panelId === viewId ? '' : 'hidden';
    feedbackNodes[panelId].dataset.analyticsReady = panelId === viewId ? 'false' : 'true';
  }
  let context = feedbackRuntime.resolveFeedbackResultContext('/cannula-pressure-drop/');
  assert.strictEqual(context.insertAfter, feedbackNodes[viewId]);
  assert.strictEqual(context.readinessTarget, feedbackNodes[resultId]);
  assert.strictEqual(context.isReady(), false, `${mode} filter-only/out-of-range-only result is not feedback-ready`);
  feedbackNodes[viewId].dataset.analyticsReady = 'true';
  assert.strictEqual(context.isReady(), true, `${mode} visible, in-range result can show feedback`);
  feedbackNodes[resultId].className = 'hidden';
  assert.strictEqual(context.isReady(), false, `${mode} hidden result cannot show feedback`);
  feedbackNodes[resultId].className = '';
  feedbackNodes[viewId].className = 'hidden';
  assert.strictEqual(context.isReady(), false, `${mode} hidden view cannot show feedback`);
  feedbackNodes[viewId].className = '';
}
// An old view's ready flag must never make the active target view ready.
feedbackNodes['cannula-pressure-drop-page'].dataset.pressureDropView = 'target';
feedbackNodes['pressure-drop-target-view'].dataset.analyticsReady = 'false';
feedbackNodes['pressure-drop-single-view'].dataset.analyticsReady = 'true';
feedbackNodes['pressure-drop-target-view'].className = '';
feedbackNodes['pressure-drop-single-view'].className = 'hidden';
assert.strictEqual(feedbackRuntime.resolveFeedbackResultContext('/cannula-pressure-drop/').isReady(), false);

let existingFeedbackCard = null;
let insertedFeedbackCards = 0;
const feedbackEventHandlers = {};
const feedbackTimers = [];
for (const id of ['pressure-drop-target-view', 'pressure-drop-single-view']) {
  feedbackNodes[id].insertAdjacentHTML = () => { insertedFeedbackCards += 1; existingFeedbackCard = new PressureTestNode(); };
}
const feedbackRoot = { addEventListener: (type, handler) => { feedbackEventHandlers[type] = handler; } };
const initFeedbackRuntime = vm.runInNewContext(`${pressureProductionFunction('initFeedbackCard')}; initFeedbackCard`, {
  window: { location: { pathname: '/cannula-pressure-drop/' } },
  location: { hostname: 'example.com' },
  normalizeFeedbackPath: path => path,
  FEEDBACK_CALCULATOR_ROUTES: { '/cannula-pressure-drop/': 'cannula_pressure_drop' },
  FEEDBACK_MIN_DWELL_MS: 0,
  resolveFeedbackResultContext: feedbackRuntime.resolveFeedbackResultContext,
  document: { querySelector: selector => selector === '.feedback-card' ? existingFeedbackCard : selector === 'main' ? feedbackRoot : null },
  setTimeout: handler => { feedbackTimers.push(handler); },
  canShowFeedbackPrompt: () => true,
  getFeedbackCardMarkup: () => '<section class="feedback-card"></section>',
  getFeedbackPromptId: () => 'prompt',
  bindFeedbackCard: () => {}
});
initFeedbackRuntime();
const feedbackInteraction = { isTrusted: true, target: { closest: () => ({}) } };
feedbackNodes['pressure-drop-target-view'].dataset.analyticsReady = 'false';
feedbackEventHandlers.input(feedbackInteraction);
feedbackTimers.splice(0).forEach(callback => callback());
assert.strictEqual(insertedFeedbackCards, 0, 'Filter-only target results cannot trigger a prompt');
feedbackNodes['pressure-drop-target-view'].dataset.analyticsReady = 'true';
feedbackEventHandlers.input(feedbackInteraction);
feedbackTimers.splice(0).forEach(callback => callback());
assert.strictEqual(insertedFeedbackCards, 1);
feedbackNodes['cannula-pressure-drop-page'].dataset.pressureDropView = 'single';
feedbackNodes['pressure-drop-target-view'].className = 'hidden';
feedbackNodes['pressure-drop-single-view'].className = '';
feedbackNodes['pressure-drop-single-view'].dataset.analyticsReady = 'true';
feedbackEventHandlers.change(feedbackInteraction);
feedbackTimers.splice(0).forEach(callback => callback());
assert.strictEqual(insertedFeedbackCards, 1, 'An existing card must not be duplicated after a view switch');
console.log('Pressure-drop active-view feedback anchoring, readiness and single-card regressions passed.');
