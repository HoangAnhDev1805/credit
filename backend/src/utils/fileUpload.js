const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const logger = require('../config/logger');

class FileUploadService {
  constructor() {
    this.uploadPath = process.env.UPLOAD_PATH || './uploads';
    this.maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024; // 5MB
    this.allowedMimeTypes = (process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/gif').split(',');
    
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  ensureUploadDirectory() {
    try {
      if (!fs.existsSync(this.uploadPath)) {
        fs.mkdirSync(this.uploadPath, { recursive: true });
        logger.info(`Created upload directory: ${this.uploadPath}`);
      }

      // Create subdirectories
      const subdirs = ['images', 'documents', 'temp', 'avatars', 'qr-codes'];
      subdirs.forEach(subdir => {
        const subdirPath = path.join(this.uploadPath, subdir);
        if (!fs.existsSync(subdirPath)) {
          fs.mkdirSync(subdirPath, { recursive: true });
        }
      });
    } catch (error) {
      logger.error('Error creating upload directory:', error);
      throw new Error('Failed to create upload directory');
    }
  }

  /**
   * Generate unique filename
   * @param {string} originalName - Original filename
   * @param {string} prefix - Filename prefix
   * @returns {string} Unique filename
   */
  generateUniqueFilename(originalName, prefix = '') {
    try {
      const ext = path.extname(originalName);
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const prefixPart = prefix ? `${prefix}_` : '';
      
      return `${prefixPart}${timestamp}_${randomString}${ext}`;
    } catch (error) {
      logger.error('Error generating unique filename:', error);
      throw new Error('Failed to generate unique filename');
    }
  }

  /**
   * Create multer storage configuration
   * @param {string} destination - Upload destination
   * @param {string} filenamePrefix - Filename prefix
   * @returns {Object} Multer storage configuration
   */
  createStorage(destination = 'temp', filenamePrefix = '') {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const destPath = path.join(this.uploadPath, destination);
        
        // Ensure destination directory exists
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        
        cb(null, destPath);
      },
      filename: (req, file, cb) => {
        try {
          const uniqueFilename = this.generateUniqueFilename(file.originalname, filenamePrefix);
          cb(null, uniqueFilename);
        } catch (error) {
          cb(error);
        }
      }
    });
  }

  /**
   * File filter function
   * @param {Array} allowedTypes - Allowed MIME types
   * @returns {Function} File filter function
   */
  createFileFilter(allowedTypes = null) {
    const types = allowedTypes || this.allowedMimeTypes;
    
    return (req, file, cb) => {
      if (types.includes(file.mimetype)) {
        cb(null, true);
      } else {
        const error = new Error(`File type ${file.mimetype} is not allowed`);
        error.code = 'INVALID_FILE_TYPE';
        cb(error, false);
      }
    };
  }

  /**
   * Create multer upload middleware
   * @param {Object} options - Upload options
   * @returns {Object} Multer upload middleware
   */
  createUploadMiddleware(options = {}) {
    const {
      destination = 'temp',
      filenamePrefix = '',
      allowedTypes = null,
      maxFileSize = this.maxFileSize,
      maxFiles = 1,
      fieldName = 'file'
    } = options;

    const storage = this.createStorage(destination, filenamePrefix);
    const fileFilter = this.createFileFilter(allowedTypes);

    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: maxFileSize,
        files: maxFiles
      }
    });

    return maxFiles === 1 ? upload.single(fieldName) : upload.array(fieldName, maxFiles);
  }

  /**
   * Create image upload middleware
   * @param {Object} options - Upload options
   * @returns {Object} Multer upload middleware
   */
  createImageUpload(options = {}) {
    return this.createUploadMiddleware({
      destination: 'images',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      maxFileSize: 5 * 1024 * 1024, // 5MB
      ...options
    });
  }

  /**
   * Create document upload middleware
   * @param {Object} options - Upload options
   * @returns {Object} Multer upload middleware
   */
  createDocumentUpload(options = {}) {
    return this.createUploadMiddleware({
      destination: 'documents',
      allowedTypes: ['application/pdf', 'image/jpeg', 'image/png'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      ...options
    });
  }

  /**
   * Create avatar upload middleware
   * @param {Object} options - Upload options
   * @returns {Object} Multer upload middleware
   */
  createAvatarUpload(options = {}) {
    return this.createUploadMiddleware({
      destination: 'avatars',
      filenamePrefix: 'avatar',
      allowedTypes: ['image/jpeg', 'image/png'],
      maxFileSize: 2 * 1024 * 1024, // 2MB
      ...options
    });
  }

  /**
   * Move file from temp to permanent location
   * @param {string} tempPath - Temporary file path
   * @param {string} destination - Destination directory
   * @param {string} newFilename - New filename (optional)
   * @returns {string} New file path
   */
  moveFile(tempPath, destination, newFilename = null) {
    try {
      const filename = newFilename || path.basename(tempPath);
      const destDir = path.join(this.uploadPath, destination);
      const destPath = path.join(destDir, filename);

      // Ensure destination directory exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Move file
      fs.renameSync(tempPath, destPath);
      
      logger.info(`File moved from ${tempPath} to ${destPath}`);
      return destPath;
    } catch (error) {
      logger.error('Error moving file:', error);
      throw new Error('Failed to move file');
    }
  }

  /**
   * Delete file
   * @param {string} filePath - File path to delete
   * @returns {boolean} Success status
   */
  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`File deleted: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting file:', error);
      return false;
    }
  }

  /**
   * Get file info
   * @param {string} filePath - File path
   * @returns {Object} File information
   */
  getFileInfo(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath);
      const name = path.basename(filePath, ext);

      return {
        path: filePath,
        name,
        extension: ext,
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory()
      };
    } catch (error) {
      logger.error('Error getting file info:', error);
      return null;
    }
  }

  /**
   * Clean up old files
   * @param {string} directory - Directory to clean
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {number} Number of files deleted
   */
  cleanupOldFiles(directory = 'temp', maxAge = 24 * 60 * 60 * 1000) {
    try {
      const dirPath = path.join(this.uploadPath, directory);
      
      if (!fs.existsSync(dirPath)) {
        return 0;
      }

      const files = fs.readdirSync(dirPath);
      let deletedCount = 0;
      const now = Date.now();

      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile() && (now - stats.mtime.getTime()) > maxAge) {
          if (this.deleteFile(filePath)) {
            deletedCount++;
          }
        }
      });

      logger.info(`Cleaned up ${deletedCount} old files from ${directory}`);
      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old files:', error);
      return 0;
    }
  }

  /**
   * Get directory size
   * @param {string} directory - Directory to check
   * @returns {number} Directory size in bytes
   */
  getDirectorySize(directory = '') {
    try {
      const dirPath = directory ? path.join(this.uploadPath, directory) : this.uploadPath;
      
      if (!fs.existsSync(dirPath)) {
        return 0;
      }

      let totalSize = 0;
      const files = fs.readdirSync(dirPath);

      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isFile()) {
          totalSize += stats.size;
        } else if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(path.join(directory, file));
        }
      });

      return totalSize;
    } catch (error) {
      logger.error('Error getting directory size:', error);
      return 0;
    }
  }

  /**
   * Format file size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get upload statistics
   * @returns {Object} Upload statistics
   */
  getUploadStatistics() {
    try {
      const stats = {
        uploadPath: this.uploadPath,
        maxFileSize: this.formatFileSize(this.maxFileSize),
        allowedMimeTypes: this.allowedMimeTypes,
        directories: {}
      };

      const subdirs = ['images', 'documents', 'temp', 'avatars', 'qr-codes'];
      
      subdirs.forEach(subdir => {
        const dirPath = path.join(this.uploadPath, subdir);
        if (fs.existsSync(dirPath)) {
          const files = fs.readdirSync(dirPath);
          const size = this.getDirectorySize(subdir);
          
          stats.directories[subdir] = {
            fileCount: files.length,
            size: this.formatFileSize(size),
            sizeBytes: size
          };
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting upload statistics:', error);
      return null;
    }
  }
}

module.exports = new FileUploadService();
