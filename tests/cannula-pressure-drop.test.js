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
  pressureDropPageHtml.includes('width: calc(100vw - 32px) !important;') &&
  pressureDropPageHtml.includes('text-overflow: ellipsis;') &&
  pressureDropPageHtml.includes('white-space: nowrap;'),
  'Pressure-drop combobox CSS should prevent horizontal overflow and truncate long selected/option labels.'
);
assert(
  pressureDropPageHtml.includes('<title>Cannula Pressure Drop Calculator | CPB &amp; Perfusion Flow Resistance</title>') &&
  pressureDropPageHtml.includes('Estimate cannula pressure drop from manufacturer pressure-flow data for perfusion cannulas') &&
  pressureDropPageHtml.includes('<link rel="canonical" href="https://perfusiontools.com/cannula-pressure-drop/" />'),
  'Cannula pressure-drop page should expose unique title, description, and exact canonical URL metadata.'
);
assert(
  pressureDropPageHtml.includes('id="pressure-drop-single-tab"') &&
  pressureDropPageHtml.includes('id="pressure-drop-compare-tab"') &&
  pressureDropPageHtml.includes('id="pressure-drop-compare-flow"') &&
  pressureDropPageHtml.includes('id="pressure-drop-compare-results"'),
  'Cannula pressure-drop page should add a separate tabbed Compare sizes view while keeping the single lookup markup present.'
);
assert(
  pressureDropPageHtml.includes('manufacturer pressure-flow curve data') &&
  pressureDropPageHtml.includes('flow resistance') &&
  pressureDropPageHtml.includes('model-specific limitations') &&
  pressureDropPageHtml.includes('Pressure-flow curves') &&
  pressureDropPageHtml.includes('Manufacturer data') &&
  pressureDropPageHtml.includes('Linear interpolation') &&
  pressureDropPageHtml.includes('Arterial &amp; venous cannulas') &&
  pressureDropPageHtml.includes('available manufacturer pressure-flow curves or tables') &&
  pressureDropPageHtml.includes('linear interpolation between adjacent source points') &&
  pressureDropPageHtml.includes('Compare sizes view applies one shared target flow'),
  'Cannula pressure-drop methodology should explain manufacturer source data, linear interpolation, and shared-flow Compare sizes behavior.'
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
  mainJs.includes('function getPressureDropComparisonSizeLabel(entry)') &&
  mainJs.includes('if (entry.size) return entry.size;') &&
  mainJs.includes('label: getPressureDropComparisonSizeLabel(entry)') &&
  !mainJs.includes('function getPressureDropComparisonSecondaryLabel(entry)') &&
  !mainJs.includes('secondaryLabel'),
  'Comparison dropdown, column headers, cards, and summaries should share one concise primary size-label formatter without secondary header metadata.'
);
assert(
  mainJs.includes('selectedComparisonKeys.length >= 4') &&
  mainJs.includes('selectedComparisonKeys.includes(key)') &&
  mainJs.includes('selectedComparisonKeys = selectedComparisonKeys.filter(key => validScopeKeys.has(key))'),
  'Comparison mode should prevent duplicates, cap selection at four cannulas, and clear selections that no longer match the same-family scope.'
);
assert(
  mainJs.includes('const hasCompleteComparisonScope = () => Boolean(') &&
  mainJs.includes('if (!hasCompleteComparisonScope()) return [];') &&
  mainJs.includes('manufacturer: compareControls.manufacturerSelect.value') &&
  mainJs.includes("manufacturerValue ? 'Select type' : 'Select manufacturer first'") &&
  mainJs.includes("categoryValue ? 'Select model / family' : 'Select type first'") &&
  mainJs.includes("scopeComplete ? (availableSizeOptions.length ? 'Select size to add' : 'No sizes available for this selection') : 'Select manufacturer, type, and model first'"),
  'Compare scope entries and size options should stay empty/placeholder-only until manufacturer, category/type, and model/family are selected.'
);
assert(
  mainJs.includes('const canAddComparisonSize = () => (') &&
  mainJs.includes("Number.isFinite(parsePressureDropFlowInput(compareControls.flowInput?.value || ''))") &&
  mainJs.includes('compareControls.addButton.disabled = !canAddComparisonSize()') &&
  mainJs.includes('if (!canAddComparisonSize() || selectedComparisonKeys.includes(key)) return;'),
  'Compare Add size button should require valid flow, complete scope, selected size, non-duplicate key, and the max-count limit.'
);
assert(
  pressureDropPageHtml.includes('id="pressure-drop-compare-scope-lock"') &&
  pressureDropPageHtml.includes('Clear selected sizes to change comparison scope.') &&
  pressureDropPageHtml.includes('id="pressure-drop-compare-clear"') &&
  mainJs.includes('compareControls.manufacturerSelect.disabled = hasSelectedComparisonItems') &&
  mainJs.includes('compareControls.categorySelect.disabled = hasSelectedComparisonItems || !manufacturerValue') &&
  mainJs.includes('compareControls.modelSelect.disabled = hasSelectedComparisonItems || !categoryValue') &&
  mainJs.includes('selectedComparisonKeys = [];'),
  'Compare mode should lock parent scope controls while selected sizes exist and provide a clear comparison control.'
);
assert(
  mainJs.includes('Out of source range') &&
  mainJs.includes('No extrapolation.') &&
  mainJs.includes('High pressure drop warning (>100 mmHg).') &&
  mainJs.includes('function shouldApplyPressureDropHighWarning(entry)') &&
  mainJs.includes("getPressureDropCategoryFilterValue(entry?.category) === 'arterial cannula'"),
  'Comparison mode should show explicit out-of-source-range labels and gate high pressure status to applicable arterial cannulas.'
);
assert(
  mainJs.includes("wrap.className = 'hidden md:block overflow-x-auto") &&
  mainJs.includes("stack.className = 'grid gap-3 md:hidden'") &&
  mainJs.includes('createPressureDropComparisonTable') &&
  mainJs.includes('createPressureDropComparisonCards'),
  'Comparison mode should render a desktop table and mobile card stack rather than a wide mobile table.'
);
assert(
  mainJs.includes('selectedEntries.length === 0') &&
  mainJs.includes('Add at least one size to compare.') &&
  mainJs.includes('selectedEntries.length === 1') &&
  mainJs.includes('Add one more size to compare.') &&
  !mainJs.includes('Add at least two sizes to compare.'),
  'Comparison mode should show an empty state only for zero selections and render the table/card after one selected size.'
);
assert(
  mainJs.includes("removeButton.textContent = '×'") &&
  mainJs.includes("Remove ${getPressureDropComparisonSizeLabel(entry)} from comparison") &&
  !mainJs.includes("removeButton.textContent = 'Remove'"),
  'Comparison remove controls should use compact accessible X buttons rather than large red text links.'
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
  dispatch(name) { this.listeners[name]?.(); }
  focus() { targetTestDocument.activeElement = this; }
  querySelectorAll(selector) {
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
const targetNodes = Object.fromEntries(['view', 'flow', 'category', 'location', 'manufacturer', 'model', 'sort', 'results', 'summary', 'chart']
  .map(name => [`pressure-drop-target-${name}`, new PressureTestNode()]));
targetNodes['pressure-drop-target-category'].value = 'arterial';
targetNodes['pressure-drop-target-sort'].value = 'pressure';
const targetTestDocument = {
  createElement: tag => new PressureTestNode(tag),
  createElementNS: (_, tag) => new PressureTestNode(tag)
};
const targetFunctionNames = [
  'normalizePressureDropFilterLabel', 'getPressureDropGroupLabel', 'getPressureDropCategoryFilterValue',
  'getPressureDropConnectionOptionValue', 'getPressureDropComparisonKey', 'shouldApplyPressureDropHighWarning',
  'getPressureDropComparisonResult', 'hasValidPressureDropEstimate', 'isPressureDropAnalyticsReady',
  'parsePressureDropFlowInput', 'getPressureDropResultStateText', 'getPressureDropResultValueText',
  'formatPressureDropFlowValue', 'getPressureDropRangeText', 'formatSignedPressureDrop',
  'buildPressureDropAxisTicks', 'formatPressureDropAxisTick', 'getPressureDropSourceNode',
  'getUniquePressureDropOptionPairs', 'setPressureDropSelectOptionPairs', 'createPressureDropRawPointsToggle'
];
const targetRuntime = vm.runInNewContext([
  mainJs.slice(mainJs.indexOf('function normalizePressureDropKey'), mainJs.indexOf('function fitPressureDropPowerLaw')),
  chartRendererSource,
  ...targetFunctionNames.map(pressureProductionFunction),
  mainJs.slice(mainJs.indexOf('function classifyPressureDropComparisonEntry'), mainJs.indexOf('async function initCannulaPressureDropPage')),
  `; ({ classifyPressureDropComparisonEntry, getPressureDropTargetFlowKey, getPressureDropTargetFlowMatches,
    parsePressureDropTargetFlow, getPressureDropTargetFlowResult, getPressureDropTargetFlowRows,
    getPressureDropComparisonFr, updatePressureDropTargetFlowSelection, createPressureDropTargetFlowChart,
    getPressureDropTargetFlowIdentity, createPressureDropTargetFlowTable,
    initPressureDropTargetFlowComparison, isPressureDropAnalyticsReady, drawPressureDropSeriesChart })`
].join('\n'), {
  document: targetTestDocument,
  el: id => targetNodes[id], isElementVisible: node => Boolean(node && !node.classList.contains('hidden'))
});
const classifyComparison = targetRuntime.classifyPressureDropComparisonEntry;
const classificationCounts = {};
pressureDropData.forEach(entry => {
  const classification = classifyComparison(entry);
  const group = `${classification.category}/${classification.location}`;
  classificationCounts[group] = (classificationCounts[group] || 0) + 1;
});
assert.deepStrictEqual(classificationCounts, {
  'venous/femoral': 19, 'arterial/femoral': 24, 'arterial/central': 13,
  'venous/other': 79, 'specialty/other': 35, 'arterial/other': 13, 'venous/jugular': 6
}, 'Catalog audit must not silently infer anatomy or admit specialty devices');
assert(avalonProducts.every(entry => !classifyComparison(entry).eligible), 'Both Avalon lumens stay outside standard comparison');
assert.strictEqual(classifyComparison({ category: 'arterial cardioplegia', model: 'Ambiguous' }).eligible, false);
assert.strictEqual(classifyComparison({ category: 'arterial', model: 'EOPA Central', connectionSite: '1/4 in' }).location, 'other');
assert.strictEqual(classifyComparison({ category: 'venous', model: 'Bi-caval' }).location, 'other');
assert.strictEqual(classifyComparison({ category: 'venous', connectionSite: 'Right atrium' }).location, 'central');
assert.strictEqual(classifyComparison({ category: 'femoral venous', connectionSite: 'Jugular venous' }).location, 'jugular', 'Explicit anatomical site takes precedence');
assert.strictEqual(classifyComparison({ category: 'arterial', connectionSite: 'Femoral venous' }).eligible, false, 'Conflicting type/site metadata is ambiguous');
assert.strictEqual(classifyComparison({ category: 'arterial', connectionSite: 'Aortic root' }).eligible, false);
assert.strictEqual(new Set(pressureDropData.map(targetRuntime.getPressureDropTargetFlowKey)).size, 189);
const catalogEntry = pressureDropData[0];
assert.strictEqual(targetRuntime.getPressureDropTargetFlowKey(catalogEntry), targetRuntime.getPressureDropTargetFlowKey({ ...catalogEntry, lookupId: 'reordered' }));

for (const input of ['', '.', '0', '-1', 'NaN', 'Infinity', '1e309', '4.5junk', '1.2.3']) {
  assert(Number.isNaN(targetRuntime.parsePressureDropTargetFlow(input)), `${input} must not yield a usable flow`);
}
assert.strictEqual(targetRuntime.parsePressureDropTargetFlow('4,5'), 4.5);
assert.strictEqual(targetRuntime.parsePressureDropTargetFlow('100000'), 100000, 'No arbitrary clinical maximum');
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
const warningRows = [highArterial, venousHighMagnitude].map(entry => ({
  entry, key: targetRuntime.getPressureDropTargetFlowKey(entry), identity: entry.size,
  result: targetRuntime.getPressureDropTargetFlowResult(entry, 5)
}));
const warningTableRows = pressureDescendants(targetRuntime.createPressureDropTargetFlowTable(warningRows, [], () => {}), node => node.tagName === 'tr');
assert(warningTableRows[0].textContent.includes('High pressure drop warning (>100 mmHg).'), 'Arterial warning renders in desktop/mobile row');
assert(!warningTableRows[1].textContent.includes('High pressure drop warning'), 'Venous results retain their own semantics');
assert.deepStrictEqual(Array.from(targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 3, 'size'), row => row.entry.size), ['15 Fr', '19 Fr', '21 Fr']);
assert.deepStrictEqual(Array.from(targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 3, 'manufacturer'), row => row.entry.manufacturer), ['Getinge / Maquet', 'LivaNova', 'Medtronic']);
assert.deepStrictEqual(Array.from(targetRuntime.getPressureDropTargetFlowRows(targetFixtures, arterialFilters, 3, 'model'), row => row.entry.model), ['A', 'B', 'C']);
const actualFemoralRows = targetRuntime.getPressureDropTargetFlowRows(pressureDropData, arterialFilters, 4.5);
assert.strictEqual(actualFemoralRows.length, 24);
assert.strictEqual(new Set(Array.from(actualFemoralRows, row => row.entry.manufacturer)).size, 3);
const filteredFamily = targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { ...arterialFilters, manufacturer: 'Medtronic', model: nextGenModels[0] });
assert.strictEqual(filteredFamily.length, 6);
assert.strictEqual(targetRuntime.getPressureDropTargetFlowMatches(pressureDropData, { ...arterialFilters, manufacturer: 'LivaNova', model: nextGenModels[0] }).length, 0);

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

// Hard-coded cross-manufacturer catalog regressions at the same target flow.
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
const locationInput = targetNodes['pressure-drop-target-location'];
locationInput.value = 'femoral'; locationInput.dispatch('change');
function currentRows() { return pressureDescendants(targetNodes['pressure-drop-target-results'], node => node.tagName === 'tr'); }
function rowCheckbox(row) { return pressureDescendants(row, node => node.type === 'checkbox')[0]; }
const initialKeys = currentRows().map(row => row.dataset.productKey);
assert.strictEqual(initialKeys.length, 24);
assert(currentRows().some(row => row.textContent.includes('Out of source range')));
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
assert.strictEqual(currentRows().length, 24);
const removeButton = pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'button')[0];
removeButton.dispatch('click');
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 3);
targetFlowInput.value = '100000'; targetFlowInput.dispatch('input');
assert.strictEqual(currentRows().length, 24, 'Out-of-range-only results retain all products');
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'false');
assert(targetNodes['pressure-drop-target-results'].textContent.includes('No in-range estimates'));
targetNodes['pressure-drop-target-category'].value = 'venous'; targetNodes['pressure-drop-target-category'].dispatch('change');
assert.strictEqual(currentRows().length, 19);
assert.strictEqual(pressureDescendants(targetNodes['pressure-drop-target-chart'], node => node.tagName === 'li').length, 0, 'Category switch clears incompatible curves');
targetNodes['pressure-drop-target-model'].value = 'not a product'; controller.refresh();
assert(targetNodes['pressure-drop-target-results'].textContent.includes('No matching cannulas'));
assert.strictEqual(targetNodes['pressure-drop-target-view'].dataset.analyticsReady, 'false');

const overlay = targetRuntime.createPressureDropTargetFlowChart([targetFixtures[0], targetFixtures[1]], 4.5, true, () => {}, () => {});
const overlaySvg = pressureDescendants(overlay, node => node.tagName === 'svg')[0];
assert(overlaySvg.innerHTML.includes('data-target-flow-line="true"'));
assert.strictEqual((overlaySvg.innerHTML.match(/data-series-id=/g) || []).length, 2);
assert(overlaySvg.innerHTML.includes('Signed pressure: +80.0 mmHg') && overlaySvg.innerHTML.includes('Signed pressure: +45.0 mmHg'));
assert.strictEqual((overlaySvg.innerHTML.match(/data-raw-pressure-point=/g) || []).length, 4);
const externalLegend = pressureDescendants(overlay, node => node.tagName === 'li');
assert(externalLegend[0].textContent.includes('Medtronic · A · 19 Fr'));
assert(externalLegend[1].textContent.includes('Getinge / Maquet · B · 21 Fr'));
assert.strictEqual(externalLegend[0].dataset.productKey, targetRuntime.getPressureDropTargetFlowKey(targetFixtures[0]));
assert.strictEqual(pressureDescendants(externalLegend[0], node => node.style.backgroundColor)[0].style.backgroundColor, chartRuntime.productColors[0]);
const signedOverlay = targetRuntime.createPressureDropTargetFlowChart([targetFixtures[3]], 4.5, false, () => {}, () => {});
assert(signedOverlay.textContent.includes('signed pressure -80.0 mmHg'));
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
assert.strictEqual(targetRuntime.isPressureDropAnalyticsReady('target', readyTarget, readyTarget, readyTarget), true);
readyTarget.className = 'hidden';
assert.strictEqual(targetRuntime.isPressureDropAnalyticsReady('target', readyTarget, readyTarget, readyTarget), false);
console.log('Target-flow classification, interpolation, filtering, selection, chart and readiness regressions passed.');

const switchStart = mainJs.indexOf('    const setPressureDropView = (view) => {');
const switchSource = mainJs.slice(switchStart, mainJs.indexOf('\n    [', switchStart));
const switchPage = new PressureTestNode();
const switchPanels = { single: new PressureTestNode(), compare: new PressureTestNode(), target: new PressureTestNode() };
const switchTabs = { single: new PressureTestNode(), compare: new PressureTestNode(), target: new PressureTestNode() };
const switchRenders = [];
const switchView = vm.runInNewContext(`let activePressureDropView = 'single'; ${switchSource}; setPressureDropView`, {
  page: switchPage, status: new PressureTestNode(), selectedComparisonKeys: [],
  compareControls: { singleView: switchPanels.single, compareView: switchPanels.compare, singleTab: switchTabs.single, compareTab: switchTabs.compare },
  targetView: switchPanels.target, targetTab: switchTabs.target,
  targetComparison: { refresh: () => switchRenders.push('target') },
  populateCompareOptions: () => {}, renderCompare: () => switchRenders.push('compare'), render: () => switchRenders.push('single')
});
for (const mode of ['target', 'single', 'compare', 'target']) {
  Object.values(switchPanels).forEach(panel => { panel.dataset.analyticsReady = 'true'; });
  switchView(mode);
  assert.strictEqual(switchPage.dataset.pressureDropView, mode);
  Object.entries(switchPanels).forEach(([name, panel]) => {
    assert.strictEqual(panel.classList.contains('hidden'), name !== mode);
    if (name !== mode) assert.strictEqual(panel.dataset.analyticsReady, 'false', 'Mode switches clear inactive readiness');
    assert.strictEqual(switchTabs[name].attributes['aria-pressed'], String(name === mode));
  });
}
assert.deepStrictEqual(switchRenders, ['target', 'single', 'compare', 'target']);
console.log('Pressure-drop mode switching and inactive readiness regressions passed.');

// Execute the production feedback resolver with the active view and its real
// readiness contract. The feedback card itself remains unique across modes.
const feedbackNodes = Object.fromEntries([
  'cannula-pressure-drop-page', 'pressure-drop-target-view', 'pressure-drop-single-view',
  'pressure-drop-compare-view', 'pressure-drop-target-results', 'pressure-drop-results',
  'pressure-drop-compare-results'
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
  ['single', 'pressure-drop-single-view', 'pressure-drop-results'],
  ['compare', 'pressure-drop-compare-view', 'pressure-drop-compare-results']
]) {
  feedbackNodes['cannula-pressure-drop-page'].dataset.pressureDropView = mode;
  for (const panelId of ['pressure-drop-target-view', 'pressure-drop-single-view', 'pressure-drop-compare-view']) {
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
for (const id of ['pressure-drop-target-view', 'pressure-drop-single-view', 'pressure-drop-compare-view']) {
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
