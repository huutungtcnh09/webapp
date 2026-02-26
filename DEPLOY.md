# Deploy web lên internet (Render)

Dự án đã được cấu hình để deploy fullstack bằng **1 Web Service**:
- Backend chạy Node.js
- Frontend được build và serve từ backend
- API dùng cùng domain qua prefix `/api`

## Bước 1: Đẩy code lên GitHub

```bash
git init
git add .
git commit -m "prepare production deploy"
# tạo repo mới trên GitHub rồi push
```

## Bước 2: Tạo service trên Render

1. Vào https://render.com và đăng nhập.
2. Chọn **New +** -> **Blueprint**.
3. Kết nối repo GitHub chứa project `webapp`.
4. Render tự đọc file `render.yaml` ở root và tạo service.

## Bước 3: Thiết lập biến môi trường (nếu được hỏi)

- `JWT_SECRET`: Render tự generate.
- `ADMIN_EMAIL`: mặc định `admin@webapp.com`.
- `ADMIN_PASSWORD`: nhập mật khẩu admin bạn muốn.
- `ENABLE_DB_INIT`: giữ `false`.

## Bước 4: Deploy

- Nhấn **Apply** / **Create Blueprint**.
- Chờ build + deploy hoàn tất.
- Render cấp URL dạng: `https://<ten-service>.onrender.com`

## Kiểm tra nhanh sau deploy

- Truy cập: `https://<ten-service>.onrender.com`
- Health API: `https://<ten-service>.onrender.com/api/health`

Nếu cần, mình có thể cấu hình tiếp để deploy backend riêng + database MySQL cloud (Railway/Aiven/PlanetScale).