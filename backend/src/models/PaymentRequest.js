const mongoose = require('mongoose');

const paymentRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [1, 'Amount must be at least 1']
  },
  fee: { type: Number, default: 0 },
  finalAmount: { type: Number, default: 0 },
  note: { type: String, trim: true, maxlength: 500 },
  paymentMethodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    required: [true, 'Payment method is required']
  },
  transactionId: {
    type: String,
    trim: true,
    maxlength: [100, 'Transaction ID cannot exceed 100 characters']
  },
  proofImage: {
    type: String,
    trim: true
    // URL của ảnh chứng từ
  },
  proofImagePath: {
    type: String,
    trim: true
    // Local file path của ảnh chứng từ
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  adminNote: {
    type: String,
    trim: true,
    maxlength: [1000, 'Admin note cannot exceed 1000 characters']
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
    // Admin xử lý
  },
  processedAt: {
    type: Date
  },
  rejectionReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Rejection reason cannot exceed 500 characters']
  },
  ipAddress: {
    type: String,
    trim: true
  },
  userAgent: {
    type: String,
    trim: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Expire after 24 hours if not processed
      return new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for status display
paymentRequestSchema.virtual('statusDisplay').get(function() {
  const statusMap = {
    pending: 'Đang chờ xử lý',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối',
    cancelled: 'Đã hủy'
  };
  return statusMap[this.status] || this.status;
});

// Virtual for processing time
paymentRequestSchema.virtual('processingTime').get(function() {
  if (!this.processedAt) return null;
  
  const diffMs = this.processedAt - this.createdAt;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
});

// Virtual for time until expiry
paymentRequestSchema.virtual('timeUntilExpiry').get(function() {
  if (this.status !== 'pending') return null;
  
  const now = new Date();
  if (now >= this.expiresAt) return 'Expired';
  
  const diffMs = this.expiresAt - now;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes}m`;
  }
  return `${diffMinutes}m`;
});

// Index for better performance
paymentRequestSchema.index({ userId: 1 });
paymentRequestSchema.index({ status: 1 });
paymentRequestSchema.index({ paymentMethodId: 1 });
paymentRequestSchema.index({ processedBy: 1 });
paymentRequestSchema.index({ createdAt: -1 });
paymentRequestSchema.index({ processedAt: -1 });
paymentRequestSchema.index({ expiresAt: 1 });
paymentRequestSchema.index({ userId: 1, status: 1 });
paymentRequestSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware
paymentRequestSchema.pre('save', function(next) {
  // Set processedAt when status changes from pending
  if (this.isModified('status') && this.status !== 'pending' && !this.processedAt) {
    this.processedAt = new Date();
  }
  
  next();
});

// Instance method to approve request
paymentRequestSchema.methods.approve = async function(adminId, adminNote = '') {
  if (this.status !== 'pending') {
    throw new Error('Only pending requests can be approved');
  }
  
  this.status = 'approved';
  this.processedBy = adminId;
  this.processedAt = new Date();
  this.adminNote = adminNote;
  
  await this.save();
  
  // Update user balance - convert USD to credits
  const User = mongoose.model('User');
  const user = await User.findById(this.userId);
  if (user) {
    // Get conversion rate from site config
    const SiteConfig = mongoose.model('SiteConfig');
    const conversionConfig = await SiteConfig.findOne({ key: 'payment_credit_per_usd' });
    const conversionRate = conversionConfig ? parseFloat(conversionConfig.value) : 10; // Default 10 credits per USD

    // Convert USD to credits
    const creditsToAdd = Math.floor(this.amount * conversionRate);
    const balanceBefore = user.balance;

    await user.updateBalance(creditsToAdd, 'add');

    // Create transaction record
    const Transaction = mongoose.model('Transaction');
    await Transaction.create({
      userId: this.userId,
      type: 'deposit',
      amount: creditsToAdd,
      description: `Deposit approved - Payment Request #${this._id} ($${this.amount} = ${creditsToAdd} credits)`,
      balanceBefore: balanceBefore,
      balanceAfter: user.balance,
      relatedId: this._id,
      metadata: {
        usdAmount: this.amount,
        conversionRate: conversionRate,
        creditsAdded: creditsToAdd
      }
    });
  }
  
  return this;
};

// Instance method to reject request
paymentRequestSchema.methods.reject = async function(adminId, rejectionReason, adminNote = '') {
  if (this.status !== 'pending') {
    throw new Error('Only pending requests can be rejected');
  }
  
  this.status = 'rejected';
  this.processedBy = adminId;
  this.processedAt = new Date();
  this.rejectionReason = rejectionReason;
  this.adminNote = adminNote;
  
  await this.save();
  return this;
};

// Instance method to cancel request
paymentRequestSchema.methods.cancel = async function() {
  if (this.status !== 'pending') {
    throw new Error('Only pending requests can be cancelled');
  }
  
  this.status = 'cancelled';
  this.processedAt = new Date();
  
  await this.save();
  return this;
};

// Static method to get statistics
paymentRequestSchema.statics.getStatistics = async function(startDate = null, endDate = null) {
  const matchStage = {};
  
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
        totalRequests: { $sum: 1 },
        pendingRequests: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        approvedRequests: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        rejectedRequests: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        cancelledRequests: {
          $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
        },
        totalAmount: { $sum: '$amount' },
        approvedAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] }
        },
        pendingAmount: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    cancelledRequests: 0,
    totalAmount: 0,
    approvedAmount: 0,
    pendingAmount: 0
  };

  // Calculate approval rate
  result.approvalRate = result.totalRequests > 0 
    ? ((result.approvedRequests / result.totalRequests) * 100).toFixed(2)
    : 0;

  return result;
};

// Static method to get expired requests
paymentRequestSchema.statics.getExpiredRequests = function() {
  return this.find({
    status: 'pending',
    expiresAt: { $lt: new Date() }
  });
};

// Static method to auto-cancel expired requests
paymentRequestSchema.statics.autoCancelExpiredRequests = async function() {
  const expiredRequests = await this.getExpiredRequests();
  
  for (const request of expiredRequests) {
    await request.cancel();
  }
  
  return expiredRequests.length;
};

module.exports = mongoose.model('PaymentRequest', paymentRequestSchema);
