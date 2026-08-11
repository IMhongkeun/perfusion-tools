const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
const functionSource = mainJs.slice(
  mainJs.indexOf('function parseClockMinutes'),
  mainJs.indexOf('function transplantClockIcon')
);
const context = {};
vm.runInNewContext(`${functionSource}; this.calculateElapsedMinutes = calculateElapsedMinutes; this.formatDuration = formatDuration; this.normalizeClockInput = normalizeClockInput;`, context);

assert.strictEqual(context.calculateElapsedMinutes('08:00', '08:45'), 45);
assert.strictEqual(context.formatDuration(context.calculateElapsedMinutes('08:00', '08:45')), '45 min');
assert.strictEqual(context.formatDuration(context.calculateElapsedMinutes('08:00', '09:05')), '1 hr 05 min');
assert.strictEqual(context.calculateElapsedMinutes('23:50', '00:20'), 30);
assert.strictEqual(context.calculateElapsedMinutes('08:00', ''), null);
assert.strictEqual(context.calculateElapsedMinutes('25:00', '09:00'), null);
assert.strictEqual(context.calculateElapsedMinutes('8:00', '09:00'), null);
assert.strictEqual(context.formatDuration(null), '—');
assert.strictEqual(context.normalizeClockInput('0800'), '08:00');
assert.strictEqual(context.normalizeClockInput('905'), '09:05');
assert.strictEqual(context.normalizeClockInput('2350'), '23:50');
assert.strictEqual(context.normalizeClockInput('08:00'), '08:00');
assert.strictEqual(context.normalizeClockInput('2400'), null);
assert.strictEqual(context.normalizeClockInput('1260'), null);


const transplantStart = mainJs.indexOf('const transplantState');
const transplantSource = mainJs.slice(
  transplantStart,
  mainJs.indexOf("if (typeof window !== 'undefined')", transplantStart)
);
const summaryContext = { document: { querySelectorAll: () => [], getElementById: () => null } };
vm.runInNewContext(`${transplantSource}
  transplantState.lung.donorAcc = '08:00';
  transplantState.lung.sides.left = { iceOut: '09:10', anastomosisStart: '09:20', reperfusion: '09:55' };
  transplantState.lung.firstSide = 'right';
  this.bilateralSummary = buildTransplantSummary('lung');
  transplantState.lung.procedure = 'single';
  transplantState.lung.singleSide = 'left';
  this.singleSummary = buildTransplantSummary('lung');
  transplantState.heart = { donorAcc: '08:00', iceOut: '09:20', anastomosisStart: '09:35', recipientAccRelease: '10:10' };
  this.heartSummary = buildTransplantSummary('heart');`, summaryContext);
assert(summaryContext.bilateralSummary.includes('Implant order: Right first'));
assert(summaryContext.bilateralSummary.indexOf('Right Lung · 1st') < summaryContext.bilateralSummary.indexOf('Left Lung · 2nd'));
assert(summaryContext.singleSummary.includes('Left Lung · Single'));
assert(!summaryContext.singleSummary.includes('Right Lung'));
assert(summaryContext.heartSummary.includes('Cold Ischemic Time: 1 hr 20 min'));
assert(summaryContext.heartSummary.includes('Warm Ischemic Time: 50 min'));
assert(summaryContext.heartSummary.includes('Anastomosis Time: 35 min'));

assert(timecalcHtml.includes('id="time-mode-transplant"'), 'Transplant must be the third top-level mode');
assert(timecalcHtml.indexOf('time-mode-record') < timecalcHtml.indexOf('time-mode-live'));
assert(timecalcHtml.indexOf('time-mode-live') < timecalcHtml.indexOf('time-mode-transplant'));
assert(timecalcHtml.includes('id="transplant-type-lung"'));
assert(timecalcHtml.includes('id="transplant-type-heart"'));
assert(mainJs.includes("sides: {\n      left:"), 'lung event state should be anatomical-side based');
assert(mainJs.includes("transplantState.activeType === 'lung' ? renderLungTransplant() : renderHeartTransplant()"));
assert(mainJs.includes("lung.firstSide === 'left' ? ['left', 'right'] : ['right', 'left']"));
assert(mainJs.includes("if (lung.procedure === 'single') return [lung.singleSide]"));
assert(mainJs.includes("grid-cols-[minmax(0,1fr)_2.5rem]"), 'time input and compact clock button should stay side by side');
assert(mainJs.includes('class="grid grid-cols-1 gap-4"'), 'bilateral lungs should use full-width stacked cards');
assert(mainJs.includes('id="transplant-summary-preview"'), 'transplant summary preview should be rendered');
assert(mainJs.includes('function buildTransplantSummary(type)'), 'summary should be generated from shared transplant state');
assert(mainJs.includes('navigator.clipboard?.writeText'), 'summary should use the Clipboard API');
assert(mainJs.includes("if (event.target.closest('#transplant-summary-copy')) copyTransplantSummary()"), 'summary copy button should be delegated safely');
assert(!mainJs.includes('renderTransplantCalculator();\n    const next = document.querySelector'), 'typing should not rerender the entire transplant calculator');

console.log('All timecalc transplant tests passed.');
