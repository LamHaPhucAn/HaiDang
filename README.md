# Proxy Server — Hải Đăng Sức Khỏe

Server nhỏ này đứng giữa frontend (GitHub Pages) và Anthropic API, giữ `ANTHROPIC_API_KEY` an toàn ở phía server thay vì lộ trong code frontend.

## 1. Lấy API key
Đăng ký tại https://console.anthropic.com → mục "API Keys" → tạo key mới (dạng `sk-ant-...`).

## 2. Deploy lên Render.com (miễn phí, dễ nhất)
1. Đưa thư mục `proxy-server/` này lên một repo GitHub riêng (hoặc thư mục con trong repo hiện tại).
2. Vào https://render.com → đăng nhập bằng GitHub → **New** → **Web Service**.
3. Chọn repo vừa tạo. Nếu server nằm trong thư mục con, điền **Root Directory** là `proxy-server`.
4. Cấu hình:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Vào tab **Environment** → thêm biến:
   - `ANTHROPIC_API_KEY` = key thật của bạn
6. Bấm **Create Web Service**. Sau khi deploy xong, Render cấp một URL dạng:
   `https://hai-dang-proxy.onrender.com`

## 3. Cập nhật frontend
Mở file `hai-dang-suc-khoe.html`, tìm dòng:
```js
const CHAT_API_URL = 'https://TEN-PROXY-CUA-BAN.onrender.com/api/chat';
```
Thay bằng URL Render thật của bạn, ví dụ:
```js
const CHAT_API_URL = 'https://hai-dang-proxy.onrender.com/api/chat';
```
Commit lại file lên GitHub, GitHub Pages sẽ tự cập nhật sau ít phút.

## 4. Kiểm tra
- Mở `https://ten-proxy-cua-ban.onrender.com/health` → phải thấy `{"ok":true}`.
- Mở web app trên GitHub Pages, vào tab Trợ lý AI, thử nhắn tin.

## Lưu ý
- Gói miễn phí của Render sẽ "ngủ" sau ~15 phút không dùng, tin nhắn đầu tiên sau đó có thể mất 20–30 giây để server khởi động lại — bình thường.
- Không bao giờ commit file `.env` thật (chứa key) lên GitHub — đã có `.gitignore` chặn sẵn.
- Muốn chạy thử ở máy local: copy `.env.example` thành `.env`, điền key, chạy `npm install && npm start`, server chạy ở `http://localhost:3000`.
