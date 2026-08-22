# Backend — Hải Đăng Sức Khỏe

Server Node.js/Express xử lý:
- Chatbot AI (Google Gemini, miễn phí)
- Đăng nhập / Đăng ký / Phân quyền (admin / citizen / medical)
- Yêu cầu & phản ánh của người dân → nhân viên y tế tiếp nhận
- Đề nghị cung cấp vật tư của nhân viên y tế → admin duyệt

## 1. Biến môi trường cần cấu hình trên Render

Vào Web Service → tab **Environment** → thêm các biến:

| Biến | Ý nghĩa | Bắt buộc |
|---|---|---|
| `GEMINI_API_KEY` | Key gọi Google Gemini, lấy tại aistudio.google.com/apikey | Có |
| `JWT_SECRET` | Chuỗi bí mật ký token đăng nhập — tự đặt một chuỗi dài ngẫu nhiên | Nên có (nếu bỏ trống sẽ dùng giá trị mặc định, không an toàn) |
| `ADMIN_EMAIL` | Email tài khoản quản trị viên đầu tiên | Không (mặc định `admin@haidang.vn`) |
| `ADMIN_PASSWORD` | Mật khẩu tài khoản quản trị viên đầu tiên | Không (mặc định `Admin@123`, **nên đổi**) |

Tài khoản admin được **tự động tạo** khi server khởi động lần đầu tiên, dùng đúng `ADMIN_EMAIL` / `ADMIN_PASSWORD` bạn đã cấu hình.

## 2. Ba vai trò trong hệ thống

- **Người dân (citizen)** — tự đăng ký, được kích hoạt ngay. Dùng Hồ sơ sức khỏe, Chăm sóc sức khỏe, Trợ lý AI, gửi yêu cầu/phản ánh đến nhân viên y tế.
- **Nhân viên y tế (medical)** — tự đăng ký nhưng ở trạng thái **chờ duyệt**, phải được admin duyệt mới đăng nhập được. Xem & phản hồi yêu cầu của người dân, gửi đề nghị cung cấp vật tư.
- **Quản trị viên (admin)** — không có form đăng ký công khai; chỉ được tạo tự động 1 tài khoản đầu tiên qua biến môi trường, hoặc do admin khác cấp quyền trong bảng Quản trị. Duyệt/khóa tài khoản, đổi vai trò, duyệt đề nghị vật tư.

## 3. Lưu trữ dữ liệu — lưu ý quan trọng

Dữ liệu (tài khoản, yêu cầu, đề nghị vật tư) được lưu trong file `db.json` ngay trên server — đơn giản, phù hợp cho demo/đồ án.

⚠️ **Trên Render free tier, dữ liệu sẽ mất khi bạn deploy lại code mới** (mỗi lần build là một container mới). Vì vậy:
- Trong ngày báo cáo/demo, **tránh** đẩy commit mới lên GitHub sau khi đã tạo tài khoản test, nếu không muốn dữ liệu bị xóa.
- Nếu cần dữ liệu tồn tại lâu dài, cân nhắc nâng cấp lên Render Persistent Disk (trả phí) hoặc chuyển sang dùng một database ngoài như MongoDB Atlas (có gói miễn phí) — đây là hướng phát triển tiếp theo, không bắt buộc cho bản demo hiện tại.

## 4. Chạy thử ở máy local

```
npm install
cp .env.example .env
# rồi điền các giá trị thật vào file .env
npm start
```

Server chạy tại `http://localhost:3000`. Kiểm tra nhanh: mở `http://localhost:3000/health`.

## 5. Deploy lên Render.com

Xem hướng dẫn chi tiết trong tài liệu Word "Hướng dẫn xây dựng Web App bằng Claude" — Phần 3. Về cơ bản: New → Web Service → Root Directory `proxy-server` (hoặc tên thư mục chứa các file này) → Build Command `npm install` → Start Command `npm start` → thêm đủ 4 biến môi trường ở mục 1 → Create Web Service.
