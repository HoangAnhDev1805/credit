const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  type: {
    type: String,
    enum: ['deposit', 'card_check', 'refund', 'bonus', 'penalty', 'withdrawal'],
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
    // Can be negative for deductions
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  balanceBefore: {
    type: Number,
    required: [true, 'Balance before is required'],
    min: 0
  },
  balanceAfter: {
    type: Number,
    required: [true, 'Balance after is required'],
    min: 0
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId
    // ID của card, payment_request, hoặc entity liên quan khác
  },
  relatedModel: {
    type: String,
    enum: ['Card', 'PaymentRequest', 'User', 'PricingConfig']
    // Model name của relatedId
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'completed'
  },
  metadata: {
    cardCount: {
      type: Number,
      min: 0
    },
    pricePerCard: {
      type: Number,
      min: 0
    },
    paymentMethod: {
      type: String,
      trim: true
    },
    ipAddress: {
      type: String,
      trim: true
    },
    userAgent: {
      type: String,
      trim: true
    },
    adminNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Admin note cannot exceed 1000 characters']
    },
    externalTransactionId: {
      type: String,
      trim: true
    }
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Admin hoặc system user thực hiện transaction
  },
  processedAt: {
    type: Date,
    default: Date.now
  },
  reversedAt: {
    type: Date
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reversalReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Reversal reason cannot exceed 500 characters']
  },
  isReversed: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for transaction type display
transactionSchema.virtual('typeDisplay').get(function() {
  const typeMap = {
    deposit: 'Nạp tiền',
    card_check: 'Kiểm tra thẻ',
    refund: 'Hoàn tiền',
    bonus: 'Thưởng',
    penalty: 'Phạt',
    withdrawal: 'Rút tiền'
  };
  return typeMap[this.type] || this.type;
});

// Virtual for amount display with sign
transactionSchema.virtual('amountDisplay').get(function() {
  const sign = this.amount >= 0 ? '+' : '';
  return `${sign}${this.amount.toFixed(2)}`;
});

// Virtual for status display
transactionSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Đang xử lý',
    completed: 'Hoàn thành',
    failed: 'Thất bại',
    cancelled: 'Đã hủy'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for processing time
transactionSchema.virtual('processingTime').get(function() {
  if (!this.processedAt) return null;
  
  const diffMs = this.processedAt - this.createdAt;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}m ${diffSeconds % 60}s`;
  } else {
    return `${diffSeconds}s`;
  }
});

// Index for better performance
transactionSchema.index({ userId: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ processedAt: -1 });
transactionSchema.index({ relatedId: 1, relatedModel: 1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ isReversed: 1 });

// Compound index for efficient queries
transactionSchema.index({ userId: 1, type: 1, createdAt: -1 });

// Pre-save middleware
transactionSchema.pre('save', function(next) {
  // Validate balance calculation
  if (this.balanceAfter !== this.balanceBefore + this.amount) {
    const error = new Error('Balance calculation is incorrect');
    return next(error);
  }
  
  // Set processedAt if status is completed and not set
  if (this.status === 'completed' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Instance method to reverse transaction
transactionSchema.methods.reverse = async function(adminId, reason) {
  if (this.isReversed) {
    throw new Error('Transaction is already reversed');
  }
  
  if (this.status !== 'completed') {
    throw new Error('Only completed transactions can be reversed');
  }
  
  // Create reversal transaction
  const reversalTransaction = new this.constructor({
    userId: this.userId,
    type: 'refund',
    amount: -this.amount, // Opposite amount
    description: `Reversal of transaction: ${this.description}`,
    balanceBefore: this.balanceAfter,
    balanceAfter: this.balanceBefore,
    relatedId: this._id,
    relatedModel: 'Transaction',
    processedBy: adminId,
    metadata: {
      ...this.metadata,
      originalTransactionId: this._id,
      adminNote: reason
    }
  });
  
  await reversalTransaction.save();
  
  // Mark original transaction as reversed
  this.isReversed = true;
  this.reversedAt = new Date();
  this.reversedBy = adminId;
  this.reversalReason = reason;
  
  await this.save();
  
  // Update user balance
  const User = mongoose.model('User');
  const user = await User.findById(this.userId);
  if (user) {
    user.balance = this.balanceBefore;
    await user.save();
  }
  
  return reversalTransaction;
};

// Static method to create transaction
transactionSchema.statics.createTransaction = async function(data) {
  const { userId, type, amount, description, relatedId, relatedModel, metadata, processedBy } = data;
  
  // Get user current balance
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const balanceBefore = user.balance;
  const balanceAfter = balanceBefore + amount;
  
  // Validate sufficient balance for deductions
  if (amount < 0 && balanceAfter < 0) {
    throw new Error('Insufficient balance');
  }
  
  // Create transaction
  const transaction = new this({
    userId,
    type,
    amount,
    description,
    balanceBefore,
    balanceAfter,
    relatedId,
    relatedModel,
    metadata,
    processedBy
  });
  
  await transaction.save();
  
  // Update user balance
  user.balance = balanceAfter;
  await user.save();
  
  return transaction;
};

// Static method to get user transaction history
transactionSchema.statics.getUserTransactionHistory = function(userId, options = {}) {
  const {
    page = 1,
    limit = 20,
    type,
    status,
    startDate,
    endDate,
    sortBy = 'createdAt',
    sortOrder = -1
  } = options;
  
  const query = { userId };
  
  if (type) query.type = type;
  if (status) query.status = status;
  
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .populate('processedBy', 'username')
    .populate('reversedBy', 'username')
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);
};

// Static method to get transaction statistics
transactionSchema.statics.getStatistics = async function(userId = null, startDate = null, endDate = null) {
  const matchStage = {};
  
  if (userId) {
    matchStage.userId = new mongoose.Types.ObjectId(userId);
  }
  
  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        totalDeposits: {
          $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
        },
        totalCardChecks: {
          $sum: { $cond: [{ $eq: ['$type', 'card_check'] }, '$amount', 0] }
        },
        totalRefunds: {
          $sum: { $cond: [{ $eq: ['$type', 'refund'] }, '$amount', 0] }
        },
        completedTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        pendingTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        failedTransactions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        reversedTransactions: {
          $sum: { $cond: [{ $eq: ['$isReversed', true] }, 1, 0] }
        }
      }
    }
  ]);

  const typeStats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        averageAmount: { $avg: '$amount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return {
    overview: stats[0] || {
      totalTransactions: 0,
      totalAmount: 0,
      totalDeposits: 0,
      totalCardChecks: 0,
      totalRefunds: 0,
      completedTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      reversedTransactions: 0
    },
    byType: typeStats
  };
};

// Static method to get daily transaction summary
transactionSchema.statics.getDailyTransactionSummary = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        totalTransactions: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        deposits: {
          $sum: { $cond: [{ $eq: ['$type', 'deposit'] }, '$amount', 0] }
        },
        cardChecks: {
          $sum: { $cond: [{ $eq: ['$type', 'card_check'] }, '$amount', 0] }
        }
      }
    },
    {
      $project: {
        date: {
          $dateFromParts: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day'
          }
        },
        totalTransactions: 1,
        totalAmount: 1,
        deposits: 1,
        cardChecks: 1
      }
    },
    { $sort: { date: 1 } }
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);
