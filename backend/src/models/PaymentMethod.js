const mongoose = require('mongoose');

const paymentMethodSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Payment method name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  type: {
    type: String,
    enum: ['bank_transfer', 'e_wallet', 'crypto', 'other'],
    default: 'bank_transfer'
  },
  accountNumber: {
    type: String,
    required: [true, 'Account number is required'],
    trim: true,
    maxlength: [50, 'Account number cannot exceed 50 characters']
  },
  accountName: {
    type: String,
    required: [true, 'Account name is required'],
    trim: true,
    maxlength: [100, 'Account name cannot exceed 100 characters']
  },
  bankName: {
    type: String,
    trim: true,
    maxlength: [100, 'Bank name cannot exceed 100 characters']
  },
  bankCode: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: [20, 'Bank code cannot exceed 20 characters']
  },
  qrCode: {
    type: String,
    trim: true
    // URL hoặc base64 của QR code
  },
  qrCodeType: {
    type: String,
    enum: ['url', 'base64'],
    default: 'url'
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [1000, 'Instructions cannot exceed 1000 characters']
  },
  minAmount: {
    type: Number,
    default: 0,
    min: [0, 'Minimum amount cannot be negative']
  },
  maxAmount: {
    type: Number,
    min: [0, 'Maximum amount cannot be negative']
  },
  processingTime: {
    type: String,
    trim: true,
    default: '5-15 minutes'
  },
  fees: {
    type: Number,
    default: 0,
    min: [0, 'Fees cannot be negative']
  },
  feeType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  totalTransactions: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  lastUsedAt: {
    type: Date
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for display name
paymentMethodSchema.virtual('displayName').get(function() {
  return `${this.name} - ${this.accountNumber}`;
});

// Virtual for formatted account number (mask middle digits)
paymentMethodSchema.virtual('maskedAccountNumber').get(function() {
  if (!this.accountNumber || this.accountNumber.length < 8) {
    return this.accountNumber;
  }
  
  const start = this.accountNumber.substring(0, 3);
  const end = this.accountNumber.substring(this.accountNumber.length - 3);
  const middle = '*'.repeat(this.accountNumber.length - 6);
  
  return start + middle + end;
});

// Virtual for average transaction amount
paymentMethodSchema.virtual('averageTransactionAmount').get(function() {
  if (this.totalTransactions === 0) return 0;
  return (this.totalAmount / this.totalTransactions).toFixed(2);
});

// Index for better performance
paymentMethodSchema.index({ isActive: 1, sortOrder: 1 });
paymentMethodSchema.index({ type: 1 });
paymentMethodSchema.index({ createdAt: -1 });
paymentMethodSchema.index({ name: 1 });

// Pre-save middleware
paymentMethodSchema.pre('save', function(next) {
  // Ensure maxAmount is greater than minAmount
  if (this.maxAmount && this.minAmount && this.maxAmount < this.minAmount) {
    const error = new Error('Maximum amount must be greater than minimum amount');
    return next(error);
  }
  
  next();
});

// Instance method to calculate fee
paymentMethodSchema.methods.calculateFee = function(amount) {
  if (this.feeType === 'percentage') {
    return (amount * this.fees) / 100;
  }
  return this.fees;
};

// Instance method to validate amount
paymentMethodSchema.methods.validateAmount = function(amount) {
  const errors = [];
  
  if (amount < this.minAmount) {
    errors.push(`Amount must be at least ${this.minAmount}`);
  }
  
  if (this.maxAmount && amount > this.maxAmount) {
    errors.push(`Amount cannot exceed ${this.maxAmount}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Instance method to update usage statistics
paymentMethodSchema.methods.updateUsageStats = async function(amount) {
  this.totalTransactions += 1;
  this.totalAmount += amount;
  this.lastUsedAt = new Date();
  
  await this.save();
};

// Static method to get active payment methods
paymentMethodSchema.statics.getActivePaymentMethods = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
};

// Static method to get payment method statistics
paymentMethodSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalMethods: { $sum: 1 },
        activeMethods: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveMethods: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        },
        totalTransactions: { $sum: '$totalTransactions' },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  const typeStats = await this.aggregate([
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalTransactions: { $sum: '$totalTransactions' },
        totalAmount: { $sum: '$totalAmount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    overview: stats[0] || {
      totalMethods: 0,
      activeMethods: 0,
      inactiveMethods: 0,
      totalTransactions: 0,
      totalAmount: 0
    },
    byType: typeStats
  };
};

// Static method to find by type
paymentMethodSchema.statics.findByType = function(type) {
  return this.find({ type, isActive: true }).sort({ sortOrder: 1 });
};

module.exports = mongoose.model('PaymentMethod', paymentMethodSchema);
