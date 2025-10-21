const logger = require('../config/logger');

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error('Error Handler:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    user: req.user ? req.user._id : 'Anonymous'
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      statusCode: 404
    };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
    error = {
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = {
      message,
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = {
      message,
      statusCode: 401
    };
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large';
    error = {
      message,
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    const message = 'Unexpected file field';
    error = {
      message,
      statusCode: 400
    };
  }

  // Rate limit errors
  if (err.status === 429) {
    const message = 'Too many requests, please try again later';
    error = {
      message,
      statusCode: 429
    };
  }

  // CORS errors
  if (err.message && err.message.includes('CORS')) {
    const message = 'CORS policy violation';
    error = {
      message,
      statusCode: 403
    };
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    const message = 'Database connection error';
    error = {
      message,
      statusCode: 503
    };
  }

  // Syntax errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    const message = 'Invalid JSON format';
    error = {
      message,
      statusCode: 400
    };
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  // Don't leak error details in production
  const errorResponse = {
    success: false,
    message
  };

  // Add error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }

  // Add request ID for tracking
  if (req.requestId) {
    errorResponse.requestId = req.requestId;
  }

  res.status(statusCode).json(errorResponse);
};

// 404 handler
const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  logger.warn('404 Not Found:', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({
    success: false,
    message
  });
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation error helper
const validationError = (message, field = null) => {
  const error = new AppError(message, 400);
  if (field) {
    error.field = field;
  }
  return error;
};

// Authentication error helper
const authError = (message = 'Authentication failed') => {
  return new AppError(message, 401);
};

// Authorization error helper
const authorizationError = (message = 'Not authorized to access this resource') => {
  return new AppError(message, 403);
};

// Not found error helper
const notFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, 404);
};

// Conflict error helper
const conflictError = (message = 'Resource already exists') => {
  return new AppError(message, 409);
};

// Server error helper
const serverError = (message = 'Internal server error') => {
  return new AppError(message, 500);
};

// Service unavailable error helper
const serviceUnavailableError = (message = 'Service temporarily unavailable') => {
  return new AppError(message, 503);
};

// Request timeout error helper
const timeoutError = (message = 'Request timeout') => {
  return new AppError(message, 408);
};

// Too many requests error helper
const tooManyRequestsError = (message = 'Too many requests') => {
  return new AppError(message, 429);
};

// Unprocessable entity error helper
const unprocessableEntityError = (message = 'Unprocessable entity') => {
  return new AppError(message, 422);
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('========== UNCAUGHT EXCEPTION ==========');
  console.error('Error Name:', err.name);
  console.error('Error Message:', err.message);
  console.error('Stack Trace:', err.stack);
  console.error('=========================================');
  logger.error('Uncaught Exception:', err);
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', err);
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    
    server.close(() => {
      logger.info('Process terminated');
      process.exit(0);
    });

    // Force close server after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
  validationError,
  authError,
  authorizationError,
  notFoundError,
  conflictError,
  serverError,
  serviceUnavailableError,
  timeoutError,
  tooManyRequestsError,
  unprocessableEntityError,
  gracefulShutdown
};
