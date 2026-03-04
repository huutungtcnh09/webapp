# Deploy webapp bằng Docker + MySQL Viettel IDC (Ubuntu 24.04)

> Nếu bạn muốn tách riêng 2 domain `tms.name.vn` (corporate) và `pos.tms.name.vn` (POS), xem thêm: `DEPLOY_SUBDOMAIN_TMS_POS.md`.

## 1) Cài Docker + Compose plugin

```bash
apt update
apt install -y ca-certificates curl gnupg lsb-release
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable docker
systemctl start docker
```

Kiểm tra:

```bash
docker --version
docker compose version
```

## 2) Clone source code

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/huutungtcnh09/webapp.git
cd webapp
```

## 3) Tạo file biến môi trường Docker

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Điền giá trị thật cho:
- `MYSQL_HOST` (hostname/endpoint MySQL Viettel IDC)
- `MYSQL_PORT` (thường `3306`)
- `MYSQL_DATABASE`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `JWT_SECRET`
- `ADMIN_PHONE`
- `ADMIN_ROLE` (mặc định `admin`)
- `ADMIN_PASSWORD`
- `BCRYPT_ROUNDS` (mặc định `10`)

Ví dụ cấu hình đang chạy ổn định:
- `MYSQL_HOST=10.4.1.128`
- `MYSQL_PORT=3306`
- `MYSQL_DATABASE=tungdb`
- `MYSQL_USER=dbadmin`

## 4) Build và chạy containers

```bash
docker compose --env-file .env.docker up -d --build
```

Kiểm tra trạng thái:

```bash
docker compose ps
docker compose logs app --tail 100
```

## 5) Kiểm tra ứng dụng

```bash
curl http://127.0.0.1/api/health
```

Nếu trả `{"status":"ok"}` là app chạy tốt.

## 6) Chuẩn bị database Viettel IDC

Đảm bảo trên MySQL Viettel IDC đã có:
- database tên `webapp_db` (hoặc tên bạn đặt trong `.env.docker`)
- user có quyền trên database đó

Nếu app chạy trên VPS private IP `10.4.1.210`, cần grant user đúng theo host nguồn này (không chỉ `localhost`):

```sql
CREATE USER IF NOT EXISTS 'dbadmin'@'10.4.1.210' IDENTIFIED BY 'your_password';
ALTER USER 'dbadmin'@'10.4.1.210' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON tungdb.* TO 'dbadmin'@'10.4.1.210';
FLUSH PRIVILEGES;
```

Lưu ý: cấu hình hiện tại để `ENABLE_DB_INIT=false`, phù hợp cho MySQL managed.

## 7) (Khuyến nghị) Mở bằng domain + HTTPS qua Nginx

Nếu muốn giữ Docker chạy nội bộ và public qua Nginx:
- Đổi map port app trong `docker-compose.yml` từ `80:5000` thành `127.0.0.1:5000:5000`
- Cấu hình Nginx reverse proxy từ 80/443 -> `http://127.0.0.1:5000`
- Dùng Certbot để cấp SSL.

## 8) Cập nhật phiên bản mới

```bash
cd /var/www/webapp
git pull
docker compose --env-file .env.docker up -d --build
```

## 9) Lệnh hữu ích

```bash
docker compose --env-file .env.docker down
docker compose --env-file .env.docker restart
docker compose --env-file .env.docker logs -f app
docker system df
```
