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
vm.runInNewContext(`${functionSource}; this.calculateElapsedMinutes = calculateElapsedMinutes; this.formatDuration = formatDuration;`, context);

assert.strictEqual(context.calculateElapsedMinutes('08:00', '08:45'), 45);
assert.strictEqual(context.formatDuration(context.calculateElapsedMinutes('08:00', '08:45')), '45 min');
assert.strictEqual(context.formatDuration(context.calculateElapsedMinutes('08:00', '09:05')), '1 hr 05 min');
assert.strictEqual(context.calculateElapsedMinutes('23:50', '00:20'), 30);
assert.strictEqual(context.calculateElapsedMinutes('08:00', ''), null);
assert.strictEqual(context.calculateElapsedMinutes('25:00', '09:00'), null);
assert.strictEqual(context.calculateElapsedMinutes('8:00', '09:00'), null);
assert.strictEqual(context.formatDuration(null), '—');

assert(timecalcHtml.includes('id="time-mode-transplant"'), 'Transplant must be the third top-level mode');
assert(timecalcHtml.indexOf('time-mode-record') < timecalcHtml.indexOf('time-mode-live'));
assert(timecalcHtml.indexOf('time-mode-live') < timecalcHtml.indexOf('time-mode-transplant'));
assert(timecalcHtml.includes('id="transplant-type-lung"'));
assert(timecalcHtml.includes('id="transplant-type-heart"'));
assert(mainJs.includes("sides: {\n      left:"), 'lung event state should be anatomical-side based');
assert(mainJs.includes("transplantState.activeType === 'lung' ? renderLungTransplant() : renderHeartTransplant()"));
assert(mainJs.includes("lung.firstSide === 'left' ? ['left', 'right'] : ['right', 'left']"));
assert(mainJs.includes("if (lung.procedure === 'single') sides = [lung.singleSide]"));
assert(mainJs.includes("setTransplantPath(button.dataset.transplantNow, localTime)"));

console.log('All timecalc transplant tests passed.');
