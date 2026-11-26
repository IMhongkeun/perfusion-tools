const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const rootAdsPath = path.join(repoRoot, 'ads.txt');
const distAdsPath = path.join(repoRoot, 'dist', 'ads.txt');
const packageJsonPath = path.join(repoRoot, 'package.json');
const expectedPublisherId = 'pub-2705461910278176';

assert(fs.existsSync(rootAdsPath), 'Root ads.txt should exist.');
assert(fs.existsSync(distAdsPath), 'Dist ads.txt should exist.');

const rootAdsTxt = fs.readFileSync(rootAdsPath, 'utf8');
const distAdsTxt = fs.readFileSync(distAdsPath, 'utf8');

assert.strictEqual(distAdsTxt, rootAdsTxt, 'Dist ads.txt should exactly match root ads.txt.');
assert.strictEqual(rootAdsTxt.trim(), `google.com, ${expectedPublisherId}, DIRECT, f08c47fec0942fa0`, 'ads.txt must authorize only the intended direct Google publisher.');
assert(rootAdsTxt.trim().length > 0, 'ads.txt should not be empty.');
assert(!/<(?:!doctype\s+html|html|head|body|script|meta)\b/i.test(rootAdsTxt), 'ads.txt should not contain HTML.');
assert(rootAdsTxt.includes(expectedPublisherId), 'ads.txt publisher ID should not be changed.');

const nonCommentLines = rootAdsTxt
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

assert(nonCommentLines.length > 0, 'ads.txt should contain at least one non-comment record.');

nonCommentLines.forEach((line) => {
  const fields = line.split(',').map((field) => field.trim());
  assert.strictEqual(fields.length, 4, `ads.txt record should have 4 fields: ${line}`);
  assert(/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(fields[0]), `ads.txt advertising system domain should be valid: ${line}`);
  assert(fields[1].length > 0, `ads.txt publisher ID should be present: ${line}`);
  assert(/^(DIRECT|RESELLER)$/i.test(fields[2]), `ads.txt relationship should be DIRECT or RESELLER: ${line}`);
  assert(/^[a-z0-9-]+$/i.test(fields[3]), `ads.txt certification authority ID should be valid: ${line}`);
});

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
assert(
  packageJson.scripts.build === 'node scripts/build.js' &&
    fs.readFileSync(path.join(repoRoot, 'scripts', 'build.js'), 'utf8').includes("'ads.txt'"),
  'Build script should copy ads.txt into dist/.'
);

// Check delivered assets as well as source: a script in any shared JS file or
// copied page could otherwise start advertising on clinical calculator routes.
function checkRuntimeAssets(directory, requireMetadata) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'dist', 'tests', 'scripts', 'docs', 'next-examples', 'functions'].includes(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      checkRuntimeAssets(filePath, requireMetadata);
      continue;
    }
    if (!/\.(html|js)$/i.test(entry.name)) continue;
    const contents = fs.readFileSync(filePath, 'utf8');
    assert(!/adsbygoogle|googlesyndication\.com|doubleclick\.net|googleadservices\.com|fundingchoicesmessages\.google\.com/i.test(contents), `${filePath} must not load or invoke advertising code, pixels, or connections.`);
    assert(!/<ins\b[^>]*\bdata-ad-(?:client|slot)\s*=/i.test(contents), `${filePath} must not contain an active ad slot.`);
    if (!requireMetadata || !/<head\b/i.test(contents)) continue;
    const head = contents.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
    assert(head, `${filePath} must have a complete head.`);
    const metaTags = head.match(/<meta\b[^>]*\bname=["']google-adsense-account["'][^>]*>/gi) || [];
    assert.strictEqual(metaTags.length, 1, `${filePath} must contain exactly one server-visible AdSense verification tag in head.`);
    assert(metaTags[0].includes(`content="ca-${expectedPublisherId}"`), `${filePath} must use the intended AdSense account.`);
  }
}

checkRuntimeAssets(repoRoot, true);
checkRuntimeAssets(path.join(repoRoot, 'dist'), true);

const privacyHtml = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');
const privacySection = privacyHtml.slice(privacyHtml.indexOf('id="view-privacy"'), privacyHtml.indexOf('id="view-terms"'));
assert(privacySection.includes('We do not load AdSense advertising scripts'), 'Privacy policy must describe the current inactive advertising state.');
assert(privacySection.includes('Google Analytics 4 and Microsoft Clarity'), 'Privacy policy must disclose existing analytics separately from advertising.');
assert(privacySection.includes('does not currently provide an on-site cookie consent manager'), 'Privacy policy must not imply a consent manager already exists.');
assert(privacySection.includes('Google-certified consent management platform'), 'Future advertising must account for consent requirements.');
assert(privacySection.includes('Clinical calculators will remain free of advertising scripts'), 'Clinical calculator advertising isolation must remain explicit.');
assert(privacySection.includes('current calculator pages do not display feedback prompts'), 'Privacy policy must distinguish retired feedback prompts from retained records and legacy endpoints.');
assert(privacySection.includes('optional comment and email address'), 'Legacy feedback disclosures must include the optional email field.');
assert(privacySection.includes('Cloudflare Web Analytics'), 'Privacy policy must disclose hosting analytics observed on the deployed site.');

// Google's advertising crawlers must be able to fetch the authorization file
// and representative content from both the tracked and built robots policies.
for (const robotsPath of ['robots.txt', 'dist/robots.txt']) {
  const robots = fs.readFileSync(path.join(repoRoot, robotsPath), 'utf8');
  assert(/^User-agent:\s*\*\s*$/mi.test(robots) && /^Allow:\s*\/\s*$/mi.test(robots), `${robotsPath} must allow public crawling.`);
  assert(!/^Disallow:\s*\S+/mi.test(robots), `${robotsPath} must not block AdSense crawler access.`);
}

console.log('All ads.txt and inactive AdSense preparation tests passed.');
