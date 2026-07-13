import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth.js';
import winston from 'winston';

// ─── Logging ──────────────────────────────────────────────────────────────
// Ensure logs directory exists
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'permitos-api' },
  transports: [
    new winston.transports.Console({ format: winston.format.simple() }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
    new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 10 }),
  ],
});

// ─── Request Logger ───────────────────────────────────────────────────────
export function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });
  next();
}

// ─── Auth Middleware ───────────────────────────────────────────────────────
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── Tenant Isolation ─────────────────────────────────────────────────────
export function requireTenantAccess(req, res, next) {
  const requestedTenantId = req.params.tenantId || req.body?.tenantId;
  if (requestedTenantId && requestedTenantId !== req.user.tenantId) {
    return res.status(403).json({ error: 'Access denied — tenant mismatch' });
  }
  next();
}

// ─── Error Handler ────────────────────────────────────────────────────────
export function errorHandler(err, req, res, _next) {
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });

  // Don't leak stack traces in production
  const response = {
    error: 'Internal server error',
    requestId: req.id,
  };
  if (process.env.NODE_ENV !== 'production') {
    response.detail = err.message;
  }

  res.status(err.status || 500).json(response);
}