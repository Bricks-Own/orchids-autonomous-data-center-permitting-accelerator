import { getDb, closeDb } from '../../db/database.js';
import { STATE_RULES } from './state_rules.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function loadAIRChunks() {
  const airPath = path.join(__dirname, 'cfr_air.js');
  if (!fs.existsSync(airPath)) {
    console.log('⚠ No cfr_air.js found — skipping air regulation chunks');
    return [];
  }
  const mod = await import(airPath);
  return mod.default || [];
}

async function loadWaterChunks() {
  const waterPath = path.join(__dirname, 'cfr_water.js');
  if (!fs.existsSync(waterPath)) {
    console.log('⚠ No cfr_water.js found — skipping water regulation chunks');
    return [];
  }
  const mod = await import(waterPath);
  return mod.default || [];
}

export async function seedDatabase() {
  const db = getDb();

  // Clear existing data
  db.exec('DELETE FROM regulation_chunks');
  db.exec('DELETE FROM state_rules');

  // Load and insert CFR chunks
  const airChunks = await loadAIRChunks();
  const waterChunks = await loadWaterChunks();
  const allChunks = [...airChunks, ...waterChunks];

  console.log(`Seeding ${allChunks.length} regulation chunks...`);
  const insertChunk = db.prepare(`
    INSERT INTO regulation_chunks (cfr_title, cfr_part, cfr_section, category, subcategory, chunk_index, chunk_text, source_url)
    VALUES (@cfr_title, @cfr_part, @cfr_section, @category, @subcategory, @chunk_index, @chunk_text, @source_url)
  `);

  const insertMany = db.transaction((chunks) => {
    for (const chunk of chunks) {
      insertChunk.run(chunk);
    }
  });

  insertMany(allChunks);
  console.log(`✓ Inserted ${allChunks.length} regulation chunks`);

  // Load and insert state rules
  console.log(`Seeding ${STATE_RULES.length} state rules...`);
  const insertRule = db.prepare(`
    INSERT INTO state_rules (state, category, rule_name, rule_text, citation)
    VALUES (@state, @category, @rule_name, @rule_text, @citation)
  `);

  const insertRules = db.transaction((rules) => {
    for (const rule of rules) {
      insertRule.run(rule);
    }
  });

  insertRules(STATE_RULES);
  console.log(`✓ Inserted ${STATE_RULES.length} state rules`);

  return { regulationChunks: allChunks.length, stateRules: STATE_RULES.length };
}

// Run if called directly
const isMain = process.argv[1] && (process.argv[1].endsWith('seedDb.js') || process.argv[1].endsWith('seedDb'));
if (isMain) {
  seedDatabase()
    .then(result => {
      console.log(`\nSeed complete: ${result.regulationChunks} regulation chunks, ${result.stateRules} state rules`);
      closeDb();
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed failed:', err);
      closeDb();
      process.exit(1);
    });
}