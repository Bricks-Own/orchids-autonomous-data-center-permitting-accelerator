import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function createPostgresStore() {
  if (!process.env.DATABASE_URL) return null;
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' },
    max: Number(process.env.PGPOOL_MAX || 10),
  });
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  await pool.query('SELECT 1');
  return {
    provider: 'postgres',
    pool,
    async health() {
      const result = await pool.query('SELECT now() AS now');
      return { status: 'ok', now: result.rows[0].now };
    },
    async close() { await pool.end(); },
  };
}
