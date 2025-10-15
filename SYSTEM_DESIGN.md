# Thiết kế Hệ thống Quản lý và Kiểm tra Thẻ Tín dụng

## 1. KIẾN TRÚC TỔNG QUAN

### Tech Stack
- **Backend**: Node.js + Express.js + MongoDB
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Database**: MongoDB với Mongoose ODM
- **Authentication**: JWT + bcrypt
- **Deployment**: Docker + Docker Compose
- **Security**: Helmet, CORS, Rate Limiting, Input Validation

### Cấu trúc Thư mục
```
project-root/
├── backend/                 # Node.js API Server
│   ├── src/
│   │   ├── controllers/     # API Controllers
│   │   ├── models/          # MongoDB Models
│   │   ├── routes/          # API Routes
│   │   ├── middleware/      # Custom Middleware
│   │   ├── services/        # Business Logic
│   │   ├── utils/           # Utilities
│   │   └── config/          # Configuration
│   ├── package.json
│   └── Dockerfile
├── frontend/                # Next.js Application
│   ├── src/
│   │   ├── app/             # App Router (Next.js 14)
│   │   ├── components/      # React Components
│   │   ├── lib/             # Utilities & Configs
│   │   ├── hooks/           # Custom Hooks
│   │   ├── types/           # TypeScript Types
│   │   └── styles/          # CSS Files
│   ├── public/              # Static Assets
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml       # Docker Orchestration
└── README.md               # Documentation
```

## 2. DATABASE SCHEMA (MongoDB Collections)

### users
```javascript
{
  _id: ObjectId,
  username: String (unique, required),
  email: String (unique, required),
  password: String (hashed, required),
  balance: Number (default: 0),
  role: String (enum: ['user', 'admin'], default: 'user'),
  status: String (enum: ['active', 'blocked'], default: 'active'),
  totalCardsSubmitted: Number (default: 0),
  totalLiveCards: Number (default: 0),
  totalDieCards: Number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```

### cards
```javascript
{
  _id: ObjectId,
  cardNumber: String (required, indexed),
  expiryMonth: String,
  expiryYear: String,
  cvv: String,
  fullCard: String, // Format: "4634051204317662|12|25|664"
  status: String (enum: ['live', 'die', 'unknown', 'checking'], required),
  userId: ObjectId (ref: 'User'),
  apiId: String, // ID từ API bên ngoài
  checkedAt: Date,
  price: Number,
  typeCheck: Number, // 1=CheckLive, 2=CheckCharge
  createdAt: Date,
  updatedAt: Date
}
```

### payment_methods
```javascript
{
  _id: ObjectId,
  name: String (required), // Tên ngân hàng
  accountNumber: String (required),
  accountName: String (required),
  qrCode: String, // URL hoặc base64 của QR code
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### payment_requests
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  amount: Number (required),
  paymentMethodId: ObjectId (ref: 'PaymentMethod', required),
  proofImage: String, // URL của ảnh chứng từ
  status: String (enum: ['pending', 'approved', 'rejected'], default: 'pending'),
  adminNote: String,
  processedBy: ObjectId (ref: 'User'), // Admin xử lý
  processedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### pricing_config
```javascript
{
  _id: ObjectId,
  minCards: Number (required),
  maxCards: Number, // null = unlimited
  pricePerCard: Number (required),
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### site_config
```javascript
{
  _id: ObjectId,
  key: String (unique, required), // 'seo_title', 'seo_description', etc.
  value: String (required),
  type: String (enum: ['text', 'textarea', 'number', 'boolean', 'json']),
  category: String, // 'seo', 'general', 'pricing', etc.
  updatedAt: Date
}
```

### transactions
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: 'User', required),
  type: String (enum: ['deposit', 'card_check', 'refund'], required),
  amount: Number (required),
  description: String,
  balanceBefore: Number,
  balanceAfter: Number,
  relatedId: ObjectId, // ID của card hoặc payment_request
  createdAt: Date
}
```

## 3. API ENDPOINTS

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- PUT /api/auth/profile

### Cards
- POST /api/cards/check - Kiểm tra thẻ tín dụng
- GET /api/cards/history - Lịch sử thẻ của user
- POST /api/cards/generate - Tạo số thẻ tín dụng

### Payments
- GET /api/payments/methods - Lấy danh sách phương thức thanh toán
- POST /api/payments/request - Tạo yêu cầu nạp tiền
- GET /api/payments/requests - Lịch sử yêu cầu nạp tiền

### Admin
- GET /api/admin/dashboard - Thống kê tổng quan
- GET /api/admin/users - Quản lý users
- PUT /api/admin/users/:id - Cập nhật user
- GET /api/admin/cards - Quản lý thẻ
- GET /api/admin/payments/methods - Quản lý phương thức thanh toán
- POST /api/admin/payments/methods - Tạo phương thức thanh toán
- PUT /api/admin/payments/methods/:id - Cập nhật phương thức thanh toán
- DELETE /api/admin/payments/methods/:id - Xóa phương thức thanh toán
- GET /api/admin/payments/requests - Quản lý yêu cầu thanh toán
- PUT /api/admin/payments/requests/:id - Duyệt/từ chối yêu cầu
- GET /api/admin/config - Lấy cấu hình website
- PUT /api/admin/config - Cập nhật cấu hình website

## 4. TÍCH HỢP API BÊN NGOÀI

### Service: ExternalCardAPI
```javascript
class ExternalCardAPI {
  // Lấy thẻ để kiểm tra
  async getCardsToCheck(token, amount, typeCheck) {
    // Call: http://160.25.168.79/api/TrungLOL.aspx?token=abc&LoaiDV=1&Device=test&Amount=10&TypeCheck=2
  }
  
  // Cập nhật trạng thái thẻ
  async updateCardStatus(token, id, status, state, from, msg) {
    // Call: http://160.25.168.79/api/TrungLOL.aspx?token=abc&LoaiDV=2&Device=test&Id=3359834&Status=3&State=0&From=0&Msg=msg
  }
}
```

## 5. SECURITY MEASURES

### Backend Security
- JWT Authentication với refresh token
- Password hashing với bcrypt (salt rounds: 12)
- Rate limiting (express-rate-limit)
- Input validation và sanitization (joi, express-validator)
- CORS configuration
- Helmet.js cho security headers
- MongoDB injection prevention
- XSS protection
- CSRF protection

### Frontend Security
- CSP (Content Security Policy)
- Input sanitization
- Secure cookie handling
- Environment variables protection
- API endpoint validation

## 6. PERFORMANCE OPTIMIZATION

### Database
- Indexing cho các trường tìm kiếm thường xuyên
- Pagination cho large datasets
- Aggregation pipelines cho complex queries
- Connection pooling

### Frontend
- Code splitting
- Lazy loading components
- Image optimization
- Caching strategies
- Bundle optimization

### Caching Strategy
- Redis cho session storage
- Database query caching
- API response caching
- Static asset caching

## 7. MONITORING & LOGGING

### Logging
- Winston logger cho backend
- Request/response logging
- Error tracking
- Performance monitoring

### Health Checks
- Database connection health
- External API health
- System resource monitoring

## 8. DEPLOYMENT STRATEGY

### Docker Configuration
- Multi-stage builds
- Environment-specific configs
- Auto port detection
- Health checks
- Volume management

### Production Considerations
- Load balancing
- SSL/TLS configuration
- Backup strategies
- Monitoring setup
- CI/CD pipeline
