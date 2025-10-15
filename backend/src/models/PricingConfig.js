const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pricing tier name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  minCards: {
    type: Number,
    required: [true, 'Minimum cards is required'],
    min: [1, 'Minimum cards must be at least 1']
  },
  maxCards: {
    type: Number,
    min: [1, 'Maximum cards must be at least 1'],
    validate: {
      validator: function(value) {
        // maxCards can be null (unlimited) or must be >= minCards
        return value === null || value >= this.minCards;
      },
      message: 'Maximum cards must be greater than or equal to minimum cards'
    }
  },
  pricePerCard: {
    type: Number,
    required: [true, 'Price per card is required'],
    min: [0, 'Price per card cannot be negative']
  },
  discountPercentage: {
    type: Number,
    default: 0,
    min: [0, 'Discount percentage cannot be negative'],
    max: [100, 'Discount percentage cannot exceed 100']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0,
    min: 0
  },
  validFrom: {
    type: Date,
    default: Date.now
  },
  validUntil: {
    type: Date
  },
  applicableUserRoles: [{
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  }],
  minimumBalance: {
    type: Number,
    default: 0,
    min: [0, 'Minimum balance cannot be negative']
  },
  features: [{
    type: String,
    trim: true
  }],
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
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

// Virtual for display range
pricingConfigSchema.virtual('rangeDisplay').get(function() {
  if (this.maxCards === null) {
    return `${this.minCards}+ cards`;
  }
  return `${this.minCards}-${this.maxCards} cards`;
});

// Virtual for effective price (after discount)
pricingConfigSchema.virtual('effectivePrice').get(function() {
  if (this.discountPercentage > 0) {
    return this.pricePerCard * (1 - this.discountPercentage / 100);
  }
  return this.pricePerCard;
});

// Virtual for savings amount
pricingConfigSchema.virtual('savingsAmount').get(function() {
  if (this.discountPercentage > 0) {
    return this.pricePerCard * (this.discountPercentage / 100);
  }
  return 0;
});

// Virtual for average revenue per usage
pricingConfigSchema.virtual('averageRevenuePerUsage').get(function() {
  if (this.usageCount === 0) return 0;
  return (this.totalRevenue / this.usageCount).toFixed(2);
});

// Index for better performance
pricingConfigSchema.index({ isActive: 1, priority: -1 });
pricingConfigSchema.index({ minCards: 1, maxCards: 1 });
pricingConfigSchema.index({ validFrom: 1, validUntil: 1 });
pricingConfigSchema.index({ applicableUserRoles: 1 });
pricingConfigSchema.index({ createdAt: -1 });

// Compound index for efficient pricing queries
pricingConfigSchema.index({ 
  isActive: 1, 
  validFrom: 1, 
  validUntil: 1, 
  minCards: 1, 
  maxCards: 1 
});

// Pre-save middleware
pricingConfigSchema.pre('save', function(next) {
  // Validate date range
  if (this.validUntil && this.validFrom >= this.validUntil) {
    const error = new Error('Valid until date must be after valid from date');
    return next(error);
  }
  
  // Auto-generate name if not provided
  if (!this.name) {
    if (this.maxCards === null) {
      this.name = `${this.minCards}+ Cards Tier`;
    } else {
      this.name = `${this.minCards}-${this.maxCards} Cards Tier`;
    }
  }
  
  next();
});

// Instance method to check if pricing is currently valid
pricingConfigSchema.methods.isCurrentlyValid = function() {
  const now = new Date();
  
  if (!this.isActive) return false;
  if (this.validFrom > now) return false;
  if (this.validUntil && this.validUntil < now) return false;
  
  return true;
};

// Instance method to check if applicable for user role
pricingConfigSchema.methods.isApplicableForRole = function(userRole) {
  return this.applicableUserRoles.includes(userRole);
};

// Instance method to calculate total cost
pricingConfigSchema.methods.calculateTotalCost = function(cardCount) {
  if (cardCount < this.minCards) {
    throw new Error(`Minimum ${this.minCards} cards required for this pricing tier`);
  }
  
  if (this.maxCards && cardCount > this.maxCards) {
    throw new Error(`Maximum ${this.maxCards} cards allowed for this pricing tier`);
  }
  
  return cardCount * this.effectivePrice;
};

// Instance method to update usage statistics
pricingConfigSchema.methods.updateUsageStats = async function(cardCount, revenue) {
  this.usageCount += 1;
  this.totalRevenue += revenue;
  
  await this.save();
};

// Static method to find applicable pricing for card count
pricingConfigSchema.statics.findApplicablePricing = async function(cardCount, userRole = 'user') {
  const now = new Date();
  
  const pricing = await this.findOne({
    isActive: true,
    minCards: { $lte: cardCount },
    $or: [
      { maxCards: { $gte: cardCount } },
      { maxCards: null }
    ],
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $gte: now } },
      { validUntil: null }
    ],
    applicableUserRoles: userRole
  }).sort({ priority: -1, minCards: -1 });
  
  return pricing;
};

// Static method to get all active pricing tiers
pricingConfigSchema.statics.getActivePricingTiers = function(userRole = 'user') {
  const now = new Date();
  
  return this.find({
    isActive: true,
    validFrom: { $lte: now },
    $or: [
      { validUntil: { $gte: now } },
      { validUntil: null }
    ],
    applicableUserRoles: userRole
  }).sort({ priority: -1, minCards: 1 });
};

// Static method to get pricing statistics
pricingConfigSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalTiers: { $sum: 1 },
        activeTiers: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        inactiveTiers: {
          $sum: { $cond: [{ $eq: ['$isActive', false] }, 1, 0] }
        },
        totalUsage: { $sum: '$usageCount' },
        totalRevenue: { $sum: '$totalRevenue' },
        averagePrice: { $avg: '$pricePerCard' },
        minPrice: { $min: '$pricePerCard' },
        maxPrice: { $max: '$pricePerCard' }
      }
    }
  ]);

  const usageStats = await this.aggregate([
    { $match: { usageCount: { $gt: 0 } } },
    {
      $group: {
        _id: '$_id',
        name: { $first: '$name' },
        usageCount: { $first: '$usageCount' },
        totalRevenue: { $first: '$totalRevenue' },
        pricePerCard: { $first: '$pricePerCard' }
      }
    },
    { $sort: { usageCount: -1 } },
    { $limit: 10 }
  ]);

  return {
    overview: stats[0] || {
      totalTiers: 0,
      activeTiers: 0,
      inactiveTiers: 0,
      totalUsage: 0,
      totalRevenue: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0
    },
    topUsedTiers: usageStats
  };
};

// Static method to validate pricing tiers (no overlaps)
pricingConfigSchema.statics.validatePricingTiers = async function() {
  const activeTiers = await this.find({ isActive: true }).sort({ minCards: 1 });
  const overlaps = [];
  
  for (let i = 0; i < activeTiers.length - 1; i++) {
    const current = activeTiers[i];
    const next = activeTiers[i + 1];
    
    if (current.maxCards === null || (current.maxCards >= next.minCards)) {
      overlaps.push({
        tier1: current.name,
        tier2: next.name,
        overlap: `${next.minCards}-${current.maxCards || '∞'}`
      });
    }
  }
  
  return overlaps;
};

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
