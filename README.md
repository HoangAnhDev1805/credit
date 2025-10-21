# creditv2

Hệ thống gồm 2 phần:
- Backend (Node.js/Express/MongoDB) tại `backend/`
- Frontend (Next.js) tại `frontend/`

## 1) Yêu cầu hệ thống (VPS Ubuntu 22.04/24.04)
- Node.js 20.x, npm
- MongoDB 6.x
- PM2
- Nginx + Certbot (SSL)

Cài đặt nhanh:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl build-essential ufw

# Node 20 + PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# MongoDB 6.x
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor
. /etc/os-release
echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg] https://repo.mongodb.org/apt/ubuntu $UBUNTU_CODENAME/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable --now mongod

# Nginx + SSL
sudo apt install -y nginx certbot python3-certbot-nginx
```

## 2) Clone mã nguồn và cài đặt
```bash
sudo mkdir -p /opt/apps && cd /opt/apps
sudo chown -R $USER:$USER /opt/apps
git clone https://github.com/HoangAnhDev1805/creditv2.git
cd creditv2

# Tạo file môi trường từ mẫu
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Cài dependencies
cd backend && npm ci && cd ..
cd frontend && npm ci && cd ..
```

## 3) Cấu hình môi trường

Chỉnh `backend/.env`:
```
NODE_ENV=production
PORT=3001

MONGODB_URI=mongodb://localhost:27017/creditchecker

JWT_SECRET=your-strong-secret
JWT_REFRESH_SECRET=your-strong-refresh
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this

CRYPTAPI_CALLBACK_URL=https://yourdomain.com/api/webhooks/cryptapi

MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=https://yourdomain.com,http://localhost:3000
```

Chỉnh `frontend/.env`:
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_SOCKET_URL=https://api.yourdomain.com
```

- Domain gợi ý:
  - Frontend: `yourdomain.com`
  - API: `api.yourdomain.com`

## 4) Chạy ứng dụng (PM2)
```bash
# Backend
cd /opt/apps/creditv2/backend
pm2 start src/server.js --name credit-backend
pm2 save
pm2 startup   # làm theo hướng dẫn in ra để enable khi reboot

# Frontend (Next.js)
cd /opt/apps/creditv2/frontend
npm run build
pm2 start "npm run start -- -p 3000" --name credit-frontend
pm2 save
```

## 5) Reverse Proxy Nginx + SSL
Tạo `/etc/nginx/sites-available/creditv2`:
```
server {
  listen 80;
  server_name yourdomain.com;
  client_max_body_size 20m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
  }
}

server {
  listen 80;
  server_name api.yourdomain.com;
  client_max_body_size 20m;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```
Kích hoạt và cấp SSL:
```bash
sudo ln -s /etc/nginx/sites-available/creditv2 /etc/nginx/sites-enabled/creditv2
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com --redirect -m admin@yourdomain.com --agree-tos -n
```

## 6) Đường dẫn ảnh và upload
- Static uploads được mount ở backend: `GET /uploads/...`
- Mặc định backend dùng: `app.use('/uploads', express.static(path.join(__dirname, '../uploads')))`
- Thư mục thực tế: `/opt/apps/creditv2/uploads`

Tạo và phân quyền:
```bash
mkdir -p /opt/apps/creditv2/uploads
chown -R $USER:$USER /opt/apps/creditv2/uploads
chmod -R 755 /opt/apps/creditv2/uploads
```
- Có thể đổi thư mục ghi file bằng biến `UPLOAD_DIR` trong `backend/.env`.

## 7) Backup & Restore database (MongoDB)

Backup:
```bash
# Cách 1: dùng script
cd /opt/apps/creditv2/backend
node backup-database.js
# Output tại backend/database-backup/backup-YYYY...

# Cách 2: dùng mongodump trực tiếp
mongodump --uri="mongodb://localhost:27017/creditchecker" --out \
  "/opt/backups/creditchecker-$(date +%F_%H%M)"
```

Restore:
```bash
mongorestore --uri="mongodb://localhost:27017/creditchecker" \
  "/opt/backups/creditchecker-YYYY-MM-DD_HHMM/creditchecker"
```

Lưu ý: dump có dữ liệu nhạy cảm → chỉ lưu trữ an toàn, không commit lên repo public.

## 8) Push code lên GitHub (force replace repo)

> Không dán trực tiếp token vào lệnh. Dùng biến môi trường tạm thời.

```bash
# Khắc phục dubious ownership
git config --global --add safe.directory /opt/apps/creditv2

cd /opt/apps/creditv2
git config user.name "Your Name"
git config user.email "you@example.com"

export GITHUB_TOKEN='YOUR_PAT_TOKEN_HERE'

git remote remove origin 2>/dev/null || true
git remote add origin https://${GITHUB_USERNAME:-HoangAnhDev1805}:${GITHUB_TOKEN}@github.com/HoangAnhDev1805/creditv2.git

git add -A
git commit -m "Deploy current workspace snapshot"
git branch -M main
git push -f origin main

unset GITHUB_TOKEN
```

## 9) Troubleshooting nhanh
- 500 khi gọi `/checker/start`: kiểm tra `backend/.env`, MongoDB đang chạy, logs PM2: `pm2 logs credit-backend`
- 404 ảnh: kiểm tra Nginx proxy tới API domain, và đường dẫn `/uploads/...` có file tồn tại, quyền thư mục
- Frontend không kết nối socket: kiểm tra `NEXT_PUBLIC_SOCKET_URL` và CORS `ALLOWED_ORIGINS`

---

Nếu cần CI/CD (GitHub Actions, auto deploy) hoặc Docker Compose, tạo issue để bổ sung.
