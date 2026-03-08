// backend/routes/products.js
// ─────────────────────────────────────────────────────────────────────────────
// GET    /api/products          — List products (search, category, pagination)
// GET    /api/products/categories — List distinct categories
// GET    /api/products/:id      — Get one product
// POST   /api/products          — Create product [admin]
// PUT    /api/products/:id      — Update product [admin]
// DELETE /api/products/:id      — Delete product [admin]
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── GET /api/products ─────────────────────────────────────────────────────────
router.get('/', (req, res, next) => {
  try {
    const {
      search = '',
      category = '',
      sort = 'created_at',
      order = 'desc',
      page = 1,
      limit = 24,
      admin = '',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const allowedSorts = { name: 'name', price: 'price', rating: 'rating', created_at: 'created_at', stock: 'stock' };
    const sortCol = allowedSorts[sort] || 'created_at';
    const sortDir = order === 'asc' ? 'ASC' : 'DESC';

    const conditions = ['1=1'];
    const params = [];

    // Active filter (admins can see all)
    if (!admin) {
      conditions.push('is_active = 1');
    }

    if (search.trim()) {
      conditions.push('(name LIKE ? OR description LIKE ? OR category LIKE ? OR sku LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }

    if (category.trim() && category !== 'All') {
      conditions.push('category = ?');
      params.push(category.trim());
    }

    const where = conditions.join(' AND ');

    const total = db.prepare(`SELECT COUNT(*) as count FROM products WHERE ${where}`).get(...params).count;
    const products = db.prepare(`
      SELECT id, name, slug, price, stock, category, image, sku, rating, review_count, is_active, description, created_at
      FROM products
      WHERE ${where}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/products/categories ──────────────────────────────────────────────
router.get('/categories', (req, res, next) => {
  try {
    const rows = db.prepare('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category').all();
    res.json({ categories: ['All', ...rows.map(r => r.category)] });
  } catch (err) { next(err); }
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const byId = !isNaN(id);
    const product = db.prepare(
      `SELECT * FROM products WHERE ${byId ? 'id' : 'slug'} = ?`
    ).get(byId ? parseInt(id) : id);

    if (!product) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product });
  } catch (err) { next(err); }
});

// ── POST /api/products ─────────────────────────────────────────────────────────
router.post('/', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const { name, description = '', price, stock = 0, category, image = '🎁', sku } = req.body;

    if (!name?.trim() || !price || !category?.trim() || !sku?.trim()) {
      return res.status(400).json({ error: 'Name, price, category, and SKU are required.' });
    }
    if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Price must be a non-negative number.' });

    const slug = slugify(name);
    const result = db.prepare(`
      INSERT INTO products (name, slug, description, price, stock, category, image, sku)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name.trim(), slug, description.trim(), parseFloat(price), parseInt(stock), category.trim(), image, sku.trim().toUpperCase());

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ product, message: 'Product created successfully.' });
  } catch (err) { next(err); }
});

// ── PUT /api/products/:id ──────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, price, stock, category, image, sku, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(id));
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const updated = {
      name:        name?.trim()        ?? existing.name,
      description: description?.trim() ?? existing.description,
      price:       price != null       ? parseFloat(price) : existing.price,
      stock:       stock != null       ? parseInt(stock)   : existing.stock,
      category:    category?.trim()    ?? existing.category,
      image:       image               ?? existing.image,
      sku:         sku?.trim().toUpperCase() ?? existing.sku,
      is_active:   is_active != null   ? (is_active ? 1 : 0) : existing.is_active,
    };

    updated.slug = slugify(updated.name);

    if (isNaN(updated.price) || updated.price < 0) return res.status(400).json({ error: 'Invalid price.' });
    if (updated.stock < 0) return res.status(400).json({ error: 'Stock cannot be negative.' });

    db.prepare(`
      UPDATE products SET name=?, slug=?, description=?, price=?, stock=?, category=?, image=?, sku=?, is_active=?
      WHERE id = ?
    `).run(updated.name, updated.slug, updated.description, updated.price, updated.stock, updated.category, updated.image, updated.sku, updated.is_active, parseInt(id));

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(parseInt(id));
    res.json({ product, message: 'Product updated successfully.' });
  } catch (err) { next(err); }
});

// ── DELETE /api/products/:id ───────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT id, name FROM products WHERE id = ?').get(parseInt(id));
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    // Soft delete to preserve order history
    db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(parseInt(id));
    res.json({ message: `"${existing.name}" has been removed from the store.` });
  } catch (err) { next(err); }
});

module.exports = router;
