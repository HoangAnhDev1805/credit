require('dotenv').config();

const express = require('express');
const compression = require('compression');
const connectDB = require('./config/database');
const logger = require('./config/logger');
const { errorHandler, notFound, gracefulShutdown } = require('./middleware/errorHandler');
const {
  cors,
  helmet,
  mongoSanitize,
  hpp,
  generalLimiter,
  securityLogger,
  ipFilter,
  requestSizeLimiter,
  maintenanceMode
} = require('./middleware/security');

// Import routes (will be created later)
// const authRoutes = require('./routes/auth');
// const cardRoutes = require('./routes/cards');
// const paymentRoutes = require('./routes/payments');
// const adminRoutes = require('./routes/admin');

const app = express();

// Trust proxy (for accurate IP addresses behind reverse proxy)
app.set('trust proxy', 1);

// Connect to database
connectDB();

// Security middleware
app.use(helmet);
app.use(cors);
app.use(mongoSanitize);
app.use(hpp);
app.use(securityLogger);
app.use(ipFilter);
app.use(requestSizeLimiter());

// Rate limiting
app.use(generalLimiter);

// Body parsing middleware
app.use('/api/payments/cryptapi/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Maintenance mode check
app.use(maintenanceMode);

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = require('crypto').randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// Background sweeper: auto-timeout cards if ZennoPoster doesn't return in time
try {
  const Card = require('./models/Card');
  const SiteConfig = require('./models/SiteConfig');
  setInterval(async () => {
    try {
      const now = new Date();
      const timeoutSec = Number(await SiteConfig.getByKey('checker_card_timeout_sec')) || 120;
      // If card has explicit checkDeadlineAt past now OR lastCheckAt older than timeout, mark unknown
      const threshold = new Date(Date.now() - timeoutSec * 1000);
      const res = await Card.updateMany(
        {
          zennoposter: 0,
          status: { $in: ['pending', 'checking'] },
          $or: [
            { checkDeadlineAt: { $exists: true, $lte: now } },
            { checkDeadlineAt: { $exists: false }, lastCheckAt: { $lte: threshold } }
          ]
        },
        {
          $set: {
            status: 'unknown',
            errorMessage: 'Timeout by system',
            updatedAt: new Date()
          }
        }
      );
      if (res && res.modifiedCount) {
        console.log(`[Sweeper] Auto-timeout ${res.modifiedCount} cards to unknown`);
      }
    } catch (e) {
      console.error('Sweeper error:', e.message);
    }
  }, 15000);
} catch (e) {
  console.error('Failed to start sweeper:', e.message);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user ? req.user._id : null
    });
  });

  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API status endpoint
app.get('/api/status', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const ExternalCardAPI = require('./services/ExternalCardAPI');

    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check external API
    const externalApiHealth = await ExternalCardAPI.healthCheck();

    res.status(200).json({
      success: true,
      status: {
        server: 'running',
        database: dbStatus,
        externalAPI: externalApiHealth.status,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Status check failed',
      error: error.message
    });
  }
});

// API routes
app.use('/api', (req, res, next) => {
  res.setHeader('X-API-Version', '1.0');
  next();
});

// Mount routes (will be uncommented when routes are created)
// app.use('/api/auth', authRoutes);
// app.use('/api/cards', cardRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/admin', adminRoutes);

// Temporary route for testing
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/cards', require('./routes/cards'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/config', require('./routes/config'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/post', require('./routes/post'));
app.use('/api/gates', require('./routes/gate'));
app.use('/api', require('./routes/checker'));
app.use('/api', require('./routes/checkcc'));
// Webhook alias (compat): allow /webhooks/cryptapi to hit the same handler
try {
  const { handleCryptApiWebhook } = require('./controllers/cryptApiController');
  app.post('/webhooks/cryptapi', handleCryptApiWebhook);
} catch (_) {}


// Serve static files (uploads) - use absolute path
const path = require('path');
const uploadsPath = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsPath));

// API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.json({
    success: true,
    message: 'Credit Card Checker API Documentation',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new user',
        'POST /api/auth/login': 'User login',
        'POST /api/auth/logout': 'User logout',
        'GET /api/auth/me': 'Get current user',
        'PUT /api/auth/profile': 'Update user profile'
      },
      cards: {
        'POST /api/cards/check': 'Check credit cards',
        'GET /api/cards/history': 'Get card check history',
        'POST /api/cards/generate': 'Generate credit card numbers'
      },
      payments: {
        'GET /api/payments/methods': 'Get payment methods',
        'POST /api/payments/request': 'Create payment request',
        'GET /api/payments/requests': 'Get payment requests'
      },
      admin: {
        'GET /api/admin/dashboard': 'Admin dashboard',
        'GET /api/admin/users': 'Manage users',
        'GET /api/admin/cards': 'Manage cards',
        'GET /api/admin/payments': 'Manage payments'
      }
    }
  });
});

// 404 handler
app.use(notFound);

// Error handler
app.use(errorHandler);

// Start server with automatic port fallback (handles EADDRINUSE)
function startServerWithFallback(initialPort, maxAttempts = 10) {
  return new Promise((resolve) => {
    let port = Number(initialPort) || 5001;
    let attempts = 0;
    let srv;

    const tryListen = () => {
      attempts += 1;
      srv = app.listen(port, () => {
        logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${port}`);
        
        // Banner khởi động tiếng Việt
        console.log('\n' + '='.repeat(70));
        console.log('🚀  CREDIT CARD CHECKER - HỆ THỐNG KIỂM TRA THẺ TÍN DỤNG');
        console.log('='.repeat(70));
        console.log(`📡  Server đang chạy trên cổng: ${port}`);
        console.log(`🌐  Môi trường: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📚  API Documentation: https://checkcc.live/api/docs`);
        console.log(`❤️   Health Check: https://checkcc.live/api/health`);
        console.log('─'.repeat(70));
        console.log('👨‍💻  Phát triển bởi: Dev Hoàng Anh');
        console.log('📞  Liên hệ: 0869.575.664');
        console.log('📧  Email: hoanganhdev1805@gmail.com');
        console.log('='.repeat(70) + '\n');
        
        // Graceful shutdown
        gracefulShutdown(srv);
        resolve(srv);
      });

      srv.on('error', (err) => {
        if (err && err.code === 'EADDRINUSE' && attempts < maxAttempts) {
          console.warn(`Port ${port} in use. Trying ${port + 1}...`);
          port += 1;
          setTimeout(tryListen, 200);
        } else {
          console.error('Failed to start server:', err);
          process.exit(1);
        }
      });
    };

    tryListen();
  });
}

const desiredPort = process.env.PORT || 5001;
let server;
startServerWithFallback(desiredPort).then((srv) => { server = srv; });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  console.log('Shutting down the server due to Unhandled Promise rejection');
  if (server) server.close(() => process.exit(1));
  else process.exit(1);
});

// Export app for testing
module.exports = app;
