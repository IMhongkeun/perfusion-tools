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
  sourceMainJs.indexOf("const MOBILE_CALCULATOR_NAV_PENDING_SCROLL_KEY"),
  sourceMainJs.indexOf('\nconst BSA =')
);
const pendingScrollKey = 'perfusiontools.mobileCalculatorNav.pendingScroll';
assert(navigationSource.includes(`'${pendingScrollKey}'`), 'Shared navigation should use the destination-bound pending-scroll key.');
assert(!navigationSource.includes('scrollIntoView'), 'Mobile-nav restoration should not invoke scrollIntoView.');
assert(!navigationSource.includes("behavior: 'smooth'"), 'Mobile-nav restoration should be immediate.');

function createHarness({ storedValue = null, storageError = null, navPresent = true, pathname = '/heparin/' } = {}) {
  const listeners = new Map();
  const makeLink = (href, offsetLeft, attributes = {}) => ({
    href,
    offsetLeft,
    offsetWidth: 72,
    target: attributes.target || '',
    hasAttribute(name) { return Boolean(attributes[name]); },
    addEventListener(type, handler) { listeners.set(href, { type, handler }); }
  });
  const links = [
    makeLink('https://perfusiontools.com/', 0),
    makeLink('https://perfusiontools.com/heparin/', 500),
    makeLink('https://perfusiontools.com/predicted-hct/', 650),
    makeLink('https://external.example/calculator/', 800),
    makeLink('https://perfusiontools.com/info/', 872)
  ];
  const nav = {
    scrollLeft: 0,
    scrollWidth: 900,
    clientWidth: 390,
    querySelectorAll() { return links; }
  };
  const stored = new Map();
  if (storedValue !== null) stored.set(pendingScrollKey, storedValue);
  let removeCount = 0;
  const sessionStorage = {
    getItem(key) {
      if (storageError === 'read') throw new Error('storage unavailable');
      return stored.has(key) ? stored.get(key) : null;
    },
    setItem(key, value) {
      if (storageError === 'write') throw new Error('storage unavailable');
      stored.set(key, value);
    },
    removeItem(key) {
      if (storageError === 'remove') throw new Error('storage unavailable');
      removeCount += 1;
      stored.delete(key);
    }
  };
  const context = {
    URL,
    TOP_NAV_ITEMS: [
      { path: '/' },
      { path: '/bsa/' },
      { path: '/heparin/' },
      { path: '/predicted-hct/' },
      { path: '/info/' }
    ],
    document: { querySelector: () => navPresent ? nav : null },
    requestAnimationFrame: (callback) => callback(),
    window: {
      location: { pathname, origin: 'https://perfusiontools.com' },
      normalizeRoute(route) {
        if (!route || route === '/') return '/';
        const withLeadingSlash = route.startsWith('/') ? route : `/${route}`;
        return withLeadingSlash.replace(/\/$/, '');
      },
      sessionStorage
    }
  };
  vm.createContext(context);
  vm.runInContext(`${navigationSource}\nthis.mobileNavApi = { initMobileCalculatorNav, consumeMobileCalculatorNavScroll, saveMobileCalculatorNavScroll };`, context);
  return { api: context.mobileNavApi, links, listeners, nav, stored, getRemoveCount: () => removeCount };
}

{
  const { api, links, listeners, nav, stored } = createHarness();
  api.initMobileCalculatorNav();
  nav.scrollLeft = 275;
  const clickEvent = { button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false };
  listeners.get(links[1].href).handler(clickEvent);
  const payload = JSON.parse(stored.get(pendingScrollKey));
  assert.strictEqual(payload.scrollLeft, 275, 'A normal click should store the current finite scrollLeft.');
  assert.strictEqual(payload.destination, '/heparin', 'The destination should use normalized route form.');
  assert(Number.isFinite(payload.savedAt) && Math.abs(Date.now() - payload.savedAt) < 1000, 'A normal click should store a current timestamp.');
}

{
  const pending = JSON.stringify({ scrollLeft: 240, destination: '/heparin/', savedAt: Date.now() });
  const { api, nav, stored, getRemoveCount } = createHarness({ storedValue: pending });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 240, 'A fresh destination-matched payload should restore its position.');
  assert(!stored.has(pendingScrollKey), 'A read payload should be removed immediately.');
  assert.strictEqual(getRemoveCount(), 1, 'A matching payload should be consumed exactly once.');
  nav.scrollLeft = 0;
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 182, 'A consumed payload should not be reused; reload should minimally reveal the active item.');
}

{
  const pending = JSON.stringify({ scrollLeft: 240, destination: '/predicted-hct/', savedAt: Date.now() });
  const { api, nav, stored } = createHarness({ storedValue: pending });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 182, 'A destination mismatch should run active-item fallback instead of restoring stale coordinates.');
  assert(!stored.has(pendingScrollKey), 'A destination-mismatched payload should still be consumed.');
}

{
  const pending = JSON.stringify({ scrollLeft: 240, destination: '/heparin', savedAt: Date.now() - 30_001 });
  const { api, nav, stored } = createHarness({ storedValue: pending });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 182, 'An expired payload should run active-item fallback.');
  assert(!stored.has(pendingScrollKey), 'An expired payload should be removed.');
}

{
  const { api, nav, stored } = createHarness({ storedValue: '{malformed' });
  assert.doesNotThrow(() => api.initMobileCalculatorNav(), 'Malformed JSON should not break initialization.');
  assert.strictEqual(nav.scrollLeft, 182, 'Malformed JSON should allow active-item fallback.');
  assert(!stored.has(pendingScrollKey), 'Malformed JSON should be removed after reading.');
}

const invalidPositions = [null, '240', -1, Number.NaN, Number.POSITIVE_INFINITY];
for (const scrollLeft of invalidPositions) {
  const pending = JSON.stringify({ scrollLeft, destination: '/heparin', savedAt: Date.now() });
  const { api, nav } = createHarness({ storedValue: pending });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 182, `Invalid position ${String(scrollLeft)} should use active-item fallback.`);
}

{
  const pending = JSON.stringify({ scrollLeft: 9999, destination: '/heparin', savedAt: Date.now() });
  const { api, nav } = createHarness({ storedValue: pending });
  api.initMobileCalculatorNav();
  assert.strictEqual(nav.scrollLeft, 510, 'An oversized valid position should clamp to the maximum scroll range.');
}

const modifiedEvents = [
  { button: 0, ctrlKey: true },
  { button: 0, metaKey: true },
  { button: 0, shiftKey: true },
  { button: 0, altKey: true },
  { button: 1 }
];
for (const eventOverrides of modifiedEvents) {
  const { api, links, listeners, nav, stored } = createHarness();
  api.initMobileCalculatorNav();
  nav.scrollLeft = 240;
  listeners.get(links[1].href).handler({ button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...eventOverrides });
  assert(!stored.has(pendingScrollKey), `Modified interaction ${JSON.stringify(eventOverrides)} should not create pending state.`);
}

for (const setup of [
  { attributes: { target: '_blank' }, href: 'https://perfusiontools.com/heparin/' },
  { attributes: { download: true }, href: 'https://perfusiontools.com/heparin/' },
  { attributes: {}, href: 'https://external.example/calculator/' },
  { attributes: {}, href: 'https://perfusiontools.com/info/' }
]) {
  const { api, nav, stored } = createHarness();
  const link = { href: setup.href, target: setup.attributes.target || '', hasAttribute: (name) => Boolean(setup.attributes[name]) };
  nav.scrollLeft = 240;
  api.saveMobileCalculatorNavScroll(nav, link, { button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
  assert(!stored.has(pendingScrollKey), `${setup.href} should not create same-tab calculator pending state.`);
}

for (const storageError of ['read', 'write', 'remove']) {
  const pending = JSON.stringify({ scrollLeft: 240, destination: '/heparin', savedAt: Date.now() });
  const harness = createHarness({ storedValue: pending, storageError });
  assert.doesNotThrow(() => harness.api.initMobileCalculatorNav(), `${storageError} storage exceptions should not break initialization.`);
  if (storageError !== 'write') assert.strictEqual(harness.nav.scrollLeft, 182, `${storageError} failures should allow active-item fallback.`);
  assert.doesNotThrow(() => harness.api.saveMobileCalculatorNavScroll(harness.nav, harness.links[1], { button: 0, defaultPrevented: false, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }), 'Write failures should preserve normal navigation.');
}

{
  const { api, links, nav, stored } = createHarness();
  nav.scrollLeft = 240;
  api.saveMobileCalculatorNavScroll(nav, links[1], { button: 0, defaultPrevented: true, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
  assert(!stored.has(pendingScrollKey), 'Already-prevented navigation should not create pending state.');
}

assert.doesNotThrow(() => createHarness({ navPresent: false }).api.initMobileCalculatorNav(), 'Initialization should be a no-op when the mobile nav is absent.');
assert(!navigationSource.includes('global-top-nav'), 'Mobile persistence should not alter desktop top navigation.');

console.log('All mobile calculator navigation tests passed.');
