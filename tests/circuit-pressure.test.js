const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('circuit-pressure/index.html');
const main = read('main.js');

// Prototype stays out of search and site navigation until reviewed.
assert(html.includes('<meta name="robots" content="noindex,nofollow" />'), 'Prototype must be noindex');
assert(html.includes("robots: 'noindex,nofollow'"), 'Route meta must keep noindex');
assert(!read('sitemap-paths.js').includes('circuit-pressure'), 'Prototype must not be in the sitemap');
assert(!/path: '\/circuit-pressure\/'/.test(main), 'Prototype must not be in calculator registries');

// Every scenario button has exactly one matching card for the same circuit.
const buttons = [...html.matchAll(/data-cp-scenario="([^"]+)" data-cp-circuit="([^"]+)"/g)].map(m => [m[1], m[2]]);
const cards = [...html.matchAll(/data-cp-card="([^"]+)" data-cp-circuit="([^"]+)"/g)].map(m => [m[1], m[2]]);
assert.deepStrictEqual(buttons, cards, 'Scenario buttons and cards must match one-to-one');
assert.deepStrictEqual(buttons.map(b => b[1]), ['cpb', 'cpb', 'cpb', 'ecmo', 'ecmo']);

// Card source links resolve to listed references; every reference is cited somewhere.
const refIds = [...html.matchAll(/<li id="(cp-ref-\d+)">/g)].map(m => m[1]);
assert.deepStrictEqual(refIds, ['cp-ref-1', 'cp-ref-2', 'cp-ref-3', 'cp-ref-4', 'cp-ref-5']);
const cited = new Set([...html.matchAll(/href="#(cp-ref-\d+)"/g)].map(m => m[1]));
refIds.forEach(id => assert(cited.has(id), `${id} is never cited`));
cited.forEach(id => assert(refIds.includes(id), `${id} is cited but not listed`));
assert(html.includes('<span class="cp-evidence">Expert perspective</span>[4]'), 'Ref 4 must be tagged as expert perspective');

// Content rules from the draft: no thresholds or normal ranges on screen.
const visible = html.slice(html.indexOf('<section id="circuit-pressure-page"'), html.indexOf('</main>'));
const text = visible.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
assert(!/normal range/i.test(text), 'No normal-range wording');
assert(!/mmHg/i.test(text), 'No pressure thresholds');
assert(text.includes('Suspected aortic dissection needs immediate team assessment.'), 'Dissection warning sits in the arterial card');
assert(text.includes('MiECC is not covered.'), 'Scope note present');

// Toggle behavior.
function makeElement(attrs, hidden) {
  const classes = new Set(hidden ? ['hidden'] : []);
  const listeners = {};
  return {
    attrs: { ...attrs },
    getAttribute(name) { return this.attrs[name] ?? null; },
    setAttribute(name, value) { this.attrs[name] = value; },
    classList: {
      toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    addEventListener(type, fn) { listeners[type] = fn; },
    click() { listeners.click(); }
  };
}
const toggles = ['cpb', 'ecmo'].map(c => makeElement({ 'data-cp-circuit-toggle': c }));
const panels = ['cpb', 'ecmo'].map(c => makeElement({ 'data-cp-circuit': c }, true));
const scenarioEls = buttons.map(([id, c]) => makeElement({ 'data-cp-scenario': id, 'data-cp-circuit': c }));
const cardEls = cards.map(([id, c]) => makeElement({ 'data-cp-card': id, 'data-cp-circuit': c }, true));
const page = {
  querySelectorAll(selector) {
    return { '[data-cp-circuit-toggle]': toggles, '[data-cp-panel]': panels, '[data-cp-scenario]': scenarioEls, '[data-cp-card]': cardEls }[selector];
  }
};
const start = main.indexOf('function initCircuitPressurePage()');
const end = main.indexOf('\n}\n', start) + 3;
const context = { el: (id) => (id === 'circuit-pressure-page' ? page : null) };
vm.runInNewContext(main.slice(start, end) + '\ninitCircuitPressurePage();', context);

const shownCards = () => cardEls.filter(c => !c.classList.contains('hidden')).map(c => c.getAttribute('data-cp-card'));
assert.deepStrictEqual(shownCards(), ['cpb-arterial-pressure'], 'CPB first card shown by default');
assert(panels[1].classList.contains('hidden'), 'ECMO diagram hidden by default');
scenarioEls[1].click();
assert.deepStrictEqual(shownCards(), ['cpb-venous-return']);
toggles[1].click();
assert.deepStrictEqual(shownCards(), ['ecmo-drainage'], 'ECMO toggle shows ECMO card');
assert(panels[0].classList.contains('hidden') && !panels[1].classList.contains('hidden'));
assert(scenarioEls.filter(b => !b.classList.contains('hidden')).every(b => b.getAttribute('data-cp-circuit') === 'ecmo'));
assert.strictEqual(toggles[1].getAttribute('aria-pressed'), 'true');

// Built output stays in sync.
const distFile = path.join(root, 'dist/circuit-pressure/index.html');
if (fs.existsSync(path.join(root, 'dist'))) {
  assert(fs.existsSync(distFile), 'dist/circuit-pressure/index.html missing; run npm run build');
  assert.strictEqual(fs.readFileSync(distFile, 'utf8'), html, 'dist copy out of sync');
}

console.log('circuit-pressure tests passed');
