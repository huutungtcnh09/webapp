# Deploy webapp lên VPS (không Docker)

Tài liệu này dùng cho Ubuntu 22.04/24.04, chạy app bằng PM2 + Nginx + SSL Let's Encrypt.

## 1) Chuẩn bị VPS

SSH vào VPS bằng user có quyền sudo:

```bash
ssh root@YOUR_SERVER_IP
```

Cập nhật hệ thống và cài gói cần thiết:

```bash
apt update && apt upgrade -y
apt install -y nginx mysql-server git curl
```

Cài Node.js 20 LTS và PM2:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
node -v
npm -v
pm2 -v
```

## 2) Clone source code

```bash
cd /var/www
git clone https://github.com/huutungtcnh09/webapp.git
cd webapp
```

## 3) Tạo file môi trường backend

```bash
cp services/api/.env.example services/api/.env
nano services/api/.env
```

Thiết lập tối thiểu trong `services/api/.env`:
- `ADMIN_PASSWORD`: mật khẩu admin mạnh
- `JWT_SECRET`: chuỗi bí mật mạnh
- `MYSQL_*`: thông tin kết nối MySQL thật trên VPS
- `ENABLE_DB_INIT`: để `false` nếu DB đã có sẵn, `true` nếu muốn app tự tạo DB/table lần đầu

Ví dụ cấu hình đã xác nhận chạy được:
- `MYSQL_HOST=10.4.1.128`
- `MYSQL_PORT=3306`
- `MYSQL_DATABASE=tungdb`
- `MYSQL_USER=dbadmin`

## 4) Chuẩn bị MySQL

Đăng nhập MySQL:

```bash
mysql -u root -p
```

Tạo database/user mẫu (đổi mật khẩu):

```sql
CREATE DATABASE IF NOT EXISTS webapp_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'webapp_user'@'localhost' IDENTIFIED BY 'StrongPass!123';
GRANT ALL PRIVILEGES ON webapp_db.* TO 'webapp_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Sau đó cập nhật lại `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` trong `services/api/.env`.

Nếu dùng MySQL riêng qua mạng private, cần grant đúng host nguồn của VPS (ví dụ `10.4.1.210`), nếu không sẽ gặp `ER_ACCESS_DENIED_ERROR`.

## 5) Build frontend + chạy backend

```bash
cd /var/www/webapp
npm install --prefix frontend
npm run build --prefix frontend

npm install --prefix services/api
```

Chạy app bằng PM2:

```bash
cd /var/www/webapp
pm2 start "npm run start --prefix services/api" --name webapp
pm2 save
pm2 startup systemd -u root --hp /root
```

Kiểm tra app local trên VPS:

```bash
curl http://127.0.0.1:5000/api/health
```

## 6) Cấu hình Nginx reverse proxy

Tạo file Nginx:

```bash
nano /etc/nginx/sites-available/webapp
```

Nội dung (đổi `your-domain.com`):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Kích hoạt site:

```bash
ln -s /etc/nginx/sites-available/webapp /etc/nginx/sites-enabled/webapp
nginx -t
systemctl reload nginx
```

Mở firewall nếu dùng UFW:

```bash
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw enable
```

## 7) Bật HTTPS miễn phí (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com -d www.your-domain.com
```

Kiểm tra auto-renew:

```bash
certbot renew --dry-run
```

## 8) Cập nhật phiên bản sau này

```bash
cd /var/www/webapp
git pull
npm install --prefix frontend
npm run build --prefix frontend

npm install --prefix services/api
pm2 restart webapp
```

## 9) Lệnh kiểm tra nhanh

```bash
pm2 status
pm2 logs webapp --lines 100
systemctl status nginx
curl https://your-domain.com/api/health
```
