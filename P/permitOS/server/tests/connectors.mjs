import assert from 'node:assert/strict';
import { fetchOfficialSource } from '../agent/liveSources.js';
import { getStatePack, listStatePacks } from '../agent/statePacks.js';
import { buildRblcResearchPlan } from '../agent/rblc.js';
import { assessAermodReadiness } from '../agent/aermod.js';

const originalFetch = globalThis.fetch;
globalThis.fetch = async url => ({
  ok: true,
  headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
  arrayBuffer: async () => new TextEncoder().encode(`<html><head><title>Official Test</title></head><body>${url} Guidance</body></html>`).buffer,
});

const snapshot = await fetchOfficialSource('https://www.epa.gov/nsr');
assert.equal(snapshot.host, 'www.epa.gov');
assert.equal(snapshot.title, 'Official Test');
assert.match(snapshot.sha256, /^[a-f0-9]{64}$/);
await assert.rejects(() => fetchOfficialSource('https://example.com/not-approved'), /not approved/);
globalThis.fetch = originalFetch;

assert.ok(listStatePacks().length >= 3);
assert.equal(getStatePack('Tennessee').code, 'TN');

const rblc = buildRblcResearchPlan({ equipmentClass: 'large-simple-cycle-natural-gas', pollutant: 'NOX' });
assert.equal(rblc.processCode, '15.110');
assert.equal(rblc.status, 'ready-for-official-search');
assert.ok(rblc.limitations.length > 0);

const aermod = assessAermodReadiness({
  controlFile: 'project.inp',
  sourceInventory: true,
  receptorDefinition: true,
  meteorology: true,
  terrain: true,
  buildingDownwash: true,
});
assert.equal(aermod.ready, false);
assert.equal(aermod.executableConfigured, false);

console.log('Controlled connector tests passed.');
