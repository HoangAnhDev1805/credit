const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('../config/logger');

// Rate limiting configuration
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

// General rate limiting - increased for better UX
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  300, // limit each IP to 300 requests per windowMs (increased from 100)
  'Too many requests from this IP, please try again later',
  false,
  {
    // Bỏ qua một số endpoint trong môi trường dev và các endpoint GET công khai
    skip: (req) => {
      const env = process.env.NODE_ENV || 'development';
      const url = req.originalUrl || '';
      if (env !== 'production') return true; // dev/test: bỏ qua limiter tổng
      // Cho phép POST API dành cho ZennoPoster không bị chặn bởi limiter tổng
      if (url.startsWith('/api/post/')) {
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

// Strict rate limiting for auth endpoints - relaxed for development
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  500, // limit each IP to 500 requests per windowMs (increased for dev)
  'Too many authentication attempts, please try again later',
  true // skip successful requests
);

// API rate limiting - increased for dashboard usage
const apiLimiter = createRateLimit(
  1 * 60 * 1000, // 1 minute
  100, // limit each IP to 100 requests per minute (increased from 30)
  'Too many API requests, please try again later'
);

// Card check rate limiting - increased for better functionality
const cardCheckLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  50, // limit each IP to 50 card check requests per 5 minutes (increased from 10)
  'Too many card check requests, please try again later'
);

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
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001'
    ];
    
    if (process.env.NODE_ENV === 'development') {
      // In development, allow any localhost origin
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
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
  hpp: hpp(hppConfig)
};
