// backend/server.js
// ─────────────────────────────────────────────────────────────────────────────
// The Crafted Nest — Express + SQLite Backend
//
// Architecture:
//   ┌──────────┐      ┌───────────────┐      ┌──────────────┐
//   │  React   │ ───► │  Express API  │ ───► │  SQLite DB   │
//   │ Frontend │ ◄─── │  (port 5000)  │ ◄─── │  (WAL mode)  │
//   └──────────┘      └───────────────┘      └──────────────┘
//
// Routes:
//   POST   /api/auth/register
//   POST   /api/auth/login
//   GET    /api/auth/me
//   PUT    /api/auth/me
//   PUT    /api/auth/me/password
//   POST   /api/auth/forgot
//   POST   /api/auth/reset
//
//   GET    /api/products
//   GET    /api/products/categories
//   GET    /api/products/:id
//   POST   /api/products          [admin]
//   PUT    /api/products/:id      [admin]
//   DELETE /api/products/:id      [admin]
//
//   POST   /api/orders
//   GET    /api/orders
//   GET    /api/orders/admin/stats [admin]
//   GET    /api/orders/:id
//   PUT    /api/orders/:id/status  [admin]
//
//   GET    /api/users              [admin]
//   GET    /api/users/:id          [admin]
//   PUT    /api/users/:id/role     [admin]
//   DELETE /api/users/:id          [admin]
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Initialize DB (runs schema on startup)
require('./db/database');
// Auto-seed if database is empty
const db = require('./db/database');
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) { console.log('Empty database detected, seeding...'); require('./db/seed'); }

const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ────────────────────────────────────────────────────────

// CORS — allow frontend origin
app.use(cors({
  origin: [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:3000', // CRA fallback
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  message: { error: 'Too many auth attempts. Please try again in 15 minutes.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot', authLimiter);

// ── Request Logger (dev only) ─────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/users',    require('./routes/users'));app.use('/api/upload',   require('./routes/upload'));

// ── Health Check ───────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'The Crafted Nest API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── Static Frontend (production) ───────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  // Railway runs `node backend/server.js` from the repo root,
  // so frontend/dist is one level up relative to backend/
  const frontendBuild = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendBuild));
  app.get('*', (_req, res) => res.sendFile(path.join(frontendBuild, 'index.html')));
}

// ── Error Handling ─────────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🌿 ─────────────────────────────────────────────');
  console.log(`   The Crafted Nest API`);
  console.log(`   Running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('─────────────────────────────────────────────\n');
  console.log('  Available routes:');
  console.log('  POST   /api/auth/register');
  console.log('  POST   /api/auth/login');
  console.log('  GET    /api/products');
  console.log('  POST   /api/orders');
  console.log('  GET    /api/health\n');
});

// Graceful shutdown
process.on('SIGTERM', () => { console.log('\nShutting down gracefully...'); process.exit(0); });
process.on('SIGINT',  () => { console.log('\nShutting down gracefully...'); process.exit(0); });

module.exports = app;
