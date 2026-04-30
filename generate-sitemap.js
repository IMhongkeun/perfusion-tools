const fs = require('fs');
const path = require('path');
const sitemapPaths = require('./sitemap-paths');

const siteUrl = 'https://perfusiontools.com';
const lastmod = new Date().toISOString().split('T')[0];

const urlEntries = sitemapPaths
  .map((routePath) => {
    const normalizedPath = routePath === '/' ? '/' : routePath;

    return `  <url>\n    <loc>${siteUrl}${normalizedPath}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
  })
  .join('\n');

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;

const distDir = path.join(__dirname, 'dist');
const sitemapPath = path.join(distDir, 'sitemap.xml');

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
