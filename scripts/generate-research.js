'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { siteUrl, editorial, loadIssues, validateIssues, issuePath, issueTitle,
  issueDescription, validateToolLinks } = require('./research-content');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c'); }
function publishedDate(issue) {
  return `<p class="text-sm text-slate-600 dark:text-slate-300">Published <time datetime="${issue.date}">${issue.date}</time> · Research window: ${escapeHtml(issue.period)}</p>`;
}
function editorialNote() {
  return `<aside class="research-note" aria-label="Editorial information"><p><strong>PerfusionTools Editorial</strong><br>Practicing Clinical Perfusionist · South Korea</p><p>Educational research summaries. Usefulness scores are editorial relevance assessments, not validated evidence grades. Findings do not automatically justify protocol changes. Review scope is shown only when documented.</p><p>AI-assisted workflows may support discovery, organization and drafting. Consult original publications, guidelines and institutional protocols. <a class="underline" href="/info/#editorial-methodology">Editorial methodology and About PerfusionTools</a></p></aside>`;
}

function renderEntry(issue, entry, links) {
  const tools = Object.entries(links).filter(([, mapping]) => mapping.entries.some(ref => ref.issue === issue.date && ref.entry === entry.id));
  const related = tools.length ? `<div class="mt-4 border-t border-slate-200 dark:border-primary-800 pt-3"><p><strong>Related tools</strong></p>${tools.map(([slug, mapping]) => `<p><a href="/${slug}/">${escapeHtml(mapping.label)}</a></p><p>${escapeHtml(mapping.description)}</p>`).join('')}</div>` : '';
  const review = entry.sourceReview ? `<p class="research-limitations">Source review: ${entry.sourceReview.scope === 'abstract' ? 'Abstract reviewed' : 'Full text reviewed'}</p>` : '';
  // Keep the original card body intact; editorial metadata is appended outside it.
  return `<li id="${entry.id}" class="scroll-mt-24"><article class="research-card">${entry.html}${review}${related}</article></li>`;
}

function renderPage(template, { title, description, route, type, content, schema }) {
  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${siteUrl}${route}" />`);
  const fields = { description, 'og:title': title, 'og:description': description, 'og:url': `${siteUrl}${route}`,
    'og:type': type, 'twitter:title': title, 'twitter:description': description };
  for (const [key, value] of Object.entries(fields)) {
    const tag = new RegExp(`<meta (name|property)="${key}" content="[^"]*"\\s*/>`);
    if (!tag.test(html)) throw new Error(`Missing research metadata field: ${key}`);
    html = html.replace(tag, (_, attribute) => `<meta ${attribute}="${key}" content="${escapeHtml(value)}" />`);
  }
  return html.replace('<!-- RESEARCH_SCHEMA -->', `<script type="application/ld+json">${jsonLd(schema)}</script>`)
    .replace('<!-- RESEARCH_CONTENT -->', content);
}

function renderResearch(template, inputIssues, links) {
  const issues = validateIssues(inputIssues);
  const pages = new Map();
  for (let index = 0; index < issues.length; index++) {
    const issue = issues[index];
    const title = issueTitle(issue);
    const description = issueDescription(issue);
    const route = issuePath(issue);
    const older = issues[index + 1];
    const newer = issues[index - 1];
    const content = `<nav class="text-sm" aria-label="Breadcrumb"><a class="underline" href="/">Home</a> / <a class="underline" href="/research/">Research archive</a> / ${issue.date}</nav>
<header class="space-y-3"><p class="research-eyebrow">Weekly CPB &amp; ECMO Research</p><h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">${escapeHtml(title)}</h1>${publishedDate(issue)}</header>
${editorialNote()}
<section aria-labelledby="week-${issue.date}"><h2 id="week-${issue.date}" class="research-week">${escapeHtml(issue.period)}</h2>${issue.summaryHtml ? `<div class="research-week-summary">${issue.summaryHtml}</div>` : ''}<ol class="research-list">${issue.entries.map(entry => renderEntry(issue, entry, links)).join('\n')}</ol></section>
<nav class="flex flex-wrap gap-4 text-sm" aria-label="Research issue navigation">${older ? `<a class="underline py-2" rel="prev" href="${issuePath(older)}">Previous issue: ${older.date}</a>` : ''}<a class="underline py-2" href="/research/">All weekly issues</a>${newer ? `<a class="underline py-2" rel="next" href="${issuePath(newer)}">Next issue: ${newer.date}</a>` : ''}</nav>`;
    const article = { '@type': 'Article', '@id': `${siteUrl}${route}#article`, url: `${siteUrl}${route}`,
      mainEntityOfPage: `${siteUrl}${route}`, headline: title, description, datePublished: issue.date,
      ...(issue.dateModified ? { dateModified: issue.dateModified } : {}), author: editorial,
      publisher: { '@type': 'Organization', name: 'PerfusionTools', url: `${siteUrl}/` },
      inLanguage: 'en', citation: issue.entries.map(entry => `https://pubmed.ncbi.nlm.nih.gov/${entry.id.slice(5)}/`) };
    const breadcrumb = { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Research archive', item: `${siteUrl}/research/` },
      { '@type': 'ListItem', position: 3, name: issue.date, item: `${siteUrl}${route}` }
    ] };
    pages.set(route, renderPage(template, { title, description, route, type: 'article', content,
      schema: { '@context': 'https://schema.org', '@graph': [article, breadcrumb] } }));
  }
  const latest = issues[0];
  const archive = issues.map(issue => `<li id="week-${issue.date}" class="research-card scroll-mt-24"><h3 class="text-lg font-semibold"><a class="underline" href="${issuePath(issue)}">${escapeHtml(issueTitle(issue))}</a></h3>${publishedDate(issue)}<p>${issue.entries.length} research ${issue.entries.length === 1 ? 'entry' : 'entries'} · ${escapeHtml(issue.topics)}</p></li>`).join('\n');
  const content = `<header class="space-y-3"><p class="research-eyebrow">Weekly evidence briefing</p><h1 id="page-heading" class="text-2xl font-bold text-primary-900 dark:text-white">Weekly CPB &amp; ECMO Research</h1><p id="page-subtitle" class="text-sm text-slate-600 dark:text-slate-300">Published research findings, practical relevance and limitations for the perfusion community.</p></header>
${editorialNote()}
<section aria-labelledby="latest-issue"><h2 id="latest-issue" class="research-week">Latest issue</h2><div class="research-card"><h3><a href="${issuePath(latest)}">${escapeHtml(issueTitle(latest))}</a></h3>${publishedDate(latest)}<ul class="list-disc pl-5 space-y-2">${latest.entries.map(entry => `<li><a class="underline" href="${issuePath(latest)}#${entry.id}">${escapeHtml(entry.title)}</a></li>`).join('')}</ul><p><a href="${issuePath(latest)}">Read the complete weekly briefing</a></p></div></section>
<section aria-labelledby="research-archive"><h2 id="research-archive" class="research-week">Chronological archive</h2><ol class="research-list">${archive}</ol></section>`;
  const title = 'Weekly CPB & ECMO Research Archive | PerfusionTools';
  const description = 'Weekly CPB and ECMO research briefings: study findings, perfusionist relevance, limitations and original publication links. Browse the chronological archive.';
  pages.set('/research/', renderPage(template, { title, description, route: '/research/', type: 'website', content,
    schema: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title,
      url: `${siteUrl}/research/`, description, inLanguage: 'en', author: editorial,
      mainEntity: { '@type': 'ItemList', itemListElement: issues.map((issue, index) => ({ '@type': 'ListItem',
        position: index + 1, name: issueTitle(issue), url: `${siteUrl}${issuePath(issue)}` })) } } }));
  return pages;
}

function relatedResearch(mapping, issues) {
  const refs = [...mapping.entries].sort((a, b) => b.issue.localeCompare(a.issue)).slice(0, 3);
  return `<section class="mt-6 p-5 rounded-xl border border-slate-200 dark:border-primary-800" aria-labelledby="related-research-heading"><h2 id="related-research-heading" class="text-lg font-semibold text-primary-900 dark:text-white">Related Research</h2><p class="mt-2 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(mapping.description)}</p><ul class="mt-3 space-y-3 text-sm">${refs.map(ref => {
    const issue = issues.find(item => item.date === ref.issue);
    const entry = issue.entries.find(item => item.id === ref.entry);
    return `<li><a class="underline text-accent-600 dark:text-accent-400 inline-block py-2" href="${issuePath(issue)}#${entry.id}">${escapeHtml(entry.title)}</a> <span>(${issue.date})</span></li>`;
  }).join('')}</ul></section>`;
}

function generateResearch(root = path.resolve(__dirname, '..')) {
  const issues = loadIssues(root);
  const links = validateToolLinks(JSON.parse(fs.readFileSync(path.join(root, 'data/research-tool-links.json'), 'utf8')), issues, root);
  const template = fs.readFileSync(path.join(root, 'research/template.html'), 'utf8');
  const pages = renderResearch(template, issues, links);
  // Only generated date directories are pruned; preserve the source template.
  for (const item of fs.readdirSync(path.join(root, 'research'), { withFileTypes: true })) {
    if (item.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(item.name) && !pages.has(`/research/${item.name}/`)) {
      const researchRoot = path.resolve(root, 'research');
      const target = path.resolve(researchRoot, item.name);
      if (path.dirname(target) !== researchRoot) throw new Error('Research output must remain inside research/.');
      fs.rmSync(target, { recursive: true });
    }
  }
  for (const [route, html] of pages) {
    const target = path.join(root, route.slice(1), 'index.html');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
  }
  const redirectsPath = path.join(root, '_redirects');
  const redirectMarker = /\n?# RESEARCH_REDIRECTS_START[\s\S]*?# RESEARCH_REDIRECTS_END\n?/g;
  const redirects = fs.readFileSync(redirectsPath, 'utf8').replace(redirectMarker, '\n').trimEnd();
  const issueRedirects = issues.map(issue => `${issuePath(issue).slice(0, -1)} ${issuePath(issue)} 301`).join('\n');
  fs.writeFileSync(redirectsPath, `${redirects}\n\n# RESEARCH_REDIRECTS_START\n${issueRedirects}\n# RESEARCH_REDIRECTS_END\n`);
  // Remove stale generated references when an explicit mapping is removed.
  for (const item of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, item.name, 'index.html');
    if (!item.isDirectory() || ['dist', 'research'].includes(item.name) || !fs.existsSync(target)) continue;
    let html = fs.readFileSync(target, 'utf8');
    const block = /<!-- RELATED_RESEARCH_START -->[\s\S]*?<!-- RELATED_RESEARCH_END -->\n/g;
    html = html.replace(block, '');
    if (links[item.name]) html = html.replace('</main>', `<!-- RELATED_RESEARCH_START -->\n${relatedResearch(links[item.name], issues)}\n<!-- RELATED_RESEARCH_END -->\n</main>`);
    if (html !== fs.readFileSync(target, 'utf8')) fs.writeFileSync(target, html);
  }
  return pages;
}

if (require.main === module) generateResearch();
module.exports = { generateResearch, renderResearch, renderEntry, relatedResearch };
