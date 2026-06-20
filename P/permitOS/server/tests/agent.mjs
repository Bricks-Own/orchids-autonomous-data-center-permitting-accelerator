import assert from 'node:assert/strict';
import { runPermittingAgent } from '../agent/permittingAgent.js';

const inputs = {
  siteName: 'Agent Test Campus',
  state: 'Virginia',
  county: 'Loudoun',
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
  siteAcres: 45,
};

const run = await runPermittingAgent({
  scenarioType: 'upsized',
  inputs,
  evidence: [
    { id: 'eq-1', category: 'equipment', title: 'Equipment schedule', source: 'Project engineering', asOf: '2026-06-01' },
    { id: 'site-1', category: 'site', title: 'Boundary survey', source: 'Surveyor', asOf: '2026-06-01' },
    { id: 'ops-1', category: 'operations', title: 'Operating scenario', source: 'Owner', asOf: '2026-06-01' },
  ],
});

assert.equal(run.scenarioType, 'upsized');
assert.ok(run.plan.tasks.some(task => task.id === 'netting'));
assert.ok(run.sources.some(source => source.publisher === 'US EPA'));
assert.ok(run.reward.score >= 0 && run.reward.score <= 100);
assert.equal(run.validation.errors, 0);
assert.ok(run.results.baseline.nox > run.results.controlled.nox);
assert.ok(run.humanReviewGates.length > 0);
assert.ok(run.reward.constraints.some(rule => rule.includes('hiding uncertainty')));

const blocked = await runPermittingAgent({ scenarioType: 'greenfield', inputs: {}, evidence: [] });
assert.equal(blocked.status, 'blocked');
assert.ok(blocked.validation.errors > 0);

console.log('Autonomous permitting agent tests passed.');
