const router = require('express').Router();
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// GET /api/reviews/:productId — get all reviews for a product
router.get('/:productId', (req, res, next) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, u.name as user_name
      FROM reviews r
      JOIN users u ON u.id = r.user_id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
    `).all(req.params.productId);
    res.json({ reviews });
  } catch (err) { next(err); }
});

// POST /api/reviews/:productId — submit a review (must be logged in + have ordered)
router.post('/:productId', requireAuth, (req, res, next) => {
  try {
    const { rating, comment, orderId } = req.body;
    const productId = req.params.productId;
    const userId = req.user.id;

    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

    // Verify user actually ordered this product
    const validOrder = db.prepare(`
      SELECT oi.id FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.id = ? AND o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'
    `).get(orderId, userId, productId);

    if (!validOrder) return res.status(403).json({ error: 'You can only review products from delivered orders.' });

    // Check if already reviewed
    const existing = db.prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ? AND order_id = ?').get(productId, userId, orderId);
    if (existing) return res.status(400).json({ error: 'You have already reviewed this product for this order.' });

    // Insert review
    db.prepare('INSERT INTO reviews (product_id, user_id, order_id, rating, comment) VALUES (?, ?, ?, ?, ?)').run(productId, userId, orderId, rating, comment || '');

    // Update product rating + review_count
    const stats = db.prepare('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE product_id = ?').get(productId);
    db.prepare('UPDATE products SET rating = ?, review_count = ? WHERE id = ?').run(stats.avg.toFixed(1), stats.cnt, productId);

    res.json({ message: 'Review submitted successfully!' });
  } catch (err) { next(err); }
});

module.exports = router;