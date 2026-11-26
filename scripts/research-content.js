'use strict';

const fs = require('node:fs');
const path = require('node:path');

const siteUrl = 'https://perfusiontools.com';
const editorial = Object.freeze({
  '@type': 'Organization',
  name: 'PerfusionTools Editorial',
  url: `${siteUrl}/info/#editorial-methodology`
});

function isIssueDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateIssues(issues) {
  if (!Array.isArray(issues) || issues.length === 0) throw new Error('Research must contain published issues.');
  const dates = new Set();
  for (const issue of issues) {
    if (!isIssueDate(issue.date) || dates.has(issue.date)) throw new Error(`Invalid or duplicate research date: ${issue.date}`);
    dates.add(issue.date);
    if (!issue.topics || !issue.period || !Array.isArray(issue.entries) || !issue.entries.length) {
      throw new Error(`Incomplete research issue: ${issue.date}`);
    }
    if (typeof issue.summaryHtml !== 'string') throw new Error(`Missing issue summary: ${issue.date}`);
    if (issue.dateModified && (!isIssueDate(issue.dateModified) || issue.dateModified < issue.date)) {
      throw new Error(`Invalid research modification date: ${issue.date}`);
    }
    const ids = new Set();
    for (const entry of issue.entries) {
      if (!/^pmid-\d+$/.test(entry.id) || ids.has(entry.id) || !entry.title || !entry.html) {
        throw new Error(`Invalid research entry in ${issue.date}: ${entry.id}`);
      }
      ids.add(entry.id);
      const pmid = entry.id.slice(5);
      if (!entry.html.includes(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`)) {
        throw new Error(`Missing original reference: ${entry.id}`);
      }
      if (entry.sourceReview && (!['abstract', 'full-text'].includes(entry.sourceReview.scope) ||
          typeof entry.sourceReview.evidence !== 'string' || !entry.sourceReview.evidence.trim())) {
        throw new Error(`Source review requires a known scope and recorded evidence: ${entry.id}`);
      }
    }
  }
  return [...issues].sort((a, b) => b.date.localeCompare(a.date));
}

function loadIssues(root = path.resolve(__dirname, '..')) {
  return validateIssues(JSON.parse(fs.readFileSync(path.join(root, 'data/research-issues.json'), 'utf8')));
}

function issuePath(issue) { return `/research/${issue.date}/`; }
function issueTitle(issue) { return `Weekly CPB & ECMO Research — ${issue.topics} | ${issue.date}`; }
function issueDescription(issue) {
  return `CPB and ECMO research briefing for ${issue.date}: ${issue.topics}. Study findings, perfusionist briefings, limitations and original references.`;
}

function validateToolLinks(links, issues, root) {
  for (const [slug, mapping] of Object.entries(links)) {
    if (!/^[a-z0-9-]+$/.test(slug) || !fs.existsSync(path.join(root, slug, 'index.html')) ||
        !mapping.label || !mapping.description || !Array.isArray(mapping.entries) || !mapping.entries.length) {
      throw new Error(`Invalid related research tool: ${slug}`);
    }
    const seen = new Set();
    for (const ref of mapping.entries) {
      const issue = issues.find(item => item.date === ref.issue);
      const key = `${ref.issue}/${ref.entry}`;
      if (!issue?.entries.some(entry => entry.id === ref.entry) || seen.has(key)) {
        throw new Error(`Invalid or duplicate related research reference: ${slug}/${key}`);
      }
      seen.add(key);
    }
  }
  return links;
}

module.exports = { siteUrl, editorial, isIssueDate, validateIssues, loadIssues, issuePath,
  issueTitle, issueDescription, validateToolLinks };
