const fs = require('fs');
const path = require('path');
const sitemapPaths = require('./sitemap-paths');

const siteUrl = 'https://perfusiontools.com';
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1];
}

function getPageLastmod(html, sourcePath) {
  const nodes = [];
  function collectNodes(block) {
    if (Array.isArray(block)) return block.forEach(collectNodes);
    if (!block || typeof block !== 'object') return;
    nodes.push(block);
    if (block['@graph']) collectNodes(block['@graph']);
  }

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (!/\btype\s*=\s*(["'])application\/ld\+json\1/i.test(match[1])) continue;
    try {
      collectNodes(JSON.parse(match[2]));
    } catch (error) {
      throw new Error(`Malformed JSON-LD in ${sourcePath}: ${error.message}`);
    }
  }
  const medicalPage = nodes.find((node) => {
    const types = [].concat(node['@type'] || []);
    return types.includes('MedicalWebPage') && isValidDate(node.dateModified);
  });
  return medicalPage ? medicalPage.dateModified : null;
}

function generateSitemap(sourceDir = __dirname) {
  const urlEntries = sitemapPaths.map((routePath) => {
    const sourcePath = path.join(sourceDir, routePath.slice(1), 'index.html');
    let html;
    try {
      html = fs.readFileSync(sourcePath, 'utf8');
    } catch (error) {
      throw new Error(`Cannot read sitemap source ${sourcePath}: ${error.message}`);
    }
    const lastmod = getPageLastmod(html, sourcePath);
    const lastmodXml = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${siteUrl}${routePath}</loc>${lastmodXml}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
}

const rootSitemapPath = path.join(__dirname, 'sitemap.xml');
const distDir = path.join(__dirname, 'dist');
const distSitemapPath = path.join(distDir, 'sitemap.xml');

if (require.main === module) {
  const sitemapXml = generateSitemap();
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(rootSitemapPath, sitemapXml, 'utf8');
  fs.writeFileSync(distSitemapPath, sitemapXml, 'utf8');
}

module.exports = { generateSitemap, getPageLastmod };
