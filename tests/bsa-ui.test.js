'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const bsaHtml = fs.readFileSync(path.join(__dirname, '..', 'bsa', 'index.html'), 'utf8');

assert(
  bsaHtml.includes('id="bsa-flow-list"') && bsaHtml.includes('max-h-[22rem] min-h-[18rem] overflow-y-auto'),
  'BSA flow sheet should be tall enough to show CI 1.0–3.0 without requiring one-row scrolling.'
);

console.log('All BSA UI tests passed.');
