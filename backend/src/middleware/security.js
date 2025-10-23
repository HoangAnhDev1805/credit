const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('../config/logger');
const SiteConfig = require('../models/SiteConfig');

// Rate limit cache with TTL
let rateLimitCache = {
  enabled: true,
  auth: { windowMs: 900000, max: 1000000 },
  api: { windowMs: 60000, max: 1000000 },
  cardCheck: { windowMs: 300000, max: 999999999 },
  lastUpdate: Date.now()
};
const CACHE_TTL = 30000; // 30 seconds

// Rate limiting configuration helper
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false, extraOptions = {}) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}, User-Agent: ${req.get('User-Agent')}`);
      res.status(429).json({
        success: false,
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    },
    ...extraOptions
  });
};

// Pre-create rate limiters
let authLimiterInstance = createRateLimit(
  rateLimitCache.auth.windowMs,
  rateLimitCache.auth.max,
  'Too many authentication attempts, please try again later',
  true
);

let apiLimiterInstance = createRateLimit(
  rateLimitCache.api.windowMs,
  rateLimitCache.api.max,
  'Too many API requests, please try again later',
  false
);

let cardCheckLimiterInstance = createRateLimit(
  rateLimitCache.cardCheck.windowMs,
  rateLimitCache.cardCheck.max,
  'Too many card check requests, please try again later',
  false
);

// Function to load rate limits from database
async function loadRateLimitsFromDB() {
  try {
    const configs = await SiteConfig.find({ category: 'ratelimit' }).lean();
    const configMap = {};
    configs.forEach(c => { configMap[c.key] = c.value; });
    
    rateLimitCache = {
      enabled: configMap.ratelimit_enabled !== false,
      auth: {
        windowMs: Number(configMap.ratelimit_auth_window_ms) || 900000,
        max: Number(configMap.ratelimit_auth_max) || 1000000
      },
      api: {
        windowMs: Number(configMap.ratelimit_api_window_ms) || 60000,
        max: Number(configMap.ratelimit_api_max) || 1000000
      },
      cardCheck: {
        windowMs: Number(configMap.ratelimit_cardcheck_window_ms) || 300000,
        max: Number(configMap.ratelimit_cardcheck_max) || 999999999
      },
      lastUpdate: Date.now()
    };
    return rateLimitCache;
  } catch (err) {
    logger.warn('Failed to load rate limits from DB, using defaults:', err.message);
    return rateLimitCache;
  }
}

// Initial load
loadRateLimitsFromDB().catch(() => {});

// Auto-refresh rate limits every 30s
// Note: We only update cache, not recreate limiters to avoid ERR_ERL_CREATED_IN_REQUEST_HANDLER
setInterval(() => {
  loadRateLimitsFromDB().catch(() => {});
}, CACHE_TTL);

// General rate limiting - increased for better UX
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5000, // limit each IP to 5000 requests per windowMs (increased from 1000)
  'Too many requests from this IP, please try again later',
  false,
  {
    // Bỏ qua một số endpoint trong môi trường dev và các endpoint GET công khai
    skip: (req) => {
      const env = process.env.NODE_ENV || 'development';
      const url = req.originalUrl || '';
      const clientIP = req.ip || req.connection?.remoteAddress || '';
      
      // Always skip rate limit in development mode
      if (env !== 'production') return true;
      
      // Skip for localhost/127.0.0.1 (admin local access)
      if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'localhost' || clientIP.includes('127.0.0.1')) {
        return true;
      }
      
      // Skip for admin users (if authenticated)
      if (req.user && req.user.role === 'admin') {
        return true;
      }
      
      // Cho phép POST API dành cho ZennoPoster không bị chặn bởi limiter tổng
      if (url.startsWith('/api/post/') || url.startsWith('/api/checkcc')) {
        return true;
      }
      
      if (req.method === 'GET' && (
        url.startsWith('/api/config/public') ||
        url.startsWith('/api/config/pricing-tiers') ||
        url.startsWith('/api/health') ||
        url.startsWith('/api/status') ||
        url.startsWith('/api/docs')
      )) {
        return true;
      }
      return false;
    }
  }
);

// Dynamic auth limiter wrapper
const authLimiter = (req, res, next) => {
  // Skip if rate limiting disabled
  if (!rateLimitCache.enabled) {
    return next();
  }
  
  // Skip for localhost
  const clientIP = req.ip || req.connection?.remoteAddress || '';
  const forwardedFor = req.headers['x-forwarded-for'] || '';
  if (clientIP === '127.0.0.1' || clientIP === '::1' || 
      clientIP.includes('127.0.0.1') || forwardedFor.includes('127.0.0.1') || 
      forwardedFor.includes('::1')) {
    return next();
  }
  
  // Use pre-created limiter
  return authLimiterInstance(req, res, next);
};

// Dynamic API limiter wrapper
const apiLimiter = (req, res, next) => {
  // Skip if rate limiting disabled
  if (!rateLimitCache.enabled) {
    return next();
  }
  
  // Skip for localhost and admin
  const clientIP = req.ip || req.connection?.remoteAddress || '';
  if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.includes('127.0.0.1')) {
    return next();
  }
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  // Use pre-created limiter
  return apiLimiterInstance(req, res, next);
};

// Dynamic card check limiter wrapper
const cardCheckLimiter = (req, res, next) => {
  // Skip if rate limiting disabled
  if (!rateLimitCache.enabled) {
    return next();
  }
  
  // Skip for localhost and admin
  const clientIP = req.ip || req.connection?.remoteAddress || '';
  if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP.includes('127.0.0.1')) {
    return next();
  }
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  // Use pre-created limiter
  return cardCheckLimiterInstance(req, res, next);
};

// File upload rate limiting
const uploadLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  20, // limit each IP to 20 uploads per hour
  'Too many file uploads, please try again later'
);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'https://checkcc.live',
      'https://checkcc.live',
      'https://www.checkcc.live',
      'http://checkcc.live',
      'http://www.checkcc.live',

    ];
    

    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'Pragma'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  maxAge: 86400 // 24 hours
};

// Helmet configuration for security headers
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};

// MongoDB injection prevention
const mongoSanitizeConfig = {
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logger.warn(`MongoDB injection attempt detected: ${key} from IP: ${req.ip}`);
  }
};

// HTTP Parameter Pollution prevention
const hppConfig = {
  whitelist: ['sort', 'fields', 'page', 'limit', 'status', 'type']
};

// Security middleware for logging suspicious activities
const securityLogger = (req, res, next) => {
  // Log suspicious patterns
  const suspiciousPatterns = [
    /(\<script\>|\<\/script\>)/gi, // XSS attempts
    /(union|select|insert|delete|update|drop|create|alter)/gi, // SQL injection attempts
    /(\$where|\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin)/gi, // MongoDB injection attempts
    /(javascript:|data:|vbscript:)/gi, // Protocol injection
    /(\.\.\/)|(\.\.\\)/gi, // Path traversal
    /(eval\(|setTimeout\(|setInterval\()/gi // Code injection
  ];

  const userAgent = req.get('User-Agent') || '';
  const requestBody = JSON.stringify(req.body);
  const requestQuery = JSON.stringify(req.query);
  const requestParams = JSON.stringify(req.params);

  const allRequestData = `${userAgent} ${requestBody} ${requestQuery} ${requestParams}`;

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(allRequestData)) {
      logger.warn(`Suspicious activity detected from IP: ${req.ip}`, {
        ip: req.ip,
        userAgent,
        method: req.method,
        url: req.originalUrl,
        body: req.body,
        query: req.query,
        params: req.params,
        pattern: pattern.toString()
      });
      break;
    }
  }

  next();
};

// IP whitelist/blacklist middleware
const ipFilter = (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Blacklisted IPs (can be stored in database or config)
  const blacklistedIPs = process.env.BLACKLISTED_IPS ? 
    process.env.BLACKLISTED_IPS.split(',') : [];
  
  if (blacklistedIPs.includes(clientIP)) {
    logger.warn(`Blocked request from blacklisted IP: ${clientIP}`);
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Whitelisted IPs for admin endpoints (optional)
  const adminWhitelistedIPs = process.env.ADMIN_WHITELISTED_IPS ? 
    process.env.ADMIN_WHITELISTED_IPS.split(',') : [];
  
  if (req.originalUrl.startsWith('/api/admin') && adminWhitelistedIPs.length > 0) {
    if (!adminWhitelistedIPs.includes(clientIP)) {
      logger.warn(`Blocked admin access from non-whitelisted IP: ${clientIP}`);
      return res.status(403).json({
        success: false,
        message: 'Admin access denied from this IP'
      });
    }
  }

  next();
};

// Request size limiter
const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    const maxSizeBytes = typeof maxSize === 'string' ? 
      parseInt(maxSize) * 1024 * 1024 : maxSize;

    if (contentLength > maxSizeBytes) {
      logger.warn(`Request too large from IP: ${req.ip}, Size: ${contentLength}`);
      return res.status(413).json({
        success: false,
        message: 'Request entity too large'
      });
    }

    next();
  };
};

// Maintenance mode middleware
const maintenanceMode = async (req, res, next) => {
  try {
    // Skip maintenance check for health endpoints
    if (req.originalUrl === '/api/health' || req.originalUrl === '/health') {
      return next();
    }

    // Check if maintenance mode is enabled
    const SiteConfig = require('../models/SiteConfig');
    const maintenanceEnabled = await SiteConfig.getByKey('maintenance_mode');

    if (maintenanceEnabled) {
      return res.status(503).json({
        success: false,
        message: 'System is under maintenance. Please try again later.',
        maintenanceMode: true
      });
    }

    next();
  } catch (error) {
    logger.error('Maintenance mode check error:', error);
    next(); // Continue if there's an error checking maintenance mode
  }
};

module.exports = {
  generalLimiter,
  authLimiter,
  apiLimiter,
  cardCheckLimiter,
  uploadLimiter,
  corsOptions,
  helmetConfig,
  mongoSanitizeConfig,
  hppConfig,
  securityLogger,
  ipFilter,
  requestSizeLimiter,
  maintenanceMode,
  cors: cors(corsOptions),
  helmet: helmet(helmetConfig),
  mongoSanitize: mongoSanitize(mongoSanitizeConfig),
  hpp: hpp(hppConfig),
  // Rate limit utilities
  rateLimitCache,
  loadRateLimitsFromDB
};
