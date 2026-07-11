import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'permitos-demo-secret-brick-2025';
const TOKEN_EXPIRY = '24h';

export function createAuthRouter(db) {
  const router = Router();

  // Register
  router.post('/register', (req, res, next) => {
    try {
      const { email, password, name, tenantSlug } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password, and name required' });
      }

      const slug = tenantSlug || 'default';
      let tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug);
      if (!tenant) {
        const tenantId = crypto.randomUUID();
        db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run(tenantId, slug, slug);
        tenant = { id: tenantId };
      }

      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      const passwordHash = `${salt}:${hash}`;

      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, tenant.id, email.toLowerCase(), passwordHash, name, 'user');

      const token = jwt.sign(
        { userId, tenantId: tenant.id, role: 'user' },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      res.status(201).json({
        token,
        user: { id: userId, email, name, role: 'user', tenantId: tenant.id },
      });
    } catch (err) {
      if (err.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      next(err);
    }
  });

  // Login
  router.post('/login', (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'email and password required' });
      }

      const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const [salt, storedHash] = user.password_hash.split(':');
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      if (hash !== storedHash) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, tenantId: user.tenant_id, role: user.role },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export { JWT_SECRET };