// backend/routes/auth.js
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register     — Create new customer account
// POST /api/auth/login        — Login, returns JWT
// GET  /api/auth/me           — Get current user (auth required)
// POST /api/auth/forgot       — Request password reset link
// POST /api/auth/reset        — Reset password with token
// PUT  /api/auth/me           — Update own profile
// PUT  /api/auth/me/password  — Change own password
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db/database');
const { generateToken, requireAuth } = require('../middleware/auth');
const { sendPasswordReset } = require('../services/emailService');

const SALT = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────
const safeUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.created_at });

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const hash = await bcrypt.hash(password, SALT);
    const result = db.prepare(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.trim().toLowerCase(), hash, 'customer');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = generateToken(user);

    res.status(201).json({ user: safeUser(user), token, message: `Welcome, ${user.name}!` });
  } catch (err) { next(err); }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    res.json({ user: safeUser(user), token, message: `Welcome back, ${user.name}!` });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

// ── PUT /api/auth/me — Update profile ─────────────────────────────────────────
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email } = req.body;
    if (!name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name and email are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }

    // Check email not taken by another user
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email.toLowerCase(), req.user.id);
    if (conflict) return res.status(409).json({ error: 'That email is already in use.' });

    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(name.trim(), email.toLowerCase(), req.user.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: safeUser(updated), token: generateToken(updated) });
  } catch (err) { next(err); }
});

// ── PUT /api/auth/me/password ─────────────────────────────────────────────────
router.put('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both fields are required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = await bcrypt.hash(newPassword, SALT);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/forgot ─────────────────────────────────────────────────────
router.post('/forgot', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase());

    // Always return 200 to prevent email enumeration
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Invalidate any existing tokens
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expiresAt);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;

    await sendPasswordReset({ user, resetUrl });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) { next(err); }
});

// ── POST /api/auth/reset ──────────────────────────────────────────────────────
router.post('/reset', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const record = db.prepare(`
      SELECT prt.*, u.name, u.email FROM password_reset_tokens prt
      JOIN users u ON u.id = prt.user_id
      WHERE prt.token = ? AND prt.used = 0 AND datetime(prt.expires_at) > datetime('now')
    `).get(token);

    if (!record) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });

    const hash = await bcrypt.hash(password, SALT);
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, record.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(record.id);

    res.json({ message: 'Password reset successfully. Please log in.' });
  } catch (err) { next(err); }
});

module.exports = router;
