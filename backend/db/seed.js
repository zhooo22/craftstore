// backend/db/seed.js
// ─────────────────────────────────────────────────────────────────────────────
// Seeds the database with:
//   - 2 users  (1 admin, 1 customer)
//   - 12 products across 9 categories
//   - 2 sample orders
// Run: node backend/db/seed.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const db = require('./database');

console.log('🌱  Seeding database...\n');

// ── Helpers ───────────────────────────────────────────────────────────────────
const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── Wipe existing data (order matters due to FK) ──────────────────────────────
db.exec(`
  DELETE FROM order_items;
  DELETE FROM orders;
  DELETE FROM password_reset_tokens;
  DELETE FROM products;
  DELETE FROM users;
  DELETE FROM sqlite_sequence;
`);

// ── Users ─────────────────────────────────────────────────────────────────────
const SALT = 10;
const insertUser = db.prepare(`
  INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
`);

const users = [
  { name: 'Admin User',  email: 'admin@craftstore.com', password: 'admin123', role: 'admin'    },
  { name: 'Jane Smith',  email: 'jane@example.com',      password: 'pass123',  role: 'customer' },
  { name: 'Bob Johnson', email: 'bob@example.com',       password: 'pass123',  role: 'customer' },
];

const userIds = [];
for (const u of users) {
  const hash = bcrypt.hashSync(u.password, SALT);
  const result = insertUser.run(u.name, u.email, hash, u.role);
  userIds.push(result.lastInsertRowid);
  console.log(`  ✓ User: ${u.email}  (${u.role})`);
}

// ── Products ─────────────────────────────────────────────────────────────────
const insertProduct = db.prepare(`
  INSERT INTO products (name, slug, description, price, stock, category, image, sku, rating, review_count)
  VALUES (@name, @slug, @description, @price, @stock, @category, @image, @sku, @rating, @review_count)
`);

const PRODUCTS = [
  { name: 'Hand-thrown Ceramic Mug',         category: 'Ceramics',      price: 38,  stock: 12, image: '🍵', sku: 'CER-001', rating: 4.8, review_count: 24,
    description: 'Each mug is lovingly hand-thrown on a pottery wheel using stoneware clay. Food-safe glaze in warm terracotta tones with subtle variations that make every piece unique. Holds 12oz, dishwasher safe.' },
  { name: 'Macramé Wall Hanging',             category: 'Textiles',      price: 85,  stock: 5,  image: '🧵', sku: 'TEX-002', rating: 4.9, review_count: 18,
    description: 'Handcrafted from 100% natural cotton rope, this bohemian wall hanging features intricate knotwork patterns. Approx. 18" wide × 32" long with driftwood dowel included.' },
  { name: 'Beeswax Taper Candles (Set of 4)', category: 'Candles',       price: 24,  stock: 30, image: '🕯️', sku: 'CAN-003', rating: 4.7, review_count: 41,
    description: 'Pure beeswax tapers hand-dipped using traditional methods. Burns clean and slow with a natural honey scent. 10 inches tall, burn time ~6 hours each. Set of 4.' },
  { name: 'Hand-stitched Leather Journal',    category: 'Stationery',    price: 55,  stock: 8,  image: '📓', sku: 'STA-004', rating: 4.6, review_count: 33,
    description: 'Full-grain vegetable-tanned leather cover with hand-stitched binding. 200 pages of cream-colored acid-free paper. Comes with a leather tie closure. A5 size.' },
  { name: 'Botanical Soap Bar',               category: 'Wellness',      price: 16,  stock: 50, image: '🌿', sku: 'WEL-005', rating: 4.9, review_count: 67,
    description: 'Cold-processed artisan soap with organic shea butter, dried lavender, and essential oils. Gentle enough for sensitive skin. Wrapped in recycled kraft paper. 4oz bar.' },
  { name: 'Woven Seagrass Basket',            category: 'Home Decor',    price: 42,  stock: 15, image: '🧺', sku: 'HOM-006', rating: 4.5, review_count: 29,
    description: 'Handwoven by skilled artisans using sustainably-harvested seagrass. Natural variation in color and weave makes each basket unique. Approx. 10" diameter × 8" tall.' },
  { name: 'Hand-painted Silk Scarf',          category: 'Textiles',      price: 120, stock: 3,  image: '🎨', sku: 'TEX-007', rating: 5.0, review_count: 9,
    description: 'Pure silk habotai scarf painted by hand using water-based dyes. Each piece is one-of-a-kind. Machine wash cold, lay flat to dry. 14" × 72".' },
  { name: 'Ceramic Planter Set',              category: 'Ceramics',      price: 65,  stock: 7,  image: '🌱', sku: 'CER-008', rating: 4.7, review_count: 15,
    description: 'Set of 3 hand-built ceramic planters in graduated sizes. Drainage holes included, with matching saucers. Finished with a matte sage green glaze. Frost-resistant.' },
  { name: 'Linen Tote Bag',                   category: 'Accessories',   price: 32,  stock: 20, image: '👜', sku: 'ACC-009', rating: 4.6, review_count: 52,
    description: 'Heavyweight European linen tote with leather handle reinforcements. Hand-stamped botanical print. Fits a 13" laptop. 16" × 14" × 4" with interior pocket.' },
  { name: 'Wild Herb Honey',                  category: 'Food & Pantry', price: 18,  stock: 25, image: '🍯', sku: 'FOO-010', rating: 4.8, review_count: 88,
    description: 'Raw, unfiltered honey infused with wild herbs from a small family farm. Rich, complex flavor with floral notes. 8oz glass jar. A perfect gift.' },
  { name: 'Hand-forged Copper Spoon',         category: 'Kitchen',       price: 48,  stock: 6,  image: '🥄', sku: 'KIT-011', rating: 4.4, review_count: 11,
    description: 'Individually forged from food-safe copper by a local blacksmith. Natural antimicrobial properties. Develops a warm patina over time. 12" long.' },
  { name: 'Soy Wax Candle in Ceramic Vessel', category: 'Candles',       price: 36,  stock: 18, image: '🪔', sku: 'CAN-012', rating: 4.8, review_count: 73,
    description: '100% soy wax with a blend of cedarwood, sandalwood, and vanilla essential oils. Housed in a hand-thrown ceramic vessel that can be repurposed. 8oz, ~45 hour burn time.' },
];

const productIds = [];
for (const p of PRODUCTS) {
  const result = insertProduct.run({ ...p, slug: slugify(p.name) });
  productIds.push(result.lastInsertRowid);
  console.log(`  ✓ Product: ${p.name}`);
}

// ── Orders ────────────────────────────────────────────────────────────────────
const insertOrder = db.prepare(`
  INSERT INTO orders (id, user_id, status, subtotal, tax, shipping_fee, total,
    ship_name, ship_email, ship_phone, ship_address, ship_city, ship_state, ship_zip)
  VALUES (@id, @user_id, @status, @subtotal, @tax, @shipping_fee, @total,
    @ship_name, @ship_email, @ship_phone, @ship_address, @ship_city, @ship_state, @ship_zip)
`);
const insertItem = db.prepare(`
  INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity, subtotal)
  VALUES (@order_id, @product_id, @product_name, @product_image, @price, @quantity, @subtotal)
`);

const seedOrder = db.transaction((order, items) => {
  insertOrder.run(order);
  for (const item of items) insertItem.run(item);
});

const order1Items = [{ product_id: productIds[0], product_name: 'Hand-thrown Ceramic Mug', product_image: '🍵', price: 38, quantity: 2, subtotal: 76 }];
seedOrder({
  id: 'ORD-00001', user_id: userIds[1], status: 'delivered',
  subtotal: 76, tax: 6.08, shipping_fee: 0, total: 82.08,
  ship_name: 'Jane Smith', ship_email: 'jane@example.com', ship_phone: '503-555-0101',
  ship_address: '123 Elm Street', ship_city: 'Portland', ship_state: 'OR', ship_zip: '97201',
}, order1Items.map(i => ({ ...i, order_id: 'ORD-00001' })));

const order2Items = [
  { product_id: productIds[2], product_name: 'Beeswax Taper Candles (Set of 4)', product_image: '🕯️', price: 24, quantity: 1, subtotal: 24 },
  { product_id: productIds[4], product_name: 'Botanical Soap Bar', product_image: '🌿',  price: 16, quantity: 3, subtotal: 48 },
];
seedOrder({
  id: 'ORD-00002', user_id: userIds[2], status: 'processing',
  subtotal: 72, tax: 5.76, shipping_fee: 0, total: 77.76,
  ship_name: 'Bob Johnson', ship_email: 'bob@example.com', ship_phone: '206-555-0199',
  ship_address: '456 Oak Avenue', ship_city: 'Seattle', ship_state: 'WA', ship_zip: '98101',
}, order2Items.map(i => ({ ...i, order_id: 'ORD-00002' })));

console.log('\n✅  Seeding complete!\n');
console.log('Demo accounts:');
console.log('  Admin:    admin@craftstore.com  /  admin123');
console.log('  Customer: jane@example.com       /  pass123\n');
