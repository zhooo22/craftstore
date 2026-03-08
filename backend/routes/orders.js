// backend/routes/orders.js
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/orders              — Place a new order (auth required)
// GET  /api/orders              — My orders (auth) OR all orders (admin)
// GET  /api/orders/:id          — Get one order
// PUT  /api/orders/:id/status   — Update status [admin]
// GET  /api/orders/admin/stats  — Dashboard stats [admin]
// ─────────────────────────────────────────────────────────────────────────────

const router = require('express').Router();
const db = require('../db/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendOrderConfirmation, sendOrderStatusUpdate } = require('../services/emailService');

// ── Generate Order ID ─────────────────────────────────────────────────────────
const nextOrderId = () => {
  const last = db.prepare("SELECT id FROM orders ORDER BY id DESC LIMIT 1").get();
  if (!last) return 'ORD-00001';
  const num = parseInt(last.id.split('-')[1]) + 1;
  return `ORD-${String(num).padStart(5, '0')}`;
};

// ── POST /api/orders ───────────────────────────────────────────────────────────
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { items, shipping } = req.body;

    // Validate
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }
    const requiredFields = ['name', 'email', 'phone', 'address', 'city', 'state', 'zip'];
    for (const f of requiredFields) {
      if (!shipping?.[f]?.trim()) return res.status(400).json({ error: `Shipping field "${f}" is required.` });
    }

    // Validate all items exist and have sufficient stock
    const orderItems = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(parseInt(item.productId));
      if (!product) return res.status(404).json({ error: `Product #${item.productId} not found.` });
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for "${product.name}". Available: ${product.stock}.` });
      }
      if (item.quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1.' });
      orderItems.push({ product, quantity: item.quantity });
    }

    // Calculate totals
    const subtotal = orderItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const tax = parseFloat((subtotal * 0.08).toFixed(2));
    const shipping_fee = subtotal >= 75 ? 0 : 8.99;
    const total = parseFloat((subtotal + tax + shipping_fee).toFixed(2));
    const orderId = nextOrderId();

    // Transaction: create order + items + decrement stock
    const createOrder = db.transaction(() => {
      db.prepare(`
        INSERT INTO orders (id, user_id, status, subtotal, tax, shipping_fee, total,
          ship_name, ship_email, ship_phone, ship_address, ship_city, ship_state, ship_zip, notes)
        VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, req.user.id, subtotal, tax, shipping_fee, total,
        shipping.name.trim(), shipping.email.trim(), shipping.phone.trim(),
        shipping.address.trim(), shipping.city.trim(), shipping.state.trim(),
        shipping.zip.trim(), shipping.notes || ''
      );

      for (const { product, quantity } of orderItems) {
        db.prepare(`
          INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(orderId, product.id, product.name, product.image, product.price, quantity, product.price * quantity);

        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(quantity, product.id);
      }
    });

    createOrder();

    // Fetch created order and items
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const dbItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    // Send confirmation email (non-blocking)
    sendOrderConfirmation({ order, items: dbItems, user: req.user }).catch(console.error);

    res.status(201).json({
      order: formatOrder(order, dbItems),
      message: `Order ${orderId} placed successfully! A confirmation email is on its way.`,
    });
  } catch (err) { next(err); }
});

// ── GET /api/orders ────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin' && req.query.admin === 'true';
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const conditions = isAdmin ? ['1=1'] : ['o.user_id = ?'];
    const params = isAdmin ? [] : [req.user.id];

    if (status) { conditions.push('o.status = ?'); params.push(status); }

    const where = conditions.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) as count FROM orders o WHERE ${where}`).get(...params).count;

    const orders = db.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o
      JOIN users u ON u.id = o.user_id
      WHERE ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    const full = orders.map(o => {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(o.id);
      return formatOrder(o, items);
    });

    res.json({ orders: full, pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) } });
  } catch (err) { next(err); }
});

// ── GET /api/orders/admin/stats ────────────────────────────────────────────────
router.get('/admin/stats', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total),0) as r FROM orders WHERE status != 'cancelled'").get().r;
    const orderCount   = db.prepare("SELECT COUNT(*) as c FROM orders").get().c;
    const productCount = db.prepare("SELECT COUNT(*) as c FROM products WHERE is_active = 1").get().c;
    const userCount    = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'customer'").get().c;
    const byStatus     = db.prepare("SELECT status, COUNT(*) as count FROM orders GROUP BY status").all();
    const topProducts  = db.prepare(`
      SELECT oi.product_name, SUM(oi.quantity) as units_sold, SUM(oi.subtotal) as revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.status != 'cancelled'
      GROUP BY oi.product_name ORDER BY units_sold DESC LIMIT 5
    `).all();

    res.json({ totalRevenue, orderCount, productCount, userCount, byStatus, topProducts });
  } catch (err) { next(err); }
});

// ── GET /api/orders/:id ────────────────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const order = db.prepare(`
      SELECT o.*, u.name as user_name, u.email as user_email
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ order: formatOrder(order, items) });
  } catch (err) { next(err); }
});

// ── PUT /api/orders/:id/status ─────────────────────────────────────────────────
router.put('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Restore stock if cancelling a non-cancelled order
    if (status === 'cancelled' && order.status !== 'cancelled') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
      const restoreStock = db.transaction(() => {
        for (const item of items) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.product_id);
        }
      });
      restoreStock();
    }

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);

    // Notify customer
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    sendOrderStatusUpdate({ order: updatedOrder, user }).catch(console.error);

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    res.json({ order: formatOrder(updatedOrder, items), message: `Order status updated to "${status}".` });
  } catch (err) { next(err); }
});

// ── Format helper ─────────────────────────────────────────────────────────────
function formatOrder(o, items) {
  return {
    id: o.id,
    status: o.status,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    subtotal: o.subtotal,
    tax: o.tax,
    shippingFee: o.shipping_fee,
    total: o.total,
    shipping: {
      name: o.ship_name, email: o.ship_email, phone: o.ship_phone,
      address: o.ship_address, city: o.ship_city, state: o.ship_state, zip: o.ship_zip,
    },
    customer: o.user_name ? { name: o.user_name, email: o.user_email } : undefined,
    userId: o.user_id,
    notes: o.notes,
    items: items.map(i => ({
      id: i.id, productId: i.product_id, name: i.product_name,
      image: i.product_image, price: i.price, quantity: i.quantity, subtotal: i.subtotal,
    })),
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

module.exports = router;
