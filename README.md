# webapp monorepo (corporate + POS + API)

Repo này đang được chuẩn hóa theo mô hình đa ứng dụng để mở rộng thêm app quản trị/phòng ban.

Trạng thái migration: Sprint 2 đã hoàn thành (POS + API đã chạy theo path mới).

## Cấu trúc hiện tại

- `frontend/`: app corporate đang hoạt động
- `apps/pos/`: app POS đang hoạt động
- `apps/admin/`: app Admin MVP đang hoạt động
- `services/api/`: API service đang hoạt động
- `packages/api-client/`: API client dùng chung
- `packages/auth/`: Auth helpers dùng chung
- `apps/`, `services/`, `packages/`, `infra/`, `docs/`: khung monorepo mới

## Scripts chạy nhanh từ root

```bash
npm run install:all
npm run dev:api
npm run dev:corporate
npm run dev:pos
npm run dev:admin
```

Build:

```bash
npm run build:corporate
npm run build:pos
npm run build:admin
```

## Domain target

- `tms.name.vn`: website doanh nghiệp
- `pos.tms.name.vn`: POS nhân viên bán hàng
- `admin.tms.name.vn`: ứng dụng quản trị
- `api.tms.name.vn`: backend API

## Tài liệu kiến trúc

- `DEPLOY_SUBDOMAIN_TMS_POS.md`
- `docs/architecture/MONOREPO_STRUCTURE.md`
- `docs/architecture/MIGRATION_PLAN_3_SPRINTS.md`
