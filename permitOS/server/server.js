import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, closeDb } from './db.js';
import { authenticateToken, requestLogger, errorHandler } from './middleware.js';
import { createAuthRouter } from './auth.js';
import { createApiRouter } from './routes.js';
import { logger } from './middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy headers (set by Vite proxy or reverse proxy)
app.set('trust proxy', 1);

// ─── Security Middleware ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || (isProduction ? false : true),
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

// ─── Database ─────────────────────────────────────────────────────────────
let db;
try {
  db = initDb();
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

// Authenticated routes
app.use('/api', authenticateToken, createApiRouter(db));

// ─── Production: Serve built frontend ──────────────────────────────────────
if (isProduction) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));

  // SPA fallback: serve index.html for all non-API, non-static routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    }
  });

  logger.info(`Serving frontend from ${distPath}`);
}

// ─── Error Handler ───────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  logger.info(`PermitOS API running on port ${PORT} (${isProduction ? 'production' : 'development'} mode)`);
});

// Graceful shutdown
process.on('SIGTERM', () => { shutdown(); });
process.on('SIGINT', () => { shutdown(); });

function shutdown() {
  logger.info('Shutting down...');
  closeDb(db);
  server.close(() => process.exit(0));
}

export { app, db };