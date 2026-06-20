import assert from 'node:assert/strict';
import { calcPTE } from '../src/utils/calculations.js';
import { generateDocument } from '../src/utils/documentGenerator.js';

const inputs = {
  siteName: 'Verification Campus',
  client: 'Brick',
  state: 'Tennessee',
  county: 'Davidson',
  address: 'Verification address',
  lat: '36.1',
  lon: '-86.7',
  turbineType: 'Gas Turbine (DLN, modern)',
  turbines: 8,
  mwPerTurbine: 25,
  hours: 6000,
  heatRate: 8.5,
  noxFactor: 0.015,
  coFactor: 0.035,
  brickSavings: 20,
  gensetCount: 12,
  gensetHP: 2000,
  gensetHours: 100,
  coolingMGD: 2.8,
  blowdownPct: 20,
  waterMGD: 1.2,
  datacenterMW: 160,
  pueTarget: 1.35,
  phases: 3,
  codTarget: '2026-Q3',
  siteAcres: 45,
  stackHeight: 65,
  nearestReceptorFt: 1200,
  nonAttainment: false,
};

const results = calcPTE(inputs);
const documents = [];

for (const [type, count] of [['air', 16], ['water', 10]]) {
  for (let number = 1; number <= count; number += 1) {
    const document = generateDocument(type, number, inputs, results);
    assert.ok(document?.title, `${type}_${number} has no title`);
    assert.ok(document?.sections?.length, `${type}_${number} has no sections`);
    documents.push(document);
  }
}

const renderedText = documents
  .flatMap(document => document.sections)
  .map(section => `${section.heading}\n${section.body}`)
  .join('\n');

const forbiddenOutput = [
  'NaN',
  '${state.toUpperCase()}',
  '15.0 lb/MMBtu',
  '35.0 lb/MMBtu',
  'Total combined engine displacement',
  "have been verified against EPA's RACT",
];

for (const value of forbiddenOutput) {
  assert.equal(renderedText.includes(value), false, `Generated output contains forbidden text: ${value}`);
}

assert.equal(documents.length, 26);
assert.ok(results.baseline.nox > results.controlled.nox);
assert.equal(typeof results.pathway.hapMajorSource, 'boolean');
assert.equal(typeof results.pathway.significantEmissionRatesExceeded.nox, 'boolean');

console.log(`Verified ${documents.length} generated documents and calculation screening flags.`);
