const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  avatar: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },

  totalCardsSubmitted: {
    type: Number,
    default: 0,
    min: 0
  },
  totalLiveCards: {
    type: Number,
    default: 0,
    min: 0
  },
  totalDieCards: {
    type: Number,
    default: 0,
    min: 0
  },
  lastLogin: {
    type: Date
  },
  refreshToken: {
    type: String,
    select: false
  },
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpire: {
    type: Date,
    select: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for success rate
userSchema.virtual('successRate').get(function() {
  if (this.totalCardsSubmitted === 0) return 0;
  return ((this.totalLiveCards / this.totalCardsSubmitted) * 100).toFixed(2);
});

// Index for better performance
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method to update card statistics
userSchema.methods.updateCardStats = async function(status) {
  this.totalCardsSubmitted += 1;

  if (status === 'live') {
    this.totalLiveCards += 1;
  } else if (status === 'die') {
    this.totalDieCards += 1;
  }

  await this.save();
};

// Instance method to update balance
userSchema.methods.updateBalance = async function(amount, type = 'add') {
  if (type === 'add') {
    this.balance += amount;
  } else if (type === 'subtract') {
    if (this.balance < amount) {
      throw new Error('Insufficient balance');
    }
    this.balance -= amount;
  }

  await this.save();
  return this.balance;
};

// Static method to find active users
userSchema.statics.findActiveUsers = function() {
  return this.find({ status: 'active' });
};

// Static method to get user statistics
userSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        blockedUsers: {
          $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] }
        },
        totalBalance: { $sum: '$balance' },
        totalCardsSubmitted: { $sum: '$totalCardsSubmitted' },
        totalLiveCards: { $sum: '$totalLiveCards' },
        totalDieCards: { $sum: '$totalDieCards' }
      }
    }
  ]);

  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    blockedUsers: 0,
    totalBalance: 0,
    totalCardsSubmitted: 0,
    totalLiveCards: 0,
    totalDieCards: 0
  };
};

module.exports = mongoose.model('User', userSchema);
