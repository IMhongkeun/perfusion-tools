'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
  assert.strictEqual(
    getPressureDropComparisonSizeLabel(pas1315),
    'PAS 1315 · 13 Fr / 4.3 mm · 15 cm',
    'PAS 1315 comparison primary label should not append family, connector, or duplicate order-code text.'
  );
  assert(!mainJs.includes('Arterial HLS cannula · 3/8 inch LL · PAS 1315'), 'PAS 1315-only secondary header text should not be rendered in the comparison UI.');
  ['PAS 1515', 'PAS 1715', 'PAS 1915', 'PAS 2115', 'PAS 2315'].forEach(orderCode => {
    const entry = getingeArterialMatches.find(item => item.cannulaOrderCode === orderCode);
    assert(entry, `${orderCode} should remain available for label regression coverage.`);
    assert.strictEqual(
      getPressureDropComparisonSizeLabel(entry),
      entry.size,
      `${orderCode} comparison primary label should use the same concise size field formatter as PAS 1315.`
    );
  });
  const pas1715 = getingeArterialMatches.find(entry => entry.cannulaOrderCode === 'PAS 1715');
  assert.strictEqual(interpolatePressureDrop(pas1715.points, 5).state, 'exact', 'Comparison warning/status should still be able to identify exact digitized source points.');
  assert.strictEqual(interpolatePressureDrop(pas1715.points, 5.25).state, 'interpolated', 'Comparison warning/status should still be able to distinguish interpolated values.');

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
  assert.strictEqual(livaNovaRootEntries.length, 8, 'LivaNova root-related entries should remain present.');
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
  const rootPressureDropSnapshots = [
    ['Aortic Root Cannula / without Vent Line', '18Ga', 0.28, 34.6],
    ['Aortic Root Cannula with Vent Line', '14 Ga / 7 Fr', 0.38, 30],
    ['Aortic Root Cannula with Vent Line', '12 Ga / 9 Fr', 0.37, 18],
    ['Aortic Root Cannula without Vent Line', '16 Ga / 5 Fr', 0.29, 36],
    ['Aortic Root Cannula without Vent Line', '14 Ga / 7 Fr', 0.38, 30],
    ['Aortic Root Cannula without Vent Line', '12 Ga / 9 Fr', 0.37, 16.5],
    ['Aortic Root Long Needle', '14 Ga / 7 Fr', 0.36, 30],
    ['Aortic Root Long Needle', '12 Ga / 9 Fr', 0.38, 24.6]
  ];
  rootPressureDropSnapshots.forEach(([model, size, flow, expectedDrop]) => {
    const entry = livaNovaRootEntries.find(item => item.model === model && item.size === size);
    assert(entry, `${model} ${size} should remain available after root reclassification.`);
    const result = interpolatePressureDrop(entry.points, flow);
    assert.strictEqual(result.state, 'exact', `${model} ${size} should retain the same exact pressure-flow point at ${flow} L/min.`);
    assert.strictEqual(result.value, expectedDrop, `${model} ${size} pressure-drop data should remain unchanged.`);
  });

  const livaNovaArterialHighDrop = livaNovaEntries.find(entry => entry.model === 'Arterial Femoral Cannulae — Polyurethane tubing with suture ring, with introducer' && entry.size === '19 Fr');
  assert(livaNovaArterialHighDrop, 'A LivaNova arterial high-pressure example should remain available.');
  const arterialHighDropResult = getPressureDropComparisonResult(livaNovaArterialHighDrop, 5.26);
  assert.strictEqual(arterialHighDropResult.isHighPressure, true, 'Arterial cannula ΔP above 100 mmHg should retain the high-pressure warning.');
  assert.strictEqual(arterialHighDropResult.warningText, 'High pressure drop warning (>100 mmHg).');

  const livaNovaRapFv = livaNovaEntries.find(entry => entry.model === 'RAP FV Femoral Venous Cannulae' && entry.cannulaOrderCode === '200-100');
  assert(livaNovaRapFv, 'LivaNova RAP FV F22/22 venous example should remain available.');
  const rapFvHighDrop = interpolatePressureDrop(livaNovaRapFv.points, 6.29);
  assert.strictEqual(rapFvHighDrop.value, 129.7, 'RAP FV F22/22 source pressure-drop value should remain unchanged.');
  const rapFvComparisonResult = getPressureDropComparisonResult(livaNovaRapFv, 6.29);
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

// Avalon Elite 13 Fr dual-lumen regression coverage.
const avalonEntries = pressureDropData.filter(entry => entry.model === 'Avalon Elite Bi-Caval Dual-Lumen Catheter' && entry.size === '13 Fr');
assert.strictEqual(avalonEntries.length, 1, 'Avalon Elite 13 Fr must be registered as one selectable product.');
const avalon = avalonEntries[0];
assert.strictEqual(avalon.manufacturer, 'Getinge / Maquet');
assert.strictEqual(avalon.pressureSeries.length, 2, 'Avalon must contain two named series within one product.');
const infusion = avalon.pressureSeries.find(series => series.id === 'infusion');
const drainage = avalon.pressureSeries.find(series => series.id === 'drainage');
assert(infusion && drainage, 'Infusion and drainage series must both be present.');
assert.strictEqual(infusion.points.length, 22, 'Infusion must retain all 22 headerless source rows.');
assert.strictEqual(drainage.points.length, 23, 'Drainage must retain all 23 headerless source rows.');
const normalizedInfusion = getValidPressureDropPoints(infusion.points);
const normalizedDrainage = getValidPressureDropPoints(drainage.points);
assert(normalizedInfusion.every((point, index) => index === 0 || point.flow > normalizedInfusion[index - 1].flow), 'Infusion flows must normalize to unique ascending values.');
assert(normalizedDrainage.every((point, index) => index === 0 || point.flow > normalizedDrainage[index - 1].flow), 'Drainage flows must normalize to unique ascending values.');
assert(normalizedInfusion.every(point => point.pressureDrop > 0), 'Infusion signs must remain positive.');
assert(normalizedDrainage.every(point => point.pressureDrop < 0), 'Drainage signs must remain negative.');
assert(!infusion.points.some(point => point.flow === 0 && point.pressureDrop === 0), 'No fabricated infusion (0, 0) point is permitted.');
assert(!drainage.points.some(point => point.flow === 0 && point.pressureDrop === 0), 'No fabricated drainage (0, 0) point is permitted.');
assert.strictEqual(interpolatePressureDrop(infusion.points, 0.5).value, 98.73949579831927);
assert.strictEqual(interpolatePressureDrop(drainage.points, 0.5).value, -28.991596638655494);
assert(Math.abs(interpolatePressureDrop(infusion.points, 0.75).value - 208.54341736694676) < 1e-10);
assert(Math.abs(interpolatePressureDrop(drainage.points, 0.75).value - (-58.543417366946834)) < 1e-10);
const infusionAtPointNine = interpolatePressureDrop(infusion.points, 0.9);
const drainageAtPointNine = interpolatePressureDrop(drainage.points, 0.9);
assert.strictEqual(infusionAtPointNine.state, 'out_of_range');
assert.strictEqual(infusionAtPointNine.value, null);
assert.strictEqual(drainageAtPointNine.state, 'interpolated');
assert(Math.abs(drainageAtPointNine.value - (-79.7527706734868)) < 1e-10);
[infusion, drainage].forEach(series => {
  const result = interpolatePressureDrop(series.points, 1.3);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
assert(mainJs.includes('function normalizePressureDropEntry') && mainJs.includes("label: 'Pressure drop'"), 'Legacy records must normalize to one pressure series.');
assert(mainJs.includes('drawPressureDropSeriesChart(svg, series') && mainJs.includes('data-zero-pressure-line="true"'), 'Dual-series chart and zero-reference line must be implemented.');
assert(mainJs.includes("item.lineStyle === 'dashed'") && mainJs.includes("{ curveMode: 'linear' }"), 'Series must use line style as well as labels and retain linear rendering.');
assert(mainJs.includes('selectedComparisonKeys.length < 4'), 'Avalon remains one entry under the existing four-product selection limit.');

// Avalon Elite 16 Fr reuses the same dual-lumen product model as 13 Fr.
const avalon16Entries = pressureDropData.filter(entry => entry.model === avalon.model && entry.size === '16 Fr');
assert.strictEqual(avalon16Entries.length, 1, 'Avalon Elite 16 Fr must be one selectable product-size record.');
const avalon16 = avalon16Entries[0];
assert.strictEqual(avalon16.manufacturer, avalon.manufacturer);
assert.strictEqual(avalon16.model, avalon.model);
assert.strictEqual(avalon16.category, avalon.category);
assert.strictEqual(avalon16.outerDiameterMm, 5.3);
assert.strictEqual(avalon16.insertableLength, '14 cm (5.5 in)');
assert.strictEqual(avalon16.connectorSize, '1/4 in');
assert.strictEqual(avalon16.cannulaOrderCode, '10016-CE');
assert.strictEqual(avalon16.sapCode, '70107.3604');
assert.strictEqual(avalon16.orderUnit, '1/Carton');
assert.strictEqual(avalon16.metadata.orderUnit, '1/Carton');
assert.strictEqual(avalon16.pressureSeries.length, 2);
const infusion16 = avalon16.pressureSeries.find(series => series.id === 'infusion');
const drainage16 = avalon16.pressureSeries.find(series => series.id === 'drainage');
assert(infusion16 && drainage16, 'Avalon Elite 16 Fr must contain Infusion and Drainage series.');
assert.strictEqual(infusion16.label, 'Infusion');
assert.strictEqual(infusion16.lineStyle, 'solid');
assert.strictEqual(drainage16.label, 'Drainage');
assert.strictEqual(drainage16.lineStyle, 'dashed');
assert.strictEqual(infusion16.points.length, 25, 'Infusion must retain all 25 headerless source rows.');
assert.strictEqual(drainage16.points.length, 29, 'Drainage must retain all 29 headerless source rows.');
const normalizedInfusion16 = getValidPressureDropPoints(infusion16.points);
const normalizedDrainage16 = getValidPressureDropPoints(drainage16.points);
assert.deepStrictEqual([normalizedInfusion16[0].flow, normalizedInfusion16.at(-1).flow], [0.016746411483253565, 1.200956937799043]);
assert.deepStrictEqual([normalizedDrainage16[0].flow, normalizedDrainage16.at(-1).flow], [0.13875598086124397, 2.0502392344497604]);
assert(normalizedInfusion16.every((point, index) => index === 0 || point.flow > normalizedInfusion16[index - 1].flow));
assert(normalizedDrainage16.every((point, index) => index === 0 || point.flow > normalizedDrainage16[index - 1].flow));
assert(infusion16.points.some(point => point.flow === 1.200956937799043 && point.pressureDrop === 243.27731092436966), 'The first supplied infusion row must be retained.');
assert(drainage16.points.some(point => point.flow === 2.0502392344497604 && point.pressureDrop === -148.31932773109241), 'The first supplied drainage row must be retained.');
assert(infusion16.points.every(point => point.pressureDrop > 0));
assert(drainage16.points.every(point => point.pressureDrop < 0));
assert(![...infusion16.points, ...drainage16.points].some(point => point.flow === 0 && point.pressureDrop === 0));
const assertEstimate = (series, flow, expected, expectedState = 'interpolated') => {
  const result = interpolatePressureDrop(series.points, flow);
  assert.strictEqual(result.state, expectedState);
  assert(Math.abs(result.value - expected) < 1e-10, `${series.label} at ${flow} L/min should equal ${expected}, received ${result.value}.`);
};
assertEstimate(infusion16, 0.5, 37.11484593837531, 'exact');
assertEstimate(drainage16, 0.5, -10.408163265306193);
assertEstimate(infusion16, 0.75, 96.43962848297211);
assertEstimate(drainage16, 0.75, -22.433111175504727);
assertEstimate(infusion16, 1.0, 174.0731586752347);
assertEstimate(drainage16, 1.0, -39.07563025210089, 'exact');
assert.strictEqual(interpolatePressureDrop(infusion16.points, 1.3).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion16.points, 1.3).value, null);
assertEstimate(drainage16, 1.3, -62.86561136082345);
assert.strictEqual(interpolatePressureDrop(infusion16.points, 1.5).state, 'out_of_range');
assertEstimate(drainage16, 1.5, -81.0924369747899, 'exact');
[infusion16, drainage16].forEach(series => {
  const result = interpolatePressureDrop(series.points, 2.1);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
assert.strictEqual(pressureDropData.filter(entry => entry.model === avalon.model && ['13 Fr', '16 Fr'].includes(entry.size)).length, 2, 'Avalon selector family must retain one 13 Fr and one 16 Fr product record.');
assert(mainJs.includes('function createPressureDropComparisonChart') && mainJs.includes('colorIndex: productIndex'), 'Multi-size comparison must assign one color per selected product.');
assert(mainJs.includes('displayLabel: `${entry.size || entry.model} — ${series.label}`'), 'Multi-size chart legend labels must distinguish size and lumen.');
assert(mainJs.includes('selectedComparisonKeys.length < 4'), 'Two Avalon sizes count as two products under the unchanged four-product limit.');

// Avalon Elite 19 Fr data and exact-duplicate import behavior.
const avalon19Entries = pressureDropData.filter(entry => entry.model === avalon.model && entry.size === '19 Fr');
assert.strictEqual(avalon19Entries.length, 1, 'Avalon Elite 19 Fr must be one selectable product-size record.');
const avalon19 = avalon19Entries[0];
assert.strictEqual(avalon19.manufacturer, avalon.manufacturer);
assert.strictEqual(avalon19.model, avalon.model);
assert.strictEqual(avalon19.category, avalon.category);
assert.strictEqual(avalon19.outerDiameterMm, 6.4);
assert.strictEqual(avalon19.insertableLength, '21 cm (8.3 in)');
assert.strictEqual(avalon19.connectorSize, '1/4 in');
assert.strictEqual(avalon19.cannulaOrderCode, '10019-CE');
assert.strictEqual(avalon19.sapCode, '70107.3605');
assert.strictEqual(avalon19.orderUnit, '1/Carton');
assert.deepStrictEqual(avalon19.metadata, {
  outerDiameter: '6.4 mm',
  insertableLength: '21 cm (8.3 in)',
  connectorSize: '1/4 in',
  productCode: '10019-CE',
  sapCode: '70107.3605',
  orderUnit: '1/Carton'
});
assert.strictEqual(avalon19.pressureSeries.length, 2);
const infusion19 = avalon19.pressureSeries.find(series => series.id === 'infusion');
const drainage19 = avalon19.pressureSeries.find(series => series.id === 'drainage');
assert(infusion19 && drainage19, 'Avalon Elite 19 Fr must contain Infusion and Drainage series.');
assert.strictEqual(infusion19.label, 'Infusion');
assert.strictEqual(infusion19.lineStyle, 'solid');
assert.strictEqual(drainage19.label, 'Drainage');
assert.strictEqual(drainage19.lineStyle, 'dashed');
assert.strictEqual(infusion19.sourceRowCount, 33);
assert.strictEqual(infusion19.exactDuplicateRowsRemoved, 2);
assert.strictEqual(infusion19.points.length, 31);
assert.strictEqual(drainage19.sourceRowCount, 30);
assert.strictEqual(drainage19.points.length, 30);
const normalizedInfusion19 = getValidPressureDropPoints(infusion19.points);
const normalizedDrainage19 = getValidPressureDropPoints(drainage19.points);
assert.deepStrictEqual([normalizedInfusion19[0].flow, normalizedInfusion19.at(-1).flow], [0.11961722488038273, 2.0861244019138754]);
assert.deepStrictEqual([normalizedDrainage19[0].flow, normalizedDrainage19.at(-1).flow], [0.1291866028708134, 2.4976076555023923]);
[normalizedInfusion19, normalizedDrainage19].forEach(points => {
  assert(points.every((point, index) => index === 0 || point.flow > points[index - 1].flow), 'Normalized flows must be unique and ascending.');
});
assert(infusion19.points.some(point => point.flow === 2.0861244019138754 && point.pressureDrop === 249.99999999999991));
assert(drainage19.points.some(point => point.flow === 2.4976076555023923 && point.pressureDrop === -113.02521008403363));
assert.strictEqual(infusion19.points.filter(point => point.flow === 1.3636363636363633 && point.pressureDrop === 114.42577030812319).length, 1);
assert.strictEqual(infusion19.points.filter(point => point.flow === 1.5023923444976077 && point.pressureDrop === 137.95518207282907).length, 1);
assert(infusion19.points.every(point => point.pressureDrop > 0));
assert(drainage19.points.every(point => point.pressureDrop < 0));
assert(![...infusion19.points, ...drainage19.points].some(point => point.flow === 0 && point.pressureDrop === 0));
assertEstimate(infusion19, 0.5, 10.112044817927172);
assertEstimate(drainage19, 0.5, -6.582633053221343, 'exact');
assertEstimate(infusion19, 0.75, 31.08076563958913);
assertEstimate(drainage19, 0.75, -12.211551287181576);
assertEstimate(infusion19, 1.0, 60.340136054421725);
assertEstimate(drainage19, 1.0, -20.214752567693754);
assertEstimate(infusion19, 1.5, 137.5395319418089);
assertEstimate(drainage19, 1.5, -43.55742296918771, 'exact');
assertEstimate(infusion19, 2.0, 232.07282913165258, 'exact');
assertEstimate(drainage19, 2.0, -73.62278244631188);
assert.strictEqual(interpolatePressureDrop(infusion19.points, 2.2).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion19.points, 2.2).value, null);
assertEstimate(drainage19, 2.2, -88.03361344537816);
[infusion19, drainage19].forEach(series => {
  const result = interpolatePressureDrop(series.points, 2.5);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
const normalizeSeriesSource = mainJs.slice(
  mainJs.indexOf('function normalizePressureDropSeries'),
  mainJs.indexOf('function normalizePressureDropEntry')
);
const normalizePressureDropSeriesRuntime = vm.runInNewContext(`${normalizeSeriesSource}; normalizePressureDropSeries`);
const identicalDuplicates = normalizePressureDropSeriesRuntime({ points: [
  { flow: 1, pressureDrop: 10 },
  { flow: 1, pressureDrop: 10 }
] });
assert.strictEqual(identicalDuplicates.points.length, 1, 'Exact duplicate pairs must normalize to one point.');
assert.throws(
  () => normalizePressureDropSeriesRuntime({ points: [{ flow: 1, pressureDrop: 10 }, { flow: 1, pressureDrop: 11 }] }),
  /conflicting pressures/,
  'Conflicting pressures at one flow must fail validation.'
);
const avalonFamilyEntries = pressureDropData.filter(entry => entry.model === avalon.model && ['13 Fr', '16 Fr', '19 Fr'].includes(entry.size));
assert.deepStrictEqual(avalonFamilyEntries.map(entry => entry.size).sort(), ['13 Fr', '16 Fr', '19 Fr']);
assert.strictEqual(avalonFamilyEntries.length, 3, 'Three Avalon sizes must consume three product slots, not six lumen slots.');
assert.strictEqual(avalonFamilyEntries.flatMap(entry => entry.pressureSeries).length, 6, 'Three Avalon products must generate six series traces.');
assert.strictEqual(new Set(avalonFamilyEntries.flatMap(entry => entry.pressureSeries.map(series => `${entry.size} — ${series.label}`))).size, 6, 'Size-and-lumen chart labels must be unique.');

// Avalon Elite 20 Fr preserves source-signed drainage values, including the positive near-zero point.
const avalon20Entries = pressureDropData.filter(entry => entry.model === avalon.model && entry.size === '20 Fr');
assert.strictEqual(avalon20Entries.length, 1, 'Avalon Elite 20 Fr must be one selectable product-size record.');
const avalon20 = avalon20Entries[0];
assert.strictEqual(avalon20.manufacturer, avalon.manufacturer);
assert.strictEqual(avalon20.model, avalon.model);
assert.strictEqual(avalon20.category, avalon.category);
assert.strictEqual(avalon20.outerDiameterMm, 6.7);
assert.strictEqual(avalon20.insertableLength, '31 cm (12.2 in)');
assert.strictEqual(avalon20.connectorSize, '3/8 in');
assert.strictEqual(avalon20.cannulaOrderCode, '10020-CE');
assert.strictEqual(avalon20.sapCode, '70107.3606');
assert.strictEqual(avalon20.orderUnit, '1/Carton');
assert.deepStrictEqual(avalon20.metadata, {
  outerDiameter: '6.7 mm',
  insertableLength: '31 cm (12.2 in)',
  connectorSize: '3/8 in',
  productCode: '10020-CE',
  sapCode: '70107.3606',
  orderUnit: '1/Carton'
});
assert.strictEqual(avalon20.pressureSeries.length, 2);
const infusion20 = avalon20.pressureSeries.find(series => series.id === 'infusion');
const drainage20 = avalon20.pressureSeries.find(series => series.id === 'drainage');
assert(infusion20 && drainage20, 'Avalon Elite 20 Fr must contain Infusion and Drainage series.');
assert.strictEqual(infusion20.label, 'Infusion');
assert.strictEqual(infusion20.lineStyle, 'solid');
assert.strictEqual(drainage20.label, 'Drainage');
assert.strictEqual(drainage20.lineStyle, 'dashed');
assert.strictEqual(infusion20.points.length, 26);
assert.strictEqual(drainage20.points.length, 23);
const normalizedInfusion20 = getValidPressureDropPoints(infusion20.points);
const normalizedDrainage20 = getValidPressureDropPoints(drainage20.points);
assert.deepStrictEqual([normalizedInfusion20[0].flow, normalizedInfusion20.at(-1).flow], [0.033333333333333326, 1.9]);
assert.deepStrictEqual([normalizedDrainage20[0].flow, normalizedDrainage20.at(-1).flow], [0.05555555555555558, 2.638888888888889]);
[normalizedInfusion20, normalizedDrainage20].forEach(points => {
  assert(points.every((point, index) => index === 0 || point.flow > points[index - 1].flow), '20 Fr flows must normalize to unique ascending values.');
});
assert(infusion20.points.some(point => point.flow === 1.9 && point.pressureDrop === 250), 'The first supplied Infusion row must be retained.');
assert(drainage20.points.some(point => point.flow === 2.638888888888889 && point.pressureDrop === -147.30094466936572), 'The first supplied Drainage row must be retained.');
const positiveDrainagePoint = drainage20.points.find(point => point.flow === 0.05555555555555558);
assert.deepStrictEqual(positiveDrainagePoint, { flow: 0.05555555555555558, pressureDrop: 0.06747638326589822 });
assert(infusion20.points.every(point => point.pressureDrop > 0));
assert(drainage20.points.some(point => point.pressureDrop > 0));
assert(drainage20.points.some(point => point.pressureDrop < 0));
assert(![...infusion20.points, ...drainage20.points].some(point => point.flow === 0 && point.pressureDrop === 0));
assertEstimate(infusion20, 0.05555555555555558, 1.2550607287449569);
assertEstimate(drainage20, 0.05555555555555558, 0.06747638326589822, 'exact');
assertEstimate(infusion20, 0.5, 14.786324786324796);
assertEstimate(drainage20, 0.5, -9.10931174089069, 'exact');
assertEstimate(infusion20, 0.75, 39.11381016644177);
assertEstimate(drainage20, 0.75, -16.904183535762456);
assertEstimate(infusion20, 1.0, 73.25043377674957);
assertEstimate(drainage20, 1.0, -27.70280401859344);
assertEstimate(infusion20, 1.5, 161.4709851551957, 'exact');
assertEstimate(drainage20, 1.5, -56.34278002699057);
assertEstimate(infusion20, 1.9, 250, 'exact');
assertEstimate(drainage20, 1.9, -82.60073260073257);
assertEstimate(infusion20, 0.05, 1.2280701754386145);
assert.strictEqual(interpolatePressureDrop(drainage20.points, 0.05).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(drainage20.points, 0.05).value, null);
assert.strictEqual(interpolatePressureDrop(infusion20.points, 2.0).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion20.points, 2.0).value, null);
assertEstimate(drainage20, 2.0, -90.40485829959513);
assert.strictEqual(interpolatePressureDrop(infusion20.points, 2.5).state, 'out_of_range');
assertEstimate(drainage20, 2.5, -133.1848852901485);
[infusion20, drainage20].forEach(series => {
  const result = interpolatePressureDrop(series.points, 2.7);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
assert(!mainJs.includes('Math.abs(point.pressureDrop)'), 'Normalization and charting must not coerce signed source pressures.');
assert(mainJs.includes('function formatSignedPressureDrop') && mainJs.includes("roundedValue > 0 ? '+' : ''"), 'Signed pressure formatting must show positive values explicitly and normalize display-zero noise.');
const allAvalonEntries = pressureDropData.filter(entry => entry.model === avalon.model && ['13 Fr', '16 Fr', '19 Fr', '20 Fr'].includes(entry.size));
assert.deepStrictEqual(allAvalonEntries.map(entry => entry.size).sort(), ['13 Fr', '16 Fr', '19 Fr', '20 Fr']);
assert.strictEqual(allAvalonEntries.length, 4, 'Four Avalon sizes must consume four product slots, not eight lumen slots.');
assert.strictEqual(allAvalonEntries.flatMap(entry => entry.pressureSeries).length, 8, 'Four Avalon products must generate eight traces.');
assert.strictEqual(new Set(allAvalonEntries.flatMap(entry => entry.pressureSeries.map(series => `${entry.size} — ${series.label}`))).size, 8, 'All size-and-lumen labels must remain unique.');

// Avalon Elite 23 Fr uses generic exact-duplicate normalization and independent lumen ranges.
const avalon23Entries = pressureDropData.filter(entry => entry.model === avalon.model && entry.size === '23 Fr');
assert.strictEqual(avalon23Entries.length, 1, 'Avalon Elite 23 Fr must be one selectable product-size record.');
const avalon23 = avalon23Entries[0];
assert.strictEqual(avalon23.manufacturer, avalon.manufacturer);
assert.strictEqual(avalon23.model, avalon.model);
assert.strictEqual(avalon23.category, avalon.category);
assert.strictEqual(avalon23.outerDiameterMm, 7.7);
assert.strictEqual(avalon23.insertableLength, '31 cm (12.2 in)');
assert.strictEqual(avalon23.connectorSize, '3/8 in');
assert.strictEqual(avalon23.cannulaOrderCode, '10023-CE');
assert.strictEqual(avalon23.sapCode, '70107.3607');
assert.strictEqual(avalon23.orderUnit, '1/Carton');
assert.deepStrictEqual(avalon23.metadata, {
  outerDiameter: '7.7 mm',
  insertableLength: '31 cm (12.2 in)',
  connectorSize: '3/8 in',
  productCode: '10023-CE',
  sapCode: '70107.3607',
  orderUnit: '1/Carton'
});
assert.strictEqual(avalon23.pressureSeries.length, 2);
const infusion23 = avalon23.pressureSeries.find(series => series.id === 'infusion');
const drainage23 = avalon23.pressureSeries.find(series => series.id === 'drainage');
assert(infusion23 && drainage23, 'Avalon Elite 23 Fr must contain Infusion and Drainage series.');
assert.strictEqual(infusion23.label, 'Infusion');
assert.strictEqual(infusion23.lineStyle, 'solid');
assert.strictEqual(drainage23.label, 'Drainage');
assert.strictEqual(drainage23.lineStyle, 'dashed');
assert.strictEqual(infusion23.sourceRowCount, 32);
assert.strictEqual(infusion23.exactDuplicateRowsRemoved, 1);
assert.strictEqual(infusion23.points.length, 31);
assert.strictEqual(drainage23.sourceRowCount, 32);
assert.strictEqual(drainage23.exactDuplicateRowsRemoved, 1);
assert.strictEqual(drainage23.points.length, 31);
const normalizedInfusion23 = getValidPressureDropPoints(infusion23.points);
const normalizedDrainage23 = getValidPressureDropPoints(drainage23.points);
assert.deepStrictEqual([normalizedInfusion23[0].flow, normalizedInfusion23.at(-1).flow], [0.2777777777777778, 3.01111111111111]);
assert.deepStrictEqual([normalizedDrainage23[0].flow, normalizedDrainage23.at(-1).flow], [0.2333333333333332, 3.905555555555555]);
[normalizedInfusion23, normalizedDrainage23].forEach(points => {
  assert(points.every((point, index) => index === 0 || point.flow > points[index - 1].flow), '23 Fr flows must normalize to unique ascending values.');
});
assert(infusion23.points.some(point => point.flow === 3.01111111111111 && point.pressureDrop === 244.0620782726046));
assert(drainage23.points.some(point => point.flow === 3.905555555555555 && point.pressureDrop === -147.30094466936572));
assert.strictEqual(infusion23.points.filter(point => point.flow === 1.0 && point.pressureDrop === 24.358974358974365).length, 1);
assert.strictEqual(drainage23.points.filter(point => point.flow === 2.8833333333333333 && point.pressureDrop === -87.92172739541161).length, 1);
assert(infusion23.points.every(point => point.pressureDrop > 0));
assert(drainage23.points.every(point => point.pressureDrop < 0));
assert(![...infusion23.points, ...drainage23.points].some(point => point.flow === 0 && point.pressureDrop === 0));
assertEstimate(infusion23, 0.5, 4.2240215924426545);
assertEstimate(drainage23, 0.5, -2.9122807017543932);
assertEstimate(infusion23, 0.75, 12.199019816748377);
assertEstimate(drainage23, 0.75, -7.489878542510086);
assertEstimate(infusion23, 1.0, 24.358974358974365, 'exact');
assertEstimate(drainage23, 1.0, -13.659147869674147);
assertEstimate(infusion23, 1.2, 37.66531713900137);
assertEstimate(drainage23, 1.2, -18.825910931174064, 'exact');
assertEstimate(infusion23, 1.5, 63.72365825807124);
assertEstimate(drainage23, 1.5, -28.722447143499725);
assertEstimate(infusion23, 2.0, 115.25485310910415);
assertEstimate(drainage23, 2.0, -47.327935222672075);
assertEstimate(infusion23, 2.5, 175.50607287449392);
assertEstimate(drainage23, 2.5, -69.30998063721174);
assertEstimate(infusion23, 2.8833333333333333, 225.97840755735498);
assertEstimate(drainage23, 2.8833333333333333, -87.92172739541161, 'exact');
assertEstimate(infusion23, 3.0, 242.51976094081368);
assertEstimate(drainage23, 3.0, -93.58974358974358);
assert.strictEqual(interpolatePressureDrop(infusion23.points, 0.25).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion23.points, 0.25).value, null);
assertEstimate(drainage23, 0.25, -0.5346205751064089);
assert.strictEqual(interpolatePressureDrop(infusion23.points, 3.2).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion23.points, 3.2).value, null);
assertEstimate(drainage23, 3.2, -105.27279737806056);
assert.strictEqual(interpolatePressureDrop(infusion23.points, 3.9).state, 'out_of_range');
assertEstimate(drainage23, 3.9, -147.0065022696602);
[infusion23, drainage23].forEach(series => {
  const result = interpolatePressureDrop(series.points, 4.0);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
const fiveAvalonEntries = pressureDropData.filter(entry => entry.model === avalon.model && ['13 Fr', '16 Fr', '19 Fr', '20 Fr', '23 Fr'].includes(entry.size));
assert.deepStrictEqual(fiveAvalonEntries.map(entry => entry.size).sort(), ['13 Fr', '16 Fr', '19 Fr', '20 Fr', '23 Fr']);
assert.strictEqual(fiveAvalonEntries.length, 5, 'The selector must expose five Avalon product-size records.');
assert.strictEqual(fiveAvalonEntries.flatMap(entry => entry.pressureSeries).length, 10, 'Five available products contain ten series, while only selected products are charted.');
const fourSelectedAvalonEntries = fiveAvalonEntries.filter(entry => entry.size !== '19 Fr');
assert.strictEqual(fourSelectedAvalonEntries.length, 4);
assert.strictEqual(fourSelectedAvalonEntries.flatMap(entry => entry.pressureSeries).length, 8, 'Any four selected Avalon products generate eight traces.');
assert.strictEqual(new Set(fourSelectedAvalonEntries.flatMap(entry => entry.pressureSeries.map(series => `${entry.size} — ${series.label}`))).size, 8);
assert(mainJs.includes('selectedComparisonKeys.length < 4') && mainJs.includes('selectedComparisonKeys.length >= 4'), 'The comparison limit must remain four selected products.');

// Avalon Elite 27 Fr preserves three positive low-flow Drainage source points.
const avalon27Entries = pressureDropData.filter(entry => entry.model === avalon.model && entry.size === '27 Fr');
assert.strictEqual(avalon27Entries.length, 1, 'Avalon Elite 27 Fr must be one selectable product-size record.');
const avalon27 = avalon27Entries[0];
assert.strictEqual(avalon27.manufacturer, avalon.manufacturer);
assert.strictEqual(avalon27.model, avalon.model);
assert.strictEqual(avalon27.category, avalon.category);
assert.strictEqual(avalon27.outerDiameterMm, 9.0);
assert.strictEqual(avalon27.insertableLength, '31 cm (12.2 in)');
assert.strictEqual(avalon27.connectorSize, '3/8 in');
assert.strictEqual(avalon27.cannulaOrderCode, '10027-CE');
assert.strictEqual(avalon27.sapCode, '70107.3608');
assert.strictEqual(avalon27.orderUnit, '1/Carton');
assert.deepStrictEqual(avalon27.metadata, {
  outerDiameter: '9.0 mm',
  insertableLength: '31 cm (12.2 in)',
  connectorSize: '3/8 in',
  productCode: '10027-CE',
  sapCode: '70107.3608',
  orderUnit: '1/Carton'
});
assert.strictEqual(avalon27.pressureSeries.length, 2);
const infusion27 = avalon27.pressureSeries.find(series => series.id === 'infusion');
const drainage27 = avalon27.pressureSeries.find(series => series.id === 'drainage');
assert(infusion27 && drainage27, 'Avalon Elite 27 Fr must contain Infusion and Drainage series.');
assert.strictEqual(infusion27.label, 'Infusion');
assert.strictEqual(infusion27.lineStyle, 'solid');
assert.strictEqual(drainage27.label, 'Drainage');
assert.strictEqual(drainage27.lineStyle, 'dashed');
assert.strictEqual(infusion27.points.length, 39);
assert.strictEqual(drainage27.points.length, 31);
const normalizedInfusion27 = getValidPressureDropPoints(infusion27.points);
const normalizedDrainage27 = getValidPressureDropPoints(drainage27.points);
assert.deepStrictEqual([normalizedInfusion27[0].flow, normalizedInfusion27.at(-1).flow], [0.19444444444444453, 4.633333333333333]);
assert.deepStrictEqual([normalizedDrainage27[0].flow, normalizedDrainage27.at(-1).flow], [0.09444444444444455, 4.994444444444444]);
[normalizedInfusion27, normalizedDrainage27].forEach(points => {
  assert(points.every((point, index) => index === 0 || point.flow > points[index - 1].flow), '27 Fr flows must normalize to unique ascending values.');
});
assert(infusion27.points.some(point => point.flow === 4.633333333333333 && point.pressureDrop === 250));
assert(drainage27.points.some(point => point.flow === 4.994444444444444 && point.pressureDrop === -96.01889338731445));
const positiveDrainageFlows27 = [0.09444444444444455, 0.23333333333333328, 0.36111111111111116];
positiveDrainageFlows27.forEach(flow => {
  assert.deepStrictEqual(drainage27.points.find(point => point.flow === flow), { flow, pressureDrop: 0.06747638326589822 });
});
assert(infusion27.points.every(point => point.pressureDrop > 0));
assert.strictEqual(drainage27.points.filter(point => point.pressureDrop > 0).length, 3);
assert(drainage27.points.some(point => point.pressureDrop < 0));
assert(![...infusion27.points, ...drainage27.points].some(point => point.flow === 0 && point.pressureDrop === 0));
assert.strictEqual(interpolatePressureDrop(infusion27.points, 0.1).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion27.points, 0.1).value, null);
assertEstimate(drainage27, 0.1, 0.06747638326589822);
assertEstimate(infusion27, 0.2, 1.1678604796013892);
assertEstimate(drainage27, 0.2, 0.06747638326589822);
assertEstimate(infusion27, 0.5, 1.8586676481413553);
assertEstimate(drainage27, 0.5, -1.012145748987848);
assertEstimate(infusion27, 0.75, 3.585555400437459);
assertEstimate(drainage27, 0.75, -1.3663967611336272);
assertEstimate(infusion27, 1.0, 6.404388898668046);
assertEstimate(drainage27, 1.0, -3.125120493541554);
assertEstimate(infusion27, 1.5, 24.358974358974365, 'exact');
assertEstimate(drainage27, 1.5, -8.67071524966263);
assertEstimate(infusion27, 2.0, 53.05892937471885);
assertEstimate(drainage27, 2.0, -17.63178342125711);
assertEstimate(infusion27, 3.0, 121.43499775078723);
assertEstimate(drainage27, 3.0, -38.42520502439528);
assertEstimate(infusion27, 4.0, 198.32808517019038);
assertEstimate(drainage27, 4.0, -65.9294247013545);
assertEstimate(infusion27, 4.6, 247.24696356275305);
assertEstimate(drainage27, 4.6, -83.44447090577121);
assert.strictEqual(interpolatePressureDrop(infusion27.points, 4.7).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(infusion27.points, 4.7).value, null);
assertEstimate(drainage27, 4.7, -86.01651186790511);
assert.strictEqual(interpolatePressureDrop(infusion27.points, 4.9).state, 'out_of_range');
assertEstimate(drainage27, 4.9, -92.9599640125956);
[infusion27, drainage27].forEach(series => {
  const result = interpolatePressureDrop(series.points, 5.0);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
assert(!mainJs.includes('Math.abs(point.pressureDrop)'), 'Source-signed Drainage values must not be coerced.');
const sixAvalonEntries = pressureDropData.filter(entry => entry.model === avalon.model && ['13 Fr', '16 Fr', '19 Fr', '20 Fr', '23 Fr', '27 Fr'].includes(entry.size));
assert.deepStrictEqual(sixAvalonEntries.map(entry => entry.size).sort(), ['13 Fr', '16 Fr', '19 Fr', '20 Fr', '23 Fr', '27 Fr']);
assert.strictEqual(sixAvalonEntries.length, 6, 'The selector must expose six Avalon product-size records.');
const selectedFourAvalonEntries = sixAvalonEntries.filter(entry => ['19 Fr', '20 Fr', '23 Fr', '27 Fr'].includes(entry.size));
assert.strictEqual(selectedFourAvalonEntries.length, 4);
assert.strictEqual(selectedFourAvalonEntries.flatMap(entry => entry.pressureSeries).length, 8, 'Four selected products generate eight traces while using four slots.');
assert.strictEqual(new Set(selectedFourAvalonEntries.flatMap(entry => entry.pressureSeries.map(series => `${entry.size} — ${series.label}`))).size, 8);
assert(mainJs.includes('selectedComparisonKeys.length < 4') && mainJs.includes('selectedComparisonKeys.length >= 4'), 'The comparison limit must remain four selected products.');

// Avalon Elite 31 Fr preserves duplicate normalization and two natural low-flow zero crossings.
const avalon31Entries = pressureDropData.filter(entry => entry.model === avalon.model && entry.size === '31 Fr');
assert.strictEqual(avalon31Entries.length, 1, 'Avalon Elite 31 Fr must be one selectable product-size record.');
const avalon31 = avalon31Entries[0];
assert.strictEqual(avalon31.manufacturer, avalon.manufacturer);
assert.strictEqual(avalon31.model, avalon.model);
assert.strictEqual(avalon31.category, avalon.category);
assert.strictEqual(avalon31.outerDiameterMm, 10.3);
assert.strictEqual(avalon31.insertableLength, '31 cm (12.2 in)');
assert.strictEqual(avalon31.connectorSize, '3/8 in');
assert.strictEqual(avalon31.cannulaOrderCode, '10031-CE');
assert.strictEqual(avalon31.sapCode, '70107.3609');
assert.strictEqual(avalon31.orderUnit, '1/Carton');
assert.deepStrictEqual(avalon31.metadata, {
  outerDiameter: '10.3 mm',
  insertableLength: '31 cm (12.2 in)',
  connectorSize: '3/8 in',
  productCode: '10031-CE',
  sapCode: '70107.3609',
  orderUnit: '1/Carton'
});
assert.strictEqual(avalon31.pressureSeries.length, 2);
const infusion31 = avalon31.pressureSeries.find(series => series.id === 'infusion');
const drainage31 = avalon31.pressureSeries.find(series => series.id === 'drainage');
assert(infusion31 && drainage31, 'Avalon Elite 31 Fr must contain Infusion and Drainage series.');
assert.strictEqual(infusion31.sourceRowCount, 41);
assert.strictEqual(infusion31.exactDuplicateRowsRemoved, 1);
assert.strictEqual(infusion31.points.length, 40);
assert.strictEqual(drainage31.points.length, 35);
assert.strictEqual(infusion31.lineStyle, 'solid');
assert.strictEqual(drainage31.lineStyle, 'dashed');
const normalizedInfusion31 = getValidPressureDropPoints(infusion31.points);
const normalizedDrainage31 = getValidPressureDropPoints(drainage31.points);
assert.deepStrictEqual([normalizedInfusion31[0].flow, normalizedInfusion31.at(-1).flow], [0.1777777777777778, 5.994444444444444]);
assert.deepStrictEqual([normalizedDrainage31[0].flow, normalizedDrainage31.at(-1).flow], [0.3833333333333333, 5.988888888888889]);
[normalizedInfusion31, normalizedDrainage31].forEach(points => {
  assert(points.every((point, index) => index === 0 || point.flow > points[index - 1].flow), '31 Fr flows must normalize to unique ascending values.');
});
assert.strictEqual(infusion31.points.filter(point => point.flow === 2.522222222222222 && point.pressureDrop === 42.17273954116061).length, 1);
[
  { flow: 0.3833333333333333, pressureDrop: -0.47233468286100333 },
  { flow: 0.5166666666666666, pressureDrop: 0.06747638326589822 },
  { flow: 0.6555555555555554, pressureDrop: 0.06747638326589822 },
  { flow: 0.822222222222222, pressureDrop: -0.47233468286100333 }
].forEach(expectedPoint => assert.deepStrictEqual(drainage31.points.find(point => point.flow === expectedPoint.flow), expectedPoint));
assert(infusion31.points.every(point => point.pressureDrop > 0));
assert(drainage31.points.some(point => point.pressureDrop > 0));
assert(drainage31.points.some(point => point.pressureDrop < 0));
assert(![...infusion31.points, ...drainage31.points].some(point => point.flow === 0 && point.pressureDrop === 0));
assertEstimate(infusion31, 0.2, 0.6072874493926861);
assert.strictEqual(interpolatePressureDrop(drainage31.points, 0.2).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(drainage31.points, 0.2).value, null);
assertEstimate(infusion31, 0.4, 0.8265856950067398);
assertEstimate(drainage31, 0.4, -0.4048582995951404);
assertEstimate(infusion31, 0.5, 1.130229419703122);
const drainage31AtPointFive = interpolatePressureDrop(drainage31.points, 0.5);
assert.strictEqual(drainage31AtPointFive.state, 'interpolated');
assert(Math.abs(drainage31AtPointFive.value) < 1e-10);
assertEstimate(infusion31, 0.5166666666666666, 1.178852107644696);
assertEstimate(drainage31, 0.5166666666666666, 0.06747638326589822, 'exact');
assertEstimate(infusion31, 0.6555555555555554, 1.5757720092085523);
assertEstimate(drainage31, 0.6555555555555554, 0.06747638326589822, 'exact');
assertEstimate(infusion31, 0.75, 2.0867696306292807);
assertEstimate(drainage31, 0.75, -0.23841655420601326);
assertEstimate(infusion31, 1.0, 4.781826360773729);
assertEstimate(drainage31, 1.0, -0.5735492577597918);
assertEstimate(infusion31, 1.5, 12.06140350877193);
assertEstimate(drainage31, 1.5, -3.1713900134952837, 'exact');
assertEstimate(infusion31, 2.0, 25.13495276653173);
assertEstimate(drainage31, 2.0, -6.410256410256409);
assertEstimate(infusion31, 2.522222222222222, 42.17273954116061, 'exact');
assertEstimate(infusion31, 3.0, 60.40363145626304);
assertEstimate(drainage31, 3.0, -16.506722647073495);
assertEstimate(infusion31, 4.0, 107.44835461434651);
assertEstimate(drainage31, 4.0, -29.41970310391362);
assertEstimate(infusion31, 5.0, 164.17004048583001);
assertEstimate(drainage31, 5.0, -46.464237516869076);
assertEstimate(infusion31, 5.9, 220.82771030139457);
assertEstimate(drainage31, 5.9, -67.99024187688156);
assertEstimate(infusion31, 5.99, 227.02204228520026);
assert.strictEqual(interpolatePressureDrop(drainage31.points, 5.99).state, 'out_of_range');
assert.strictEqual(interpolatePressureDrop(drainage31.points, 5.99).value, null);
[infusion31, drainage31].forEach(series => {
  const result = interpolatePressureDrop(series.points, 6.0);
  assert.strictEqual(result.state, 'out_of_range');
  assert.strictEqual(result.value, null);
});
const signedFormatterSource = mainJs.slice(mainJs.indexOf('function formatSignedPressureDrop'), mainJs.indexOf('function drawPressureDropSeriesChart'));
const formatSignedPressureDropRuntime = vm.runInNewContext(`${signedFormatterSource}; formatSignedPressureDrop`);
assert.strictEqual(formatSignedPressureDropRuntime(drainage31AtPointFive.value), '0.0', 'Negligible interpolation noise must display as 0.0.');
assert.strictEqual(formatSignedPressureDropRuntime(0.06747638326589822), '+0.1');
assert.strictEqual(formatSignedPressureDropRuntime(-0.06747638326589822), '-0.1');
const sevenAvalonEntries = pressureDropData.filter(entry => entry.model === avalon.model);
assert.deepStrictEqual(sevenAvalonEntries.map(entry => entry.size).sort(), ['13 Fr', '16 Fr', '19 Fr', '20 Fr', '23 Fr', '27 Fr', '31 Fr']);
assert.strictEqual(sevenAvalonEntries.length, 7, 'The selector must expose seven Avalon product-size records.');
const selectedFourFor31 = sevenAvalonEntries.filter(entry => ['20 Fr', '23 Fr', '27 Fr', '31 Fr'].includes(entry.size));
assert.strictEqual(selectedFourFor31.length, 4);
assert.strictEqual(selectedFourFor31.flatMap(entry => entry.pressureSeries).length, 8, 'Four selected products generate eight traces while using four slots.');
assert.strictEqual(new Set(selectedFourFor31.flatMap(entry => entry.pressureSeries.map(series => `${entry.size} — ${series.label}`))).size, 8);
assert(mainJs.includes('selectedComparisonKeys.length < 4') && mainJs.includes('selectedComparisonKeys.length >= 4'), 'The comparison limit must remain four selected products.');

// Post-merge review regression coverage uses the actual chart renderer rather than source-string comments.
const chartRendererSource = mainJs.slice(
  mainJs.indexOf('const PRESSURE_DROP_PRODUCT_COLORS'),
  mainJs.indexOf('\nfunction getPressureDropProductFamily')
);
const chartRuntime = vm.runInNewContext(`${chartRendererSource}; ({
  drawPressureDropSeriesChart,
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
assert(renderedSvg.innerHTML.includes('23 Fr — Drainage; Target flow: 1.50 L/min; Signed pressure: -15.0 mmHg'), 'Rendered target tooltip must include target flow, lumen identity, signed pressure, and units.');
assert(!renderedSvg.innerHTML.includes('data-raw-pressure-point="true"'), 'Raw source markers must not be rendered by default.');
assert(renderedSvg.innerHTML.includes('<path '), 'Straight source-point line segments must remain rendered while raw markers are hidden.');
assert(renderedSvg.innerHTML.includes('data-series-id="drainage"'), 'An empty leading series must not shift the populated series marker/estimate association.');
assert(renderedSvg.innerHTML.includes('stroke-dasharray="7 4"'), 'The populated drainage series must retain its dashed line style after empty-series filtering.');
assert(!renderedSvg.innerHTML.includes('Empty leading series; Target flow'), 'The empty leading series must not receive the later series estimate.');
assert(renderedSvg.innerHTML.includes('Flow [L/min]') && renderedSvg.innerHTML.includes('Pressure drop [mmHg]'), 'The rendered chart must contain bracketed axis units.');
assert.strictEqual(new Set(Array.from(chartRuntime.productColors)).size, 4, 'Product indexes 0–3 must map to distinct colors.');

const visibleRawPointsSvg = { dataset: {}, innerHTML: '' };
const visibleSeries = [
  { id: 'infusion', label: 'Infusion', displayLabel: '23 Fr — Infusion', lineStyle: 'solid', colorIndex: 0, points: [{ flow: 1, pressureDrop: 10 }, { flow: 2, pressureDrop: 20 }] },
  { id: 'drainage', label: 'Drainage', displayLabel: '23 Fr — Drainage', lineStyle: 'dashed', colorIndex: 0, points: [{ flow: 1, pressureDrop: -10 }, { flow: 2, pressureDrop: -20 }] }
];
chartRuntime.drawPressureDropSeriesChart(visibleRawPointsSvg, visibleSeries, 1.5, [{ value: 15 }, { value: -15 }], { curveMode: 'linear', showRawPoints: true });
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(/data-raw-pressure-point="true"/g) || []).length, 4, 'Enabling the control must render every raw point across all series.');
assert(visibleRawPointsSvg.innerHTML.includes('23 Fr — Infusion; Flow: 1.00 L/min; Signed pressure: +10.0 mmHg'), 'Visible raw points must retain their rendered tooltip.');
assert(visibleRawPointsSvg.innerHTML.includes('23 Fr — Drainage; Flow: 1.00 L/min; Signed pressure: -10.0 mmHg'), 'Both Avalon lumens must expose raw-point tooltips when enabled.');
assert.strictEqual((visibleRawPointsSvg.innerHTML.match(/data-series-id=/g) || []).length, 2, 'Target markers must remain rendered when raw points are enabled.');
assert(visibleRawPointsSvg.innerHTML.includes('data-raw-pressure-point="true"') && visibleRawPointsSvg.innerHTML.includes(' r="2"') && visibleRawPointsSvg.innerHTML.includes(' r="4"'), 'Raw markers must remain smaller than target-flow markers.');

[2, 4, 6, 8].forEach(entryCount => {
  const layout = chartRuntime.getPressureDropLegendLayout(entryCount);
  assert.strictEqual(layout.positions.length, entryCount);
  assert.strictEqual(new Set(Array.from(layout.positions, position => `${position.x},${position.y}`)).size, entryCount, `${entryCount} legend entries must have unique positions.`);
  assert(layout.topPadding > Math.max(...Array.from(layout.positions, position => position.y)), `${entryCount} legend entries must be above the dynamically padded plot.`);
});

const stateFormatterSource = mainJs.slice(
  mainJs.indexOf('function getPressureDropResultStateText'),
  mainJs.indexOf('\nfunction createPressureDropEstimateCard')
);
const formatResultState = vm.runInNewContext(`${stateFormatterSource}; getPressureDropResultStateText`);
assert.strictEqual(formatResultState({ state: 'exact' }), 'Exact manufacturer source point.');
assert.strictEqual(formatResultState({ state: 'interpolated' }), 'Adjacent-point linear interpolation.');
assert.strictEqual(formatResultState({ state: 'invalid' }), 'Enter a valid target flow. No calculation performed.');
assert.strictEqual(formatResultState({ state: 'out_of_range' }), 'Out of source range. No extrapolation.');
assert(!formatResultState({ state: 'invalid' }).match(/exact|interpolat/i), 'Cleared/invalid input must never claim a calculation.');

const formatTestFlow = flow => Number.isInteger(flow) ? flow.toFixed(1) : flow.toFixed(2).replace(/0$/, '');
const getTestRange = points => `${formatTestFlow(points[0].flow)}–${formatTestFlow(points.at(-1).flow)} L/min`;

const avalonAllSizes = pressureDropData.filter(entry => entry.model === 'Avalon Elite Bi-Caval Dual-Lumen Catheter');
const expectedAvalonSizes = ['13 Fr', '16 Fr', '19 Fr', '20 Fr', '23 Fr', '27 Fr', '31 Fr'];
assert.deepStrictEqual(avalonAllSizes.map(entry => entry.size).sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])), expectedAvalonSizes);
assert(avalonAllSizes.every(entry => entry.pressureSeries.length === 2), 'Every Avalon size must retain two independent pressure series.');
assert.strictEqual(new Set(avalonAllSizes.map(entry => `${entry.model}|${entry.size}`)).size, 7, 'Avalon selectable product-size entries must not be duplicated.');
avalonAllSizes.forEach(entry => {
  const rangeText = entry.pressureSeries.map(series => `${series.label}: ${getTestRange(getValidPressureDropPoints(series.points))}`).join('; ');
  assert.match(rangeText, /^Infusion: [\d.]+–[\d.]+ L\/min; Drainage: [\d.]+–[\d.]+ L\/min$/);
});
assert(!mainJs.includes('Series-specific L/min'), 'No view may show the non-numeric “Series-specific L/min” placeholder.');
const legacyEntry = pressureDropData.find(entry => !entry.pressureSeries && Array.isArray(entry.points) && entry.points.length);
assert(legacyEntry, 'A legacy single-series fixture must remain available.');
assert.strictEqual(getTestRange(getValidPressureDropPoints(legacyEntry.points)), `${formatTestFlow(legacyEntry.points[0].flow)}–${formatTestFlow(legacyEntry.points.at(-1).flow)} L/min`, 'Legacy single-series numeric range behavior must remain unchanged.');
assert(mainJs.includes("lumenRows.className = 'mt-2 grid gap-2'") && mainJs.includes('result.seriesResults.forEach(item =>'), 'Mobile comparison must render explicit per-lumen elements rather than a newline in one paragraph.');
assert(mainJs.includes("text.textContent = 'Show raw digitized points'") && mainJs.includes("input.type = 'checkbox'") && mainJs.includes('input.checked = checked'), 'The raw-point control must be a labeled, checked-state checkbox.');
assert(mainJs.includes('let showRawPressureDropPoints = false;'), 'Raw markers must default to hidden once per page initialization.');
assert.strictEqual((mainJs.match(/showRawPressureDropPoints = false/g) || []).length, 1, 'Rerender paths must not reset the page-level raw-marker state.');
assert(mainJs.includes('checked => { showRawPressureDropPoints = checked; render(); }') && mainJs.includes('checked => { showRawPressureDropPoints = checked; renderCompare(); }'), 'Single and comparison toggles must update the same page-level state across rerenders.');
assert(mainJs.includes("{ curveMode: 'linear', showRawPoints }") && !mainJs.includes("curveMode: 'smooth'"), 'Both chart paths must preserve straight-line rendering while forwarding raw-marker visibility.');

const staticSummaryFiles = ['index.html', 'dist/index.html', 'cannula-pressure-drop/index.html', 'dist/cannula-pressure-drop/index.html'];
const getingeCount = pressureDropData.filter(entry => entry.manufacturer === 'Getinge / Maquet').length;
staticSummaryFiles.forEach(relativePath => {
  const html = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
  assert(html.includes(`${pressureDropData.length} datasets`), `${relativePath} must show the canonical dataset total.`);
  assert(html.includes(`${getingeCount} datasets`) || html.includes(`Getinge / Maquet (${getingeCount})`), `${relativePath} must show the canonical Getinge / Maquet count.`);
  assert.match(html, /Avalon Elite/i, `${relativePath} must mention Avalon Elite.`);
  assert.match(html, /jugular/i, `${relativePath} must include jugular venous coverage.`);
});
