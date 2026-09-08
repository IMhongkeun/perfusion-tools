'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const home = read('index.html');
assert(
  home.includes('id="view-home" class="animate-in') &&
  home.includes('#view-home { min-height: 74rem; }') &&
  home.includes('#view-home { min-height: 48rem; }'),
  'Home should paint its primary view immediately and reserve the known directory/recent-tools footprint.'
);

const pressureDrop = read('cannula-pressure-drop/index.html');
assert(
  pressureDrop.includes('class="pressure-drop-async-region space-y-4"') &&
  pressureDrop.includes('.pressure-drop-async-region { min-height: 50rem; }') &&
  pressureDrop.includes('.pressure-drop-async-region { min-height: 62rem; }'),
  'Cannula lookup should reserve responsive space while manufacturer data replaces the loading state.'
);

const standalonePages = [
  'bsa/index.html', 'cannula-pressure-drop/index.html', 'gdp/index.html',
  'heparin/index.html', 'lbm/index.html', 'phn-echo/index.html',
  'predicted-hct/index.html', 'priming-volume/index.html',
  'quick-reference/index.html', 'timecalc/index.html',
  'unit-converter/index.html', 'z-score/index.html'
];
standalonePages.forEach(relativePath => {
  const html = read(relativePath);
  assert(
    html.includes('id="global-top-nav"') && html.indexOf('id="global-top-nav"') < html.indexOf('id="theme-toggle"'),
    `${relativePath} should reserve the desktop navigation slot in initial HTML.`
  );
});

const mainJs = read('main.js');
assert(
  mainJs.includes("nav.className = 'hidden md:flex flex-1 items-center") &&
  mainJs.includes("max-w-[68%] ml-auto pr-1"),
  'The fallback-created navigation should use the same reserved sizing as server HTML.'
);

console.log('CLS stability regression tests passed');
