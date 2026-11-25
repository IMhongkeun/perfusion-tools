const sitemapPaths = [
  '/',
  '/bsa/',
  '/lbm/',
  '/gdp/',
  '/heparin/',
  '/predicted-hct/',
  '/z-score/',
  '/priming-volume/',
  '/timecalc/',
  '/unit-converter/',
  '/quick-reference/',
  '/research/',
  '/cannula-pressure-drop/'
];

const { loadIssues, issuePath } = require('./scripts/research-content');
module.exports = [...sitemapPaths, ...loadIssues().map(issuePath)];
