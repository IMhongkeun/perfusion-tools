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
  /cp\s+ads\.txt\s+dist\//.test(packageJson.scripts.build),
  'Build script should copy ads.txt into dist/.'
);

console.log('All ads.txt asset tests passed.');
