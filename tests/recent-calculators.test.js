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

function makeContext(storage) {
  const elements = new Map();
  const document = {
    documentElement: { lang: 'en' },
    getElementById: id => elements.get(id) || null,
    createElement: () => ({ dataset: {}, setAttribute() {}, append() {}, appendChild() {} })
  };
  const context = { document, navigator: { language: 'en' }, window: { localStorage: storage, location: { pathname: '/' } }, console };
  vm.createContext(context);
  vm.runInContext(`${block}\nthis.api = { CALCULATOR_REGISTRY, HOME_TRANSLATIONS, readRecentCalculatorRoutes, saveVisitedCalculator, clearRecentCalculatorRoutes, getCalculatorByRoute };`, context);
  return { context, api: context.api, elements };
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
  assert(api.HOME_TRANSLATIONS.en.recent && api.HOME_TRANSLATIONS.ko.recent && api.HOME_TRANSLATIONS.en.clear && api.HOME_TRANSLATIONS.ko.all, 'English and Korean home labels exist');
  for (const item of api.CALCULATOR_REGISTRY) assert(html.includes(`href="${item.path}"`) || source.includes(`path: '${item.path}'`), `${item.path} is available`);
  assert(/recently used feature stores only up to three calculator routes/i.test(html));
  assert(/does not store patient inputs, calculation results, patient identifiers/i.test(html));
  assert(/Clear recent/.test(html) && /최근 기록 지우기/.test(html), 'clear instructions exist in both languages');
}

console.log('All recent calculator tests passed.');
