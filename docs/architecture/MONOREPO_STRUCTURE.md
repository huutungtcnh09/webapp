# Monorepo Structure cho hệ thống đa ứng dụng

## Mục tiêu

Chuẩn hóa cấu trúc để phát triển nhiều app theo domain nghiệp vụ:
- `tms.name.vn` (corporate)
- `pos.tms.name.vn` (sales/POS)
- `admin.tms.name.vn` (quản trị)
- các app phòng ban khác: `hr`, `finance`, `warehouse`...

## Cấu trúc thư mục mục tiêu

```txt
webapp/
  apps/
    corporate/
    pos/
    admin/
    hr/
    finance/
  services/
    api/
  packages/
    ui/
    config/
    api-client/
    auth/
  infra/
    nginx/
    docker/
    ci/
  docs/
```

## Cấu trúc hiện tại (giai đoạn chuyển tiếp)

- `frontend/` = corporate app đang hoạt động
- `apps/pos/` = POS app đang hoạt động
- `services/api/` = API service đang hoạt động
- `apps/*`, `services/*`, `packages/*` = scaffold chuẩn cho mở rộng

## Domain routing khuyến nghị

- `tms.name.vn` -> app corporate
- `pos.tms.name.vn` -> app POS
- `admin.tms.name.vn` -> app Admin
- `api.tms.name.vn` -> backend API

## Nguyên tắc phát triển app mới

1. Mỗi app là một frontend độc lập trong `apps/`.
2. Dùng chung auth/RBAC từ API (`roles`, `permissions`).
3. Tái sử dụng component và config qua `packages/`.
4. Deploy độc lập theo subdomain, không ảnh hưởng app khác.
5. API versioning theo module (`/v1/auth`, `/v1/orders`, ...).
