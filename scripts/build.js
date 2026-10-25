'use strict';

// Same static copy pipeline as before, using Node's standard library so the
// established npm build also works on Windows without a POSIX shell.
const fs = require('node:fs');
const path = require('node:path');
const { generateSitemap } = require('../generate-sitemap');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error('Build output must remain the repository dist directory.');
}
fs.rmSync(output, { recursive: true, force: true });
const pages = ['bsa', 'gdp', 'heparin', 'predicted-hct', 'lbm', 'timecalc',
  'z-score', 'quick-reference', 'cannula-pressure-drop', 'priming-volume', 'unit-converter', 'admin/feedback'];
for (const directory of ['', 'data', ...pages]) fs.mkdirSync(path.join(output, directory), { recursive: true });
for (const file of ['index.html', 'main.js', 'analytics.js', 'mobile.css', '_redirects',
  'favicon.svg', 'ads.txt', 'data/cannula-pressure-drop.json', ...pages.map(page => `${page}/index.html`)]) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
fs.writeFileSync(path.join(output, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://perfusiontools.com/sitemap.xml\n');
const sitemap = generateSitemap(root);
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(output, 'sitemap.xml'), sitemap);
console.log('Static build complete.');
