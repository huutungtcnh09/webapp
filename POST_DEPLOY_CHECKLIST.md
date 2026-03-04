# Checklist vận hành sau deploy

Tài liệu này dùng để kiểm tra nhanh sau mỗi lần deploy và vận hành định kỳ.

## 1) Việc cần làm ngay sau deploy

- [ ] Kiểm tra API health public
  - `curl -i http://27.71.26.161/api/health`
  - Kỳ vọng: `200` và có `"db":{"status":"connected","name":"tungdb"}`
- [ ] Kiểm tra trang chủ public
  - `curl -i http://27.71.26.161/`
  - Kỳ vọng: `200`
- [ ] Kiểm tra process backend
  - `pm2 status`
  - `pm2 logs webapp --lines 100`
- [ ] Kiểm tra Nginx
  - `sudo nginx -t`
  - `sudo systemctl status nginx --no-pager -l | head -n 30`

## 2) Bảo mật bắt buộc (làm trong ngày)

- [ ] Đổi mật khẩu đã dùng trong lúc setup:
  - mật khẩu VPS
  - mật khẩu DB
  - `ADMIN_PASSWORD`
  - `JWT_SECRET`
- [ ] Cập nhật lại biến môi trường trên VPS (`/var/www/webapp/services/api/.env`) và restart:
  - `pm2 restart webapp --update-env`
- [ ] Xác nhận DB user được grant đúng theo IP private của VPS (ví dụ `10.4.1.210`), không chỉ `localhost`.
- [ ] Chỉ mở các cổng cần thiết trên firewall (`22`, `80`, `443`), không mở `3306` ra public nếu không bắt buộc.

## 3) HTTPS

- [ ] Cấu hình chứng chỉ SSL (Let's Encrypt) và bật auto renew.
- [ ] Sau khi cấu hình xong, kiểm tra:
  - `curl -I https://27.71.26.161/`
  - Kỳ vọng: có phản hồi HTTPS thành công.

## 4) Backup và khôi phục

- [ ] Tạo backup DB hằng ngày (ít nhất giữ 7 bản gần nhất).
- [ ] Kiểm tra khôi phục thử 1 lần.
- [ ] Lưu nơi lưu backup + người chịu trách nhiệm.

## 5) Giám sát và cảnh báo

- [ ] Theo dõi các chỉ số:
  - CPU/RAM/Disk VPS
  - trạng thái `pm2`
  - lỗi `nginx`/`webapp`
- [ ] Cảnh báo khi:
  - `/api/health` không phải `200`
  - process `webapp` không `online`

## 6) Lịch vận hành định kỳ

### Daily
- [ ] `curl -s http://27.71.26.161/api/health`
- [ ] `pm2 status`
- [ ] `df -h`

### Weekly
- [ ] `pm2 logs webapp --lines 200`
- [ ] `sudo journalctl -u nginx -n 200 --no-pager`
- [ ] Xác nhận backup DB chạy đúng lịch

### Monthly
- [ ] Cập nhật bản vá bảo mật hệ điều hành
- [ ] Rà soát tài khoản/mật khẩu/secret
- [ ] Diễn tập rollback nhanh (khôi phục code + DB)

## 7) Quy trình update tính năng có thay đổi DB

- [ ] Chạy migration trước (thêm cột/bảng/index)
- [ ] Deploy code tương thích ngược
- [ ] Kiểm tra health + luồng chức năng
- [ ] Chạy backfill dữ liệu (nếu có)
- [ ] Chỉ cleanup cột/bảng cũ khi đã ổn định

## 8) Trạng thái hiện tại (01-03-2026)

- HTTP public: OK
- Health DB: OK (`tungdb` connected)
- HTTPS: Chưa sẵn sàng (`Unable to connect`)
