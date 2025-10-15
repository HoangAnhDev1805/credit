# Credit Card Checker System

Hệ thống quản lý và kiểm tra thẻ tín dụng hoàn chỉnh với giao diện hiện đại và tính năng bảo mật cao.

## 🚀 Tính năng chính

### Người dùng
- ✅ Đăng ký/Đăng nhập bảo mật
- ✅ Card Generator - Tạo số thẻ tín dụng
- ✅ Kiểm tra thẻ tín dụng với API bên ngoài
- ✅ Quản lý số dư và nạp tiền
- ✅ Lịch sử giao dịch chi tiết

### Admin
- ✅ Dashboard thống kê tổng quan
- ✅ Quản lý người dùng
- ✅ Quản lý thẻ tín dụng
- ✅ Quản lý thanh toán
- ✅ Cấu hình website và SEO

### Giao diện
- ✅ Responsive design (Mobile, Tablet, Desktop)
- ✅ Dark/Light mode
- ✅ Đa ngôn ngữ (Tiếng Việt, English)
- ✅ Animation mượt mà
- ✅ SEO tối ưu

## 🛠 Công nghệ sử dụng

### Backend
- **Node.js** + **Express.js** - API Server
- **MongoDB** + **Mongoose** - Database
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **Helmet** - Security headers
- **Rate Limiting** - API protection

### Frontend
- **Next.js 14** - React Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **React Hook Form** - Form handling
- **Zustand** - State management

### DevOps
- **Docker** + **Docker Compose** - Containerization
- **Auto Port Detection** - Tránh xung đột port
- **Health Checks** - Monitoring
- **Multi-stage builds** - Optimization

## 📦 Cài đặt và chạy

### Yêu cầu hệ thống
- Node.js >= 18.0.0
- Docker Desktop
- MongoDB (hoặc sử dụng Docker)

### 1. Clone repository
```bash
git clone <repository-url>
cd credit-card-checker
```

### 2. Cấu hình environment variables
```bash
# Backend
cp backend/.env.example backend/.env
# Chỉnh sửa các giá trị trong backend/.env

# Frontend  
cp frontend/.env.example frontend/.env.local
# Chỉnh sửa các giá trị trong frontend/.env.local
```

### 3. Chạy với Docker (Khuyến nghị)
```bash
# Chạy toàn bộ hệ thống
docker-compose up -d

# Xem logs
docker-compose logs -f

# Dừng hệ thống
docker-compose down
```

### 4. Chạy development mode
```bash
# Cài đặt dependencies
cd backend && npm install
cd ../frontend && npm install

# Chạy MongoDB (nếu không dùng Docker)
mongod

# Chạy backend
cd backend && npm run dev

# Chạy frontend (terminal mới)
cd frontend && npm run dev
```

## 🌐 Truy cập ứng dụng

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **MongoDB**: mongodb://localhost:27017

### Tài khoản admin mặc định
- **Username**: admin
- **Password**: admin123

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Thông tin user

### Cards
- `POST /api/cards/check` - Kiểm tra thẻ
- `GET /api/cards/history` - Lịch sử thẻ
- `POST /api/cards/generate` - Tạo số thẻ

### Admin
- `GET /api/admin/dashboard` - Thống kê
- `GET /api/admin/users` - Quản lý users
- `GET /api/admin/cards` - Quản lý thẻ

## 🔒 Bảo mật

### Backend Security
- JWT Authentication với refresh token
- Password hashing (bcrypt, salt rounds: 12)
- Rate limiting (100 requests/15 minutes)
- Input validation và sanitization
- MongoDB injection prevention
- XSS protection
- CORS configuration
- Security headers (Helmet.js)

### Frontend Security
- CSP (Content Security Policy)
- Input sanitization
- Secure cookie handling
- Environment variables protection

## 🚀 Deployment

### Production với Docker
```bash
# Build và chạy production
docker-compose -f docker-compose.yml up -d

# Scale services
docker-compose up -d --scale backend=2 --scale frontend=2
```

### Environment Variables Production
```bash
# Backend
NODE_ENV=production
JWT_SECRET=your-super-secret-key
MONGODB_URI=mongodb://user:pass@host:port/db

# Frontend
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
```

## 📊 Monitoring

### Health Checks
- Backend: `GET /api/health`
- Frontend: `GET /`
- Database: Connection monitoring

### Logging
- Winston logger cho backend
- Request/response logging
- Error tracking
- Performance monitoring

## 🧪 Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests  
cd frontend && npm test

# E2E tests
npm run test:e2e
```

## 📝 Cấu trúc Database

### Collections
- `users` - Thông tin người dùng
- `cards` - Dữ liệu thẻ tín dụng
- `payment_methods` - Phương thức thanh toán
- `payment_requests` - Yêu cầu nạp tiền
- `pricing_config` - Cấu hình giá
- `site_config` - Cấu hình website
- `transactions` - Lịch sử giao dịch

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Tạo Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 📞 Hỗ trợ

- Email: support@creditcardchecker.com
- Documentation: [Wiki](link-to-wiki)
- Issues: [GitHub Issues](link-to-issues)
