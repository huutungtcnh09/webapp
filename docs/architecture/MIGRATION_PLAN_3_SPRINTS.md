# Migration Plan (3 Sprints)

## Sprint 1 - Chuẩn hóa nền tảng

- Tạo root workspace scripts (đã hoàn thành)
- Chuẩn hóa quy tắc đặt tên app/subdomain
- Chốt API base domain: `api.tms.name.vn`
- Chốt RBAC cơ bản: `admin`, `manager`, `sales`

## Sprint 2 - Đưa app về đúng thư mục `apps/*`

Trạng thái: **Hoàn thành**

- Chuẩn hóa app corporate theo cấu trúc mới và script root thống nhất
- Migrate app POS sang cấu trúc `apps/*` (đã hoàn thành)
- Migrate API service sang cấu trúc `services/*` (đã hoàn thành)
- Cập nhật scripts/deploy docs theo path mới

## Sprint 3 - Tách shared packages + thêm app mới

Trạng thái: **Đang triển khai**

- Tạo `packages/api-client` (đã hoàn thành)
- Tạo `packages/auth` cho logic session/token (đã hoàn thành)
- Tạo `packages/ui` cho component dùng chung (đã hoàn thành)
- Khởi tạo `apps/admin` (MVP quản trị) (đã hoàn thành)
- Nối `apps/admin` dùng package chung (`api-client`, `auth`) (đã hoàn thành)
- Nối `apps/admin` dùng component từ `packages/ui` (đã hoàn thành)
- (tuỳ chọn) khởi tạo `apps/hr` hoặc app phòng ban ưu tiên

## Tiêu chí done

- Mỗi app có thể build/deploy độc lập
- Cấu hình Nginx tách rõ theo subdomain
- Không còn phụ thuộc import chéo trực tiếp giữa app
- Shared logic nằm ở `packages/*`
