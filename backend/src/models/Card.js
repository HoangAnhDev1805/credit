const mongoose = require('mongoose');

const cardSchema = new mongoose.Schema({
  cardNumber: {
    type: String,
    required: [true, 'Card number is required'],
    trim: true,
    match: [/^\d{13,19}$/, 'Card number must be 13-19 digits']
  },
  expiryMonth: {
    type: String,
    trim: true,
    match: [/^(0[1-9]|1[0-2])$/, 'Expiry month must be 01-12']
  },
  expiryYear: {
    type: String,
    trim: true,
    match: [/^\d{2,4}$/, 'Expiry year must be 2-4 digits']
  },
  cvv: {
    type: String,
    trim: true,
    match: [/^\d{3,4}$/, 'CVV must be 3-4 digits']
  },
  fullCard: {
    type: String,
    required: [true, 'Full card format is required'],
    trim: true
    // Format: "4634051204317662|12|25|664"
  },
  status: {
    type: String,
    enum: ['live', 'die', 'unknown', 'checking', 'pending'],
    required: [true, 'Card status is required'],
    default: 'unknown'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },
  // Chủ sở hữu thực tế đã gửi thẻ (để tính tiền), khác với userId (stock Zenno)
  originUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Mã phiên check để gom thống kê realtime
  sessionId: {
    type: String,
    trim: true
  },
  apiId: {
    type: String,
    trim: true
    // ID từ API bên ngoài
  },
  // Đã được tính tiền cho lần check này hay chưa (tránh double charge)
  billed: {
    type: Boolean,
    default: false
  },
  billAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  checkSource: {
    type: String,
    enum: ['unknown','google','wm','zenno','777'],
    default: 'unknown'
  },
  checkedAt: {
    type: Date
  },
  price: {
    type: Number,
    min: [0, 'Price cannot be negative'],
    default: 0
  },
  typeCheck: {
    type: Number,
    enum: [1, 2], // 1=CheckLive, 2=CheckCharge
    default: 1
  },
  bin: {
    type: String,
    trim: true,
    match: [/^\d{6}$/, 'BIN must be 6 digits']
  },
  brand: {
    type: String,
    enum: ['visa', 'mastercard', 'amex', 'discover', 'jcb', 'diners', 'unknown'],
    default: 'unknown'
  },
  country: {
    type: String,
    trim: true,
    uppercase: true,
    match: [/^[A-Z]{2}$/, 'Country must be 2-letter code']
  },
  bank: {
    type: String,
    trim: true
  },
  level: {
    type: String,
    enum: ['classic', 'gold', 'platinum', 'black', 'unknown'],
    default: 'unknown'
  },
  zennoposter: {
    type: Number,
    default: 0, // 0 = chưa có result từ ZennoPoster, 1 = đã có result
    index: true
  },
  errorMessage: {
    type: String,
    trim: true
  },
  checkAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lastCheckAt: {
    type: Date
  },
  // Deadline cho lần check hiện tại (dùng để reset nếu Zenno không trả đúng hạn)
  checkDeadlineAt: {
    type: Date
  },
  // Cờ đếm processed cho session (tránh đếm trùng)
  sessionCounted: {
    type: Boolean,
    default: false
  },
  // Cờ đã tính tiền trong session (tránh double billing)
  billedInSession: {
    type: Boolean,
    default: false,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for masked card number
cardSchema.virtual('maskedCardNumber').get(function() {
  if (!this.cardNumber) return '';
  const cardNum = this.cardNumber;
  return cardNum.substring(0, 6) + '*'.repeat(cardNum.length - 10) + cardNum.substring(cardNum.length - 4);
});

// Virtual for card age (days since created)
cardSchema.virtual('ageInDays').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Index for better performance
cardSchema.index({ cardNumber: 1 });
cardSchema.index({ userId: 1 });
cardSchema.index({ originUserId: 1 });
cardSchema.index({ sessionId: 1 });
cardSchema.index({ status: 1 });
cardSchema.index({ bin: 1 });
cardSchema.index({ brand: 1 });
cardSchema.index({ createdAt: -1 });
cardSchema.index({ checkedAt: -1 });
cardSchema.index({ userId: 1, status: 1 });
cardSchema.index({ userId: 1, createdAt: -1 });
cardSchema.index({ sessionId: 1, status: 1 });

// Compound index for efficient queries
cardSchema.index({ fullCard: 1, userId: 1 }, { unique: true });

// Pre-save middleware to extract card information
cardSchema.pre('save', function(next) {
  if (this.isModified('cardNumber') || this.isNew) {
    // Extract BIN (first 6 digits)
    if (this.cardNumber && this.cardNumber.length >= 6) {
      this.bin = this.cardNumber.substring(0, 6);
      
      // Determine card brand based on BIN
      this.brand = this.determineBrand(this.cardNumber);
    }
    
    // Update fullCard format if individual fields are provided
    if (this.cardNumber && this.expiryMonth && this.expiryYear && this.cvv) {
      this.fullCard = `${this.cardNumber}|${this.expiryMonth}|${this.expiryYear}|${this.cvv}`;
    }
  }
  
  next();
});

// Instance method to determine card brand
cardSchema.methods.determineBrand = function(cardNumber) {
  const firstDigit = cardNumber.charAt(0);
  const firstTwoDigits = cardNumber.substring(0, 2);
  const firstThreeDigits = cardNumber.substring(0, 3);
  const firstFourDigits = cardNumber.substring(0, 4);

  // Visa
  if (firstDigit === '4') {
    return 'visa';
  }
  
  // Mastercard
  if (firstTwoDigits >= '51' && firstTwoDigits <= '55') {
    return 'mastercard';
  }
  if (firstFourDigits >= '2221' && firstFourDigits <= '2720') {
    return 'mastercard';
  }
  
  // American Express
  if (firstTwoDigits === '34' || firstTwoDigits === '37') {
    return 'amex';
  }
  
  // Discover
  if (firstFourDigits === '6011' || firstTwoDigits === '65' || 
      (firstThreeDigits >= '644' && firstThreeDigits <= '649')) {
    return 'discover';
  }
  
  // JCB
  if (firstFourDigits >= '3528' && firstFourDigits <= '3589') {
    return 'jcb';
  }
  
  // Diners Club
  if ((firstTwoDigits >= '30' && firstTwoDigits <= '38') || 
      firstTwoDigits === '36' || firstTwoDigits === '38') {
    return 'diners';
  }
  
  return 'unknown';
};

// Instance method to update status
cardSchema.methods.updateStatus = async function(status, errorMessage = null) {
  this.status = status;
  this.checkedAt = new Date();
  this.lastCheckAt = new Date();
  this.checkAttempts += 1;
  
  if (errorMessage) {
    this.errorMessage = errorMessage;
  }
  
  await this.save();
};

// Static method to get card statistics
cardSchema.statics.getStatistics = async function(userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalCards: { $sum: 1 },
        liveCards: {
          $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] }
        },
        dieCards: {
          $sum: { $cond: [{ $eq: ['$status', 'die'] }, 1, 0] }
        },
        unknownCards: {
          $sum: { $cond: [{ $eq: ['$status', 'unknown'] }, 1, 0] }
        },
        checkingCards: {
          $sum: { $cond: [{ $eq: ['$status', 'checking'] }, 1, 0] }
        },
        totalPrice: { $sum: '$price' }
      }
    }
  ]);

  const result = stats[0] || {
    totalCards: 0,
    liveCards: 0,
    dieCards: 0,
    unknownCards: 0,
    checkingCards: 0,
    totalPrice: 0
  };

  // Calculate success rate
  result.successRate = result.totalCards > 0 
    ? ((result.liveCards / result.totalCards) * 100).toFixed(2)
    : 0;

  return result;
};

// Static method to get brand statistics
cardSchema.statics.getBrandStatistics = async function(userId = null) {
  const matchStage = userId ? { userId: new mongoose.Types.ObjectId(userId) } : {};
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$brand',
        count: { $sum: 1 },
        liveCount: {
          $sum: { $cond: [{ $eq: ['$status', 'live'] }, 1, 0] }
        },
        dieCount: {
          $sum: { $cond: [{ $eq: ['$status', 'die'] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        brand: '$_id',
        count: 1,
        liveCount: 1,
        dieCount: 1,
        successRate: {
          $cond: [
            { $eq: ['$count', 0] },
            0,
            { $multiply: [{ $divide: ['$liveCount', '$count'] }, 100] }
          ]
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

module.exports = mongoose.model('Card', cardSchema);
