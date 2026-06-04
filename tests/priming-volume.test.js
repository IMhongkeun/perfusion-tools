'use strict';

const assert = require('assert');

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

  const adultExampleTotal = tubingSubtotal + 260 + 300;
  assert(nearlyEqual(adultExampleTotal, 970.9), `Adult CPB example total expected 970.9 mL, got ${adultExampleTotal}`);

  console.log('All priming volume tests passed.');
}

run();
