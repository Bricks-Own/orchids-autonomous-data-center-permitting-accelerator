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

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      scenario_type TEXT NOT NULL,
      status TEXT NOT NULL,
      score INTEGER NOT NULL,
      output TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence_items (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      uploaded_by TEXT REFERENCES users(id),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      source TEXT NOT NULL,
      as_of TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      byte_length INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      object_key TEXT,
      malware_status TEXT DEFAULT 'pending',
      extraction_status TEXT DEFAULT 'pending',
      extracted_text TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS source_snapshots (
      id TEXT PRIMARY KEY,
      site_id TEXT REFERENCES sites(id),
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      host TEXT NOT NULL,
      retrieved_at TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      content_type TEXT NOT NULL,
      text_content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rblc_records (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      evidence_id TEXT NOT NULL REFERENCES evidence_items(id),
      rblc_id TEXT NOT NULL,
      permit_date TEXT,
      facility_name TEXT,
      criteria_json TEXT NOT NULL,
      comparison_json TEXT NOT NULL,
      evidence_sha256 TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS review_assignments (
      id TEXT PRIMARY KEY,
      site_id TEXT NOT NULL REFERENCES sites(id),
      artifact_type TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      discipline TEXT NOT NULL,
      reviewer_user_id TEXT REFERENCES users(id),
      reviewer_name TEXT NOT NULL,
      due_at TEXT,
      assigned_by TEXT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'assigned',
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS immutable_approvals (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES review_assignments(id),
      site_id TEXT NOT NULL REFERENCES sites(id),
      artifact_type TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      discipline TEXT NOT NULL,
      reviewer_user_id TEXT REFERENCES users(id),
      reviewer_name TEXT NOT NULL,
      reviewer_license TEXT,
      decision TEXT NOT NULL CHECK(decision IN ('approved','rejected')),
      statement TEXT,
      artifact_sha256 TEXT NOT NULL,
      previous_approval_hash TEXT,
      approval_hash TEXT NOT NULL UNIQUE,
      signed_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sites_tenant ON sites(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_documents_site ON documents(site_id);
    CREATE INDEX IF NOT EXISTS idx_chat_site ON chat_history(site_id);
    CREATE INDEX IF NOT EXISTS idx_agent_runs_site ON agent_runs(site_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_site ON evidence_items(site_id);
    CREATE INDEX IF NOT EXISTS idx_source_snapshots_site ON source_snapshots(site_id);
    CREATE INDEX IF NOT EXISTS idx_rblc_records_site ON rblc_records(site_id);
    CREATE INDEX IF NOT EXISTS idx_review_assignments_site ON review_assignments(site_id);
    CREATE INDEX IF NOT EXISTS idx_immutable_approvals_site ON immutable_approvals(site_id);

    CREATE TRIGGER IF NOT EXISTS immutable_approvals_no_update
    BEFORE UPDATE ON immutable_approvals
    BEGIN SELECT RAISE(ABORT, 'immutable approvals cannot be updated'); END;

    CREATE TRIGGER IF NOT EXISTS immutable_approvals_no_delete
    BEFORE DELETE ON immutable_approvals
    BEGIN SELECT RAISE(ABORT, 'immutable approvals cannot be deleted'); END;
  `);

  for (const migration of [
    'ALTER TABLE evidence_items ADD COLUMN object_key TEXT',
    "ALTER TABLE evidence_items ADD COLUMN malware_status TEXT DEFAULT 'pending'",
    "ALTER TABLE evidence_items ADD COLUMN extraction_status TEXT DEFAULT 'pending'",
    'ALTER TABLE evidence_items ADD COLUMN extracted_text TEXT',
  ]) {
    try { db.exec(migration); } catch (error) {
      if (!error.message.includes('duplicate column name')) throw error;
    }
  }

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
