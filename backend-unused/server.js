import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb } from './src/db/database.js';
import api from './src/api/routes.js';
import { seedDatabase } from './src/data/seed/seedDb.js';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── API Routes ──────────────────────────────────────────────────────────────
app.use('/api', api);

// ─── Static Frontend (production) ────────────────────────────────────────────
const distPath = path.resolve(__dirname, '..', 'permitOS', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────
async function start() {
  // Initialize database
  const db = getDb();

  // Check if we need to seed
  const chunkCount = db.prepare('SELECT COUNT(*) as count FROM regulation_chunks').get();
  if (chunkCount.count === 0) {
    console.log('Database empty — seeding regulatory data...');
    try {
      await seedDatabase();
      console.log('Database seeded successfully');
    } catch (err) {
      console.error('Seed failed (non-fatal):', err.message);
    }
  } else {
    console.log(`Database ready — ${chunkCount.count} regulation chunks loaded`);
  }

  app.listen(PORT, () => {
    console.log(`\n  Brick PermitOS Backend`);
    console.log(`  ─────────────────────`);
    console.log(`  API:   http://localhost:${PORT}/api`);
    console.log(`  Health: http://localhost:${PORT}/api/health`);
    console.log(`\n  Ready.\n`);
  });
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});

process.on('SIGINT', () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });