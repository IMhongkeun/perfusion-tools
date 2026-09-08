'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8');

const home = read('index.html');
assert(
  home.includes('html.initial-home-route #view-home { display: block; }') &&
  home.includes('id="view-home" class="hidden animate-in'),
  'Home should opt into visibility by pathname and render discovery content before first paint.'
);
assert(
  home.includes("new Set(['/info', '/privacy', '/terms', '/contact'])") &&
  home.includes('html.root-route-pending main { visibility: hidden; }'),
  'Informational root-document routes should hide inactive Home content until routing completes.'
);

const initialRouteScript = home.match(/<script>\s*\/\/ Run during head parsing[\s\S]*?<\/script>/)[0]
  .replace(/^<script>|<\/script>$/g, '');
function getInitialClasses(pathname) {
  const classes = new Set();
  vm.runInNewContext(initialRouteScript, {
    window: { location: { pathname } },
    document: { documentElement: { classList: { add: value => classes.add(value) } } },
    Set
  });
  return classes;
}
assert(getInitialClasses('/').has('initial-home-route'), 'Home pathname should be visible during initial layout.');
assert(getInitialClasses('/index.html').has('initial-home-route'), 'Static Home pathname should be visible during initial layout.');
['/info/', '/privacy/', '/terms/', '/contact/'].forEach(pathname => {
  const classes = getInitialClasses(pathname);
  assert(classes.has('root-route-pending'), `${pathname} should remain paint-hidden before routing.`);
  assert(!classes.has('initial-home-route'), `${pathname} must not expose Home before routing.`);
});

const pressureDrop = read('cannula-pressure-drop/index.html');
assert(
  pressureDrop.includes('class="pressure-drop-async-region space-y-4"') &&
  pressureDrop.includes('.pressure-drop-async-region { min-height: 12rem; }') &&
  pressureDrop.includes('.pressure-drop-async-region { min-height: 14rem; }'),
  'Cannula loading states should reserve a modest responsive footprint without a persistent empty slab.'
);

const bsa = read('bsa/index.html');
const bsaHeader = bsa.slice(bsa.indexOf('<header'), bsa.indexOf('</header>') + '</header>'.length);
assert.strictEqual((bsaHeader.match(/<nav(?:\s|>)/g) || []).length, 1, 'BSA should contain one desktop header navigation landmark.');
assert(!bsaHeader.includes('id="global-top-nav"'), 'BSA should not contain an inert standalone navigation placeholder.');
assert(
  bsaHeader.indexOf('id="nav-home"') !== -1 && bsaHeader.indexOf('id="nav-home"') < bsaHeader.indexOf('id="theme-toggle"'),
  'BSA should retain its complete first-paint navigation before the theme control.'
);

const placeholderPages = [
  'cannula-pressure-drop/index.html', 'gdp/index.html',
  'heparin/index.html', 'lbm/index.html', 'phn-echo/index.html',
  'predicted-hct/index.html', 'priming-volume/index.html',
  'quick-reference/index.html', 'timecalc/index.html',
  'unit-converter/index.html', 'z-score/index.html'
];
placeholderPages.forEach(relativePath => {
  const html = read(relativePath);
  assert(
    html.includes('id="global-top-nav"') && html.indexOf('id="global-top-nav"') < html.indexOf('id="theme-toggle"'),
    `${relativePath} should reserve one desktop navigation slot before the theme control.`
  );
  assert.strictEqual((html.match(/id="global-top-nav"/g) || []).length, 1, `${relativePath} should not contain duplicate top navigation.`);
});

const mainJs = read('main.js');
assert(
  mainJs.includes("nav.className = 'hidden md:flex flex-1 items-center") &&
  mainJs.includes("max-w-[68%] ml-auto pr-1") &&
  mainJs.includes("if (!nav) {") && mainJs.includes("headerRow.insertBefore(nav, themeBtn)"),
  'Fallback navigation should retain matching sizing and only insert when the placeholder is absent.'
);
assert(
  mainJs.includes("document.documentElement.classList.remove('root-route-pending')") &&
  mainJs.includes('renderInitialHomeDiscovery();'),
  'Routing should reveal informational content only after selecting the correct view.'
);

console.log('CLS stability regression tests passed');
