const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  // Allow skipping DB in local/dev when MongoDB is not available
  const skip = (process.env.SKIP_DB === '1' || process.env.SKIP_DB === 'true');
  try {
    // Prefer MONGODB_URI, fallback to MONGO_URI for compatibility
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (skip) {
      logger.warn('SKIP_DB enabled. Starting server without MongoDB connection.');
      return; // Do not attempt to connect
    }

    if (!mongoUri) {
      logger.warn('Missing MONGODB_URI/MONGO_URI. Running without database connection.');
      return; // Soft-fail in dev
    }

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    logger.info(`MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('connected', () => {
      logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('Mongoose disconnected from MongoDB');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        logger.info('Mongoose connection closed due to application termination');
      } finally {
        process.exit(0);
      }
    });

  } catch (error) {
    if (skip || (process.env.NODE_ENV !== 'production')) {
      logger.error('Database connection failed (continuing without DB):', error);
      return; // Do not exit in dev
    }
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
