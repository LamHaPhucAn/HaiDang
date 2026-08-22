// server.js — Backend cho "Hải Đăng Sức Khỏe": Chatbot AI (Gemini) + Đăng nhập/Phân quyền + Yêu cầu/Vật tư
//
// Vai trò:
//  - admin:   quản trị tài khoản (duyệt, đổi vai trò, khóa/mở), xem toàn bộ hệ thống
//  - citizen: người dân — dùng Hồ sơ sức khỏe, Chăm sóc sức khỏe, Trợ lý AI, gửi yêu cầu/phản ánh
//  - medical: nhân viên y tế — tiếp nhận yêu cầu/phản ánh từ người dân, đề nghị cung cấp vật tư
//
// Dữ liệu lưu trong file db.json trên server (đơn giản, phù hợp demo/đồ án).
// LƯU Ý: trên Render free tier, dữ liệu sẽ bị làm mới mỗi khi deploy lại (đọc kỹ README).

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const JWT_SECRET = process.env.JWT_SECRET || 'hai-dang-suc-khoe-secret-doi-ngay-khi-deploy-that';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@haidang.vn';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

// ---------------------------------------------------------------------------
// Lưu trữ dữ liệu đơn giản bằng file JSON
// ---------------------------------------------------------------------------
const DB_PATH = path.join(__dirname, 'db.json');

function loadDb() {
  if (!fs.existsSync(DB_PATH)) {
    return { users: [], requests: [], supplyProposals: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    console.error('Không đọc được db.json, khởi tạo lại:', e);
    return { users: [], requests: [], supplyProposals: [] };
  }
}
function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8');
}

let db = loadDb();

// Seed tài khoản admin đầu tiên nếu chưa có
if (!db.users.some(u => u.role === 'admin')) {
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  db.users.push({
    id: crypto.randomUUID(),
    name: 'Quản trị viên',
    email: ADMIN_EMAIL,
    passwordHash,
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
  });
  saveDb(db);
  console.log(`✅ Đã tạo tài khoản admin mặc định: ${ADMIN_EMAIL} — nhớ đổi mật khẩu sau khi đăng nhập lần đầu.`);
}

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return rest;
}

// ---------------------------------------------------------------------------
// Middleware xác thực
// ---------------------------------------------------------------------------
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.id);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại.' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Tài khoản chưa được kích hoạt hoặc đã bị khóa.' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// AUTH: đăng ký / đăng nhập / thông tin cá nhân
// ---------------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ họ tên, email và mật khẩu.' });
  }
  if (!['citizen', 'medical'].includes(role)) {
    return res.status(400).json({ error: 'Vai trò đăng ký không hợp lệ.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu cần tối thiểu 6 ký tự.' });
  }
  const emailLower = String(email).toLowerCase().trim();
  if (db.users.some(u => u.email.toLowerCase() === emailLower)) {
    return res.status(409).json({ error: 'Email này đã được đăng ký.' });
  }

  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: emailLower,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    // Người dân được kích hoạt ngay; nhân viên y tế cần admin duyệt trước khi đăng nhập được.
    status: role === 'citizen' ? 'active' : 'pending',
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDb(db);

  if (user.status === 'pending') {
    return res.status(201).json({
      message: 'Đăng ký thành công. Tài khoản nhân viên y tế cần được quản trị viên duyệt trước khi đăng nhập được.',
      pending: true,
    });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });

  const user = db.users.find(u => u.email.toLowerCase() === String(email).toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
  }
  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Tài khoản đang chờ quản trị viên duyệt.' });
  }
  if (user.status === 'blocked') {
    return res.status(403).json({ error: 'Tài khoản đã bị khóa. Liên hệ quản trị viên để biết thêm.' });
  }

  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

// ---------------------------------------------------------------------------
// ADMIN: quản lý tài khoản
// ---------------------------------------------------------------------------
app.get('/api/admin/users', authRequired, requireRole('admin'), (req, res) => {
  res.json({ users: db.users.map(publicUser) });
});

app.patch('/api/admin/users/:id', authRequired, requireRole('admin'), (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy người dùng.' });

  const { role, status } = req.body || {};
  if (role && ['admin', 'citizen', 'medical'].includes(role)) user.role = role;
  if (status && ['active', 'pending', 'blocked'].includes(status)) user.status = status;
  saveDb(db);
  res.json({ user: publicUser(user) });
});

// ---------------------------------------------------------------------------
// YÊU CẦU / PHẢN ÁNH của người dân → nhân viên y tế tiếp nhận
// ---------------------------------------------------------------------------
app.post('/api/requests', authRequired, requireRole('citizen'), (req, res) => {
  const { type, note } = req.body || {};
  if (!type) return res.status(400).json({ error: 'Thiếu loại yêu cầu.' });

  const request = {
    id: crypto.randomUUID(),
    citizenId: req.user.id,
    citizenName: req.user.name,
    type,
    note: note || '',
    status: 'moi', // moi -> dang_xu_ly -> da_xu_ly
    response: '',
    createdAt: new Date().toISOString(),
  };
  db.requests.push(request);
  saveDb(db);
  res.status(201).json({ request });
});

app.get('/api/requests/mine', authRequired, requireRole('citizen'), (req, res) => {
  const mine = db.requests.filter(r => r.citizenId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ requests: mine });
});

app.get('/api/requests', authRequired, requireRole('medical', 'admin'), (req, res) => {
  const all = [...db.requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ requests: all });
});

app.patch('/api/requests/:id', authRequired, requireRole('medical', 'admin'), (req, res) => {
  const request = db.requests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'Không tìm thấy yêu cầu.' });

  const { status, response } = req.body || {};
  if (status && ['moi', 'dang_xu_ly', 'da_xu_ly'].includes(status)) request.status = status;
  if (typeof response === 'string') request.response = response;
  saveDb(db);
  res.json({ request });
});

// ---------------------------------------------------------------------------
// ĐỀ NGHỊ CUNG CẤP VẬT TƯ (nhân viên y tế tạo, admin theo dõi)
// ---------------------------------------------------------------------------
app.post('/api/supply-proposals', authRequired, requireRole('medical'), (req, res) => {
  const { item, quantity, reason } = req.body || {};
  if (!item) return res.status(400).json({ error: 'Thiếu tên vật tư/thuốc.' });

  const proposal = {
    id: crypto.randomUUID(),
    staffId: req.user.id,
    staffName: req.user.name,
    item,
    quantity: quantity || '',
    reason: reason || '',
    status: 'cho_duyet', // cho_duyet -> da_duyet -> tu_choi
    createdAt: new Date().toISOString(),
  };
  db.supplyProposals.push(proposal);
  saveDb(db);
  res.status(201).json({ proposal });
});

app.get('/api/supply-proposals', authRequired, requireRole('medical', 'admin'), (req, res) => {
  const all = [...db.supplyProposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ proposals: all });
});

app.patch('/api/supply-proposals/:id', authRequired, requireRole('admin'), (req, res) => {
  const proposal = db.supplyProposals.find(p => p.id === req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Không tìm thấy đề nghị.' });
  const { status } = req.body || {};
  if (status && ['cho_duyet', 'da_duyet', 'tu_choi'].includes(status)) proposal.status = status;
  saveDb(db);
  res.json({ proposal });
});

// ---------------------------------------------------------------------------
// CHATBOT AI (Gemini) — chỉ người dân đã đăng nhập mới được dùng
// ---------------------------------------------------------------------------
app.post('/api/chat', authRequired, requireRole('citizen', 'admin'), async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY.' });
  }
  const { system, messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Thiếu trường "messages".' });
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
        body: JSON.stringify({
          contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        }),
      }
    );
    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Lỗi từ Gemini API' });
    }
    const replyText = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    res.json({ content: [{ type: 'text', text: replyText }] });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Không thể kết nối đến Gemini API.' });
  }
});

app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server Hải Đăng Sức Khỏe đang chạy tại cổng ${PORT}`));
