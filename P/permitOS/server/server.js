import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { initDb, closeDb } from './db.js';
import { authenticateToken, requestLogger, errorHandler } from './middleware.js';
import { createAuthRouter } from './auth.js';
import { createApiRouter } from './routes.js';
import { logger } from './middleware.js';
import { createPostgresStore } from './postgres/store.js';
import { readObject, verifySignedDownload } from './storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3001;
const corsOrigin = process.env.CORS_ORIGIN;
if (isProduction && !corsOrigin) {
  throw new Error('CORS_ORIGIN is required when NODE_ENV=production');
}

// Trust proxy headers (set by Vite proxy or reverse proxy)
app.set('trust proxy', 1);

// ─── Security Middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: corsOrigin || true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));
app.use(express.json({ limit: '5mb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests', retryAfter: '15 minutes' },
}));
app.use(requestLogger);

// ─── Debug Logger ─────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.info(`[DEBUG] ${req.method} ${req.path} - IP: ${req.ip}, Host: ${req.headers.host}, Origin: ${req.headers.origin}, UA: ${(req.headers['user-agent']||'').substring(0,50)}`);
  next();
});

// ─── Database ─────────────────────────────────────────────────────────────
let db;
let productionStore;
try {
  db = initDb();
  productionStore = await createPostgresStore();
  app.locals.productionStore = productionStore;
  logger.info('Database initialized');
} catch (err) {
  logger.error('Database init failed', err);
  process.exit(1);
}

// ─── Routes ───────────────────────────────────────────────────────────────
// Unauthenticated routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});
app.use('/api/auth', createAuthRouter(db));
app.get('/api/download', (req, res, next) => {
  try {
    const { key, expires, signature, fileName } = req.query;
    if (!verifySignedDownload({ objectKey: key, expires, signature })) {
      return res.status(403).json({ error: 'Invalid or expired download link' });
    }
    const bytes = readObject(key);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${String(fileName || 'evidence-file').replace(/"/g, '')}"`);
    res.send(bytes);
  } catch (err) { next(err); }
});

// Authenticated routes
app.use('/api', authenticateToken, createApiRouter(db));

// ─── Serve built frontend (if dist/ exists) ────────────────────────────────
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  // SPA fallback: serve index.html for all non-API, non-static routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });

  logger.info(`Serving frontend from ${distPath} (${isProduction ? 'production' : 'development'} mode)`);
} else {
  logger.warn(`Frontend dist/ not found at ${distPath} — API only`);
}

// ─── Error Handler ───────────────────────────────────────────────────────
// Catch-all for unmatched API routes - return JSON 404 with details
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    logger.warn(`[404 CATCH] ${req.method} ${req.path} - no route matched`);
    return res.status(404).json({ error: 'Endpoint not found', path: req.path, method: req.method });
  }
  next();
});
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────
// Listen on all ports so the app works regardless of which port Orchids preview uses
const PORTS = process.env.PORT ? [parseInt(process.env.PORT)] : [3001, 5173];
const servers = PORTS.map(p => app.listen(p, () => {
  logger.info(`PermitOS listening on port ${p} (${isProduction ? 'production' : 'development'} mode)`);
}));

// Graceful shutdown
process.on('SIGTERM', () => { shutdown(); });
process.on('SIGINT', () => { shutdown(); });

function shutdown() {
  logger.info('Shutting down...');
  closeDb(db);
  productionStore?.close?.().catch(err => logger.error('Postgres shutdown failed', err));
  servers.forEach(s => s.close());
  process.exit(0);
}

export { app, db };
