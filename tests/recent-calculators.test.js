'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const block = source.slice(source.indexOf("const RECENT_CALCULATORS_STORAGE_KEY"), source.indexOf("\nconst TOP_NAV_ITEMS"));

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    values
  };
}

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.innerHTML = '';
    this.textContent = '';
    this.isConnected = true;
    this.listeners = new Map();
    this.classList = {
      toggle: (name, force) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !classes.has(name) : force;
        if (enabled) classes.add(name); else classes.delete(name);
        this.className = [...classes].join(' ');
      },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  focus(options) { this.ownerDocument.activeElement = this; this.focusOptions = options; }
  closest(selector) { return selector.includes('.hidden') && this.classList.contains('hidden') ? this : null; }
}

function makeContext(storage, { browserLanguage = 'en', pathname = '/', includeHome = true } = {}) {
  const elements = new Map();
  const document = {
    documentElement: { lang: 'en' },
    body: {},
    activeElement: null,
    getElementById: id => elements.get(id) || null,
    createElement: tagName => new FakeElement(tagName, document)
  };
  const addElement = (id, tagName, className = '') => {
    const element = new FakeElement(tagName, document);
    element.id = id;
    element.className = className;
    elements.set(id, element);
    return element;
  };
  if (includeHome) {
    addElement('calculator-category-list', 'div');
    addElement('all-calculators-heading', 'h2');
    addElement('recent-calculators', 'section', 'hidden');
    addElement('recent-calculator-list', 'ul');
    addElement('recent-calculators-heading', 'h2');
    addElement('clear-recent-calculators', 'button');
  }
  const windowListeners = new Map();
  const window = {
    localStorage: storage,
    location: { pathname },
    addEventListener(type, handler) {
      const handlers = windowListeners.get(type) || [];
      handlers.push(handler);
      windowListeners.set(type, handlers);
    },
    dispatchEvent(event) { (windowListeners.get(event.type) || []).forEach(handler => handler(event)); }
  };
  const context = { document, navigator: { language: browserLanguage }, window, console };
  vm.createContext(context);
  vm.runInContext(`${block}\nthis.api = { CALCULATOR_REGISTRY, HOME_COPY, readRecentCalculatorRoutes, saveVisitedCalculator, clearRecentCalculatorRoutes, getCalculatorByRoute, createCalculatorRow, createCalculatorListItem, renderCalculatorDirectory, renderRecentCalculators, initCalculatorDiscovery, initCalculatorDiscoveryPageshow, refreshRecentCalculatorsOnPageshow };`, context);
  return { context, api: context.api, elements, window, windowListeners, document };
}

const key = 'perfusiontools_recent_calculators';
{
  const storage = makeStorage();
  const { api } = makeContext(storage);
  assert.deepStrictEqual(Array.from(api.saveVisitedCalculator('/gdp/', storage)), ['/gdp/']);
  api.saveVisitedCalculator('/bsa/', storage);
  api.saveVisitedCalculator('/heparin/', storage);
  assert.deepStrictEqual(JSON.parse(storage.values.get(key)), ['/heparin/', '/bsa/', '/gdp/']);
  api.saveVisitedCalculator('/bsa/', storage);
  assert.deepStrictEqual(JSON.parse(storage.values.get(key)), ['/bsa/', '/heparin/', '/gdp/'], 'duplicates move first');
  api.saveVisitedCalculator('/timecalc/', storage);
  assert.deepStrictEqual(JSON.parse(storage.values.get(key)), ['/timecalc/', '/bsa/', '/heparin/'], 'only latest three remain');
  const before = storage.values.get(key);
  assert.deepStrictEqual(Array.from(api.saveVisitedCalculator('/privacy/', storage)), []);
  assert.deepStrictEqual(Array.from(api.saveVisitedCalculator('/unknown/', storage)), []);
  assert.strictEqual(storage.values.get(key), before, 'non-calculator routes do not alter storage');
  assert(!storage.values.get(key).includes('input') && !storage.values.get(key).includes('result'), 'only route strings are stored');
}

{
  const storage = makeStorage({ [key]: '{bad json' });
  const { api } = makeContext(storage);
  assert.deepStrictEqual(Array.from(api.readRecentCalculatorRoutes(storage)), [], 'corrupt JSON fails safely');
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); }, removeItem() { throw new Error('denied'); } };
  assert.doesNotThrow(() => api.readRecentCalculatorRoutes(throwing));
  assert.doesNotThrow(() => api.saveVisitedCalculator('/gdp/', throwing));
  assert.doesNotThrow(() => api.clearRecentCalculatorRoutes(throwing));
}

{
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const { api } = makeContext(makeStorage());
  assert(html.includes('id="recent-calculators" class="hidden"'), 'first-time Recent section starts hidden');
  assert(html.includes('id="calculator-category-list"'), 'full categorized directory mount exists');
  assert(!/<input[^>]+type=["']search/i.test(html), 'home has no search field');
  assert.strictEqual(new Set(api.CALCULATOR_REGISTRY.map(item => item.path)).size, api.CALCULATOR_REGISTRY.length, 'registry routes are unique');
  assert(api.CALCULATOR_REGISTRY.every(item => /^\/[a-z0-9-]+\/$/.test(item.path)), 'registry routes are canonical');
  assert.strictEqual(api.HOME_COPY.recent, 'Recently used');
  assert.strictEqual(api.HOME_COPY.clear, 'Clear recent');
  assert.strictEqual(api.HOME_COPY.all, 'All calculators');
  assert(api.CALCULATOR_REGISTRY.every(item => typeof item.title === 'string' && typeof item.description === 'string'), 'registry uses direct English fields');
  for (const item of api.CALCULATOR_REGISTRY) assert(html.includes(`href="${item.path}"`) || source.includes(`path: '${item.path}'`), `${item.path} is available`);
  assert(/recently used feature stores only up to three calculator routes/i.test(html));
  assert(/does not store patient inputs, calculation results, patient identifiers/i.test(html));
  assert(/Clear recent/.test(html), 'English clear instructions exist');
  assert(!/[가-힣]/.test(block) && !/[가-힣]/.test(html), 'no Korean localization data remains for this feature');
  assert(!block.includes('navigator.language') && !block.includes('document.documentElement.lang'), 'home discovery does not detect browser or document language');

  const koreanBrowserApi = makeContext(makeStorage(), { browserLanguage: 'ko-KR' }).api;
  const row = koreanBrowserApi.createCalculatorRow(koreanBrowserApi.CALCULATOR_REGISTRY[0]);
  assert(row.innerHTML.includes('DO₂i / GDP Calculator'), 'Korean browser locale still renders the English calculator title');
  assert(row.innerHTML.includes('Indexed oxygen delivery'), 'Korean browser locale still renders the English calculator description');
  assert.strictEqual(koreanBrowserApi.HOME_COPY.recent, 'Recently used', 'Korean browser locale does not change recent heading copy');
}

{
  const { api } = makeContext(makeStorage());
  const item = api.createCalculatorListItem(api.CALCULATOR_REGISTRY[0]);
  assert.strictEqual(item.tagName, 'LI', 'calculator link is wrapped in a native list item');
  assert.strictEqual(item.children[0].tagName, 'A', 'calculator row remains a native anchor');
  assert.strictEqual(item.children[0].href, '/gdp/', 'calculator anchor retains its canonical href');
  assert.strictEqual(item.children[0].getAttribute('role'), null, 'native anchor role is not overridden');

  api.renderCalculatorDirectory();
  const fullContainer = api.createCalculatorRow(api.CALCULATOR_REGISTRY[0]).ownerDocument.getElementById('calculator-category-list');
  assert(fullContainer.children.length > 0, 'full directory remains rendered');
  fullContainer.children.forEach(section => {
    const list = section.children[1];
    assert.strictEqual(list.tagName, 'UL', 'each full-directory category uses a semantic list');
    assert(list.children.every(listItem => listItem.tagName === 'LI' && listItem.children[0].tagName === 'A'), 'full-directory list uses ul > li > a');
  });
}

{
  const storage = makeStorage();
  const harness = makeContext(storage);
  harness.api.initCalculatorDiscovery();
  assert(harness.elements.get('recent-calculators').classList.contains('hidden'), 'home initially has no recent section');
  assert.strictEqual((harness.windowListeners.get('pageshow') || []).length, 1, 'home installs one pageshow listener');
  harness.api.initCalculatorDiscovery();
  assert.strictEqual((harness.windowListeners.get('pageshow') || []).length, 1, 'reinitialization does not duplicate pageshow listeners');

  harness.api.saveVisitedCalculator('/heparin/', storage);
  harness.window.dispatchEvent({ type: 'pageshow', persisted: true });
  const recentList = harness.elements.get('recent-calculator-list');
  assert(!harness.elements.get('recent-calculators').classList.contains('hidden'), 'pageshow reveals updated recent history');
  assert.strictEqual(recentList.tagName, 'UL', 'recent routes use a semantic list');
  assert.strictEqual(recentList.children[0].tagName, 'LI');
  assert.strictEqual(recentList.children[0].children[0].tagName, 'A');
  assert.strictEqual(recentList.children[0].children[0].href, '/heparin/');
  assert.strictEqual(recentList.children[0].children[0].getAttribute('role'), null, 'recent anchor retains its native role');
}

{
  const storage = makeStorage();
  const harness = makeContext(storage, { pathname: '/heparin/', includeHome: false });
  harness.api.initCalculatorDiscoveryPageshow();
  assert.strictEqual((harness.windowListeners.get('pageshow') || []).length, 0, 'standalone calculator pages do not install the home pageshow listener');
  harness.window.dispatchEvent({ type: 'pageshow', persisted: true });
  assert.strictEqual(harness.elements.size, 0, 'standalone pageshow does not create a home directory');
}

{
  const storage = makeStorage();
  const harness = makeContext(storage);
  harness.api.renderCalculatorDirectory();
  harness.api.saveVisitedCalculator('/gdp/', storage);
  harness.api.renderRecentCalculators();
  const fullContainer = harness.elements.get('calculator-category-list');
  const fullCount = fullContainer.children.reduce((count, section) => count + section.children[1].children.length, 0);
  const clearButton = harness.elements.get('clear-recent-calculators');
  harness.document.activeElement = clearButton;

  harness.api.clearRecentCalculatorRoutes(storage);
  assert(!storage.values.has(key), 'Clear recent removes the storage key');
  assert(harness.elements.get('recent-calculators').classList.contains('hidden'), 'Clear recent hides the section');
  assert.strictEqual(harness.elements.get('recent-calculator-list').children.length, 0, 'Clear recent empties recent list items');
  assert.strictEqual(harness.document.activeElement, harness.elements.get('all-calculators-heading'), 'focus moves to All calculators');
  assert.notStrictEqual(harness.document.activeElement, clearButton, 'focus does not remain in hidden recent controls');
  assert.notStrictEqual(harness.document.activeElement, harness.document.body, 'focus does not fall back to the body');
  assert.strictEqual(harness.document.activeElement.focusOptions.preventScroll, true, 'focus transfer prevents scrolling');
  assert.strictEqual(fullContainer.children.reduce((count, section) => count + section.children[1].children.length, 0), fullCount, 'full directory remains intact');
}

console.log('All recent calculator tests passed.');
