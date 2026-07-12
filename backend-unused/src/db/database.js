import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'permitos.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

let db = null;

export function getDb() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS regulation_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cfr_title TEXT NOT NULL,
      cfr_part TEXT NOT NULL,
      cfr_section TEXT,
      category TEXT NOT NULL,
      subcategory TEXT,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding TEXT,
      source_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS state_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      state TEXT NOT NULL,
      category TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      rule_text TEXT NOT NULL,
      citation TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS site_screenings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      site_name TEXT,
      state TEXT,
      county TEXT,
      inputs_json TEXT NOT NULL,
      results_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS generated_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screening_id INTEGER,
      doc_key TEXT NOT NULL,
      doc_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      citations TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      screening_id INTEGER,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      agent_data TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_category ON regulation_chunks(category);
    CREATE INDEX IF NOT EXISTS idx_chunks_cfr ON regulation_chunks(cfr_title, cfr_part);
    CREATE INDEX IF NOT EXISTS idx_state_rules_state ON state_rules(state);
    CREATE INDEX IF NOT EXISTS idx_chunks_search ON regulation_chunks(chunk_text);
  `);
}

export function closeDb() {
  if (db) { db.close(); db = null; }
}