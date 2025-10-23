const crypto = require('crypto');
const logger = require('../config/logger');
const SiteConfig = require('../models/SiteConfig');

/**
 * HMAC signature validation for ZennoPoster requests
 * 
 * Client (ZennoPoster) computes:
 *   signature = HMAC-SHA256(secret, method + path + body)
 *   
 * Headers:
 *   X-Signature: <hex_signature>
 *   X-Timestamp: <unix_timestamp_ms>
 *   
 * Server validates:
 *   - Timestamp not too old (5 min window)
 *   - Signature matches
 */
exports.validateHMAC = async (req, res, next) => {
  try {
    // Check if HMAC validation is enabled
    const hmacEnabled = await SiteConfig.getByKey('zenno_hmac_enabled');
    if (!hmacEnabled || hmacEnabled === '0' || hmacEnabled === 'false') {
      return next(); // Skip validation if disabled
    }

    const signature = req.get('X-Signature') || req.get('x-signature');
    const timestamp = req.get('X-Timestamp') || req.get('x-timestamp');

    if (!signature || !timestamp) {
      logger.warn('HMAC validation failed: missing signature or timestamp', {
        ip: req.ip,
        path: req.path
      });
      return res.status(401).json({
        ErrorId: 1,
        Title: 'Unauthorized',
        Message: 'Missing signature or timestamp',
        Content: ''
      });
    }

    // Validate timestamp (5 minute window)
    const now = Date.now();
    const reqTime = parseInt(timestamp, 10);
    const timeDiff = Math.abs(now - reqTime);
    const maxAge = 5 * 60 * 1000; // 5 minutes

    if (timeDiff > maxAge) {
      logger.warn('HMAC validation failed: timestamp too old', {
        ip: req.ip,
        timeDiff: timeDiff / 1000,
        maxAge: maxAge / 1000
      });
      return res.status(401).json({
        ErrorId: 1,
        Title: 'Unauthorized',
        Message: 'Request timestamp expired',
        Content: ''
      });
    }

    // Get shared secret from config
    const secret = await SiteConfig.getByKey('zenno_hmac_secret');
    if (!secret || typeof secret !== 'string' || secret.length < 32) {
      logger.error('HMAC secret not configured or too short');
      return res.status(500).json({
        ErrorId: 1,
        Title: 'Server Error',
        Message: 'HMAC not configured',
        Content: ''
      });
    }

    // Compute expected signature
    const method = req.method;
    const path = req.path;
    const body = JSON.stringify(req.body || {});
    const message = `${method}${path}${timestamp}${body}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(message)
      .digest('hex');

    // Compare signatures (constant-time)
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      logger.warn('HMAC validation failed: signature mismatch', {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return res.status(401).json({
        ErrorId: 1,
        Title: 'Unauthorized',
        Message: 'Invalid signature',
        Content: ''
      });
    }

    // Signature valid
    next();
  } catch (error) {
    logger.error('HMAC validation error:', error);
    return res.status(500).json({
      ErrorId: 1,
      Title: 'Server Error',
      Message: 'HMAC validation failed',
      Content: ''
    });
  }
};

/**
 * IP allowlist for ZennoPoster requests
 * 
 * Config: zenno_ip_allowlist (comma-separated IPs or CIDR)
 * Example: "192.168.1.100,10.0.0.0/8"
 */
exports.validateIPAllowlist = async (req, res, next) => {
  try {
    // Check if IP allowlist is enabled
    const allowlistEnabled = await SiteConfig.getByKey('zenno_ip_allowlist_enabled');
    if (!allowlistEnabled || allowlistEnabled === '0' || allowlistEnabled === 'false') {
      return next(); // Skip validation if disabled
    }

    const allowlistStr = await SiteConfig.getByKey('zenno_ip_allowlist');
    if (!allowlistStr || typeof allowlistStr !== 'string') {
      logger.warn('IP allowlist enabled but not configured');
      return next(); // Allow if not configured
    }

    const allowedIPs = allowlistStr.split(',').map(ip => ip.trim()).filter(Boolean);
    if (allowedIPs.length === 0) {
      return next();
    }

    // Get client IP (trust proxy headers)
    const clientIP = req.ip || 
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.connection?.remoteAddress || 
                     '';

    // Simple IP matching (basic implementation, can be enhanced with CIDR)
    const isAllowed = allowedIPs.some(allowedIP => {
      // Exact match
      if (clientIP === allowedIP) return true;
      
      // Remove IPv6 prefix if present (::ffff:192.168.1.1)
      const normalizedClient = clientIP.replace(/^::ffff:/, '');
      const normalizedAllowed = allowedIP.replace(/^::ffff:/, '');
      
      if (normalizedClient === normalizedAllowed) return true;
      
      // CIDR matching (simple /24, /16, /8 support)
      if (allowedIP.includes('/')) {
        const [network, bits] = allowedIP.split('/');
        const mask = parseInt(bits, 10);
        
        // Simple Class C (/24) matching
        if (mask === 24) {
          const clientPrefix = normalizedClient.split('.').slice(0, 3).join('.');
          const networkPrefix = network.split('.').slice(0, 3).join('.');
          if (clientPrefix === networkPrefix) return true;
        }
      }
      
      return false;
    });

    if (!isAllowed) {
      logger.warn('IP allowlist validation failed', {
        ip: clientIP,
        allowlist: allowedIPs,
        path: req.path
      });
      return res.status(403).json({
        ErrorId: 1,
        Title: 'Forbidden',
        Message: 'IP not allowed',
        Content: ''
      });
    }

    next();
  } catch (error) {
    logger.error('IP allowlist validation error:', error);
    return res.status(500).json({
      ErrorId: 1,
      Title: 'Server Error',
      Message: 'IP validation failed',
      Content: ''
    });
  }
};

/**
 * Rate limiting for ZennoPoster (per IP)
 * 
 * Config: zenno_rate_limit_requests (default: 100)
 *         zenno_rate_limit_window_sec (default: 60)
 */
const requestCounts = new Map(); // ip -> { count, resetAt }

exports.validateRateLimit = async (req, res, next) => {
  try {
    // Check if rate limiting is enabled
    const rateLimitEnabled = await SiteConfig.getByKey('zenno_rate_limit_enabled');
    if (!rateLimitEnabled || rateLimitEnabled === '0' || rateLimitEnabled === 'false') {
      return next();
    }

    const maxRequests = parseInt(await SiteConfig.getByKey('zenno_rate_limit_requests') || '100', 10);
    const windowSec = parseInt(await SiteConfig.getByKey('zenno_rate_limit_window_sec') || '60', 10);

    const clientIP = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    let record = requestCounts.get(clientIP);
    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowSec * 1000 };
      requestCounts.set(clientIP, record);
    }

    record.count++;

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      logger.warn('Rate limit exceeded', {
        ip: clientIP,
        count: record.count,
        limit: maxRequests,
        retryAfter
      });
      res.setHeader('Retry-After', retryAfter.toString());
      return res.status(429).json({
        ErrorId: 1,
        Title: 'Too Many Requests',
        Message: `Rate limit exceeded. Retry after ${retryAfter}s`,
        Content: ''
      });
    }

    next();
  } catch (error) {
    logger.error('Rate limit validation error:', error);
    next(); // Don't block on error
  }
};

// Cleanup old rate limit records every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetAt + 60000) { // 1 minute grace
      requestCounts.delete(ip);
    }
  }
}, 10 * 60 * 1000);
