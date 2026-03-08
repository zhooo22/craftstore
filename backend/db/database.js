// backend/db/database.js
// ─────────────────────────────────────────────────────────────────────────────
// SQLite database initialization using better-sqlite3 (synchronous, zero config)
// Schema: Users, Products, Orders, OrderItems, Sessions (password reset tokens)
// ─────────────────────────────────────────────────────────────────────────────

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'craftstore.db');

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

// ─── Schema Definitions ───────────────────────────────────────────────────────

db.exec(`
  -- ── Users ────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password    TEXT    NOT NULL,               -- bcrypt hash
    role        TEXT    NOT NULL DEFAULT 'customer' CHECK(role IN ('customer','admin')),
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Password Reset Tokens ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       TEXT    NOT NULL UNIQUE,
    expires_at  TEXT    NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Products ─────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS products (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    slug        TEXT    NOT NULL UNIQUE,
    description TEXT    NOT NULL DEFAULT '',
    price       REAL    NOT NULL CHECK(price >= 0),
    stock       INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    category    TEXT    NOT NULL,
    image       TEXT    NOT NULL DEFAULT '🎁',   -- emoji or image URL
    sku         TEXT    NOT NULL UNIQUE,
    rating      REAL    NOT NULL DEFAULT 0.0,
    review_count INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Orders ────────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS orders (
    id              TEXT    PRIMARY KEY,           -- e.g. ORD-00001
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          TEXT    NOT NULL DEFAULT 'pending'
                            CHECK(status IN ('pending','processing','shipped','delivered','cancelled')),
    payment_method  TEXT    NOT NULL DEFAULT 'cash_on_delivery',
    payment_status  TEXT    NOT NULL DEFAULT 'pending'
                            CHECK(payment_status IN ('pending','paid','refunded')),
    subtotal        REAL    NOT NULL DEFAULT 0,
    tax             REAL    NOT NULL DEFAULT 0,
    shipping_fee    REAL    NOT NULL DEFAULT 0,
    total           REAL    NOT NULL DEFAULT 0,
    -- Shipping address (denormalized for order history integrity)
    ship_name       TEXT    NOT NULL DEFAULT '',
    ship_email      TEXT    NOT NULL DEFAULT '',
    ship_phone      TEXT    NOT NULL DEFAULT '',
    ship_address    TEXT    NOT NULL DEFAULT '',
    ship_city       TEXT    NOT NULL DEFAULT '',
    ship_state      TEXT    NOT NULL DEFAULT '',
    ship_zip        TEXT    NOT NULL DEFAULT '',
    notes           TEXT    DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Order Items ───────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    TEXT    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_name TEXT   NOT NULL,                 -- snapshot at time of order
    product_image TEXT  NOT NULL DEFAULT '🎁',
    price       REAL    NOT NULL,                 -- snapshot at time of order
    quantity    INTEGER NOT NULL CHECK(quantity > 0),
    subtotal    REAL    NOT NULL
  );

  -- ── Indexes ───────────────────────────────────────────────────────────────────
  CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);
  CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_slug      ON products(slug);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id     ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_order_items_order  ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_prt_token          ON password_reset_tokens(token);
`);

// ─── Auto-update updated_at triggers ─────────────────────────────────────────

db.exec(`
  CREATE TRIGGER IF NOT EXISTS users_updated_at
    AFTER UPDATE ON users
    BEGIN UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS products_updated_at
    AFTER UPDATE ON products
    BEGIN UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS orders_updated_at
    AFTER UPDATE ON orders
    BEGIN UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id; END;
`);

module.exports = db;
