const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');
const SiteConfig = require('../models/SiteConfig');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      const user = await User.findById(decoded.id).select('-password -refreshToken');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        const tg = (await SiteConfig.getByKey('telegram_support_url'))
          || (await SiteConfig.getByKey('telegram_support'))
          || '';
        res.setHeader('X-Account-Blocked', '1');
        return res.status(403).json({
          success: false,
          message: 'Your account has been locked. Please contact Telegram support to get assistance.',
          support: { telegram: tg }
        });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error('Token verification failed:', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }

    next();
  };
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).select('-password -refreshToken');

        if (user && user.status === 'active') {
          req.user = user;
        }
      } catch (error) {
        // Token is invalid, but we don't fail the request
        logger.warn('Invalid token in optional auth:', error.message);
      }
    }

    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

// Check if user owns the resource
const checkOwnership = (resourceUserIdField = 'userId') => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized to access this route'
        });
      }

      // Admin can access all resources
      if (req.user.role === 'admin') {
        return next();
      }

      // Get resource ID from params or body
      const resourceId = req.params.id || req.body.id;
      
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          message: 'Resource ID is required'
        });
      }

      // This is a generic middleware, specific ownership checks should be done in controllers
      req.resourceId = resourceId;
      next();
    } catch (error) {
      logger.error('Ownership check middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error in ownership check'
      });
    }
  };
};

// Rate limiting per user
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user._id.toString();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get user's request history
    let userRequestHistory = userRequests.get(userId) || [];

    // Remove old requests outside the window
    userRequestHistory = userRequestHistory.filter(timestamp => timestamp > windowStart);

    // Check if user has exceeded the limit
    if (userRequestHistory.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    userRequestHistory.push(now);
    userRequests.set(userId, userRequestHistory);

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance
      for (const [key, requests] of userRequests.entries()) {
        const filteredRequests = requests.filter(timestamp => timestamp > windowStart);
        if (filteredRequests.length === 0) {
          userRequests.delete(key);
        } else {
          userRequests.set(key, filteredRequests);
        }
      }
    }

    next();
  };
};

// Check if user has sufficient balance
const checkBalance = (amountField = 'amount') => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized to access this route'
        });
      }

      const amount = req.body[amountField] || req.query[amountField];
      
      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Valid amount is required'
        });
      }

      if (req.user.balance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance',
          currentBalance: req.user.balance,
          requiredAmount: amount
        });
      }

      next();
    } catch (error) {
      logger.error('Balance check middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error in balance check'
      });
    }
  };
};

// Refresh token middleware
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      // Get user and check if refresh token matches
      const user = await User.findById(decoded.id).select('+refreshToken');

      if (!user || user.refreshToken !== refreshToken) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Check if user is active
      if (user.status !== 'active') {
        const tg = (await SiteConfig.getByKey('telegram_support_url'))
          || (await SiteConfig.getByKey('telegram_support'))
          || '';
        res.setHeader('X-Account-Blocked', '1');
        return res.status(403).json({
          success: false,
          message: 'Your account has been locked. Please contact Telegram support to get assistance.',
          support: { telegram: tg }
        });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error('Refresh token verification failed:', error);
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
  } catch (error) {
    logger.error('Refresh token middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in token refresh'
    });
  }
};

// Protect routes but allow Token to be provided via body/query as well as Authorization header
// Accepts:
// - Authorization: Bearer <jwt>
// - body.Token or query.Token (optionally prefixed with 'Bearer ')
const protectToken = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      const headerToken = req.get('Token') || req.get('token') || req.get('x-token') || req.get('x-api-token');
      const raw = headerToken || (req.body && (req.body.Token || req.body.token)) || (req.query && (req.query.Token || req.query.token));
      if (typeof raw === 'string' && raw.length > 0) {
        token = raw.startsWith('Bearer ') ? raw.split(' ')[1] : raw;
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshToken');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'No user found with this token'
        });
      }

      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'User account is blocked'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error('Token verification failed (protectToken):', error);
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    logger.error('Auth protectToken middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  checkOwnership,
  userRateLimit,
  checkBalance,
  refreshToken,
  protectToken
};
