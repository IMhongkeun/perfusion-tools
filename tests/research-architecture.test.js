'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { loadIssues, validateIssues, validateToolLinks, issuePath, issueTitle, issueDescription } = require('../scripts/research-content');
const { renderResearch } = require('../scripts/generate-research');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const issues = loadIssues(root);
const links = JSON.parse(read('data/research-tool-links.json'));
const baseline = JSON.parse(read('tests/fixtures/research-migration.json'));
const template = read('research/template.html');
const pages = renderResearch(template, issues, links);
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const schema = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap(match => {
  const value = JSON.parse(match[1]);
  return value['@graph'] || [value];
});

function unusedFixtureDate(publishedIssues) {
  const latestDate = publishedIssues.map(issue => issue.date).sort().at(-1);
  const date = new Date(`${latestDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

function assertReviewScopes(issue, html) {
  for (const entry of issue.entries) {
    const card = html.slice(html.indexOf(`id="${entry.id}"`)).split('</article>')[0];
    if (entry.sourceReview) {
      const label = entry.sourceReview.scope === 'abstract' ? 'Abstract reviewed' : 'Full text reviewed';
      assert(card.includes(`Source review: ${label}`), `${entry.id}: render its documented review scope.`);
    } else {
      assert(!card.includes('Source review:'), `${entry.id}: do not infer an undocumented review scope.`);
    }
  }
}

function buildOutputHashes(directory) {
  const hashes = {};
  function collect(relative) {
    const target = path.join(directory, relative);
    if (fs.statSync(target).isDirectory()) {
      for (const name of fs.readdirSync(target).sort()) collect(path.join(relative, name));
    } else {
      hashes[relative] = sha256(fs.readFileSync(target));
    }
  }
  for (const relative of ['research', 'dist', '_redirects', 'sitemap.xml']) collect(relative);
  return hashes;
}

const fixtureDate = unusedFixtureDate(issues);
assert(!issues.some(issue => issue.date === fixtureDate));
assert.equal(unusedFixtureDate([...issues].reverse()), fixtureDate, 'Fixture dates must be deterministic regardless of input order.');
assert(unusedFixtureDate([...issues, { date: fixtureDate }]) > fixtureDate,
  'Publishing the previously selected fixture date must select a later unused date.');

// Frozen hashes were captured from the pre-migration HTML, not from the renderer.
assert.equal(baseline.length, 5);
assert.equal(baseline.reduce((total, issue) => total + issue.entries.length, 0), 18);
for (const original of baseline) {
  const issue = issues.find(item => item.date === original.date);
  assert(issue, `Historical issue ${original.date} must remain published.`);
  assert.equal(issue.period, original.period);
  assert.equal(sha256(issue.summaryHtml), original.summarySha256);
  for (const originalEntry of original.entries) {
    const entry = issue.entries.find(item => item.id === originalEntry.id);
    assert(entry, `${originalEntry.id} must remain in its original issue.`);
    assert.equal(sha256(entry.html), originalEntry.sha256, `${entry.id}: preserve the complete original card, including scores, findings and references.`);
    assert.equal(entry.sourceReview, undefined, 'Do not retrospectively assign a review scope.');
  }
}

const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]);
assert.equal(new Set(sitemapUrls).size, sitemapUrls.length);
const titles = new Set();
const descriptions = new Set();
for (let index = 0; index < issues.length; index++) {
  const issue = issues[index];
  const route = issuePath(issue);
  const html = pages.get(route);
  const url = `https://perfusiontools.com${route}`;
  assert.equal(html, read(`${route.slice(1)}index.html`));
  assert.equal(html, read(`dist${route}index.html`));
  assert(html.includes(`<title>${escapeHtml(issueTitle(issue))}</title>`));
  assert(html.includes(`<link rel="canonical" href="${url}" />`));
  assert(html.includes(`<meta property="og:url" content="${url}" />`));
  assert(html.includes('<meta property="og:type" content="article" />'));
  assert(html.includes(`content="${escapeHtml(issueDescription(issue))}"`));
  assert(html.includes(`<h1 id="page-heading"`) && html.includes(escapeHtml(issueTitle(issue))));
  assert(html.includes(`<time datetime="${issue.date}">${issue.date}</time>`));
  titles.add(issueTitle(issue));
  descriptions.add(issueDescription(issue));
  const article = schema(html).find(item => item['@type'] === 'Article');
  assert(article);
  assert.equal(article.headline, issueTitle(issue));
  assert.equal(article.description, issueDescription(issue));
  assert.equal(article.url, url);
  assert.equal(article.datePublished, issue.date);
  assert.equal(article.dateModified, issue.dateModified, 'No build-time modification dates.');
  assert.equal(article.author['@type'], 'Organization');
  assert.equal(article.author.name, 'PerfusionTools Editorial');
  assert.equal(article.publisher.name, 'PerfusionTools');
  assert.deepEqual(article.citation, issue.entries.map(entry => `https://pubmed.ncbi.nlm.nih.gov/${entry.id.slice(5)}/`));
  const breadcrumb = schema(html).find(item => item['@type'] === 'BreadcrumbList');
  assert.equal(breadcrumb.itemListElement[2].item, url);
  for (const entry of issue.entries) {
    assert(html.includes(`id="${entry.id}"`));
    assert(html.includes(entry.html), 'Substantive original HTML must be present without JavaScript or interaction.');
    assert.equal((html.match(new RegExp(`href="https://pubmed\\.ncbi\\.nlm\\.nih\\.gov/${entry.id.slice(5)}/"`, 'g')) || []).length, 1);
  }
  assertReviewScopes(issue, html);
  if (issues[index + 1]) assert(html.includes(`rel="prev" href="${issuePath(issues[index + 1])}"`));
  else assert(!html.includes('rel="prev"'));
  if (issues[index - 1]) assert(html.includes(`rel="next" href="${issuePath(issues[index - 1])}"`));
  else assert(!html.includes('rel="next"'));
  assert(html.includes('href="/research/">All weekly issues'));
  assert(sitemapUrls.includes(url));
  assert(read('_redirects').includes(`${route.slice(0, -1)} ${route} 301`));
}
assert.equal(titles.size, issues.length);
assert.equal(descriptions.size, issues.length);

const archive = pages.get('/research/');
assert.equal(archive, read('research/index.html'));
assert.equal(archive, read('dist/research/index.html'));
assert.equal(schema(archive)[0]['@type'], 'CollectionPage');
assert.equal(schema(archive)[0].mainEntity.itemListElement.length, issues.length);
for (const issue of issues) {
  assert(archive.includes(`id="week-${issue.date}"`), 'Preserve historical archive fragments.');
  assert(archive.includes(`href="${issuePath(issue)}"`));
  assert(!archive.includes(issue.entries[0].html), 'Do not duplicate complete historical content on the archive.');
}

validateToolLinks(links, issues, root);
for (const [slug, mapping] of Object.entries(links)) {
  const calculator = read(`${slug}/index.html`);
  const related = calculator.match(/<!-- RELATED_RESEARCH_START -->([\s\S]*?)<!-- RELATED_RESEARCH_END -->/)[1];
  assert(related.includes('Related Research'));
  assert((related.match(/<li>/g) || []).length <= 3);
  const displayedRefs = [...mapping.entries].sort((a, b) => b.issue.localeCompare(a.issue)).slice(0, 3);
  for (const ref of mapping.entries) {
    const issue = issues.find(item => item.date === ref.issue);
    if (displayedRefs.includes(ref)) assert(calculator.includes(`href="${issuePath(issue)}#${ref.entry}"`));
    const issueHtml = pages.get(issuePath(issue));
    const card = issueHtml.slice(issueHtml.indexOf(`id="${ref.entry}"`)).split('</article>')[0];
    assert(card.includes(`href="/${slug}/"`), 'Research-to-tool link must be on the mapped card.');
  }
  assert(calculator.indexOf('RELATED_RESEARCH_START') > calculator.indexOf('calculator-lower-section'),
    'Related research belongs below the existing calculator and reference areas.');
  assert(!/<(?:input|button|select|script)\b/.test(related), 'Related research must not add controls or executable behavior.');
}
assert.doesNotThrow(() => renderResearch(template, issues, {}));
assert.throws(() => validateToolLinks({ gdp: { ...links.gdp, entries: [{ issue: issues[0].date, entry: 'pmid-0' }] } }, issues, root), /Invalid or duplicate/);
assert.throws(() => validateIssues([...issues, issues[0]]), /duplicate/);
assert.throws(() => validateIssues([{ ...issues[0], entries: [] }]), /Incomplete/);
assert.throws(() => validateIssues([{ ...issues[0], date: '2026-02-30' }]), /Invalid/);
const reviewed = structuredClone(issues[0]);
reviewed.date = fixtureDate;
reviewed.entries[0].sourceReview = { scope: 'abstract', evidence: 'Documented abstract review in an editorial record.' };
assert(renderResearch(template, [reviewed], {}).get(issuePath(reviewed)).includes('Source review: Abstract reviewed'));
reviewed.entries[0].sourceReview.scope = 'full-text';
assert(renderResearch(template, [reviewed], {}).get(issuePath(reviewed)).includes('Source review: Full text reviewed'));
delete reviewed.entries[0].sourceReview.evidence;
assert.throws(() => validateIssues([reviewed]), /recorded evidence/);

for (const [route, html] of pages) {
  assert(!/\bnoindex\b/i.test(html));
  assert.equal((html.match(/name="google-adsense-account"/g) || []).length, 1);
  assert(html.includes('content="ca-pub-2705461910278176"'));
  assert.equal((html.match(/src="\/analytics.js"/g) || []).length, 1);
  const nodes = schema(html);
  assert(!nodes.some(node => node['@type'] === 'Person'));
  for (const link of html.matchAll(/href="(\/research\/[^"#]*)(?:#([^"]+))?"/g)) {
    const target = pages.get(link[1]);
    assert(target, `Broken research link from ${route}: ${link[1]}`);
    if (link[2]) assert(target.includes(`id="${link[2]}"`));
  }
}
// Exercise the complete normal build in isolation after adding only one new issue.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'perfusion-research-test-'));
try {
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    if (['.git', 'dist', 'node_modules'].includes(item.name)) continue;
    fs.cpSync(path.join(root, item.name), path.join(temporary, item.name), { recursive: true });
  }
  const future = structuredClone(issues[0]);
  future.date = fixtureDate;
  future.period = `Synthetic weekly issue ending ${fixtureDate} (test fixture)`;
  // Keep reviewed and unreviewed entries together, even if the latest real issue has only one entry.
  future.entries = structuredClone([...new Map(issues.flatMap(issue => issue.entries).map(entry => [entry.id, entry])).values()].slice(0, 3));
  future.entries[0].sourceReview = { scope: 'abstract', evidence: 'Abstract review recorded for this test fixture.' };
  future.entries[1].sourceReview = { scope: 'full-text', evidence: 'Full-text review recorded for this test fixture.' };
  delete future.entries[2].sourceReview;
  const futureRoute = issuePath(future);
  const fixtureIssues = [future, ...issues];
  fs.writeFileSync(path.join(temporary, 'data/research-issues.json'), JSON.stringify(fixtureIssues));
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: temporary, stdio: 'pipe' });
  const futureHtml = fs.readFileSync(path.join(temporary, 'dist', futureRoute, 'index.html'), 'utf8');
  assert(futureHtml.includes(`<time datetime="${fixtureDate}">${fixtureDate}</time>`));
  assertReviewScopes(future, futureHtml);
  assert.equal((futureHtml.match(/Source review:/g) || []).length, 2);
  assert(fs.readFileSync(path.join(temporary, 'dist/research/index.html'), 'utf8').includes(`href="${futureRoute}"`));
  assert(fs.readFileSync(path.join(temporary, 'dist/sitemap.xml'), 'utf8').includes(`<loc>https://perfusiontools.com${futureRoute}</loc>`));
  const redirects = fs.readFileSync(path.join(temporary, 'dist/_redirects'), 'utf8');
  assert(redirects.includes(`${futureRoute.slice(0, -1)} ${futureRoute} 301`));
  const firstBuild = buildOutputHashes(temporary);
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: temporary, stdio: 'pipe' });
  assert.deepEqual(buildOutputHashes(temporary), firstBuild, 'Every generated research, sitemap, redirect and dist asset must remain deterministic.');
  fs.writeFileSync(path.join(temporary, 'data/research-tool-links.json'), '{}');
  fs.writeFileSync(path.join(temporary, 'data/research-issues.json'), JSON.stringify(issues));
  execFileSync(process.execPath, ['scripts/build.js'], { cwd: temporary, stdio: 'pipe' });
  assert(!fs.existsSync(path.join(temporary, futureRoute)));
  assert(!fs.readFileSync(path.join(temporary, 'dist/gdp/index.html'), 'utf8').includes('RELATED_RESEARCH_START'));
} finally {
  const resolved = path.resolve(temporary);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert(path.basename(resolved).startsWith('perfusion-research-test-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}

// Execute the actual routing and scroll lifecycle code, including the initially hidden About view.
const mainJs = read('main.js');
const routeSource = mainJs.slice(mainJs.indexOf('function route() {'), mainJs.indexOf('// Event Wiring'));
const scrollSource = mainJs.slice(mainJs.indexOf('function getResearchFragmentTarget()'), mainJs.indexOf('const FEEDBACK_CALCULATOR_ROUTES'));
const bootstrapStart = mainJs.indexOf("window.addEventListener('DOMContentLoaded'");
const bootstrapSource = mainJs.slice(bootstrapStart, mainJs.indexOf('  initStandaloneTopNav();', bootstrapStart)) + '});';

function scrollHarness(pathname, hash, { hasTarget = true, quickReference = false, homeDirectory = false } = {}) {
  const handlers = new Map();
  const frames = [];
  const timers = [];
  const topResets = [];
  const fragmentScrolls = [];
  const classes = new Set(['hidden']);
  const infoView = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
  const target = { scrollIntoView(options) {
    if (pathname.startsWith('/info')) assert(!classes.has('hidden'), 'Editorial target must be revealed before scrolling.');
    fragmentScrolls.push(options);
  } };
  let id;
  try { id = decodeURIComponent(hash.slice(1)); } catch (_) { id = null; }
  const elements = new Map([['view-info', infoView]]);
  if (hasTarget && id) elements.set(id, target);
  const context = {
    el: id => elements.get(id) || null,
    getActivePath: () => pathname,
    shouldPreserveQuickReferenceHashScroll: () => quickReference,
    isHomeCalculatorDirectoryContext: () => homeDirectory,
    removeLegacyBsaPatientPayload() {},
    renderInitialHomeDiscovery() {},
    initQuickReference() {},
    requestAnimationFrame: callback => frames.push(callback),
    setTimeout: callback => timers.push(callback),
    history: { scrollRestoration: 'auto' },
    window: { location: { pathname, hash }, scrollTo: (...args) => topResets.push(args),
      addEventListener: (name, callback) => handlers.set(name, callback) },
    document: { getElementById: id => elements.get(id) || null,
      documentElement: { style: {}, classList: { remove() {} }, scrollTop: 700 },
      body: { classList: { toggle() {} }, scrollTop: 700 } }
  };
  vm.runInNewContext(routeSource + scrollSource + bootstrapSource, context);
  function flush() {
    while (timers.length || frames.length) {
      while (timers.length) timers.shift()();
      while (frames.length) frames.shift()();
    }
  }
  handlers.get('DOMContentLoaded')();
  context.route();
  flush();
  for (const event of ['load', 'pageshow', 'popstate']) {
    handlers.get(event)();
    flush();
  }
  return { topResets, fragmentScrolls };
}

for (const [pathname, hash] of [
  ['/research/2026-11-22/', '#pmid-43051000'],
  ['/research/', '#week-2026-11-15'],
  ['/research/2026-11-22/', '#%70mid-43051000'],
  ['/info/', '#editorial-methodology'],
  ['/info', '#editorial-methodology']
]) {
  const result = scrollHarness(pathname, hash);
  assert.equal(result.topResets.length, 0, `${pathname}${hash}: lifecycle handlers must not erase the selected fragment.`);
  assert(result.fragmentScrolls.length >= 4, 'Restore the visible fragment through DOMContentLoaded, load, pageshow and popstate.');
  assert(result.fragmentScrolls.every(options => options.block === 'start'));
}
for (const [pathname, hash, options] of [
  ['/research/2026-11-22/', '#pmid-0', { hasTarget: false }],
  ['/research/', '#%broken', {}],
  ['/gdp/', '#pmid-43051000', {}],
  ['/info/', '#not-an-editorial-target', {}],
  ['/timecalc/', '', {}]
]) {
  const result = scrollHarness(pathname, hash, options);
  assert(result.topResets.length > 0, 'Unrelated or missing targets retain existing reset behavior.');
  assert.equal(result.fragmentScrolls.length, 0);
}
assert.equal(scrollHarness('/quick-reference/', '#ecmo', { quickReference: true }).topResets.length, 0);
assert.equal(scrollHarness('/', '#all-calculators-heading', { homeDirectory: true }).topResets.length, 0);

console.log(`Research architecture tests passed: ${issues.length} issues, ${issues.reduce((total, issue) => total + issue.entries.length, 0)} entries preserved; reviewed/unreviewed publication and fragment lifecycles verified.`);
