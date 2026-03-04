# Auth + RBAC (phone login)

## Mục tiêu

- Đăng nhập bằng `số điện thoại + mật khẩu`
- Phiên đăng nhập dài hạn (không hết hạn theo thời gian), chỉ hết khi `logout`
- Phân quyền theo RBAC: `admin`, `manager`, `sales`
- Có fallback login offline cho tài khoản admin khi DB tạm thời mất kết nối

## Bảng dữ liệu

1. `contact_entries`: thông tin liên hệ nghiệp vụ
2. `auth_users`: tài khoản đăng nhập, có thể liên kết `contact_id`
3. `auth_sessions`: phiên đăng nhập đang hoạt động

## API chính

- `POST /api/auth/login-phone`
  - body: `{ "phone": "0900000000", "password": "..." }`
  - trả về: `token`, `user`

- `GET /api/auth/me`
  - header: `Authorization: Bearer <token>`
  - trả về thông tin user hiện tại

- `POST /api/auth/logout`
  - header: `Authorization: Bearer <token>`
  - revoke session hiện tại

- `POST /api/auth/users` (admin)
  - tạo tài khoản mới
  - body mẫu:
    ```json
    {
      "contactId": 1,
      "phone": "0912345678",
      "password": "StrongPass!123",
      "role": "sales"
    }
    ```

## RBAC đang áp dụng

- `contacts:list/create/update`: `admin`, `manager`, `sales`
- `contacts:delete`: `admin`, `manager`
- `auth/users:create`: `admin`

## Luồng khởi tạo nhanh

1. Cập nhật `services/api/.env`:
   - `ADMIN_PHONE`
   - `ADMIN_PASSWORD`
   - `ADMIN_ROLE=admin`
  - `ALLOW_OFFLINE_LOGIN=true` (tùy chọn, mặc định bật)
2. Khởi động API, hệ thống sẽ seed tài khoản admin nếu chưa có.
3. Đăng nhập admin qua `POST /api/auth/login-phone`.
4. Dùng token admin gọi `POST /api/auth/users` để tạo tài khoản cho sales/manager.

## Ghi chú offline mode

- Khi DB timeout, `POST /api/auth/login-phone` vẫn cho phép đăng nhập admin bằng `ADMIN_PHONE` + `ADMIN_PASSWORD` nếu `ALLOW_OFFLINE_LOGIN=true`.
- Offline token chỉ phục vụ truy cập cơ bản; các chức năng phụ thuộc DB sẽ vẫn báo lỗi cho tới khi DB hoạt động lại.
