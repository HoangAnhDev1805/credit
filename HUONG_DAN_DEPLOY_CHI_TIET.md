# Hướng Dẫn Deploy Chi Tiết (Không Dùng PM2)

## 📋 Mục Lục
1. [Cài Đặt Môi Trường](#1-cài-đặt-môi-trường)
2. [Clone Source Code](#2-clone-source-code)
3. [Cấu Hình Backend](#3-cấu-hình-backend)
4. [Cấu Hình Frontend](#4-cấu-hình-frontend)
5. [Import Database](#5-import-database)
6. [Build & Deploy](#6-build--deploy)
7. [Chạy Ứng Dụng](#7-chạy-ứng-dụng)
8. [Troubleshooting](#8-troubleshooting)

---

## 1. Cài Đặt Môi Trường

### Bước 1.1: Cài Node.js (v18 hoặc v20)

```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### Bước 1.2: Cài MongoDB

```bash
# Ubuntu/Debian
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
mongosh --version
```

### Bước 1.3: Cài Git

```bash
sudo apt-get install -y git
git --version
```

---

## 2. Clone Source Code

### Bước 2.1: Clone Repository

```bash
cd /home/YOUR_USERNAME
git clone https://github.com/HoangAnhDev1805/creditv2.git
cd creditv2
```

### Bước 2.2: Checkout Nhánh Deploy

```bash
git checkout deploy
git pull origin deploy
```

### Bước 2.3: Xem Cấu Trúc Thư Mục

```bash
ls -la
# Bạn sẽ thấy:
# - backend/          (Backend Node.js + Express)
# - frontend/         (Frontend Next.js)
# - database_export/  (Database backup)
# - scripts/          (Utility scripts)
```

---

## 3. Cấu Hình Backend

### Bước 3.1: Install Dependencies

```bash
cd backend
npm install
```

⏱️ **Thời gian:** 2-5 phút tùy tốc độ mạng

### Bước 3.2: Tạo File .env

```bash
cp .env.example .env
nano .env
```

### Bước 3.3: Cấu Hình .env Backend

**File: `/backend/.env`**

```env
# =================================
# SERVER CONFIGURATION
# =================================
NODE_ENV=production
PORT=5000

# =================================
# DATABASE CONFIGURATION
# =================================
# Local MongoDB (khuyến nghị)
MONGODB_URI=mongodb://localhost:27017/credit_card_checker

# Hoặc MongoDB Atlas (cloud)
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/credit_card_checker

# =================================
# JWT CONFIGURATION
# =================================
# QUAN TRỌNG: Đổi các giá trị này!
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-too
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d

# =================================
# CRYPTOAPI CONFIGURATION
# =================================
# Lấy từ https://cryptapi.io/
CRYPTAPI_API_KEY=your-cryptapi-key-here
CRYPTAPI_CALLBACK_URL=https://your-domain.com/api/payments/cryptapi/webhook

# =================================
# EXTERNAL API (Optional - API Check Card)
# =================================
CHECKCC_API_URL=https://160.25.168.79/api/TrungLOL.aspx
CHECKCC_API_TOKEN=your-api-token-here

# =================================
# CORS CONFIGURATION
# =================================
FRONTEND_URL=http://localhost:3000
# Production: https://your-domain.com

# =================================
# LOG CONFIGURATION
# =================================
LOG_LEVEL=info
```

### Bước 3.4: Tạo Thư Mục Logs

```bash
mkdir -p logs uploads
chmod 755 logs uploads
```

### Bước 3.5: Test Backend Configuration

```bash
# Test MongoDB connection
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => {console.log('✅ MongoDB connected'); process.exit(0);}).catch(err => {console.error('❌ MongoDB error:', err); process.exit(1);});"
```

---

## 4. Cấu Hình Frontend

### Bước 4.1: Install Dependencies

```bash
cd ../frontend
npm install
```

⏱️ **Thời gian:** 3-7 phút

### Bước 4.2: Tạo File .env.local

```bash
nano .env.local
```

### Bước 4.3: Cấu Hình .env.local Frontend

**File: `/frontend/.env.local`**

```env
# =================================
# API CONFIGURATION
# =================================
# Development
NEXT_PUBLIC_API_URL=http://localhost:5000/api

# Production (uncomment và đổi domain)
# NEXT_PUBLIC_API_URL=https://your-domain.com/api

# =================================
# WEBSOCKET CONFIGURATION (Optional)
# =================================
NEXT_PUBLIC_WS_URL=ws://localhost:5000

# Production (uncomment và đổi domain)
# NEXT_PUBLIC_WS_URL=wss://your-domain.com
```

### Bước 4.4: Test Frontend Configuration

```bash
npm run build
```

✅ **Nếu build thành công**, cấu hình đúng!

---

## 5. Import Database

### Bước 5.1: Xem Backup Có Sẵn

```bash
cd /home/YOUR_USERNAME/creditv2
ls -lh database_export/
```

Bạn sẽ thấy file: `database_backup_2025-10-19.json`

### Bước 5.2: Import Database

```bash
cd backend
node scripts/import-database.js database_backup_2025-10-19.json
```

**Output:**
```
🔄 Reading backup file...
✅ Backup file loaded
📅 Export date: 2025-10-19T...
🗄️  Database: credit_card_checker

🔄 Connecting to MongoDB...
✅ Connected to MongoDB

📦 Importing collections:
  🔄 Importing users...
    🗑️  Dropped existing users
  ✅ Imported 9 documents to users
  🔄 Importing siteconfigs...
  ✅ Imported 47 documents to siteconfigs
  ...

✅ Database imported successfully!
```

### Bước 5.3: Verify Database

```bash
mongosh

use credit_card_checker
show collections
db.users.countDocuments()  # Should show 9
db.siteconfigs.countDocuments()  # Should show 47
exit
```

---

## 6. Build & Deploy

### Bước 6.1: Build Frontend

```bash
cd /home/YOUR_USERNAME/creditv2/frontend
npm run build
```

**Output cuối cùng:**
```
✓ Compiled successfully
✓ Collecting page data
✓ Generating static pages (27/27)
✓ Finalizing page optimization

Route (app)                              Size     First Load JS
├ ○ /                                    5.95 kB         140 kB
├ ○ /dashboard                           4.71 kB         138 kB
...
```

⏱️ **Thời gian:** 1-3 phút

### Bước 6.2: Test Production Build

```bash
npm run start
```

Mở browser: `http://localhost:3000`

Nhấn **Ctrl+C** để dừng test.

---

## 7. Chạy Ứng Dụng

### Cách 1: Chạy Trong Foreground (Development/Testing)

#### Terminal 1 - Backend:
```bash
cd /home/YOUR_USERNAME/creditv2/backend
npm start
```

**Output:**
```
🚀 Server running in production mode on port 5000
✅ MongoDB Connected
```

#### Terminal 2 - Frontend:
```bash
cd /home/YOUR_USERNAME/creditv2/frontend
npm run start
```

**Output:**
```
▲ Next.js 14.0.4
- Local:        http://localhost:3000
- Environments: .env.local

✓ Ready in 2.3s
```

### Cách 2: Chạy Trong Background (Production)

#### Sử Dụng `nohup`:

```bash
# Backend
cd /home/YOUR_USERNAME/creditv2/backend
nohup npm start > ../logs/backend.log 2>&1 &
echo $! > ../backend.pid

# Frontend  
cd /home/YOUR_USERNAME/creditv2/frontend
nohup npm run start > ../logs/frontend.log 2>&1 &
echo $! > ../frontend.pid
```

#### Kiểm Tra Process:

```bash
# Xem PID
cat backend.pid
cat frontend.pid

# Xem logs
tail -f logs/backend.log
tail -f logs/frontend.log

# Xem process đang chạy
ps aux | grep node
```

#### Dừng Process:

```bash
# Backend
kill $(cat backend.pid)

# Frontend
kill $(cat frontend.pid)
```

### Cách 3: Tạo Systemd Service (Khuyến Nghị cho Production)

#### Bước 7.3.1: Tạo Service Backend

```bash
sudo nano /etc/systemd/system/creditv2-backend.service
```

**Nội dung:**
```ini
[Unit]
Description=Credit Card Checker Backend
After=network.target mongod.service

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/creditv2/backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:/home/YOUR_USERNAME/creditv2/logs/backend.log
StandardError=append:/home/YOUR_USERNAME/creditv2/logs/backend.error.log

[Install]
WantedBy=multi-user.target
```

**⚠️ Thay `YOUR_USERNAME` bằng username thật!**

#### Bước 7.3.2: Tạo Service Frontend

```bash
sudo nano /etc/systemd/system/creditv2-frontend.service
```

**Nội dung:**
```ini
[Unit]
Description=Credit Card Checker Frontend
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/home/YOUR_USERNAME/creditv2/frontend
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
StandardOutput=append:/home/YOUR_USERNAME/creditv2/logs/frontend.log
StandardError=append:/home/YOUR_USERNAME/creditv2/logs/frontend.error.log

[Install]
WantedBy=multi-user.target
```

#### Bước 7.3.3: Enable và Start Services

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable creditv2-backend
sudo systemctl enable creditv2-frontend

# Start services
sudo systemctl start creditv2-backend
sudo systemctl start creditv2-frontend

# Check status
sudo systemctl status creditv2-backend
sudo systemctl status creditv2-frontend
```

#### Bước 7.3.4: Quản Lý Services

```bash
# Stop
sudo systemctl stop creditv2-backend
sudo systemctl stop creditv2-frontend

# Restart
sudo systemctl restart creditv2-backend
sudo systemctl restart creditv2-frontend

# View logs
sudo journalctl -u creditv2-backend -f
sudo journalctl -u creditv2-frontend -f

# View application logs
tail -f /home/YOUR_USERNAME/creditv2/logs/backend.log
tail -f /home/YOUR_USERNAME/creditv2/logs/frontend.log
```

---

## 8. Troubleshooting

### ❌ Lỗi: MongoDB Connection Failed

**Triệu chứng:**
```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Giải pháp:**
```bash
# Kiểm tra MongoDB đang chạy
sudo systemctl status mongod

# Nếu không chạy
sudo systemctl start mongod

# Test connection
mongosh
```

---

### ❌ Lỗi: Port Already in Use

**Triệu chứng:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Giải pháp:**
```bash
# Tìm process đang dùng port
sudo lsof -i :5000
sudo lsof -i :3000

# Kill process
sudo kill -9 <PID>

# Hoặc đổi port trong .env
PORT=5001  # Backend
# Frontend: Next.js tự động dùng 3000
```

---

### ❌ Lỗi: Module Not Found

**Triệu chứng:**
```
Error: Cannot find module 'express'
```

**Giải pháp:**
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json .next
npm install
npm run build
```

---

### ❌ Lỗi: JWT Token Invalid

**Triệu chứng:**
- Không login được
- 401 Unauthorized errors

**Giải pháp:**
```bash
# Clear browser localStorage
# F12 > Console > Run:
localStorage.clear()
location.reload()

# Hoặc generate JWT secrets mới
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output vào .env: JWT_SECRET và JWT_REFRESH_SECRET
```

---

### ❌ Lỗi: Next.js Build Failed

**Triệu chứng:**
```
Error: Build failed
```

**Giải pháp:**
```bash
cd frontend

# Clear cache
rm -rf .next node_modules

# Reinstall
npm install

# Build lại
npm run build
```

---

### ❌ Lỗi: Database Import Failed

**Triệu chứng:**
```
❌ Import failed: Backup file not found
```

**Giải pháp:**
```bash
# Kiểm tra file có tồn tại
ls -lh database_export/

# Nếu không có, export lại từ server cũ
cd /path/to/old/server/backend
node scripts/export-database.js

# Copy file sang server mới
scp database_export/*.json user@new-server:/home/YOUR_USERNAME/creditv2/database_export/
```

---

## 📝 Tóm Tắt Các File Cần Config

| File | Location | Cần Config |
|------|----------|------------|
| Backend .env | `/backend/.env` | ✅ **BẮT BUỘC** |
| Frontend .env.local | `/frontend/.env.local` | ✅ **BẮT BUỘC** |
| Systemd Backend Service | `/etc/systemd/system/creditv2-backend.service` | ⚠️ **Khuyến nghị** |
| Systemd Frontend Service | `/etc/systemd/system/creditv2-frontend.service` | ⚠️ **Khuyến nghị** |

---

## 🚀 Quick Start Script

Tạo file `quick-deploy.sh`:

```bash
#!/bin/bash

echo "🚀 Quick Deploy Script"
echo "====================="

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Don't run as root!${NC}"
   exit 1
fi

echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd backend && npm install

echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd ../frontend && npm install

echo -e "${YELLOW}🏗️  Building frontend...${NC}"
npm run build

echo -e "${YELLOW}💾 Importing database...${NC}"
cd ../backend
node scripts/import-database.js database_backup_2025-10-19.json

echo -e "${GREEN}✅ Deploy completed!${NC}"
echo ""
echo "Next steps:"
echo "1. Configure backend/.env"
echo "2. Configure frontend/.env.local"
echo "3. Run: sudo systemctl start creditv2-backend creditv2-frontend"
echo "   Or: cd backend && npm start (in terminal 1)"
echo "       cd frontend && npm run start (in terminal 2)"
```

Chạy:
```bash
chmod +x quick-deploy.sh
./quick-deploy.sh
```

---

## ✅ Checklist Hoàn Thành

- [ ] Node.js v20 installed
- [ ] MongoDB installed and running
- [ ] Git installed
- [ ] Source code cloned (branch: deploy)
- [ ] Backend dependencies installed
- [ ] Backend .env configured
- [ ] Frontend dependencies installed
- [ ] Frontend .env.local configured
- [ ] Database imported successfully
- [ ] Frontend built successfully
- [ ] Backend running (port 5000)
- [ ] Frontend running (port 3000)
- [ ] Can access http://localhost:3000
- [ ] Can login successfully
- [ ] Systemd services created (optional)

---

## 🆘 Cần Hỗ Trợ?

- **Documentation:** Xem `FIXES_SUMMARY.md`
- **GitHub:** https://github.com/HoangAnhDev1805/creditv2
- **Branch:** deploy
- **Logs:** Check `logs/backend.log` và `logs/frontend.log`

---

**Phiên bản:** 1.0.0  
**Ngày cập nhật:** 19/10/2025  
**Branch:** deploy
