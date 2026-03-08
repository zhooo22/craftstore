// backend/routes/users.js
// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/users           — List all users [admin]
// GET    /api/users/:id       — Get one user [admin]
// PUT    /api/users/:id/role  — Update user role [admin]
// DELETE /api/users/:id       — Deactivate user [admin]
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  is_active: u.is_active, created_at: u.created_at,
  order_count: u.order_count || 0, total_spent: u.total_spent || 0,
});

// ── GET /api/users ─────────────────────────────────────────────────────────────
router.get('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const { search = '', role = '', page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['1=1'];
    const params = [];

    if (search.trim()) {
      conditions.push('(u.name LIKE ? OR u.email LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }
    if (role && ['admin', 'customer'].includes(role)) {
      conditions.push('u.role = ?');
      params.push(role);
    }

    const where = conditions.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as c FROM users u WHERE ${where}`).get(...params).c;

    const users = db.prepare(`
      SELECT u.*,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      WHERE ${where}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      users: users.map(safeUser),
      pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (err) { next(err); }
});

// ── GET /api/users/:id ─────────────────────────────────────────────────────────
router.get('/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const user = db.prepare(`
      SELECT u.*,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total), 0) as total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
      WHERE u.id = ?
      GROUP BY u.id
    `).get(parseInt(req.params.id));

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const orders = db.prepare('SELECT id, status, total, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10').all(user.id);
    res.json({ user: safeUser(user), recentOrders: orders });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id/role ────────────────────────────────────────────────────
router.put('/:id/role', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "customer".' });
    }
    // Prevent self-demotion
    if (parseInt(req.params.id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot demote yourself.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found.' });

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    res.json({ user: safeUser(updated), message: `${user.name} is now a ${role}.` });
  } catch (err) { next(err); }
});

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(parseInt(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found.' });

    db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(user.id);
    res.json({ message: `Account for ${user.name} has been deactivated.` });
  } catch (err) { next(err); }
});

module.exports = router;
