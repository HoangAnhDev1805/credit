const { body, param, query, validationResult } = require('express-validator');
const logger = require('../config/logger');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path,
      message: error.msg,
      value: error.value
    }));

    logger.warn('Validation errors:', errorMessages);

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errorMessages
    });
  }

  next();
};

// User validation rules
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  
  handleValidationErrors
];

const validateLogin = [
  body('login')
    .trim()
    .notEmpty()
    .withMessage('Username or email is required'),

  body('password')
    .notEmpty()
    .withMessage('Password is required'),

  handleValidationErrors
];

const validateUpdateProfile = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  
  body('currentPassword')
    .optional()
    .notEmpty()
    .withMessage('Current password is required when updating password'),
  
  body('newPassword')
    .optional()
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  handleValidationErrors
];

// Card validation rules
const validateCardCheck = [
  body('cards')
    .isArray({ min: 1 })
    .withMessage('Cards array is required and must contain at least one card'),
  
  body('cards.*')
    .matches(/^\d{13,19}\|\d{2}\|\d{2,4}\|\d{3,4}$/)
    .withMessage('Card format must be: cardNumber|month|year|cvv'),
  
  body('typeCheck')
    .optional()
    .isIn([1, 2])
    .withMessage('Type check must be 1 (CheckLive) or 2 (CheckCharge)'),
  
  handleValidationErrors
];

const validateCardGenerate = [
  body('bin')
    .matches(/^\d{6}$/)
    .withMessage('BIN must be exactly 6 digits'),
  
  body('quantity')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Quantity must be between 1 and 1000'),
  
  body('month')
    .optional()
    .matches(/^(0[1-9]|1[0-2]|random)$/)
    .withMessage('Month must be 01-12 or "random"'),
  
  body('year')
    .optional()
    .matches(/^(\d{2,4}|random)$/)
    .withMessage('Year must be 2-4 digits or "random"'),
  
  body('cvv')
    .optional()
    .matches(/^(\d{3,4}|random)$/)
    .withMessage('CVV must be 3-4 digits or "random"'),
  
  body('format')
    .optional()
    .isIn(['XXXXXXXXXXXXXXXX|MM|YY|CVV', 'XXXXXXXXXXXXXXXX|MM|YYYY|CVV'])
    .withMessage('Invalid format specified'),
  
  body('validCardsOnly')
    .optional()
    .isBoolean()
    .withMessage('Valid cards only must be a boolean'),
  
  handleValidationErrors
];

// Payment validation rules
const validatePaymentRequest = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be a positive number'),
  
  body('paymentMethodId')
    .isMongoId()
    .withMessage('Valid payment method ID is required'),
  
  body('transactionId')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Transaction ID cannot exceed 100 characters'),
  
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  handleValidationErrors
];

const validatePaymentMethod = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required and cannot exceed 100 characters'),
  
  body('type')
    .isIn(['bank_transfer', 'e_wallet', 'crypto', 'other'])
    .withMessage('Invalid payment method type'),
  
  body('accountNumber')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Account number is required and cannot exceed 50 characters'),
  
  body('accountName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Account name is required and cannot exceed 100 characters'),
  
  body('bankName')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Bank name cannot exceed 100 characters'),
  
  body('qrCode')
    .optional()
    .trim()
    .isURL()
    .withMessage('QR code must be a valid URL'),
  
  body('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be a non-negative number'),
  
  body('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be a non-negative number'),
  
  handleValidationErrors
];

// Admin validation rules
const validateUserUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  
  body('status')
    .optional()
    .isIn(['active', 'blocked'])
    .withMessage('Status must be active or blocked'),
  
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be user or admin'),
  
  body('checker')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('Checker must be 0 or 1'),
  
  body('balance')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Balance must be a non-negative number'),
  
  handleValidationErrors
];

const validatePricingConfig = [
  body('name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  
  body('minCards')
    .isInt({ min: 1 })
    .withMessage('Minimum cards must be at least 1'),
  
  body('maxCards')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Maximum cards must be at least 1'),
  
  body('pricePerCard')
    .isFloat({ min: 0 })
    .withMessage('Price per card must be a non-negative number'),
  
  body('discountPercentage')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('Discount percentage must be between 0 and 100'),
  
  handleValidationErrors
];

const validateSiteConfig = [
  body('configs')
    .isObject()
    .withMessage('Configs must be an object'),
  
  handleValidationErrors
];

// Query validation rules
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sortBy')
    .optional()
    .isAlpha()
    .withMessage('Sort by must contain only letters'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', '1', '-1'])
    .withMessage('Sort order must be asc, desc, 1, or -1'),
  
  handleValidationErrors
];

const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = (fieldName, allowedTypes = ['image/jpeg', 'image/png', 'image/gif'], maxSize = 5 * 1024 * 1024) => {
  return (req, res, next) => {
    if (!req.file && !req.files) {
      return next();
    }

    const file = req.file || req.files[fieldName];
    
    if (!file) {
      return next();
    }

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
      });
    }

    // Check file size
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
      });
    }

    next();
  };
};

// Custom validation for card number using Luhn algorithm
const validateCardNumber = (cardNumber) => {
  // Remove any non-digit characters
  const cleanCardNumber = cardNumber.replace(/\D/g, '');
  
  // Check if it's a valid length
  if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
    return false;
  }
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanCardNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanCardNumber.charAt(i));
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateCardCheck,
  validateCardGenerate,
  validatePaymentRequest,
  validatePaymentMethod,
  validateUserUpdate,
  validatePricingConfig,
  validateSiteConfig,
  validatePagination,
  validateDateRange,
  validateFileUpload,
  validateCardNumber
};
