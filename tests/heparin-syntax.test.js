const assert = require('assert');
const fs = require('fs');

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notStrictEqual(start, -1, `${functionName} should exist`);
  const signatureEnd = source.indexOf(') {', start);
  assert.notStrictEqual(signatureEnd, -1, `${functionName} should have a body`);
  const bodyStart = signatureEnd + 2;

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  throw new Error(`${functionName} body should close`);
}

function assertHeparinMessagePlacement(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const planBody = extractFunctionBody(source, 'computeHeparinPlan');
  const checklistBody = extractFunctionBody(source, 'updateHeparinResistanceChecklist');
  const returnStart = planBody.indexOf('return {');
  assert.notStrictEqual(returnStart, -1, `${filePath}: computeHeparinPlan should return an object`);
  const returnEnd = planBody.indexOf('};', returnStart);
  assert.notStrictEqual(returnEnd, -1, `${filePath}: computeHeparinPlan return object should close`);
  const returnObject = planBody.slice(returnStart, returnEnd);

  assert(!/\bmessage\b/.test(returnObject), `${filePath}: computeHeparinPlan return object must not contain ACT-response message assignments`);
  assert(/let message = 'Low ACT-response cue/.test(checklistBody), `${filePath}: checklist should keep low ACT-response message logic`);
  assert(/message = 'High ACT-response review cue/.test(checklistBody), `${filePath}: checklist should keep high ACT-response message logic`);
  assert(/message = 'Moderate ACT-response review cue/.test(checklistBody), `${filePath}: checklist should keep moderate ACT-response message logic`);
}

assertHeparinMessagePlacement('main.js');
assertHeparinMessagePlacement('dist/main.js');

console.log('Heparin syntax placement tests passed.');
