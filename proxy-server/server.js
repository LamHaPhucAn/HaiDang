// server.js — Proxy server cho Trợ lý AI "Hải Đăng Sức Khỏe"
// Dùng Google Gemini API (miễn phí) — giữ API key an toàn ở phía server, không lộ ra frontend.

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors()); // Cho phép frontend (GitHub Pages) gọi sang server này
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-3.5-flash-lite';

app.post('/api/chat', async (req, res) => {
  if (!API_KEY) {
    return res.status(500).json({ error: 'Server chưa cấu hình GEMINI_API_KEY.' });
  }

  const { system, messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Thiếu trường "messages".' });
  }

  // Chuyển định dạng messages (kiểu Anthropic: {role:'user'|'assistant', content}) 
  // sang định dạng Gemini (kiểu {role:'user'|'model', parts:[{text}]})
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY,
        },
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

    // Trả về đúng định dạng { content: [{ type: "text", text }] } mà frontend đang mong đợi,
    // để không cần sửa gì bên index.html.
    res.json({ content: [{ type: 'text', text: replyText }] });
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Không thể kết nối đến Gemini API.' });
  }
});

// Kiểm tra nhanh server có chạy không
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Proxy server (Gemini) đang chạy tại cổng ${PORT}`));

