import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('JWT_SECRET is required when NODE_ENV=production');
}
const JWT_SECRET = configuredSecret || crypto.randomBytes(64).toString('hex');
const TOKEN_EXPIRY = '24h';

export function createAuthRouter(db) {
  const router = Router();

  // Register
  router.post('/register', (req, res, next) => {
    try {
      const { email, password, name, organizationName } = req.body;
      if (!email || !password || !name) {
        return res.status(400).json({ error: 'email, password, and name required' });
      }
      if (password.length < 12) {
        return res.status(400).json({ error: 'Password must be at least 12 characters' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail)) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      // Public registration always creates a new isolated organization.
      // Joining an existing organization must use a future signed invitation flow.
      const tenantId = crypto.randomUUID();
      const orgName = (organizationName || `${name}'s workspace`).trim();
      const slugBase = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
      const slug = `${slugBase}-${tenantId.slice(0, 8)}`;
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
      const passwordHash = `${salt}:${hash}`;

      const userId = crypto.randomUUID();
      db.transaction(() => {
        db.prepare('INSERT INTO tenants (id, name, slug) VALUES (?, ?, ?)').run(tenantId, orgName, slug);
        db.prepare('INSERT INTO users (id, tenant_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)')
          .run(userId, tenantId, normalizedEmail, passwordHash, name.trim(), 'admin');
      })();

      const token = jwt.sign(
        { userId, tenantId, role: 'admin' },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
      );

      res.status(201).json({
        token,
        user: { id: userId, email: normalizedEmail, name: name.trim(), role: 'admin', tenantId },
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
