'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'tool-workspace.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'mobile.css'), 'utf8');
const pages = ['index.html', 'bsa/index.html', 'gdp/index.html', 'heparin/index.html', 'predicted-hct/index.html', 'lbm/index.html', 'timecalc/index.html', 'z-score/index.html', 'quick-reference/index.html', 'research/index.html', 'cannula-pressure-drop/index.html', 'priming-volume/index.html', 'unit-converter/index.html'];
assert.equal(js, fs.readFileSync(path.join(root, 'dist/tool-workspace.js'), 'utf8'));
assert.equal(css, fs.readFileSync(path.join(root, 'dist/mobile.css'), 'utf8'));
assert(css.includes('--pt-page: #ffffff;'));
assert(css.includes('--pt-accent: #277fad;'), 'Light mode should use a soft blue accent.');
assert(css.includes('.pt-sidebar-inline-results'), 'Categories should render an inline sublist.');
assert(css.includes('.pt-app-shell > main') && css.includes('max-width: 56rem'),
  'Home and standalone calculators must share a main content width.');
assert(css.includes('header .pt-header-inner > .pt-brand'),
  'All page headers must keep the animated brand anchored left.');
assert(css.includes('.pt-sidebar-option { font-size: .92rem'),
  'Navigation typography must be improved for desktop readability.');
assert(js.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches"),
  'Category motion must respect reduced motion settings.');
assert(css.includes(':not(:disabled):not([readonly]):not([aria-readonly="true"])'),
  'White input rule must not misrepresent disabled or readonly calculator controls.');
assert(js.includes('activeButton.after(sidebarPanel)'), 'Expanded tools should move immediately below the selected category.');
assert(js.includes("controls.className = 'pt-header-controls'"),
  'Favorite, My Tools and theme controls must use one right-aligned group.');
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
  assert(html.includes('pt-header-inner'), file + ': expected shared header alignment');
  assert(html.includes('pt-app-shell'), file + ': expected shared full-width app shell');
  assert(html.includes('pt-primary-nav hidden lg:flex'), file + ': desktop nav should be pre-rendered');
  const headerNav = html.match(/<nav class="pt-primary-nav[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert(headerNav, file + ': missing header navigation');
  for (const href of ['/', '/research/', '/info/']) {
    assert(headerNav.includes('href="' + href + '"'), file + ': missing header link to ' + href);
  }
  assert(html.includes('pt-header-pages lg:hidden'), file + ': missing narrow-screen page menu');
  assert(/<a href="\/"[^>]*id="brand-home"[^>]*class="pt-brand"/.test(html),
    file + ': the brand icon and name should link to Home');
}
assert(css.includes('.pt-header-pages { flex: 0 0 auto; order: 2; }'),
  'The narrow-screen page menu should follow the header action buttons.');
const researchHtml = fs.readFileSync(path.join(root, 'research/index.html'), 'utf8');
assert(researchHtml.indexOf('id="week-2026-11-01"') < researchHtml.indexOf('id="week-2026-10-25"'),
  'Weekly research should show the newest week first.');
assert(researchHtml.includes('<details class="research-archive">'),
  'Older research weeks should have a collapsible archive.');
const archivedWeek = researchHtml.match(/id="week-2026-10-25"[\s\S]*?<\/details>/)?.[0];
assert(archivedWeek && (archivedWeek.match(/<article class="research-card">/g) || []).length === 5,
  'The archived week should contain five study cards.');
for (const pmid of ['42926135', '42906575', '42940214', '42911832', '42899414']) {
  assert(archivedWeek.includes('https://pubmed.ncbi.nlm.nih.gov/' + pmid + '/'),
    'The archived week should link to PMID ' + pmid);
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
assert(mainSource.includes("link.id === 'brand-home'"),
  'Returning Home through the brand should scroll to the top.');


// Exercise the actual desktop accordion with a minimal DOM harness rather
// than relying only on source-string checks.
class AccordionElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.handlers = {};
    this.parentElement = null;
    this.hidden = false;
    this.className = '';
    this.textContent = '';
  }
  append(...items) {
    for (const item of items) {
      if (item.parentElement) item.parentElement.children =
        item.parentElement.children.filter(existing => existing !== item);
      this.children.push(item);
      item.parentElement = this;
    }
  }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...items) { this.children.forEach(item => { item.parentElement = null; }); this.children = []; this.append(...items); }
  after(node) {
    const parent = this.parentElement;
    assert(parent, 'Accordion button must have a parent');
    if (node.parentElement) node.parentElement.children =
      node.parentElement.children.filter(item => item !== node);
    parent.children.splice(parent.children.indexOf(this) + 1, 0, node);
    node.parentElement = parent;
  }
  insertBefore(node, reference) {
    if (node.parentElement) node.parentElement.children =
      node.parentElement.children.filter(item => item !== node);
    const index = this.children.indexOf(reference);
    this.children.splice(index >= 0 ? index : this.children.length, 0, node);
    node.parentElement = this;
  }
  addEventListener(event, callback) { (this.handlers[event] ||= []).push(callback); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  querySelectorAll(selector) {
    if (selector === 'a[href]') return this.descendants().filter(node => node.tagName === 'A' && node.href);
    return [];
  }
  querySelector() { return null; }
  contains(node) { return this === node || this.descendants().includes(node); }
  focus() {}
}
const workspaceAside = new AccordionElement('aside');
for (const route of ['/', '/bsa/', '/gdp/', '/info/']) {
  const link = new AccordionElement('a');
  link.href = route;
  link.setAttribute('href', route);
  workspaceAside.append(link);
}
const workspaceHeader = new AccordionElement();
const themeButton = new AccordionElement('button');
workspaceHeader.append(themeButton);
const workspaceBody = new AccordionElement('body');
workspaceBody.append(workspaceAside, workspaceHeader);
const uiLocalStorage = new Map();
const uiSessionStorage = new Map();
const uiWindow = {
  location: { pathname: '/bsa/' },
  PerfusionToolsCalculatorRegistry: [
    { path: '/bsa/', title: 'BSA Calculator', category: 'flow' },
    { path: '/gdp/', title: 'GDP Calculator', category: 'flow' }
  ],
  PerfusionToolsRecentCalculators: { readRecentCalculatorRoutes: () => ['/gdp/'] },
  localStorage: {
    getItem: key => uiLocalStorage.get(key) ?? null,
    setItem: (key, value) => uiLocalStorage.set(key, value)
  },
  sessionStorage: {
    getItem: key => uiSessionStorage.get(key) ?? null,
    setItem: (key, value) => uiSessionStorage.set(key, value),
    removeItem: key => uiSessionStorage.delete(key)
  },
  addEventListener() {},
  setTimeout: callback => callback()
};
const uiDocument = {
  readyState: 'complete',
  body: workspaceBody,
  createElement: tag => new AccordionElement(tag),
  getElementById(id) {
    if (id === 'desktop-sidebar') return workspaceAside;
    if (id === 'theme-toggle') return themeButton;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '[data-pt-favorite-path]') {
      return workspaceBody.descendants().filter(item => item.getAttribute('data-pt-favorite-path'));
    }
    return [];
  },
  addEventListener() {}
};
vm.runInNewContext(js, { window: uiWindow, document: uiDocument, console });
const headerControls = workspaceHeader.descendants().find(item => item.className === 'pt-header-controls');
assert(headerControls, 'Header action group must be initialized on a calculator page.');
assert.equal(themeButton.parentElement, headerControls,
  'Theme button should be inside the same group as calculator favorites.');
assert(headerControls.descendants().some(item => item.className.includes('pt-header-favorite')),
  'Favorite star should be grouped with the theme control.');
const workspaceNav = workspaceAside.children[0];
const buttons = workspaceNav.descendants().filter(item => item.getAttribute('data-pt-sidebar-view') !== null);
const flowOption = buttons.find(item => item.getAttribute('data-pt-sidebar-view') === 'flow');
const favoriteOption = buttons.find(item => item.getAttribute('data-pt-sidebar-view') === 'favorites');
const accordion = workspaceNav.descendants().find(item => item.id === 'pt-sidebar-inline-panel');
let animationCount = 0;
accordion.animate = () => { animationCount += 1; return { cancel() {} }; };
uiWindow.matchMedia = () => ({ matches: false });
assert(accordion && accordion.hidden, 'Accordion should initially be collapsed');
flowOption.handlers.click[0]();
assert.equal(animationCount, 1, 'Opening a category animates once.');
assert.equal(flowOption.getAttribute('aria-expanded'), 'true');
assert.equal(workspaceNav.children.indexOf(accordion), workspaceNav.children.indexOf(flowOption) + 1,
  'Expanded flow calculators appear immediately below their category');
assert.equal(accordion.descendants().filter(item => item.tagName === 'A' && item.href === '/bsa/').length, 1);
uiWindow.PerfusionToolsFavorites.toggleFavorite('/bsa/');
assert.equal(animationCount, 1, 'Updating favorites does not replay the opening animation.');
favoriteOption.handlers.click[0]();
assert.equal(animationCount, 2, 'Switching categories animates the new list.');
assert.equal(workspaceNav.children.indexOf(accordion), workspaceNav.children.indexOf(favoriteOption) + 1,
  'Favorites appear immediately beneath the Favorites control');
assert.equal(accordion.descendants().filter(item => item.tagName === 'A' && item.href === '/bsa/').length, 1);
favoriteOption.handlers.click[0]();
assert(accordion.hidden, 'Selecting an expanded category a second time closes it');
for (const href of ['/', '/research/', '/info/']) {
  assert(!workspaceNav.descendants().some(item => item.tagName === 'A' && item.getAttribute('href') === href),
    href + ' belongs in the header, not the sidebar');
}
assert(!workspaceNav.descendants().some(item => item.className === 'pt-sidebar-results-title'),
  'Expanded lists should not repeat category names above their items.');
for (const option of [flowOption, favoriteOption]) {
  option.handlers.click[0]();
  assert.equal(accordion.children.length, 1, 'Expanded lists should contain only the item list.');
}
uiWindow.matchMedia = () => ({ matches: true });
const recentOption = buttons.find(item => item.getAttribute('data-pt-sidebar-view') === 'recent');
const lastAnimationCount = animationCount;
recentOption.handlers.click[0]();
assert.equal(animationCount, lastAnimationCount, 'Reduced-motion preference disables category animation.');


console.log('Tool workspace and favorites tests passed.');
