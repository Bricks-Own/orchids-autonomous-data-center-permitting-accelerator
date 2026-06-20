import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sqlitePath = process.env.DB_PATH || path.resolve('data/permitos.db');
if (!fs.existsSync(sqlitePath)) throw new Error(`SQLite database not found: ${sqlitePath}`);

const sqlite = new Database(sqlitePath, { readonly: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query('BEGIN');
  for (const row of sqlite.prepare('SELECT * FROM tenants').all()) {
    await client.query(`INSERT INTO tenants(id,name,slug,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5) ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, updated_at=excluded.updated_at`,
      [row.id, row.name, row.slug, row.created_at, row.updated_at]);
  }
  for (const row of sqlite.prepare('SELECT * FROM users').all()) {
    await client.query(`INSERT INTO users(id,tenant_id,email,password_hash,name,role,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(id) DO UPDATE SET email=excluded.email,name=excluded.name,role=excluded.role,updated_at=excluded.updated_at`,
      [row.id, row.tenant_id, row.email, row.password_hash, row.name, row.role, row.created_at, row.updated_at]);
  }
  for (const row of sqlite.prepare('SELECT * FROM sites').all()) {
    await client.query(`INSERT INTO sites(id,tenant_id,name,address,county,state,lat,lon,site_acres,input_data,results_data,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name,input_data=excluded.input_data,results_data=excluded.results_data,status=excluded.status,updated_at=excluded.updated_at`,
      [row.id, row.tenant_id, row.name, row.address, row.county, row.state, row.lat, row.lon, row.site_acres,
        jsonOrNull(row.input_data), jsonOrNull(row.results_data), row.status, row.created_at, row.updated_at]);
  }
  for (const row of sqlite.prepare('SELECT * FROM documents').all()) {
    await client.query(`INSERT INTO documents(id,site_id,doc_type,doc_num,title,content,status,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) ON CONFLICT(id) DO NOTHING`,
      [row.id, row.site_id, row.doc_type, row.doc_num, row.title, jsonOrNull(row.content), row.status, row.created_at, row.updated_at]);
  }
  const hasAgentRuns = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='agent_runs'").get();
  if (hasAgentRuns) {
    for (const row of sqlite.prepare('SELECT * FROM agent_runs').all()) {
      await client.query(`INSERT INTO agent_runs(id,site_id,scenario_type,status,score,output,created_at)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(id) DO NOTHING`,
        [row.id, row.site_id, row.scenario_type, row.status, row.score, jsonOrNull(row.output), row.created_at]);
    }
  }
  await client.query('COMMIT');
  console.log('SQLite data migrated to Postgres.');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
  sqlite.close();
}

function jsonOrNull(value) {
  if (!value) return null;
  JSON.parse(value);
  return value;
}
