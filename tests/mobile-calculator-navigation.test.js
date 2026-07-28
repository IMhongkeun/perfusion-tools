'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const sourceMainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
const sourcePages = [
  'index.html',
  'bsa/index.html',
  'lbm/index.html',
  'gdp/index.html',
  'heparin/index.html',
  'predicted-hct/index.html',
  'z-score/index.html',
  'priming-volume/index.html',
  'timecalc/index.html',
  'quick-reference/index.html',
  'cannula-pressure-drop/index.html',
  'unit-converter/index.html'
];

for (const relativePath of sourcePages) {
  const sourceHtml = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const distHtml = fs.readFileSync(path.join(repoRoot, 'dist', relativePath), 'utf8');
  assert(sourceHtml.includes('<nav data-mobile-calculator-nav class="md:hidden fixed bottom-0'), `${relativePath} should contain the shared fixed mobile calculator nav.`);
  assert.strictEqual(sourceHtml, distHtml, `${relativePath} source and dist output should match.`);
}

const heparinHtml = fs.readFileSync(path.join(repoRoot, 'heparin', 'index.html'), 'utf8');
assert(/id="mob-heparin" aria-current="page" class="[^"]*text-accent-600/.test(heparinHtml), 'Heparin mobile link should be active and expose aria-current.');
assert(/data-mobile-calculator-nav class="[^"]*fixed bottom-0[^"]*z-50[^"]*overflow-x-auto/.test(heparinHtml), 'Heparin mobile nav should retain the shared fixed, scrollable, foreground layout.');
assert(!/#view-heparin[^}]*display\s*:\s*none|#view-heparin[^}]*overflow\s*:\s*hidden[^}]*data-mobile-calculator-nav/.test(heparinHtml), 'Heparin should not define a route-specific mobile-nav hiding rule.');

const navigationSource = sourceMainJs.slice(
  sourceMainJs.indexOf("const MOBILE_CALCULATOR_NAV_SCROLL_KEY"),
  sourceMainJs.indexOf('\nconst BSA =')
);
assert(navigationSource.includes("'perfusiontools.mobileCalculatorNav.scrollLeft'"), 'Shared navigation should use the documented session key.');
assert(!navigationSource.includes('scrollIntoView'), 'Mobile-nav restoration should not invoke scrollIntoView.');
assert(!navigationSource.includes("behavior: 'smooth'"), 'Mobile-nav restoration should be immediate.');

function createHarness({ storedValue = null, storageThrows = false, navPresent = true, pathname = '/heparin/' } = {}) {
  const listeners = new Map();
  const links = [
    { href: 'https://perfusiontools.com/', offsetLeft: 0, offsetWidth: 72, addEventListener() {} },
    { href: 'https://perfusiontools.com/heparin/', offsetLeft: 288, offsetWidth: 72, addEventListener(type, handler) { listeners.set(type, handler); } }
  ];
  const nav = {
    scrollLeft: 0,
    scrollWidth: 900,
    clientWidth: 390,
    querySelectorAll() { return links; }
  };
  const stored = new Map();
  if (storedValue !== null) stored.set('perfusiontools.mobileCalculatorNav.scrollLeft', storedValue);
  const sessionStorage = {
    getItem(key) {
      if (storageThrows) throw new Error('storage unavailable');
      return stored.has(key) ? stored.get(key) : null;
    },
    setItem(key, value) {
      if (storageThrows) throw new Error('storage unavailable');
      stored.set(key, value);
    }
  };
  const context = {
    URL,
    document: { querySelector: () => navPresent ? nav : null },
    requestAnimationFrame: (callback) => callback(),
    window: { location: { pathname, origin: 'https://perfusiontools.com' }, sessionStorage }
  };
  vm.createContext(context);
  vm.runInContext(`${navigationSource}\nthis.mobileNavApi = { initMobileCalculatorNav, readMobileCalculatorNavScroll, saveMobileCalculatorNavScroll };`, context);
  return { api: context.mobileNavApi, links, listeners, nav, stored };
}

{
  const { api, listeners, nav, stored } = createHarness({ storedValue: '240' });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 240, 'A finite stored position should be restored.');
  nav.scrollLeft = 275;
  listeners.get('click')();
  assert.strictEqual(stored.get('perfusiontools.mobileCalculatorNav.scrollLeft'), '275', 'Link activation should record the current finite scrollLeft without preventing navigation.');
}

{
  const { api, nav } = createHarness({ storedValue: '-50' });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 0, 'Negative stored positions should clamp to zero.');
}

{
  const { api, nav } = createHarness({ storedValue: '9999' });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 510, 'Stored positions should clamp to scrollWidth minus clientWidth.');
}

for (const storedValue of ['not-a-number', 'Infinity', '']) {
  const { api, nav } = createHarness({ storedValue });
  assert.doesNotThrow(() => api.initMobileCalculatorNav(), `Invalid stored value ${storedValue || '(empty)'} should be ignored safely.`);
  assert.strictEqual(nav.scrollLeft, 0, 'Invalid state should use minimal active-item reveal rather than an arbitrary reset.');
}

assert.doesNotThrow(() => createHarness({ storageThrows: true }).api.initMobileCalculatorNav(), 'Storage exceptions should not break shared navigation initialization.');
assert.doesNotThrow(() => createHarness({ navPresent: false }).api.initMobileCalculatorNav(), 'Initialization should be a no-op when the mobile nav is absent.');
assert(!navigationSource.includes('global-top-nav'), 'Mobile persistence should not alter desktop top navigation.');

console.log('All mobile calculator navigation tests passed.');
