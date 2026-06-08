'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function calculatePrimingVolumeMl(idMm, lengthM, quantity = 1) {
  // Formula: V(mL) = (π/4) × ID(mm)^2 × Length(m) × Quantity.
  return (Math.PI / 4) * Math.pow(idMm, 2) * lengthM * quantity;
}

function nearlyEqual(actual, expected, tolerance = 0.05) {
  return Math.abs(actual - expected) <= tolerance;
}

function run() {
  const examples = [
    { label: '3/8 × 150 cm', idMm: 9.525, lengthM: 1.5, expectedMl: 106.9 },
    { label: '1/2 × 180 cm', idMm: 12.7, lengthM: 1.8, expectedMl: 228.0 },
    { label: '1/4 × 60 cm', idMm: 6.35, lengthM: 0.6, expectedMl: 19.0 },
    { label: '3/8 × 80 cm', idMm: 9.525, lengthM: 0.8, expectedMl: 57.0 }
  ];

  const volumes = examples.map((example) => {
    const volumeMl = calculatePrimingVolumeMl(example.idMm, example.lengthM);
    assert(nearlyEqual(volumeMl, example.expectedMl), `${example.label} expected ${example.expectedMl} mL, got ${volumeMl}`);
    return volumeMl;
  });

  const tubingSubtotal = volumes.reduce((sum, value) => sum + value, 0);
  assert(nearlyEqual(tubingSubtotal, 410.9), `Default example tubing subtotal expected 410.9 mL, got ${tubingSubtotal}`);

  const tubingPlusOxygenatorTotal = tubingSubtotal + 260;
  assert(nearlyEqual(tubingPlusOxygenatorTotal, 670.9), `Tubing plus oxygenator total expected 670.9 mL, got ${tubingPlusOxygenatorTotal}`);

  const primingPageHtml = fs.readFileSync(path.join(__dirname, '..', 'priming-volume', 'index.html'), 'utf8');
  [
    ['Medtronic Affinity Fusion', '260'],
    ['Terumo CAPIOX FX25', '260'],
    ['Terumo CAPIOX FX15', '144'],
    ['Terumo CAPIOX FX05', '43'],
    ['LivaNova Inspire 6', '184'],
    ['LivaNova Inspire 8', '219'],
    ['LivaNova Inspire 6F', '284'],
    ['LivaNova Inspire 8F', '351']
  ].forEach(([model, volume]) => {
    assert(primingPageHtml.includes(`value="${volume}" data-label="${model}"`), `${model} preset should have ${volume} mL value`);
  });
  assert(primingPageHtml.includes('<option value="custom" data-label="Custom oxygenator">Custom</option>'));
  ['LivaNova EOS ECMO', 'Getinge HLS Module Advanced 5.0', 'Getinge HLS Module Advanced 7.0', 'ECMO / ECLS'].forEach((text) => {
    assert(!primingPageHtml.includes(text), `${text} should not appear in CPB oxygenator presets`);
  });

  console.log('All priming volume tests passed.');
}

run();
