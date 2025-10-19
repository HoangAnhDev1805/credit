const mongoose = require('mongoose');

/**
 * Middleware to short-circuit routes that require DB access when the
 * MongoDB connection is not established. Returns 503 Service Unavailable.
 */
module.exports = function dbCheck(req, res, next) {
  // If SKIP_DB is explicitly enabled, report service unavailable
  const skip = (process.env.SKIP_DB === '1' || process.env.SKIP_DB === 'true');
  if (skip) {
    return res.status(503).json({
      success: false,
      message: 'Database is not available (SKIP_DB enabled). Please try again later.'
    });
  }

  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      message: 'Database connection not ready. Please try again later.'
    });
  }

  return next();
};
