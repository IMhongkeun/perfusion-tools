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
  bsaHeader.includes('href="/#all-calculators-heading"') &&
  bsaHeader.includes('href="/quick-reference/"') &&
  bsaHeader.indexOf('href="/#all-calculators-heading"') < bsaHeader.indexOf('id="theme-toggle"') &&
  !bsaHeader.includes('id="nav-bsa"'),
  'BSA should retain one concise first-paint desktop navigation, separate from calculator links.'
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

const homeHeader = home.slice(home.indexOf('<header'), home.indexOf('</header>') + '</header>'.length);
assert(homeHeader.includes('href="/#all-calculators-heading"') && homeHeader.includes('href="/quick-reference/"'),
  'Home top navigation should contain Calculators and Clinical Reference.');
assert(!homeHeader.includes('id="nav-bsa"') && !homeHeader.includes('id="nav-home"'),
  'The homepage top navigation should not duplicate the left-side tool directory.');
assert(mainJs.includes('const desktopItems = [') && mainJs.includes('MOBILE_CALCULATOR_ROUTES = new Set(TOP_NAV_ITEMS'),
  'Desktop simplification must not remove established mobile calculator routes.');

assert(
  mainJs.includes("document.documentElement.classList.remove('root-route-pending')") &&
  mainJs.includes('renderInitialHomeDiscovery();'),
  'Routing should reveal informational content only after selecting the correct view.'
);

const discoveryBlock = mainJs.slice(
  mainJs.indexOf('let initialHomeDiscoveryRendered'),
  mainJs.indexOf('\nfunction initCalculatorDiscovery()')
);
function createDiscoveryHarness(isInitialHome) {
  const calls = { featured: 0, directory: 0, recent: 0 };
  const context = {
    isHomeCalculatorDirectoryContext: () => isInitialHome,
    renderFeaturedCalculators: () => { calls.featured += 1; },
    renderCalculatorDirectory: () => { calls.directory += 1; },
    renderRecentCalculators: () => { calls.recent += 1; }
  };
  vm.createContext(context);
  vm.runInContext(`${discoveryBlock}\nthis.renderHome = renderInitialHomeDiscovery;`, context);
  return { calls, renderHome: context.renderHome };
}

const initialHomeHarness = createDiscoveryHarness(true);
initialHomeHarness.renderHome();
initialHomeHarness.renderHome();
assert.deepStrictEqual(initialHomeHarness.calls, { featured: 1, directory: 1, recent: 1 }, 'Initial Home discovery should render once during startup.');

const informationalHarness = createDiscoveryHarness(false);
informationalHarness.renderHome();
assert.deepStrictEqual(informationalHarness.calls, { featured: 0, directory: 0, recent: 0 }, 'Informational startup must not render inactive Home discovery.');
informationalHarness.renderHome(true);
informationalHarness.renderHome(true);
assert.deepStrictEqual(informationalHarness.calls, { featured: 1, directory: 1, recent: 1 }, 'First SPA visit to Home should populate discovery exactly once.');

assert(
  mainJs.includes("document.documentElement.classList.remove('initial-home-route');") &&
  mainJs.indexOf("document.documentElement.classList.remove('initial-home-route');") < mainJs.indexOf("const sections = ['view-home'"),
  'route() should release initial Home visibility before normal hidden-state routing.'
);
assert(
  mainJs.includes("if (key === 'home') renderInitialHomeDiscovery(true);"),
  'route() should lazily populate Home after an informational-route startup.'
);

console.log('CLS stability regression tests passed');
