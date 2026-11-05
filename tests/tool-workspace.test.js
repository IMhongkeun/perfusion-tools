'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'tool-workspace.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'mobile.css'), 'utf8');
const pages = ['index.html', 'bsa/index.html', 'gdp/index.html', 'heparin/index.html', 'predicted-hct/index.html', 'lbm/index.html', 'timecalc/index.html', 'z-score/index.html', 'quick-reference/index.html', 'cannula-pressure-drop/index.html', 'priming-volume/index.html', 'unit-converter/index.html'];
assert.equal(js, fs.readFileSync(path.join(root, 'dist/tool-workspace.js'), 'utf8'));
assert.equal(css, fs.readFileSync(path.join(root, 'dist/mobile.css'), 'utf8'));
assert(css.includes('--pt-page: #ffffff;'));
assert(css.includes('--pt-accent: #168c96;'), 'Light mode should use a subtle teal accent.');
assert(css.includes('.pt-sidebar-inline-results'), 'Categories should render an inline sublist.');
assert(css.includes(':not(:disabled):not([readonly]):not([aria-readonly="true"])'),
  'White input rule must not misrepresent disabled or readonly calculator controls.');
assert(js.includes('activeButton.after(sidebarPanel)'), 'Expanded tools should move immediately below the selected category.');
assert(js.includes("selectedView === key ? 'none' : key"), 'Clicking an expanded category should collapse it.');
for (const file of pages) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal(html, fs.readFileSync(path.join(root, 'dist', file), 'utf8'), file + ': source/dist mismatch');
  assert(html.includes('<script src="/main.js"></script>'), file + ': missing main.js');
  assert(html.includes('<script src="/tool-workspace.js"></script>'), file + ': missing workspace.js');
  assert(html.indexOf('src="/main.js"') < html.indexOf('src="/tool-workspace.js"'), file + ': incorrect script order');
  assert(html.includes('id="desktop-sidebar"'), file + ': missing sidebar');
  assert(html.includes('data-mobile-calculator-nav'), file + ': missing mobile navigation');
  assert(html.includes('animate-pulse-flow'), file + ': missing animated brand');
}
assert(js.includes('PerfusionToolsRecentCalculators'), 'Use existing recent history implementation');
assert(!js.includes('fetch('), 'Favorite actions must not make network requests');
const saved = new Map();
const window = { PerfusionToolsCalculatorRegistry: [{ path: '/bsa/' }, { path: '/gdp/' }],
  localStorage: { getItem: key => saved.get(key) || null, setItem: (key, val) => saved.set(key, val), removeItem: key => saved.delete(key) } };
const document = { readyState: 'loading', addEventListener() {}, querySelectorAll: () => [] };
vm.runInNewContext(js, { window, document, console });
const fav = window.PerfusionToolsFavorites;
assert(fav);
fav.toggleFavorite('/bsa/');
fav.toggleFavorite('/gdp/');
assert.deepEqual(JSON.parse(saved.get(fav.favoriteStorageKey)), ['/bsa/', '/gdp/']);
fav.toggleFavorite('/bsa/');
assert.deepEqual(JSON.parse(saved.get(fav.favoriteStorageKey)), ['/gdp/']);
fav.toggleFavorite('/invalid/');
assert.deepEqual(JSON.parse(saved.get(fav.favoriteStorageKey)), ['/gdp/']);
saved.set(fav.favoriteStorageKey, JSON.stringify(['/gdp/', '/gdp/', '/invalid/']));
assert.deepEqual(Array.from(fav.readFavorites()), ['/gdp/']);
saved.set(fav.favoriteStorageKey, 'broken-json');
assert.deepEqual(Array.from(fav.readFavorites()), []);

const noWriteWindow = {
  PerfusionToolsCalculatorRegistry: [{ path: '/bsa/', title: 'BSA Calculator' }],
  localStorage: {
    getItem() { return '[]'; },
    setItem() { throw new Error('Quota exceeded'); }
  }
};
vm.runInNewContext(js, { window: noWriteWindow, document, console });
noWriteWindow.PerfusionToolsFavorites.toggleFavorite('/bsa/');
assert.deepEqual(Array.from(noWriteWindow.PerfusionToolsFavorites.readFavorites()), ['/bsa/'],
  'A readable but write-protected localStorage must fall back to in-page favorites.');

const mainSource = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const routeStart = mainSource.indexOf('function getActivePath()');
const routeEnd = mainSource.indexOf('\nfunction navigateTo(', routeStart);
assert(routeStart >= 0 && routeEnd > routeStart, 'Home route resolution function should remain accessible.');
const routeContext = {
  window: {
    location: { pathname: '/', hash: '#featured-tools-heading' },
    normalizeRoute(value) { return value; }
  },
  history: { replaceState() { throw new Error('An in-page section must not become a route'); } }
};
vm.createContext(routeContext);
vm.runInContext(mainSource.slice(routeStart, routeEnd), routeContext);
assert.equal(routeContext.getActivePath(), '/', 'Quick Access section must preserve the Home route.');
routeContext.window.location.hash = '#all-calculators-heading';
assert.equal(routeContext.getActivePath(), '/', 'All Calculators section must preserve the Home route.');
assert(mainSource.includes("['#all-calculators-heading', '#featured-tools-heading'].includes(window.location.hash)"),
  'Scroll reset should preserve both Home section anchors.');

console.log('Tool workspace and favorites tests passed.');
