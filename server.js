const express = require('express');
const session = require('express-session');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'koder_admin_2026';
const SESSION_SECRET = process.env.SESSION_SECRET || 'koder_secret_change_me_xyz123';

const DATA_DIR = path.join(__dirname, 'data');
const FILES = {
  products: path.join(DATA_DIR, 'products.json'),
  coupons: path.join(DATA_DIR, 'coupons.json'),
  notices: path.join(DATA_DIR, 'notices.json')
};

// ---------- helpers ----------
function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return [];
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function requireAuth(req, res, next) {
  if (req.session && req.session.isAdmin) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ---------- middleware ----------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ---------- PUBLIC API (shop frontend can call) ----------
app.get('/api/products', (req, res) => {
  res.json(readJSON(FILES.products));
});

app.get('/api/coupons', (req, res) => {
  // Only return active, non-expired coupons (no internal fields)
  const now = new Date().toISOString().slice(0, 10);
  const list = readJSON(FILES.coupons)
    .filter(c => c.active && (!c.expiresAt || c.expiresAt >= now) && (c.maxUses === 0 || c.used < c.maxUses))
    .map(c => ({
      code: c.code,
      type: c.type,
      value: c.value,
      note: c.note || ''
    }));
  res.json(list);
});

app.get('/api/notices', (req, res) => {
  const list = readJSON(FILES.notices).filter(n => n.active);
  res.json(list);
});

// Validate coupon (public)
app.post('/api/coupons/validate', (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Thiếu mã' });

  const coupons = readJSON(FILES.coupons);
  const c = coupons.find(x => x.code.toUpperCase() === code);
  if (!c) return res.status(404).json({ error: 'Mã không tồn tại' });
  if (!c.active) return res.status(400).json({ error: 'Mã đã tắt' });

  const now = new Date().toISOString().slice(0, 10);
  if (c.expiresAt && c.expiresAt < now) return res.status(400).json({ error: 'Mã đã hết hạn' });
  if (c.maxUses > 0 && c.used >= c.maxUses) return res.status(400).json({ error: 'Mã đã hết lượt dùng' });

  res.json({
    ok: true,
    code: c.code,
    type: c.type,
    value: c.value,
    note: c.note || ''
  });
});

// ---------- AUTH ----------
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Sai mật khẩu' });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

app.get('/api/admin/me', (req, res) => {
  res.json({ isAdmin: !!(req.session && req.session.isAdmin) });
});

// ---------- ADMIN: PRODUCTS / STOCK ----------
app.get('/api/admin/products', requireAuth, (req, res) => {
  res.json(readJSON(FILES.products));
});

app.put('/api/admin/products/:id/stock', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { durations } = req.body || {};
  if (!Array.isArray(durations)) {
    return res.status(400).json({ error: 'durations phải là mảng' });
  }

  const products = readJSON(FILES.products);
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // Update stock by label match
  const map = {};
  durations.forEach(d => { map[d.label] = Number(d.stock); });
  products[idx].durations = products[idx].durations.map(d => ({
    ...d,
    stock: map[d.label] !== undefined ? map[d.label] : d.stock
  }));

  writeJSON(FILES.products, products);
  res.json(products[idx]);
});

app.put('/api/admin/products/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const body = req.body || {};
  const products = readJSON(FILES.products);
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });

  // Allow updating name, badge, platform, durations fully
  if (body.name !== undefined) products[idx].name = body.name;
  if (body.badge !== undefined) products[idx].badge = body.badge;
  if (body.platform !== undefined) products[idx].platform = body.platform;
  if (body.game !== undefined) products[idx].game = body.game;
  if (Array.isArray(body.durations)) products[idx].durations = body.durations;

  writeJSON(FILES.products, products);
  res.json(products[idx]);
});

// ---------- ADMIN: COUPONS ----------
app.get('/api/admin/coupons', requireAuth, (req, res) => {
  res.json(readJSON(FILES.coupons));
});

app.post('/api/admin/coupons', requireAuth, (req, res) => {
  const { code, type, value, maxUses, expiresAt, active, note } = req.body || {};
  if (!code || !type || value === undefined) {
    return res.status(400).json({ error: 'Thiếu code / type / value' });
  }
  if (!['percent', 'fixed'].includes(type)) {
    return res.status(400).json({ error: 'type phải là percent hoặc fixed' });
  }

  const coupons = readJSON(FILES.coupons);
  const upper = String(code).trim().toUpperCase();
  if (coupons.some(c => c.code.toUpperCase() === upper)) {
    return res.status(400).json({ error: 'Mã đã tồn tại' });
  }

  const item = {
    id: 'c' + Date.now(),
    code: upper,
    type,
    value: Number(value),
    maxUses: Number(maxUses) || 0,
    used: 0,
    expiresAt: expiresAt || '',
    active: active !== false,
    note: note || ''
  };
  coupons.push(item);
  writeJSON(FILES.coupons, coupons);
  res.json(item);
});

app.put('/api/admin/coupons/:id', requireAuth, (req, res) => {
  const coupons = readJSON(FILES.coupons);
  const idx = coupons.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy mã' });

  const body = req.body || {};
  if (body.code !== undefined) coupons[idx].code = String(body.code).trim().toUpperCase();
  if (body.type !== undefined) coupons[idx].type = body.type;
  if (body.value !== undefined) coupons[idx].value = Number(body.value);
  if (body.maxUses !== undefined) coupons[idx].maxUses = Number(body.maxUses);
  if (body.used !== undefined) coupons[idx].used = Number(body.used);
  if (body.expiresAt !== undefined) coupons[idx].expiresAt = body.expiresAt;
  if (body.active !== undefined) coupons[idx].active = !!body.active;
  if (body.note !== undefined) coupons[idx].note = body.note;

  writeJSON(FILES.coupons, coupons);
  res.json(coupons[idx]);
});

app.delete('/api/admin/coupons/:id', requireAuth, (req, res) => {
  let coupons = readJSON(FILES.coupons);
  const before = coupons.length;
  coupons = coupons.filter(c => c.id !== req.params.id);
  if (coupons.length === before) return res.status(404).json({ error: 'Không tìm thấy mã' });
  writeJSON(FILES.coupons, coupons);
  res.json({ ok: true });
});

// ---------- ADMIN: NOTICES ----------
app.get('/api/admin/notices', requireAuth, (req, res) => {
  res.json(readJSON(FILES.notices));
});

app.post('/api/admin/notices', requireAuth, (req, res) => {
  const { title, content, type, active } = req.body || {};
  if (!title || !content) return res.status(400).json({ error: 'Thiếu title / content' });

  const notices = readJSON(FILES.notices);
  const item = {
    id: 'n' + Date.now(),
    title,
    content,
    type: type || 'info',
    active: active !== false,
    createdAt: new Date().toISOString().slice(0, 10)
  };
  notices.unshift(item);
  writeJSON(FILES.notices, notices);
  res.json(item);
});

app.put('/api/admin/notices/:id', requireAuth, (req, res) => {
  const notices = readJSON(FILES.notices);
  const idx = notices.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Không tìm thấy thông báo' });

  const body = req.body || {};
  if (body.title !== undefined) notices[idx].title = body.title;
  if (body.content !== undefined) notices[idx].content = body.content;
  if (body.type !== undefined) notices[idx].type = body.type;
  if (body.active !== undefined) notices[idx].active = !!body.active;

  writeJSON(FILES.notices, notices);
  res.json(notices[idx]);
});

app.delete('/api/admin/notices/:id', requireAuth, (req, res) => {
  let notices = readJSON(FILES.notices);
  const before = notices.length;
  notices = notices.filter(n => n.id !== req.params.id);
  if (notices.length === before) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
  writeJSON(FILES.notices, notices);
  res.json({ ok: true });
});

// ---------- Dashboard stats ----------
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const products = readJSON(FILES.products);
  const coupons = readJSON(FILES.coupons);
  const notices = readJSON(FILES.notices);

  let totalStock = 0;
  let outOfStock = 0;
  let lowStock = 0;
  products.forEach(p => {
    p.durations.forEach(d => {
      const s = Number(d.stock) || 0;
      totalStock += s;
      if (s === 0) outOfStock++;
      else if (s <= 3) lowStock++;
    });
  });

  res.json({
    productCount: products.length,
    totalStock,
    outOfStock,
    lowStock,
    couponCount: coupons.length,
    activeCoupons: coupons.filter(c => c.active).length,
    noticeCount: notices.length,
    activeNotices: notices.filter(n => n.active).length
  });
});

// SPA fallback for admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Koder Admin running on port ${PORT}`);
  console.log(`Admin UI: http://localhost:${PORT}/admin`);
});
