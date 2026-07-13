import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'permitos.db');

export function initDb() {
  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent access
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  return db;
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      api_key TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sites (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      address TEXT,
      county TEXT,
      state TEXT NOT NULL DEFAULT 'Virginia',
      lat REAL,
      lon REAL,
      site_acres REAL,
      input_data TEXT,
      results_data TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      doc_type TEXT NOT NULL,
      doc_num TEXT NOT NULL,
      title TEXT,
      content TEXT,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_checks (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      module TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      details TEXT,
      checked_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      user_id TEXT REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('user','assistant')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compliance_reports (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      report_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generated',
      title TEXT,
      content TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS construction_metrics (
      site_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (site_id, tenant_id)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      site_id TEXT,
      user_id TEXT,
      agency TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      doc_num TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      tracking_id TEXT,
      notes TEXT,
      submitted_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_documents_site ON documents(site_id);
    CREATE INDEX IF NOT EXISTS idx_chat_site ON chat_history(site_id);
    CREATE INDEX IF NOT EXISTS idx_audit_site ON audit_logs(site_id);
    CREATE INDEX IF NOT EXISTS idx_reports_site ON compliance_reports(site_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_site ON submissions(site_id);
  `);

  // Seed default tenant if not exists
  const existing = db.prepare('SELECT id FROM tenants WHERE slug = ?').get('default');
  if (!existing) {
    db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run(
      'tnt_default', 'Default Organization', 'default'
    );
  }
}

export function closeDb(db) {
  if (db) db.close();
}

export default { initDb, closeDb };