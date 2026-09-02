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
vm.runInNewContext(`${functionSource}; this.calculateElapsedMinutes = calculateElapsedMinutes; this.calculateTotalIschemicMinutes = calculateTotalIschemicMinutes; this.formatTransplantDuration = formatTransplantDuration; this.normalizeClockInput = normalizeClockInput;`, context);

const recordFormatterSource = mainJs.slice(mainJs.indexOf('function formatDuration(mins)'), mainJs.indexOf('function formatMinutesToHHMM'));
const recordContext = {};
vm.runInNewContext(`${recordFormatterSource}; this.formatDuration = formatDuration;`, recordContext);
assert.strictEqual(recordContext.formatDuration(65), '65 min (01:05)', 'Record duration should use the shared HH:mm display format');

const modeSource = mainJs.slice(mainJs.indexOf('function normalizeTimeMode'), mainJs.indexOf('function loadTimePreferencesState'));
const modeContext = {};
vm.runInNewContext(`${modeSource}; this.normalizeTimeMode = normalizeTimeMode;`, modeContext);
assert.strictEqual(modeContext.normalizeTimeMode('transplant'), 'transplant');
assert.strictEqual(modeContext.normalizeTimeMode('live'), 'live');
assert.strictEqual(modeContext.normalizeTimeMode('unexpected'), 'record');
assert.strictEqual(modeContext.normalizeTimeMode(null), 'record');

assert.strictEqual(context.calculateElapsedMinutes('08:00', '08:45'), 45);
assert.strictEqual(context.formatTransplantDuration(context.calculateElapsedMinutes('08:00', '08:45')), '45 min');
assert.strictEqual(context.formatTransplantDuration(context.calculateElapsedMinutes('08:00', '09:05')), '1 hr 05 min');
assert.strictEqual(context.calculateElapsedMinutes('23:50', '00:20'), 30);
assert.strictEqual(context.calculateElapsedMinutes('08:00', ''), null);
assert.strictEqual(context.calculateElapsedMinutes('25:00', '09:00'), null);
assert.strictEqual(context.calculateElapsedMinutes('8:00', '09:00'), null);
assert.strictEqual(context.formatTransplantDuration(null), '—');
assert.strictEqual(context.normalizeClockInput('0800'), '08:00');
assert.strictEqual(context.normalizeClockInput('1345'), '13:45');
assert.strictEqual(context.normalizeClockInput('905'), '09:05');
assert.strictEqual(context.normalizeClockInput('2350'), '23:50');
assert.strictEqual(context.normalizeClockInput('08:00'), '08:00');
assert.strictEqual(context.normalizeClockInput('2400'), null);
assert.strictEqual(context.normalizeClockInput('1260'), null);
assert.strictEqual(context.calculateTotalIschemicMinutes('08:00', '09:10', '09:55'), 115, 'total ischemic time should add cold and warm time');
assert.strictEqual(context.calculateTotalIschemicMinutes('23:00', '23:45', '00:20'), 80, 'total ischemic time should support a midnight crossing');
assert.strictEqual(context.calculateTotalIschemicMinutes('08:00', '', '09:55'), null, 'total should wait until both ischemic intervals are complete');


const transplantStart = mainJs.indexOf('function createDefaultTransplantState');
const transplantSource = mainJs.slice(
  transplantStart,
  mainJs.indexOf("if (typeof window !== 'undefined')", transplantStart)
);
const transplantStatus = { textContent: '' };
const summaryContext = {
  document: {
    querySelectorAll: () => [],
    getElementById: id => id === 'transplant-summary-status' ? transplantStatus : null
  },
  saveTimeLiveState: () => {}
};
vm.runInNewContext(`${transplantSource}
  transplantState.lung.donorAcc = '08:00';
  transplantState.lung.sides.left = { iceOut: '09:10', anastomosisStart: '09:20', reperfusion: '09:55' };
  transplantState.lung.firstSide = 'right';
  this.bilateralSummary = buildTransplantSummary('lung');
  transplantState.lung.procedure = 'single';
  transplantState.lung.singleSide = 'left';
  this.singleSummary = buildTransplantSummary('lung');
  transplantState.heart = { donorAcc: '08:00', iceOut: '09:20', anastomosisStart: '09:35', recipientAccRelease: '10:10', pumpStart: '08:30', pumpEnd: '10:30' };
  this.heartSummary = buildTransplantSummary('heart');
  transplantState.heart.donorAcc = '24:00';
  transplantState.heart.iceOut = '123';
  this.invalidSummary = buildTransplantSummary('heart');
  const restored = normalizeStoredTransplantState({ activeType: 'heart', lung: { procedure: 'single', firstSide: 'right', singleSide: 'right', donorAcc: '08:00', pumpStart: '08:10', pumpEnd: '11:00', sides: { left: {}, right: { iceOut: '09:00' } } }, heart: { donorAcc: '07:00', pumpStart: '07:30', pumpEnd: '10:30' } });
  this.restoredSnapshot = JSON.parse(JSON.stringify(restored));
  this.oldSnapshot = JSON.parse(JSON.stringify(normalizeStoredTransplantState(undefined)));
  this.defaultSnapshot = JSON.parse(JSON.stringify(createDefaultTransplantState()));
  transplantState = createDefaultTransplantState();
  transplantState.lung.procedure = 'single';
  transplantState.lung.singleSide = 'left';
  transplantState.lung.sides.right.iceOut = '2400';
  this.singleLeftHasInvalidClock = hasInvalidTransplantClock('lung');
  transplantState.lung.singleSide = 'right';
  this.singleRightHasInvalidClock = hasInvalidTransplantClock('lung');
  transplantState = createDefaultTransplantState();
  transplantState.activeType = 'heart';
  this.emptyHeartTabHasCaseData = hasTransplantCaseData(transplantState);
  transplantState.heart.donorAcc = '08:00';
  this.heartTimeHasCaseData = hasTransplantCaseData(transplantState);
  transplantState.heart = createDefaultTransplantState().heart;
  this.clearedHeartTabHasCaseData = hasTransplantCaseData(transplantState);
  transplantState = createDefaultTransplantState();
  transplantState.lung.procedure = 'single';
  transplantState.lung.singleSide = 'right';
  this.singleRightSetupHasCaseData = hasTransplantCaseData(transplantState);
  transplantState = createDefaultTransplantState();
  transplantState.lung.firstSide = 'right';
  this.rightFirstSetupHasCaseData = hasTransplantCaseData(transplantState);
  document.getElementById('transplant-summary-status').textContent = 'Summary copied.';
  updateTransplantDerivedDisplays();
  this.statusAfterSummaryEdit = document.getElementById('transplant-summary-status').textContent;`, summaryContext);
assert(summaryContext.bilateralSummary.includes('Implant order: Right first'));
assert(summaryContext.bilateralSummary.indexOf('Right Lung · 1st') < summaryContext.bilateralSummary.indexOf('Left Lung · 2nd'));
assert(summaryContext.singleSummary.includes('Left Lung · Single'));
assert(!summaryContext.singleSummary.includes('Right Lung'));
assert(summaryContext.heartSummary.includes('Cold Ischemic Time: 1 hr 20 min'));
assert(summaryContext.heartSummary.includes('Warm Ischemic Time: 50 min'));
assert(summaryContext.heartSummary.includes('Anastomosis Time: 35 min'));
assert(summaryContext.heartSummary.includes('Pump start: 08:30'));
assert(summaryContext.heartSummary.includes('Pump end: 10:30'));
assert(summaryContext.heartSummary.includes('Pump Time: 2 hr 00 min'));
assert(!summaryContext.invalidSummary.includes('24:00'), 'invalid clock values must not be copied into a summary');
assert(!summaryContext.invalidSummary.includes('123'), 'incomplete clock values must not be copied into a summary');
assert(summaryContext.invalidSummary.includes('Cold Ischemic Time: —'));
assert.strictEqual(summaryContext.restoredSnapshot.activeType, 'heart');
assert.strictEqual(summaryContext.restoredSnapshot.lung.procedure, 'single');
assert.strictEqual(summaryContext.restoredSnapshot.lung.singleSide, 'right');
assert.strictEqual(summaryContext.restoredSnapshot.heart.pumpEnd, '10:30');
assert.deepStrictEqual(summaryContext.oldSnapshot, summaryContext.defaultSnapshot, 'old cases without transplant data should restore defaults');
assert.strictEqual(summaryContext.singleLeftHasInvalidClock, false, 'hidden Right lung values must not block Single Left summary copy');
assert.strictEqual(summaryContext.singleRightHasInvalidClock, true, 'invalid Right lung values must block Single Right summary copy');
assert.strictEqual(summaryContext.emptyHeartTabHasCaseData, false, 'visiting the empty Heart tab must not create case data');
assert.strictEqual(summaryContext.heartTimeHasCaseData, true, 'an entered Heart time must count as case data');
assert.strictEqual(summaryContext.clearedHeartTabHasCaseData, false, 'an empty selected Heart calculator must not keep a case alive');
assert.strictEqual(summaryContext.singleRightSetupHasCaseData, true, 'Single/Right setup must persist before the first clock entry');
assert.strictEqual(summaryContext.rightFirstSetupHasCaseData, true, 'bilateral implant order must persist before the first clock entry');
assert.strictEqual(summaryContext.statusAfterSummaryEdit, '', 'editing summary source data must clear stale copied status');

assert(timecalcHtml.includes('id="time-mode-transplant"'), 'Transplant must be the third top-level mode');
assert(timecalcHtml.indexOf('time-mode-record') < timecalcHtml.indexOf('time-mode-live'));
assert(timecalcHtml.indexOf('time-mode-live') < timecalcHtml.indexOf('time-mode-transplant'));
assert(timecalcHtml.includes('id="transplant-type-lung"'));
assert(timecalcHtml.includes('id="transplant-type-heart"'));
assert(timecalcHtml.includes('Transplant case times are stored locally in this browser so they can be restored after refresh. Do not enter patient identifiers.'), 'Transplant should disclose local case-time persistence');
assert(timecalcHtml.includes('id="time-transplant-storage-notice" class="rounded-xl border border-slate-200 dark:border-primary-800 bg-slate-50/80 dark:bg-primary-900/50'), 'Transplant storage notice should match the Live notice card styling');
assert(/sides:\s*{\s*left:/.test(mainJs), 'lung event state should be anatomical-side based');
assert(mainJs.includes("transplantState.activeType === 'lung' ? renderLungTransplant() : renderHeartTransplant()"));
assert(mainJs.includes("lung.firstSide === 'left' ? ['left', 'right'] : ['right', 'left']"));
assert(mainJs.includes("if (lung.procedure === 'single') return [lung.singleSide]"));
assert(mainJs.includes("grid-cols-[minmax(0,1fr)_2.5rem]"), 'time input and compact clock button should stay side by side');
assert(mainJs.includes('data-transplant-now="${path}" class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200'), 'Transplant current-time buttons should reuse the standard outlined clock-button style');
assert(mainJs.includes('M12 8v4l2.5 2.5M12 22c5.523'), 'Transplant should reuse the standard Time Calculator clock icon');
assert(mainJs.includes('class="grid grid-cols-1 gap-4"'), 'bilateral lungs should use full-width stacked cards');
assert(mainJs.includes('id="transplant-summary-preview"'), 'transplant summary preview should be rendered');
assert(mainJs.includes('id="transplant-case-summary"'), 'transplant summary card should provide a stable feedback anchor');
assert(mainJs.includes('id="transplant-summary-preview" readonly rows="9" class="w-full rounded-xl border border-slate-200 dark:border-primary-700 bg-slate-50 dark:bg-primary-800 px-3 py-2 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-100 focus:ring-2 focus:ring-accent-500 focus:border-accent-500 outline-none"'), 'transplant summary field should match the standard Case summary field styling');
assert(mainJs.includes('aria-label="Copy transplant case summary"'), 'summary copy action should be an accessible icon button');
assert(mainJs.includes('absolute right-2 top-2 inline-flex h-10 w-10'), 'summary copy icon should sit inside the card corner with a usable touch target');
assert(mainJs.includes('rounded-lg border-0 bg-transparent text-slate-400 shadow-none'), 'summary copy icon should not render a visible button box');
assert(!mainJs.includes('>Copy summary</button>'), 'summary copy action should not render as a text button');
assert(mainJs.includes('function buildTransplantSummary(type)'), 'summary should be generated from shared transplant state');
assert(mainJs.includes('data-total-ischemic-side="${side}"'), 'each rendered lung side should include an automatic total ischemic output');
assert(mainJs.includes('border-cyan-300 dark:border-cyan-700 bg-cyan-50'), 'total ischemic output should use a non-black highlight color');
assert(mainJs.includes("element.classList.toggle('hidden', totalMinutes === null)"), 'total ischemic output should appear only after cold and warm times are available');
assert(mainJs.includes("function loadTimePreferencesState() {\n  // Record is the first workflow and is always the initial view on a new visit.\n  timeLiveMode = 'record';"), 'Time Calculator should always open in Record mode');
assert(!mainJs.includes('timeLiveMode = normalizeTimeMode(saved.mode)'), 'a saved view preference should not override the initial Record mode');
assert(mainJs.includes('transplant: getTransplantStateSnapshot()'), 'transplant state should use active case persistence');
assert(mainJs.includes('transplantState = createDefaultTransplantState();'), 'new case should reset transplant state');
assert(mainJs.includes("const copied = Boolean(document.execCommand && document.execCommand('copy'))"), 'fallback copy must check the returned success value');
assert(mainJs.includes("status.textContent = 'Fix invalid time fields before copying.'"), 'copy should reject invalid transplant clocks');
assert(mainJs.includes('navigator.clipboard?.writeText'), 'summary should use the Clipboard API');
assert(mainJs.includes("if (event.target.closest('#transplant-summary-copy')) copyTransplantSummary()"), 'summary copy button should be delegated safely');
assert(!mainJs.includes('renderTransplantCalculator();\n    const next = document.querySelector'), 'typing should not rerender the entire transplant calculator');

console.log('All timecalc transplant tests passed.');
