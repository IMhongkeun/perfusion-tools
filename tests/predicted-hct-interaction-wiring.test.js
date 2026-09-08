'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const wiringStart = mainJs.indexOf('if (hasHctCalculator) {');
const wiringEnd = mainJs.indexOf('\n  if (hasLbmCalculator) {', wiringStart);
assert(wiringStart >= 0 && wiringEnd > wiringStart, 'Predicted Hct wiring block must exist.');

const wiring = mainJs.slice(wiringStart, wiringEnd);
const preInputArray = wiring.match(/\[([^\]]+)\]\.forEach\(id => \{\s+const x = el\(id\);\s+if \(x\) x\.addEventListener\('input', updateHct\);/);
assert(preInputArray, 'Pre-CPB inputs must retain direct input-to-updateHct wiring.');

const preInputIds = Array.from(preInputArray[1].matchAll(/'([^']+)'/g), match => match[1]);
assert.deepStrictEqual(preInputIds, [
  'wt_hct', 'pre_hct', 'prime', 'rbc_units', 'rbc_unit_vol', 'rbc_hct', 'ebv_coef'
]);
assert.strictEqual(preInputIds.filter(id => id === 'prime').length, 1, '#prime must have exactly one calculator input registration.');

const wiringWithoutPreArray = wiring.replace(preInputArray[0], '');
assert(!/el\(['"]prime['"]\).*addEventListener/s.test(wiringWithoutPreArray), '#prime must not gain a duplicate direct listener.');
assert(!wiring.match(/prime[^\n]*addEventListener\('change', updateHct\)/), '#prime must remain immediate-input-only, without a calculator change listener.');

console.log('Predicted Hct interaction wiring verified.');
