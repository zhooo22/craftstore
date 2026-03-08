// frontend/src/api.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralized API client for all backend communication.
// Automatically attaches JWT from localStorage.
// Throws standardized { error } objects on failure.
// ─────────────────────────────────────────────────────────────────────────────

// In dev: Vite proxies /api → http://localhost:5000
// In production: Express serves frontend + API on the same origin
const BASE = '/api';

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request(method, path, body = null, opts = {}) {
  const token = localStorage.getItem('craft_token');

  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, config);
  const data = await res.json().catch(() => ({ error: 'Invalid server response.' }));

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const get  = (path, query = {}) => {
  const q = new URLSearchParams(query).toString();
  return request('GET', `${path}${q ? `?${q}` : ''}`);
};
const post = (path, body)       => request('POST',   path, body);
const put  = (path, body)       => request('PUT',    path, body);
const del  = (path)             => request('DELETE', path);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  register: (name, email, password) => post('/auth/register', { name, email, password }),
  login:    (email, password)       => post('/auth/login',    { email, password }),
  me:       ()                      => get('/auth/me'),
  updateMe: (data)                  => put('/auth/me', data),
  changePassword: (currentPassword, newPassword) => put('/auth/me/password', { currentPassword, newPassword }),
  forgotPassword: (email)           => post('/auth/forgot', { email }),
  resetPassword:  (token, password) => post('/auth/reset',  { token, password }),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const products = {
  list:   (params = {})  => get('/products', params),
  get:    (id)           => get(`/products/${id}`),
  categories: ()         => get('/products/categories'),
  create: (data)         => post('/products', data),
  update: (id, data)     => put(`/products/${id}`, data),
  delete: (id)           => del(`/products/${id}`),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const orders = {
  place:      (items, shipping)       => post('/orders', { items, shipping }),
  myOrders:   (params = {})          => get('/orders', params),
  allOrders:  (params = {})          => get('/orders', { ...params, admin: 'true' }),
  get:        (id)                    => get(`/orders/${id}`),
  updateStatus: (id, status)          => put(`/orders/${id}/status`, { status }),
  stats:      ()                      => get('/orders/admin/stats'),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  list:       (params = {})   => get('/users', params),
  get:        (id)            => get(`/users/${id}`),
  updateRole: (id, role)      => put(`/users/${id}/role`, { role }),
  deactivate: (id)            => del(`/users/${id}`),
};// ── Reviews ───────────────────────────────────────────────────────────────────
export const reviews = {
  list:   (productId)              => get(`/reviews/${productId}`),
  submit: (productId, data)        => post(`/reviews/${productId}`, data),
};

// ── Token helpers ─────────────────────────────────────────────────────────────
export const token = {
  save:   (t)  => localStorage.setItem('craft_token', t),
  clear:  ()   => localStorage.removeItem('craft_token'),
  exists: ()   => !!localStorage.getItem('craft_token'),
};
