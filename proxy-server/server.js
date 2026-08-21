// server.js — Proxy server cho Trợ lý AI "Hải Đăng Sức Khỏe"
// Giữ API key an toàn ở phía server, không lộ ra frontend.

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Cho phép frontend (GitHub Pages) gọi sang server này
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = 'claude-sonnet-5';

app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server chưa cấu hình ANTHROPIC_API_KEY.' });
  }

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Thiếu trường "messages".' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: system || '',
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return res.status(response.status).json({ error: data.error?.message || 'Lỗi từ Anthropic API' });
    }

    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Không thể kết nối đến Anthropic API.' });
  }
});

// Kiểm tra nhanh server có chạy không
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Proxy server đang chạy tại cổng ${PORT}`));

