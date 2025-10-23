# 💳 Credit Card Checker System

Hệ thống kiểm tra thẻ tín dụng chuyên nghiệp với giao diện hiện đại, hỗ trợ nhiều gateway và real-time updates.

## 📋 Mục lục

- [Tổng quan](#tổng-quan)
- [Tính năng](#tính-năng)
- [Công nghệ sử dụng](#công-nghệ-sử-dụng)
- [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
- [Cài đặt](#cài-đặt)
  - [1. Cài đặt môi trường](#1-cài-đặt-môi-trường)
  - [2. Clone project](#2-clone-project)
  - [3. Cài đặt dependencies](#3-cài-đặt-dependencies)
  - [4. Cấu hình MongoDB](#4-cấu-hình-mongodb)
  - [5. Cấu hình Redis](#5-cấu-hình-redis)
  - [6. Cấu hình Backend](#6-cấu-hình-backend)
  - [7. Cấu hình Frontend](#7-cấu-hình-frontend)
  - [8. Cấu hình Nginx](#8-cấu-hình-nginx)
  - [9. Cấu hình SSL](#9-cấu-hình-ssl)
  - [10. Cấu hình Upload Files](#10-cấu-hình-upload-files)
- [Backup & Restore Database](#backup--restore-database)
- [PM2 Process Manager](#pm2-process-manager)
- [Socket.IO Configuration](#socketio-configuration)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Tổng quan

Hệ thống quản lý và kiểm tra thẻ tín dụng với các tính năng:
- Check thẻ qua nhiều gateway (Stripe, Braintree, Authorize.net, v.v.)
- Tích hợp ZennoPoster API
- Real-time updates với Socket.IO
- Admin panel mạnh mẽ
- Hệ thống thanh toán crypto (CryptAPI)
- Rate limiting & Security

---

## ✨ Tính năng

### User Features
- ✅ Đăng ký/Đăng nhập với JWT
- ✅ Kiểm tra thẻ (Live/Charge check)
- ✅ Generate test cards
- ✅ Lịch sử kiểm tra
- ✅ Nạp credit qua crypto
- ✅ API documentation cho third-party

### Admin Features
- ✅ Dashboard thống kê real-time
- ✅ Quản lý user (ban/unban, change role)
- ✅ Quản lý thẻ (bulk delete, export CSV/TXT)
- ✅ Quản lý payment requests
- ✅ Cấu hình gates
- ✅ Rate limiting config
- ✅ Server monitoring

---

## 🛠 Công nghệ sử dụng

### Backend
- **Node.js** (v18+)
- **Express.js** (REST API)
- **MongoDB** (Database)
- **Redis** (Caching & Rate limiting)
- **Socket.IO** (Real-time communication)
- **JWT** (Authentication)
- **PM2** (Process manager)

### Frontend
- **Next.js 14** (React framework)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn/UI** (Component library)
- **Socket.IO Client**
- **Zustand** (State management)

---

## 💻 Yêu cầu hệ thống

- **OS**: Ubuntu 20.04+ / Debian 10+ / CentOS 8+
- **Node.js**: >= 18.x
- **npm**: >= 9.x
- **MongoDB**: >= 5.0
- **Redis**: >= 6.0
- **Nginx**: >= 1.18
- **RAM**: >= 2GB
- **Disk**: >= 10GB

---

## 📦 Cài đặt

### 1. Cài đặt môi trường

#### Node.js & npm
```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node -v  # v18.x.x
npm -v   # 9.x.x
```

#### MongoDB
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -

# Add repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start & Enable
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify
sudo systemctl status mongod
mongosh --version
```

#### Redis
```bash
# Install Redis
sudo apt-get install -y redis-server

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set: bind 127.0.0.1
# Set: maxmemory 256mb
# Set: maxmemory-policy allkeys-lru

# Restart
sudo systemctl restart redis
sudo systemctl enable redis

# Verify
redis-cli ping  # Should return PONG
```

#### Nginx
```bash
# Install Nginx
sudo apt-get install -y nginx

# Start & Enable
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify
sudo systemctl status nginx
```

#### PM2
```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup startup script
pm2 startup
# Follow the command it outputs

# Verify
pm2 -v
```

---

### 2. Clone project

```bash
# Clone repository
git clone https://github.com/HoangAnhDev1805/credit.git
cd credit

# Or if using SSH
git clone git@github.com:HoangAnhDev1805/credit.git
cd credit
```

---

### 3. Cài đặt dependencies

```bash
# Backend dependencies
cd backend
npm install

# Frontend dependencies
cd ../frontend
npm install
```

---

### 4. Cấu hình MongoDB

#### Tạo database và user
```bash
mongosh

use creditcard_checker

db.createUser({
  user: "creditadmin",
  pwd: "your_strong_password_here",
  roles: [
    { role: "readWrite", db: "creditcard_checker" }
  ]
})

exit
```

#### Test connection
```bash
mongosh "mongodb://creditadmin:your_strong_password_here@localhost:27017/creditcard_checker"
```

---

### 5. Cấu hình Redis

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf

# Recommended settings:
# bind 127.0.0.1
# requirepass your_redis_password
# maxmemory 256mb
# maxmemory-policy allkeys-lru

# Restart Redis
sudo systemctl restart redis

# Test
redis-cli
AUTH your_redis_password
PING  # Should return PONG
```

---

### 6. Cấu hình Backend

```bash
cd /opt/apps/creditv2/backend

# Copy env example
cp .env.example .env

# Edit .env file
nano .env
```

#### Backend `.env` configuration:
```env
# Server
NODE_ENV=production
PORT=5000

# Database
MONGO_URI=mongodb://creditadmin:your_strong_password_here@localhost:27017/creditcard_checker

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_jwt_secret_here_32_characters_min
JWT_EXPIRE=30d
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_REFRESH_EXPIRE=90d

# Frontend URL
FRONTEND_URL=https://your-domain.com

# Admin credentials (first time setup)
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change_this_password

# File uploads
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880

# Socket.IO
SOCKET_PATH=/socket.io

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Email (optional - for password reset)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# CryptAPI (for crypto payments)
CRYPTAPI_CALLBACK_URL=https://your-domain.com/api/payments/cryptapi/webhook
```

---

### 7. Cấu hình Frontend

```bash
cd /opt/apps/creditv2/frontend

# Copy env example
cp .env.local.example .env.production

# Edit .env.production
nano .env.production
```

#### Frontend `.env.production` configuration:
```env
# API URL
NEXT_PUBLIC_API_URL=https://your-domain.com/api

# Socket.IO
NEXT_PUBLIC_SOCKET_URL=https://your-domain.com
NEXT_PUBLIC_SOCKET_PATH=/socket.io

# Site info
NEXT_PUBLIC_SITE_NAME=Credit Card Checker
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

#### Build frontend
```bash
cd /opt/apps/creditv2/frontend
npm run build
```

---

### 8. Cấu hình Nginx

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/checkcc
```

#### Nginx configuration:
```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;
    
    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Client body size (for file uploads)
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Frontend (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.IO (Important!)
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
        proxy_read_timeout 86400;
    }

    # Static files (uploads)
    location /uploads {
        alias /opt/apps/creditv2/backend/uploads;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Access & Error logs
    access_log /var/log/nginx/checkcc_access.log;
    error_log /var/log/nginx/checkcc_error.log;
}
```

#### Enable site
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/checkcc /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

### 9. Cấu hình SSL

#### Using Certbot (Let's Encrypt)
```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run

# Auto-renewal is handled by systemd timer
sudo systemctl status certbot.timer
```

---

### 10. Cấu hình Upload Files

```bash
# Create uploads directory
mkdir -p /opt/apps/creditv2/backend/uploads
mkdir -p /opt/apps/creditv2/backend/uploads/logos
mkdir -p /opt/apps/creditv2/backend/uploads/banners
mkdir -p /opt/apps/creditv2/backend/uploads/icons

# Set permissions
sudo chown -R $USER:$USER /opt/apps/creditv2/backend/uploads
chmod -R 755 /opt/apps/creditv2/backend/uploads
```

#### Upload path in backend:
- Logo: `/uploads/logos/`
- Banners: `/uploads/banners/`
- Icons: `/uploads/icons/`

#### Access URLs:
- `https://your-domain.com/uploads/logos/logo.png`
- `https://your-domain.com/uploads/banners/banner.jpg`

---

## 💾 Backup & Restore Database

### Backup MongoDB

```bash
# Full backup
mongodump --uri="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker" --out=/backup/mongodb/$(date +%Y%m%d)

# Compressed backup
mongodump --uri="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker" --gzip --archive=/backup/mongodb/backup_$(date +%Y%m%d).gz

# Backup specific collections
mongodump --uri="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker" --collection=cards --out=/backup/mongodb/cards_$(date +%Y%m%d)
```

### Restore MongoDB

```bash
# Restore from directory
mongorestore --uri="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker" /backup/mongodb/20231023

# Restore from compressed archive
mongorestore --uri="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker" --gzip --archive=/backup/mongodb/backup_20231023.gz

# Drop existing data before restore
mongorestore --uri="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker" --drop /backup/mongodb/20231023
```

### Automated backup script

```bash
# Create backup script
sudo nano /usr/local/bin/mongodb-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/backup/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)
MONGO_URI="mongodb://creditadmin:your_password@localhost:27017/creditcard_checker"

# Create backup directory
mkdir -p $BACKUP_DIR

# Perform backup
mongodump --uri="$MONGO_URI" --gzip --archive=$BACKUP_DIR/backup_$DATE.gz

# Keep only last 7 days
find $BACKUP_DIR -name "backup_*.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.gz"
```

```bash
# Make executable
sudo chmod +x /usr/local/bin/mongodb-backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/mongodb-backup.sh >> /var/log/mongodb-backup.log 2>&1
```

---

## 🚀 PM2 Process Manager

### Start applications

```bash
cd /opt/apps/creditv2

# Start backend
cd backend
pm2 start npm --name "backend" -- start

# Start frontend
cd ../frontend
pm2 start npm --name "frontend" -- start

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
# Follow the command it outputs
```

### PM2 Commands

```bash
# List all processes
pm2 list

# View logs
pm2 logs backend
pm2 logs frontend
pm2 logs --lines 100

# Restart
pm2 restart backend
pm2 restart frontend
pm2 restart all

# Stop
pm2 stop backend
pm2 stop all

# Delete
pm2 delete backend
pm2 delete all

# Monitor
pm2 monit

# Show process info
pm2 show backend
```

### PM2 Ecosystem file (recommended)

```bash
cd /opt/apps/creditv2
nano ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'backend',
      cwd: './backend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'frontend',
      cwd: './frontend',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '500M',
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
}
```

```bash
# Start with ecosystem
pm2 start ecosystem.config.js

# Save
pm2 save
```

---

## 🔌 Socket.IO Configuration

### Backend Socket.IO setup

File: `backend/src/server.js`

```javascript
const { Server } = require('socket.io');
const io = new Server(serverHttp, {
  cors: { 
    origin: '*',
    methods: ['GET','POST','PUT','DELETE','OPTIONS'],
    credentials: true
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  allowEIO3: true
});
```

### Frontend Socket.IO setup

File: `frontend/src/hooks/use-socket.ts`

```typescript
import { io } from 'socket.io-client';

const socket = io('https://your-domain.com', {
  path: '/socket.io/',
  transports: ['polling', 'websocket'],
  reconnection: true,
  withCredentials: true
});
```

### Nginx Socket.IO proxy

```nginx
location /socket.io/ {
    proxy_pass http://localhost:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
}
```

### Testing Socket.IO

```bash
# Install socket.io-client globally
npm install -g socket.io-client

# Test connection
socket.io-client https://your-domain.com -p /socket.io/
```

---

## 📚 API Documentation

### Authentication

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "login": "username_or_email",
  "password": "password"
}

# Response
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

#### Check Card
```bash
POST /api/checker/start
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "cards": [
    {
      "cardNumber": "4532123456789012",
      "expiryMonth": "12",
      "expiryYear": "2025",
      "cvv": "123"
    }
  ],
  "checkType": 1
}
```

Full API documentation: `https://your-domain.com/dashboard/api-docs`

---

## 🐛 Troubleshooting

### MongoDB connection failed
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check connection
mongosh "mongodb://localhost:27017"

# View logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Redis connection failed
```bash
# Check Redis status
sudo systemctl status redis

# Test connection
redis-cli ping

# View logs
sudo tail -f /var/log/redis/redis-server.log
```

### Nginx errors
```bash
# Test config
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/checkcc_error.log

# Restart
sudo systemctl restart nginx
```

### PM2 process crashed
```bash
# View logs
pm2 logs backend --lines 100
pm2 logs frontend --lines 100

# Restart
pm2 restart all

# Reset
pm2 delete all
pm2 start ecosystem.config.js
pm2 save
```

### Socket.IO not connecting
```bash
# Check backend logs
pm2 logs backend | grep -i socket

# Test with curl
curl -v https://your-domain.com/socket.io/?EIO=4&transport=polling

# Check Nginx config
sudo nginx -t
```

### Port already in use
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill process
kill -9 PID

# Or use fuser
sudo fuser -k 5000/tcp
```

---

## 📝 License

Proprietary - All rights reserved

---

## 👨‍💻 Developer

**Hoàng Anh Dev**
- Email: hoanganhdev1805@gmail.com
- Phone: 0869.575.664
- GitHub: [@HoangAnhDev1805](https://github.com/HoangAnhDev1805)

---

## 🆘 Support

For issues or support:
1. Check [Troubleshooting](#troubleshooting) section
2. View application logs: `pm2 logs`
3. Contact developer

---

**Last updated**: October 23, 2025
