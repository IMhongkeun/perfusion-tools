'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const expectedLinks = {
  bsa: ['/priming-volume/', '/gdp/', '/predicted-hct/', '/heparin/', '/lbm/'],
  lbm: ['/bsa/', '/gdp/'],
  'priming-volume': ['/predicted-hct/', '/gdp/', '/unit-converter/'],
  'predicted-hct': ['/priming-volume/', '/bsa/', '/gdp/'],
  gdp: ['/bsa/', '/predicted-hct/']
};

function getWorkflowHrefs(html, page) {
  const container = html.match(/<div[^>]*data-cpb-workflow-links[^>]*>([\s\S]*?)<\/div>/);
  assert(container, `${page} should have one contextual CPB workflow link group.`);
  assert.strictEqual((html.match(/data-cpb-workflow-links/g) || []).length, 1, `${page} should not duplicate the workflow link group.`);
  return [...container[1].matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
}

Object.entries(expectedLinks).forEach(([page, expected]) => {
  const source = fs.readFileSync(path.join(root, page, 'index.html'), 'utf8');
  const built = fs.readFileSync(path.join(root, 'dist', page, 'index.html'), 'utf8');
  const hrefs = getWorkflowHrefs(source, page);

  assert.deepStrictEqual(hrefs, expected, `${page} should link to the expected adjacent CPB workflow tools.`);
  assert.strictEqual(new Set(hrefs).size, hrefs.length, `${page} should not duplicate a related-tool destination.`);
  hrefs.forEach((href) => {
    assert(/^\/[a-z0-9-]+\/$/.test(href), `${page} should use a clean canonical internal path: ${href}`);
  });
  assert.strictEqual(built, source, `${page} source and dist HTML should remain synchronized.`);
});

console.log('All CPB workflow internal-link tests passed.');
