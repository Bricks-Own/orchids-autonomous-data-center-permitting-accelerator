import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { putObject, createSignedDownload, readObject, verifySignedDownload } from '../storage.js';
import { extractText, scanBytes } from '../fileInspection.js';
import { buildAermodPackage, parseAermodOutput } from '../agent/aermod.js';
import { scoreRblcComparability } from '../agent/rblcImport.js';
import { greenBookDatasetRegistry, parseGreenBookRows, queryEcho } from '../agent/epaData.js';
import { listStatePacks } from '../agent/statePacks.js';

const bytes = Buffer.from('permit evidence');
const object = await putObject({ tenantId: 'tenant-a', siteId: 'site-a', fileName: 'permit.txt', bytes });
const signed = await createSignedDownload({ objectKey: object.objectKey, expiresInSeconds: 60 });
assert.equal(verifySignedDownload(signed), true);
assert.equal(readObject(object.objectKey).toString(), 'permit evidence');

assert.equal((await scanBytes(bytes, 'permit.txt')).status, 'not-configured');
const extracted = await extractText(bytes, 'text/plain', 'permit.txt');
assert.equal(extracted.status, 'completed');
assert.equal(extracted.text, 'permit evidence');

const aermodPackage = buildAermodPackage({
  project: { title: 'Test Campus' },
  sources: [{ id: 'GT01', x: 1, y: 2, elevation: 3, emissionRate: 1.2, stackHeight: 20, exitTemperature: 700, exitVelocity: 15, stackDiameter: 4 }],
  receptors: [{ x: 100, y: 200, elevation: 10, hillHeight: 10 }],
});
assert.match(Buffer.from(aermodPackage.files['aermod.inp'], 'base64').toString(), /CO STARTING/);
const parsed = parseAermodOutput('AERMOD VERSION 24142\n MAXIMUM 12.3 UG/M3');
assert.equal(parsed.modelVersion, '24142');
assert.equal(parsed.validRun, true);
assert.deepEqual(parsed.maxima, [12.3]);

const comparison = scoreRblcComparability(
  { processCode: '15.110', equipmentClass: 'turbine', fuel: 'natural gas', pollutant: 'NOX', capacityMW: 200, dutyCycle: 'continuous' },
  { processCode: '15.110', equipmentClass: 'turbine', fuel: 'natural gas', pollutant: 'NOX', capacityMW: 180, dutyCycle: 'continuous', permitDate: '2024-01-01' },
);
assert.ok(comparison.score >= 85);
assert.equal(comparison.grade, 'high');

assert.ok(listStatePacks().length >= 10);
assert.equal(greenBookDatasetRegistry().datasets.countyStatus.code, 'NAYRO');
assert.equal(parseGreenBookRows([{ STATE: 'VA', COUNTY: 'Loudoun' }], { state: 'VA', county: 'Loudoun County' }).matches.length, 1);

const originalFetch = globalThis.fetch;
globalThis.fetch = async url => ({
  ok: true,
  text: async () => JSON.stringify({ Results: { QueryID: '1', Facilities: [{ RegistryID: 'x' }] }, url: String(url) }),
});
const echo = await queryEcho({ program: 'air', state: 'VA' });
assert.equal(echo.provider, 'ECHO');
assert.match(echo.sha256, /^[a-f0-9]{64}$/);
globalThis.fetch = originalFetch;

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'permitos-prod-test-'));
process.env.DB_PATH = path.join(dbDir, 'test.db');
try {
  const { initDb, closeDb } = await import(`../db.js?test=${crypto.randomUUID()}`);
  const { assignReview, recordApproval, verifyApprovalChain } = await import('../reviews.js');
  const db = initDb();
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const siteId = crypto.randomUUID();
  db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run(tenantId, 'Test', `test-${tenantId}`);
  db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, tenantId, `${userId}@example.com`, 'salt:hash', 'Reviewer', 'admin');
  db.prepare('INSERT INTO sites (id, tenant_id, name, state) VALUES (?, ?, ?, ?)').run(siteId, tenantId, 'Site', 'Virginia');
  const assignment = assignReview(db, {
    siteId, artifactType: 'aermod-output', artifactId: 'job-1', discipline: 'modeler',
    reviewerUserId: userId, reviewerName: 'Qualified Modeler', assignedBy: userId,
  });
  const approval = recordApproval(db, {
    assignmentId: assignment.id, siteId, artifactType: 'aermod-output', artifactId: 'job-1',
    discipline: 'modeler', reviewerUserId: userId, reviewerName: 'Qualified Modeler',
    reviewerLicense: 'MODEL-001', decision: 'approved', statement: 'Reviewed',
    artifactSha256: crypto.createHash('sha256').update('artifact').digest('hex'),
  });
  assert.match(approval.approvalHash, /^[a-f0-9]{64}$/);
  assert.equal(verifyApprovalChain(db, siteId).valid, true);
  assert.throws(() => db.prepare('DELETE FROM immutable_approvals WHERE id = ?').run(approval.id), /immutable approvals cannot be deleted/);
  closeDb(db);
} catch (error) {
  if (!String(error.message).includes('Could not locate the bindings file')) throw error;
  console.warn('SQLite approval integration skipped: native binding unavailable in this local runtime.');
}
fs.rmSync(dbDir, { recursive: true, force: true });

console.log('Production slice tests passed.');
