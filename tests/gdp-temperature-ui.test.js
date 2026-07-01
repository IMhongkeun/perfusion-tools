'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const gdpHtml = fs.readFileSync(path.join(__dirname, '..', 'gdp', 'index.html'), 'utf8');
const mainJs = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');

assert(
  gdpHtml.includes('.gdp-temp-tile') &&
  gdpHtml.includes('min-height: 4.25rem;') &&
  gdpHtml.includes('display: flex;') &&
  gdpHtml.includes('justify-content: center;'),
  'GDP temperature context should define one shared tile class with a consistent min-height and flex alignment.'
);

assert(
  (gdpHtml.match(/class="gdp-temp-tile/g) || []).length === 3,
  'Temperature input, selected temp, and VO2 fraction should all use the shared gdp-temp-tile class.'
);

assert(
  gdpHtml.includes('items-stretch') &&
  gdpHtml.includes('grid-cols-1 min-[420px]:grid-cols-3'),
  'GDP temperature context should stretch equal-height tiles on desktop while preserving single-column mobile stacking.'
);

assert(
  gdpHtml.includes('id="gdp-temp-c"') &&
  gdpHtml.includes('id="gdp-temp-display"') &&
  gdpHtml.includes('id="gdp-vo2-fraction"'),
  'GDP temperature input and read-only display IDs should remain unchanged.'
);

assert(
  mainJs.includes('function calculateGdpVo2Fraction(temperatureC)') &&
  mainJs.includes('return Math.pow(GDP_Q10, (temperatureC - GDP_DEFAULT_TEMPERATURE_C) / 10);'),
  'GDP VO2 temperature correction logic should remain unchanged.'
);

console.log('All GDP temperature context UI tests passed.');
