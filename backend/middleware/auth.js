// backend/middleware/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// JWT authentication + role-based access middleware
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret';

/**
 * Generate a signed JWT for a user
 */
exports.generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Middleware: require a valid JWT
 * Attaches decoded user to req.user
 */
exports.requireAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const user = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
};

/**
 * Middleware: require admin role (must be used after requireAuth)
 */
exports.requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
};

/**
 * Middleware: optional auth — attaches user if token present but doesn't fail
 */
exports.optionalAuth = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
      req.user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);
    }
  } catch (_) { /* no-op */ }
  next();
};
