const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('../config/logger');

class JWTService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpire = process.env.JWT_EXPIRE || '24h';
    this.jwtRefreshExpire = process.env.JWT_REFRESH_EXPIRE || '7d';

    if (!this.jwtSecret || !this.jwtRefreshSecret) {
      throw new Error('JWT secrets are required');
    }
  }

  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @returns {string} JWT access token
   */
  generateAccessToken(payload) {
    try {
      return jwt.sign(payload, this.jwtSecret, {
        expiresIn: this.jwtExpire,
        issuer: 'credit-card-checker',
        audience: 'credit-card-checker-users'
      });
    } catch (error) {
      logger.error('Error generating access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @returns {string} JWT refresh token
   */
  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, this.jwtRefreshSecret, {
        expiresIn: this.jwtRefreshExpire,
        issuer: 'credit-card-checker',
        audience: 'credit-card-checker-users'
      });
    } catch (error) {
      logger.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} user - User object
   * @returns {Object} Token pair
   */
  generateTokenPair(user) {
    try {
      const payload = {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      };

      const accessToken = this.generateAccessToken(payload);
      const refreshToken = this.generateRefreshToken({ id: user._id });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.jwtExpire,
        tokenType: 'Bearer'
      };
    } catch (error) {
      logger.error('Error generating token pair:', error);
      throw new Error('Failed to generate token pair');
    }
  }

  /**
   * Verify access token
   * @param {string} token - JWT access token
   * @returns {Object} Decoded token payload
   */
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'credit-card-checker',
        audience: 'credit-card-checker-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Access token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid access token');
      } else {
        logger.error('Error verifying access token:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   * @param {string} token - JWT refresh token
   * @returns {Object} Decoded token payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.jwtRefreshSecret, {
        issuer: 'credit-card-checker',
        audience: 'credit-card-checker-users'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        logger.error('Error verifying refresh token:', error);
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Decode token without verification (for debugging)
   * @param {string} token - JWT token
   * @returns {Object} Decoded token
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      logger.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Get token expiration time
   * @param {string} token - JWT token
   * @returns {Date|null} Expiration date
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (decoded && decoded.payload && decoded.payload.exp) {
        return new Date(decoded.payload.exp * 1000);
      }
      return null;
    } catch (error) {
      logger.error('Error getting token expiration:', error);
      return null;
    }
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} Whether token is expired
   */
  isTokenExpired(token) {
    try {
      const expiration = this.getTokenExpiration(token);
      if (!expiration) return true;
      return expiration < new Date();
    } catch (error) {
      logger.error('Error checking token expiration:', error);
      return true;
    }
  }

  /**
   * Generate secure random token (for password reset, etc.)
   * @param {number} length - Token length in bytes
   * @returns {string} Random token
   */
  generateSecureToken(length = 32) {
    try {
      return crypto.randomBytes(length).toString('hex');
    } catch (error) {
      logger.error('Error generating secure token:', error);
      throw new Error('Failed to generate secure token');
    }
  }

  /**
   * Hash token (for storing in database)
   * @param {string} token - Token to hash
   * @returns {string} Hashed token
   */
  hashToken(token) {
    try {
      return crypto.createHash('sha256').update(token).digest('hex');
    } catch (error) {
      logger.error('Error hashing token:', error);
      throw new Error('Failed to hash token');
    }
  }

  /**
   * Generate API key
   * @param {string} prefix - API key prefix
   * @returns {string} API key
   */
  generateApiKey(prefix = 'ccc') {
    try {
      const randomPart = crypto.randomBytes(16).toString('hex');
      const timestamp = Date.now().toString(36);
      return `${prefix}_${timestamp}_${randomPart}`;
    } catch (error) {
      logger.error('Error generating API key:', error);
      throw new Error('Failed to generate API key');
    }
  }

  /**
   * Validate API key format
   * @param {string} apiKey - API key to validate
   * @returns {boolean} Whether API key format is valid
   */
  validateApiKeyFormat(apiKey) {
    try {
      const pattern = /^[a-z]+_[a-z0-9]+_[a-f0-9]{32}$/i;
      return pattern.test(apiKey);
    } catch (error) {
      logger.error('Error validating API key format:', error);
      return false;
    }
  }

  /**
   * Extract user ID from token
   * @param {string} token - JWT token
   * @returns {string|null} User ID
   */
  extractUserIdFromToken(token) {
    try {
      const decoded = this.decodeToken(token);
      return decoded?.payload?.id || null;
    } catch (error) {
      logger.error('Error extracting user ID from token:', error);
      return null;
    }
  }

  /**
   * Create token blacklist entry
   * @param {string} token - Token to blacklist
   * @param {string} reason - Blacklist reason
   * @returns {Object} Blacklist entry
   */
  createBlacklistEntry(token, reason = 'logout') {
    try {
      const decoded = this.decodeToken(token);
      const jti = decoded?.payload?.jti || crypto.randomUUID();
      const exp = this.getTokenExpiration(token);

      return {
        jti,
        token: this.hashToken(token),
        reason,
        blacklistedAt: new Date(),
        expiresAt: exp
      };
    } catch (error) {
      logger.error('Error creating blacklist entry:', error);
      throw new Error('Failed to create blacklist entry');
    }
  }

  /**
   * Get token statistics
   * @returns {Object} Token configuration and statistics
   */
  getTokenStatistics() {
    return {
      accessTokenExpiry: this.jwtExpire,
      refreshTokenExpiry: this.jwtRefreshExpire,
      issuer: 'credit-card-checker',
      audience: 'credit-card-checker-users',
      algorithm: 'HS256'
    };
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Valid refresh token
   * @param {Object} user - Updated user object
   * @returns {Object} New token pair
   */
  refreshAccessToken(refreshToken, user) {
    try {
      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);
      
      // Check if user ID matches
      if (decoded.id !== user._id.toString()) {
        throw new Error('Token user mismatch');
      }

      // Generate new token pair
      return this.generateTokenPair(user);
    } catch (error) {
      logger.error('Error refreshing access token:', error);
      throw error;
    }
  }
}

module.exports = new JWTService();
