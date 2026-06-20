// ─── Brick PermitOS — Integration Test Suite ──────────────────────────────
// Run: node server/tests/run.js

import assert from 'assert/strict';
import crypto from 'crypto';
import { initDb, closeDb } from '../db.js';
import { searchRegulations } from '../rag.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ─── Test Results Tracking ─────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${err.message}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \u2713 ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${err.message}`);
  }
}

function section(title) {
  console.log(`\n\u2500\u2500 ${title} ${'\u2500'.repeat(Math.max(0, 60 - title.length - 5))}`);
}

// ─── Shared DB for database tests ──────────────────────────────────────────
// Use a temp database file to avoid collisions with the real data
const DB_DIR = path.join(os.tmpdir(), 'permitos-test');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
process.env.DB_PATH = `${DB_DIR}/test-${crypto.randomUUID().slice(0, 8)}.db`;

// ─── Database Tests ────────────────────────────────────────────────────────
function runDatabaseTests() {
  section('Database');

  let db;

  test('initDb creates database and tables', () => {
    db = initDb();
    assert.ok(db, 'Database handle should exist');

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('tenants'), 'tenants table should exist');
    assert.ok(tableNames.includes('users'), 'users table should exist');
    assert.ok(tableNames.includes('sites'), 'sites table should exist');
    assert.ok(tableNames.includes('documents'), 'documents table should exist');
    assert.ok(tableNames.includes('compliance_checks'), 'compliance_checks table should exist');
    assert.ok(tableNames.includes('chat_history'), 'chat_history table should exist');
  });

  test('Default tenant is seeded', () => {
    const tenant = db.prepare('SELECT * FROM tenants WHERE slug = ?').get('default');
    assert.ok(tenant, 'Default tenant should be seeded');
    assert.equal(tenant.slug, 'default');
  });

  test('User creation with PBKDF2 password hashing', () => {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('default');

    const userId = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('test-password', salt, 100000, 64, 'sha512').toString('hex');
    const passwordHash = `${salt}:${hash}`;

    db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)')
      .run(userId, tenant.id, `test-${crypto.randomUUID().slice(0, 8)}@example.com`, passwordHash, 'Test User', 'admin');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    assert.ok(user);
    assert.equal(user.name, 'Test User');

    // Verify password verification works
    const [storedSalt, storedHash] = user.password_hash.split(':');
    const verifyHash = crypto.pbkdf2Sync('test-password', storedSalt, 100000, 64, 'sha512').toString('hex');
    assert.equal(verifyHash, storedHash);

    // Wrong password should NOT match
    const wrongHash = crypto.pbkdf2Sync('wrong-password', storedSalt, 100000, 64, 'sha512').toString('hex');
    assert.notEqual(wrongHash, storedHash);
  });

  test('Site CRUD operations', () => {
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('default');
    const siteId = crypto.randomUUID();

    // Create
    db.prepare('INSERT INTO sites (id, tenant_id, name, state, county) VALUES (?, ?, ?, ?, ?)')
      .run(siteId, tenant.id, 'Test Site', 'Virginia', 'Loudoun');

    const created = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
    assert.ok(created);
    assert.equal(created.name, 'Test Site');

    // Read
    const site = db.prepare('SELECT * FROM sites WHERE id = ? AND tenant_id = ?').get(siteId, tenant.id);
    assert.ok(site);

    // Update
    db.prepare("UPDATE sites SET name = ?, updated_at = datetime('now') WHERE id = ?").run('Updated Site', siteId);
    const updated = db.prepare('SELECT name FROM sites WHERE id = ?').get(siteId);
    assert.equal(updated.name, 'Updated Site');

    // UUID format check
    assert.match(siteId, /^[0-9a-f-]{36}$/, 'Site ID should be a valid UUID');

    // Delete
    db.prepare('DELETE FROM sites WHERE id = ?').run(siteId);
    const deleted = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
    assert.equal(deleted, undefined);
  });

  test('Tenant isolation prevents cross-tenant access', () => {
    // Create two tenants
    const tenantAId = crypto.randomUUID();
    const tenantBId = crypto.randomUUID();
    db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run(tenantAId, 'Tenant A', `tenant-a-${crypto.randomUUID().slice(0, 8)}`);
    db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run(tenantBId, 'Tenant B', `tenant-b-${crypto.randomUUID().slice(0, 8)}`);

    // Create a site in Tenant A
    const siteId = crypto.randomUUID();
    db.prepare('INSERT INTO sites (id, tenant_id, name, state) VALUES (?, ?, ?, ?)')
      .run(siteId, tenantAId, 'Tenant A Site', 'Virginia');

    // Tenant B should not see Tenant A's sites
    const tenantBSites = db.prepare('SELECT * FROM sites WHERE tenant_id = ?').all(tenantBId);
    assert.equal(tenantBSites.length, 0, 'Tenant B should not see Tenant A sites');

    // Tenant B should not be able to read Tenant A's site
    const crossTenantSite = db.prepare('SELECT * FROM sites WHERE id = ? AND tenant_id = ?').get(siteId, tenantBId);
    assert.equal(crossTenantSite, undefined, 'Cross-tenant read should fail');
  });
}

// ─── Regulatory Search Tests ───────────────────────────────────────────────
function runRegulatorySearchTests() {
  section('RAG Engine');

  test('TF-IDF search returns results for known query', () => {
    const results = searchRegulations('PSD major source threshold BACT requirements', { limit: 5 });
    assert.ok(Array.isArray(results), 'Should return an array');
    assert.ok(results.length > 0, 'Should return at least one result');
    assert.ok(results[0].title, 'Each result should have a title');
    assert.ok(results[0].text, 'Each result should have text content');
    assert.ok(typeof results[0].relevance === 'number', 'Each result should have a relevance score');
  });

  test('Search for CAA-specific query returns air category results', () => {
    const results = searchRegulations('Title V operating permit requirements', { limit: 3 });
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.title.toLowerCase().includes('title v')), 'Should include Title V document');
  });

  test('Search for water query returns water category results', () => {
    const results = searchRegulations('NPDES cooling water discharge', { limit: 3 });
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.category === 'water'), 'Should include water category documents');
  });

  test('Category filtering works', () => {
    const results = searchRegulations('emission', { category: 'air', limit: 10 });
    assert.ok(results.length > 0);
    for (const r of results) {
      assert.equal(r.category, 'air', 'All results should be in air category');
    }
  });

  test('Limit parameter works', () => {
    const results = searchRegulations('permit requirement regulation', { limit: 3 });
    assert.ok(results.length <= 3, 'Should return at most 3 results');
  });
}

// ─── Async Tests ─────────────────────────────────────────────────────────
async function runAsyncTests() {
  section('PTE Calculations');

  const { calcPTE } = await import('../../src/utils/calculations.js');

  test('calcPTE returns consistent structure for 400 MW data center', () => {
    const inputs = {
      turbines: 8, mwPerTurbine: 50, hours: 6000, heatRate: 8.5,
      noxFactor: 0.015, coFactor: 0.035, brickSavings: 20,
      gensetCount: 24, gensetHP: 2000, gensetHours: 100,
      coolingMGD: 2.8, blowdownPct: 20, waterMGD: 1.2,
      state: 'Virginia', county: 'Loudoun',
    };

    const results = calcPTE(inputs);

    assert.ok(results.baseline, 'Should have baseline emissions');
    assert.ok(results.controlled, 'Should have controlled emissions');
    assert.ok(results.avoided, 'Should have avoided emissions');
    assert.ok(results.pathway, 'Should have permit pathway');
    assert.equal(results.totalMW, 400, 'Total MW should be 400');

    // Check baseline pollutants are positive numbers
    assert.ok(results.baseline.nox > 0, 'Baseline NOx should be > 0');
    assert.ok(results.baseline.co > 0, 'Baseline CO should be > 0');
    assert.ok(results.baseline.pm25 > 0, 'Baseline PM2.5 should be > 0');
    assert.ok(results.baseline.so2 > 0, 'Baseline SO2 should be > 0');
    assert.ok(results.baseline.voc > 0, 'Baseline VOC should be > 0');
    assert.ok(results.baseline.co2e > 0, 'Baseline CO2e should be > 0');
    assert.ok(results.baseline.hap > 0, 'Baseline HAP should be > 0');

    // Check genset emissions use correct field names
    assert.ok(results.genset.gensetNox > 0, 'Genset NOx should be > 0');
    assert.ok(results.genset.gensetCO > 0, 'Genset CO should be > 0');
    assert.ok(results.genset.gensetPM > 0, 'Genset PM should be > 0');
    assert.ok(results.genset.gensetSo2 > 0, 'Genset SO2 should be > 0');
    assert.ok(results.genset.gensetVoc > 0, 'Genset VOC should be > 0');
    assert.ok(results.genset.gensetCo2e > 0, 'Genset CO2e should be > 0');
    assert.ok(results.genset.gensetHap > 0, 'Genset HAP should be > 0');

    // Controlled emissions must be lower than baseline
    assert.ok(results.controlled.nox < results.baseline.nox, 'Controlled NOx < baseline');
    assert.ok(results.controlled.co < results.baseline.co, 'Controlled CO < baseline');

    // Avoided emissions must be positive
    assert.ok(results.avoided.nox > 0, 'Avoided NOx > 0');
    assert.ok(results.avoided.co2e > 0, 'Avoided CO2e > 0');

    // Permit pathway fields must be booleans
    assert.equal(typeof results.pathway.requiresPSD, 'boolean');
    assert.equal(typeof results.pathway.requiresTitleV, 'boolean');
    assert.equal(typeof results.pathway.syntheticMinorViable, 'boolean');

    // Water calcs must be present
    assert.ok(results.water.annualWaterMG > 0);
    assert.ok(results.water.optimizedWater > 0);
  });

  test('calcPTE handles minimum viable inputs', () => {
    const inputs = {
      turbines: 1, mwPerTurbine: 5, hours: 2000, heatRate: 9.0,
      noxFactor: 0.015, coFactor: 0.035, brickSavings: 20,
      gensetCount: 2, gensetHP: 500, gensetHours: 50,
      coolingMGD: 0.5, blowdownPct: 10, waterMGD: 0.2,
      state: 'California', county: 'Santa Clara',
    };

    const results = calcPTE(inputs);
    assert.ok(results.totalMW > 0, 'Total MW > 0');
    assert.ok(results.baseline.nox > 0, 'Baseline NOx > 0');
    assert.ok(results.genset.gensetNox > 0, 'Genset NOx > 0');
    assert.equal(results.totalMW, 5, 'Total MW should be 5');
  });

  test('calcPTE genset emission factors match expected range', () => {
    const inputs = {
      turbines: 0, mwPerTurbine: 0, hours: 0, heatRate: 8.5,
      noxFactor: 0.015, coFactor: 0.035, brickSavings: 20,
      gensetCount: 1, gensetHP: 2000, gensetHours: 100,
      coolingMGD: 0, blowdownPct: 0, waterMGD: 0,
      state: 'Texas', county: 'Dallas',
    };

    const results = calcPTE(inputs);
    // CI engine at 100% load: NOx = 0.031 lb/MMBtu
    // gensetMMBtu = 1 * 2000 * 0.00354 * 100 = 708
    // gensetNox = 708 * 0.031 / 2000 = 0.01097 tpy
    assert.ok(results.genset.gensetNox > 0, 'Genset NOx should be positive');
    assert.ok(results.genset.gensetNox < 1, 'Genset NOx should be < 1 tpy for single engine');
    assert.ok(results.genset.gensetCO > 0, 'Genset CO should be positive');
    assert.ok(results.genset.gensetPM > 0, 'Genset PM should be positive');
    assert.ok(results.genset.gensetSo2 > 0, 'Genset SO2 should be computed');
    assert.ok(results.genset.gensetVoc > 0, 'Genset VOC should be computed');
  });

  section('Document Generator');

  const { generateDocument } = await import('../../src/utils/documentGenerator.js');

  const DOC_INPUTS = {
    siteName: 'BigWatt AI Campus — Site A', client: 'BigWatt Digital',
    state: 'Tennessee', county: 'Davidson County',
    address: '1200 Industrial Blvd', lat: '36.16', lon: '-86.78',
    turbineType: 'Gas Turbine (DLN, modern)',
    turbines: 8, mwPerTurbine: 25, hours: 6000, heatRate: 8.5,
    noxFactor: 0.015, coFactor: 0.035, brickSavings: 20,
    gensetCount: 12, gensetHP: 2000, gensetHours: 100,
    coolingMGD: 2.8, blowdownPct: 20, waterMGD: 1.2,
    codTarget: '2026-Q3', stackHeight: 65, siteAcres: 45,
    datacenterMW: 160, pueTarget: 1.35, phases: 3,
    nearestReceptorFt: 1200,
  };

  const DOC_RESULTS = {
    totalMW: 200,
    annualMWh: 1200000,
    annualMMBtu: 10200000,
    baseline: { nox: 152.5, co: 85.2, so2: 5.1, pm25: 10.3, voc: 18.7, co2e: 48500, hap: 4.8 },
    controlled: { nox: 122.5, co: 68.2, so2: 4.1, pm25: 8.3, voc: 15.0, co2e: 38800, hap: 3.8 },
    avoided: { nox: 30.0, co: 17.0, so2: 1.0, pm25: 2.0, voc: 3.7, co2e: 9700, hap: 1.0, water: 204 },
    pathway: { requiresPSD: true, requiresTitleV: true, syntheticMinorViable: false, requiresNSR: false, controlledBelowMajor: false },
    water: { annualWaterMG: 1022, blowdownMG: 204, makeupMG: 1226, optimizedWater: 818 },
    genset: { gensetNox: 0.26, gensetCO: 0.08, gensetPM: 0.25, gensetSo2: 0.02, gensetVoc: 0.02, gensetCo2e: 1.03, gensetHap: 0.002 },
  };

  test('All 16 air documents generate without errors', () => {
    for (let num = 1; num <= 16; num++) {
      const doc = generateDocument('air', num, DOC_INPUTS, DOC_RESULTS);
      assert.ok(doc, `air_${num} should generate`);
      assert.ok(doc.title, `air_${num} should have title`);
      assert.ok(doc.sections && doc.sections.length > 0, `air_${num} should have sections`);
    }
  });

  test('All 10 water documents generate without errors', () => {
    for (let num = 1; num <= 10; num++) {
      const doc = generateDocument('water', num, DOC_INPUTS, DOC_RESULTS);
      assert.ok(doc, `water_${num} should generate`);
      assert.ok(doc.title, `water_${num} should have title`);
      assert.ok(doc.sections && doc.sections.length > 0, `water_${num} should have sections`);
    }
  });

  test('generateDocument handles empty data gracefully', () => {
    const doc = generateDocument('air', 1, {}, {});
    assert.ok(doc, 'Should still generate with empty inputs');
    assert.ok(doc.title);
    assert.ok(doc.sections && doc.sections.length > 0, 'Should have sections even with empty inputs');
  });
}

// ─── Main Runner ───────────────────────────────────────────────────────────
async function main() {
  console.log('\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551        Brick PermitOS \u2014 Test Suite                       \u2551');
  console.log('\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d');

  runDatabaseTests();
  runRegulatorySearchTests();
  await runAsyncTests();

  // Cleanup temp DB
  closeDb(null);

  const total = passed + failed;
  console.log('\n' + '\u2550'.repeat(60));
  console.log(`  Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}`);
  console.log('\u2550'.repeat(60));

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log(`  \u2022 ${f.name}: ${f.error}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
