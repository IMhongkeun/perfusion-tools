'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourceHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const distHtml = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');

function getClasses(tagPattern, message) {
  const match = sourceHtml.match(tagPattern);
  assert(match, message);
  return match[1].split(/\s+/);
}

const bodyClasses = getClasses(/<body class="([^"]+)"/, 'The shared page body should exist.');
assert(bodyClasses.includes('flex') && bodyClasses.includes('flex-col'), 'Body should remain the normal-flow flex-column page shell.');
assert(bodyClasses.includes('min-h-screen'), 'Body should provide a 100vh fallback minimum height.');
assert(bodyClasses.includes('min-h-[100dvh]'), 'Body should use the visible dynamic viewport height when supported.');
assert(bodyClasses.includes('pb-[var(--bottom-nav-height)]') && bodyClasses.includes('md:pb-0'), 'Mobile bottom-nav and desktop padding behavior should remain intact.');

const wrapperClasses = getClasses(/<div class="([^"]*pt-\[var\(--header-height\)\][^"]*)">/, 'The shared header-offset content wrapper should exist.');
assert(wrapperClasses.includes('flex-1'), 'The content wrapper should expand to fill the page shell.');

const sidebarClasses = getClasses(/<aside id="desktop-sidebar" class="([^"]+)"/, 'The desktop sidebar should exist.');
assert(sidebarClasses.includes('sticky') && sidebarClasses.includes('top-[var(--header-height)]'), 'Desktop sidebar should retain its sticky header offset.');
assert(sidebarClasses.includes('self-start'), 'Desktop sidebar should size independently instead of stretching the grid row.');
assert(sidebarClasses.includes('max-h-[calc(100dvh-var(--header-height))]'), 'Desktop sidebar should use the visible viewport as its maximum height when supported.');
assert(sidebarClasses.includes('overflow-y-auto'), 'A tall desktop navigation should remain internally scrollable.');
assert(!sidebarClasses.includes('h-[calc(100vh-var(--header-height))]'), 'Desktop sidebar must not force short page wrappers to viewport height.');

const footerClasses = getClasses(/<footer class="([^"]+)"/, 'The desktop footer should exist.');
assert(footerClasses.includes('mt-auto'), 'The footer should consume remaining space after short content.');
assert(!footerClasses.includes('mt-10'), 'The footer should not add an extra fixed margin below a flex-filled short page.');
assert(!footerClasses.some(className => /^(fixed|sticky|absolute|bottom-)/.test(className)), 'The footer must remain in normal document flow.');

for (const viewId of ['view-privacy', 'view-terms', 'view-contact']) {
  assert(sourceHtml.includes(`id="${viewId}"`), `${viewId} should remain in the shared page shell.`);
}
assert.strictEqual(sourceHtml, distHtml, 'Source and production index pages should remain synchronized after build.');

console.log('All informational page layout tests passed.');
