# Triển khai 2 subdomain: tms.name.vn (Corporate) + pos.tms.name.vn (POS)

Mục tiêu: tách rõ website doanh nghiệp và ứng dụng bán hàng, nhưng vẫn dùng chung backend API.

## 1) Kiến trúc khuyến nghị

- `tms.name.vn`: frontend public (giới thiệu doanh nghiệp)
- `pos.tms.name.vn`: frontend nội bộ cho nhân viên bán hàng (bắt buộc đăng nhập)
- `api.tms.name.vn`: backend API dùng chung (Express + MySQL)

Luồng:
1. Người dùng web public truy cập `tms.name.vn`
2. Nhân viên truy cập `pos.tms.name.vn` và đăng nhập
3. Cả 2 frontend gọi API qua `https://api.tms.name.vn`

## 2) Cấu trúc repo hiện tại (đã cập nhật)

- `frontend/`: app corporate
- `apps/pos/`: app POS
- `services/api/`: API dùng chung

Gợi ý nhanh:
- Tách route UI theo vai trò ở tầng POS
- Backend giữ RBAC (admin/sales/manager) để chặn quyền thật sự

## 3) Biến môi trường

### Backend (`services/api/.env`)

```env
PORT=5000
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=webapp_db
JWT_SECRET=...
ADMIN_EMAIL=admin@tms.name.vn
ADMIN_PASSWORD=...
ENABLE_DB_INIT=false
```

### Frontend Corporate (`frontend/.env.production`)

```env
VITE_API_BASE_URL=https://api.tms.name.vn
```

### Frontend POS (`apps/pos/.env.production`)

```env
VITE_API_BASE_URL=https://api.tms.name.vn
```

## 4) Chạy local để phát triển đồng thời

Thêm vào file hosts (Windows):

`C:\Windows\System32\drivers\etc\hosts`

```txt
127.0.0.1 tms.local
127.0.0.1 pos.local
127.0.0.1 api.local
```

Chạy API backend:

```bash
cd services/api
npm run dev
```

Chạy corporate frontend:

```bash
cd frontend
npm run dev -- --host tms.local --port 5173
```

Chạy POS frontend:

```bash
cd apps/pos
npm run dev:pos
```

Lúc này:
- Corporate: `http://tms.local:5173`
- POS: `http://pos.local:5174`
- API: `http://localhost:5000`

## 5) Build production

```bash
npm install --prefix services/api
npm install --prefix frontend
npm install --prefix apps/pos
npm run build --prefix frontend
npm run build --prefix apps/pos
```

Deploy output:
- Corporate dist -> `/var/www/sites/tms`
- POS dist -> `/var/www/sites/pos`

Backend chạy riêng cổng nội bộ `127.0.0.1:5000` bằng PM2 hoặc Docker.

## 6) Nginx cho 3 host

Dùng file mẫu: `nginx.tms-pos-api.https.conf` trong repo.

Ý tưởng:
- `tms.name.vn` phục vụ static corporate
- `pos.tms.name.vn` phục vụ static POS
- `api.tms.name.vn` reverse proxy về backend 5000

## 7) Bảo mật tối thiểu nên có

- Chỉ mở cổng 80/443 ra internet, backend để nội bộ
- JWT secret mạnh, không hard-code
- Giới hạn CORS theo domain thật (`tms`, `pos`)
- Rate limit cho endpoint đăng nhập POS

## 8) Lộ trình triển khai nhanh (MVP)

1. Hoàn thiện app POS tại `apps/pos`
2. Dùng chung API login hiện có
3. Build 2 frontend và cấu hình Nginx 3 host
4. Smoke test: login POS + tạo đơn thử + gọi health API
5. Bật SSL Let's Encrypt cho cả 3 subdomain
