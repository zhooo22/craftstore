# 🌿 The Crafted Nest — Full-Stack E-Commerce

A handmade craft store with React frontend, Express/Node.js backend, and SQLite database.

```
craftstore/
├── backend/                  # Express + SQLite API
│   ├── db/
│   │   ├── database.js       # Schema init (Users, Products, Orders, OrderItems)
│   │   └── seed.js           # Sample data seeder
│   ├── middleware/
│   │   ├── auth.js           # JWT auth + role middleware
│   │   └── errorHandler.js   # Central error handler
│   ├── routes/
│   │   ├── auth.js           # Register, login, forgot/reset password
│   │   ├── products.js       # Product CRUD
│   │   ├── orders.js         # Order placement & management
│   │   └── users.js          # User management (admin)
│   ├── services/
│   │   └── emailService.js   # Nodemailer (console in dev, SMTP in prod)
│   ├── .env                  # Environment variables
│   ├── package.json
│   └── server.js             # Express entry point
│
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── api.js            # Centralized API client (fetch wrapper)
│   │   ├── App.jsx           # Full app (pages, components, state)
│   │   └── main.jsx          # React entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js        # Vite + API proxy config
│
├── package.json              # Root scripts (run both concurrently)
└── README.md
```

---

## ⚡ Quick Start

### 1. Install dependencies
```bash
# Install root dev tools
npm install

# Install backend deps
npm install --prefix backend

# Install frontend deps
npm install --prefix frontend
```

### 2. Seed the database
```bash
node backend/db/seed.js
```

This creates `backend/db/craftstore.db` with:
- 3 users (1 admin, 2 customers)
- 12 products across 9 categories
- 2 sample orders

### 3. Run development servers
```bash
# Option A: Run both simultaneously (requires concurrently)
npm run dev

# Option B: Run separately
npm run dev:backend   # http://localhost:5000
npm run dev:frontend  # http://localhost:5173
```

Open **http://localhost:5173** — the Vite proxy routes `/api/*` to Express.

---

## 🔐 Demo Accounts

| Role     | Email                   | Password   |
|----------|-------------------------|------------|
| Admin    | admin@craftstore.com    | admin123   |
| Customer | jane@example.com        | pass123    |
| Customer | bob@example.com         | pass123    |

---

## 🗄️ Database Schema

### Users
```sql
id, name, email, password (bcrypt), role, is_active, created_at, updated_at
```

### Products
```sql
id, name, slug, description, price, stock, category, image, sku,
rating, review_count, is_active, created_at, updated_at
```

### Orders
```sql
id (ORD-00001), user_id, status, payment_method, payment_status,
subtotal, tax, shipping_fee, total,
ship_name, ship_email, ship_phone, ship_address, ship_city, ship_state, ship_zip,
notes, created_at, updated_at
```

### Order Items
```sql
id, order_id, product_id, product_name, product_image, price, quantity, subtotal
```

### Password Reset Tokens
```sql
id, user_id, token, expires_at, used, created_at
```

---

## 📡 API Reference

### Auth
| Method | Endpoint              | Auth     | Description              |
|--------|-----------------------|----------|--------------------------|
| POST   | /api/auth/register    | None     | Create customer account  |
| POST   | /api/auth/login       | None     | Login, returns JWT       |
| GET    | /api/auth/me          | Required | Get current user         |
| PUT    | /api/auth/me          | Required | Update profile           |
| PUT    | /api/auth/me/password | Required | Change password          |
| POST   | /api/auth/forgot      | None     | Request reset link       |
| POST   | /api/auth/reset       | None     | Reset password with token|

### Products
| Method | Endpoint            | Auth     | Description              |
|--------|---------------------|----------|--------------------------|
| GET    | /api/products       | None     | List (search, filter, paginate) |
| GET    | /api/products/categories | None | Get category list       |
| GET    | /api/products/:id   | None     | Get one product          |
| POST   | /api/products       | Admin    | Create product           |
| PUT    | /api/products/:id   | Admin    | Update product           |
| DELETE | /api/products/:id   | Admin    | Soft-delete product      |

### Orders
| Method | Endpoint                 | Auth     | Description             |
|--------|--------------------------|----------|-------------------------|
| POST   | /api/orders              | Required | Place new order         |
| GET    | /api/orders              | Required | My orders / all (admin) |
| GET    | /api/orders/admin/stats  | Admin    | Dashboard statistics    |
| GET    | /api/orders/:id          | Required | Get one order           |
| PUT    | /api/orders/:id/status   | Admin    | Update order status     |

### Users
| Method | Endpoint              | Auth  | Description             |
|--------|-----------------------|-------|-------------------------|
| GET    | /api/users            | Admin | List all users          |
| GET    | /api/users/:id        | Admin | Get user + order history|
| PUT    | /api/users/:id/role   | Admin | Change user role        |
| DELETE | /api/users/:id        | Admin | Deactivate user         |

---

## 🔧 Configuration (backend/.env)

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your_secret_here
JWT_EXPIRES_IN=7d
DB_PATH=./db/craftstore.db

# For real email (leave blank to use console logging in dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="The Crafted Nest <noreply@craftednest.com>"
CLIENT_URL=http://localhost:5173
```

---

## 🚂 Deploy to Railway

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create craftstore --public --push   # or use github.com manually
```

### 2. Create Railway project
1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select your repo — Railway will auto-detect `nixpacks.toml` and build everything

### 3. Set environment variables
In Railway → your service → **Variables**, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | *(run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)* |
| `JWT_EXPIRES_IN` | `7d` |
| `DB_PATH` | `./backend/db/craftstore.db` |
| `CLIENT_URL` | *(your Railway public URL, e.g. `https://craftstore-production.up.railway.app`)* |

All variables are listed in `.env.example`.

### 4. Seed the database (one-time)
In Railway → your service → **Settings** → **Deploy** → run a one-time command:
```
node backend/db/seed.js
```
Or use the Railway CLI:
```bash
railway run node backend/db/seed.js
```

### 5. Done 🎉
Railway gives you a public URL like `https://craftstore-production.up.railway.app`.

---

> ⚠️ **SQLite + Railway note:** Railway's filesystem is ephemeral by default — the `.db` file resets on redeploy. To persist data, add a **Railway Volume** (Volumes tab → mount path `/app/backend/db`) and set `DB_PATH=/app/backend/db/craftstore.db`. For a fully managed database, swap `better-sqlite3` for Railway's built-in **PostgreSQL** plugin.

---

## 🚀 Production Deployment

### Build frontend
```bash
npm run build --prefix frontend
# Output: frontend/dist/
```

### Set environment variables
```env
NODE_ENV=production
JWT_SECRET=<strong random string, min 32 chars>
SMTP_HOST=<real SMTP host>
# etc.
```

### Start server
```bash
NODE_ENV=production node backend/server.js
```

In production mode, Express serves the `frontend/dist` static files and handles all routes — no need for Vite proxy.

---

## ✨ Features

- **Auth**: JWT-based register/login/logout, password reset via email token
- **Products**: Search, category filter, pagination, stock management
- **Cart**: Persistent (localStorage), add/remove/update quantity
- **Checkout**: 2-step flow (shipping → review), Cash on Delivery only
- **Orders**: Full lifecycle (pending → processing → shipped → delivered), stock auto-decrement on order, stock restore on cancel
- **Emails**: HTML order confirmation + status updates via Nodemailer (console log in dev)
- **Admin**: Product CRUD, order status management, user role management, revenue stats
- **Security**: bcrypt passwords, rate limiting, JWT auth, SQL injection protection (parameterized queries)
