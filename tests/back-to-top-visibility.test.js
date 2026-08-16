'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.join(__dirname, '..');
const mainJs = fs.readFileSync(path.join(repoRoot, 'main.js'), 'utf8');
const timecalcHtml = fs.readFileSync(path.join(repoRoot, 'timecalc', 'index.html'), 'utf8');
const distTimecalcHtml = fs.readFileSync(path.join(repoRoot, 'dist', 'timecalc', 'index.html'), 'utf8');
const pagesWithBackToTop = [
  'index.html', 'bsa/index.html', 'lbm/index.html', 'gdp/index.html', 'heparin/index.html',
  'predicted-hct/index.html', 'z-score/index.html', 'priming-volume/index.html',
  'timecalc/index.html', 'quick-reference/index.html', 'cannula-pressure-drop/index.html',
  'unit-converter/index.html', 'phn-echo/index.html'
];

assert.strictEqual(timecalcHtml, distTimecalcHtml, 'Time Calculator source and dist output should stay synchronized.');
assert(!timecalcHtml.includes('id="cardioplegia-shortcut"'), 'Time Calculator should no longer render the fixed cardioplegia popup.');
assert(timecalcHtml.includes('opacity-0 pointer-events-none') && timecalcHtml.includes('aria-hidden="true" tabindex="-1"'), 'Back-to-top button should start non-interactive and hidden from accessibility APIs.');
for (const relativePath of pagesWithBackToTop) {
  const html = fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
  const buttonMatches = html.match(/id="back-to-top"/g) || [];
  const mobileNavEnd = html.indexOf('</nav>', html.indexOf('<nav data-mobile-calculator-nav'));
  const buttonStart = html.indexOf('<button id="back-to-top"');
  assert.strictEqual(buttonMatches.length, 1, `${relativePath} should render exactly one Back-to-top button.`);
  if (mobileNavEnd !== -1) assert(buttonStart > mobileNavEnd, `${relativePath} should not place Back-to-top inside the mobile navigation.`);
  assert(html.includes('rounded-full border border-slate-200 bg-white text-primary-900'), `${relativePath} should use the light outlined button style.`);
  assert(html.includes('d="M6 15l6-6 6 6"'), `${relativePath} should use the compact chevron icon.`);
  assert(html.includes('[data-mobile-calculator-nav] .back-to-top-button'), `${relativePath} should defensively hide any stale centered control.`);
  assert(!/<nav data-mobile-calculator-nav[\s\S]*?<button id="back-to-top"[\s\S]*?<\/nav>/.test(html), `${relativePath} should not render Back-to-top inside the mobile navigation.`);
}
assert(mainJs.includes('removeNestedBackToTopButtons();'), 'Back-to-top initialization should remove stale controls nested in mobile navigation.');
assert(mainJs.includes("document.querySelectorAll('[data-mobile-calculator-nav] #back-to-top, [data-mobile-calculator-nav] .back-to-top-button')"), 'Legacy cleanup should cover centered controls by id and class.');
assert(mainJs.includes('button.dataset.backToTopInitialized'), 'Back-to-top initialization should guard against duplicate event listeners.');
assert(mainJs.includes('renderCardioplegiaShortcut();'), 'Shortcut state changes should continue to use the shared shortcut render path.');
assert(mainJs.includes('updateBackToTopVisibility();'), 'Back-to-top visibility should be recalculated from shared update paths.');

const source = mainJs.slice(
  mainJs.indexOf('const BACK_TO_TOP_SCROLL_THRESHOLD_PX'),
  mainJs.indexOf("window.addEventListener('DOMContentLoaded'")
) + '\nthis.__backToTopApi = { initBackToTopButton, updateBackToTopVisibility, isCardioplegiaShortcutVisible, isMobileTimeCalculatorShortcutBlockingBackToTop };';

function makeClassList(initial = []) {
  const values = new Set(initial);
  return {
    contains(name) { return values.has(name); },
    add(...names) { names.forEach(name => values.add(name)); },
    remove(...names) { names.forEach(name => values.delete(name)); },
    toggle(name, force) {
      const shouldAdd = force === undefined ? !values.has(name) : Boolean(force);
      if (shouldAdd) values.add(name);
      else values.delete(name);
      return shouldAdd;
    },
    toArray() { return Array.from(values).sort(); }
  };
}

function makeElement(initialClasses = []) {
  const attributes = new Map();
  const listeners = new Map();
  return {
    hidden: false,
    dataset: {},
    classList: makeClassList(initialClasses),
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
    removeAttribute(name) { attributes.delete(name); },
    addEventListener(type, handler) { listeners.set(type, handler); },
    click() { listeners.get('click')?.(); },
    getListener(type) { return listeners.get(type); },
    get attributes() { return attributes; }
  };
}

function createHarness({ pathname = '/timecalc/', width = 390, scrollY = 0, shortcutHidden = true } = {}) {
  const button = makeElement(['opacity-0', 'pointer-events-none', 'translate-y-2']);
  button.setAttribute('aria-hidden', 'true');
  button.setAttribute('tabindex', '-1');
  const shortcut = makeElement(shortcutHidden ? ['hidden'] : []);
  const elements = new Map([
    ['back-to-top', button],
    ['cardioplegia-shortcut', shortcut]
  ]);
  const listeners = new Map();
  const context = {
    el: id => elements.get(id) || null,
    document: {
      getElementById: id => elements.get(id) || null,
      documentElement: { scrollTop: scrollY },
      body: { scrollTop: 0 }
    },
    window: {
      innerWidth: width,
      scrollY,
      location: { pathname },
      normalizeRoute: pathValue => pathValue,
      getComputedStyle: node => ({
        display: node.classList.contains('hidden') ? 'none' : 'block',
        visibility: 'visible',
        opacity: node.classList.contains('hidden') ? '0' : '1'
      }),
      matchMedia: query => ({
        matches: query === '(max-width: 768px)' ? width <= 768 : false,
        addEventListener(type, handler) { listeners.set(`media:${type}`, handler); }
      }),
      addEventListener(type, handler) { listeners.set(type, handler); },
      scrollTo(options) { context.scrollToOptions = options; context.window.scrollY = 0; context.document.documentElement.scrollTop = 0; }
    },
    console,
    setTimeout,
    clearTimeout
  };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return { context, button, shortcut, listeners, api: context.__backToTopApi };
}

function assertBackToTopHidden(button, message) {
  assert(button.classList.contains('opacity-0'), `${message}: should be visually hidden.`);
  assert(button.classList.contains('pointer-events-none'), `${message}: should block pointer interaction.`);
  assert.strictEqual(button.getAttribute('tabindex'), '-1', `${message}: should be removed from keyboard tab order.`);
  assert.strictEqual(button.getAttribute('aria-hidden'), 'true', `${message}: should be hidden from screen readers.`);
}

function assertBackToTopVisible(button, message) {
  assert(!button.classList.contains('opacity-0'), `${message}: should be visible.`);
  assert(!button.classList.contains('pointer-events-none'), `${message}: should allow pointer interaction.`);
  assert.strictEqual(button.getAttribute('tabindex'), null, `${message}: should restore keyboard focusability.`);
  assert.strictEqual(button.getAttribute('aria-hidden'), 'false', `${message}: should be exposed to screen readers.`);
}

{
  const { api, button } = createHarness({ scrollY: 0, shortcutHidden: true });
  api.updateBackToTopVisibility();
  assertBackToTopHidden(button, 'Mobile page top');
}

{
  const { api, button } = createHarness({ scrollY: 320, shortcutHidden: true });
  api.updateBackToTopVisibility();
  assertBackToTopVisible(button, 'Mobile scrolled without shortcut');
}

{
  const { api, button } = createHarness({ scrollY: 320, shortcutHidden: false });
  api.updateBackToTopVisibility();
  assertBackToTopHidden(button, 'Mobile scrolled with visible cardioplegia shortcut');
}

{
  const { api, button, shortcut } = createHarness({ scrollY: 320, shortcutHidden: false });
  api.updateBackToTopVisibility();
  assertBackToTopHidden(button, 'Visible shortcut before dismiss');
  shortcut.classList.add('hidden');
  api.updateBackToTopVisibility();
  assertBackToTopVisible(button, 'Dismissed shortcut after threshold scroll');
}

{
  const { api, button, shortcut } = createHarness({ pathname: '/bsa/', scrollY: 320, shortcutHidden: false });
  api.updateBackToTopVisibility();
  assertBackToTopVisible(button, 'Other calculator pages should ignore Time Calculator shortcut DOM');
  shortcut.classList.add('hidden');
}

{
  const { api, button } = createHarness({ width: 1024, scrollY: 320, shortcutHidden: false });
  api.updateBackToTopVisibility();
  assertBackToTopVisible(button, 'Desktop should not apply mobile shortcut collision suppression');
}

{
  const { api, button, context } = createHarness({ scrollY: 320, shortcutHidden: true });
  api.initBackToTopButton();
  assert.strictEqual(button.dataset.backToTopInitialized, 'true', 'Initializer should mark the button as initialized.');
  button.click();
  assert.strictEqual(JSON.stringify(context.scrollToOptions), JSON.stringify({ top: 0, left: 0, behavior: 'smooth' }), 'Visible Back-to-top click should keep smooth scroll-to-top behavior.');
}

console.log('All back-to-top visibility tests passed.');
