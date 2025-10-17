const mongoose = require('mongoose');

const siteConfigSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Config key is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9_]+$/, 'Key can only contain lowercase letters, numbers, and underscores']
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Config value is required']
  },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'boolean', 'json', 'url', 'email', 'color', 'file'],
    default: 'text'
  },
  category: {
    type: String,
    required: [true, 'Config category is required'],
    trim: true,
    lowercase: true,
    enum: ['seo', 'general', 'pricing', 'payment', 'email', 'social', 'security', 'api', 'ui', 'features']
  },
  label: {
    type: String,
    trim: true,
    maxlength: [100, 'Label cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  placeholder: {
    type: String,
    trim: true,
    maxlength: [200, 'Placeholder cannot exceed 200 characters']
  },
  defaultValue: {
    type: mongoose.Schema.Types.Mixed
  },
  validation: {
    required: {
      type: Boolean,
      default: false
    },
    minLength: {
      type: Number,
      min: 0
    },
    maxLength: {
      type: Number,
      min: 0
    },
    min: {
      type: Number
    },
    max: {
      type: Number
    },
    pattern: {
      type: String
    },
    options: [{
      label: String,
      value: mongoose.Schema.Types.Mixed
    }]
  },
  isPublic: {
    type: Boolean,
    default: false
    // Có thể truy cập từ frontend không cần authentication
  },
  isEditable: {
    type: Boolean,
    default: true
    // Có thể chỉnh sửa từ admin panel không
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for display value
siteConfigSchema.virtual('displayValue').get(function() {
  if (this.type === 'boolean') {
    return this.value ? 'Enabled' : 'Disabled';
  }

  if (this.type === 'json') {
    return JSON.stringify(this.value, null, 2);
  }

  if (this.type === 'file' && this.value) {
    return this.value.split('/').pop(); // Show only filename
  }

  return this.value;
});

// Virtual for formatted label
siteConfigSchema.virtual('displayLabel').get(function() {
  if (this.label) return this.label;

  // Auto-generate label from key
  return this.key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
});

// Index for better performance
siteConfigSchema.index({ key: 1 }, { unique: true });
siteConfigSchema.index({ category: 1, sortOrder: 1 });
siteConfigSchema.index({ isPublic: 1 });
siteConfigSchema.index({ isEditable: 1 });
siteConfigSchema.index({ updatedAt: -1 });

// Pre-save middleware
siteConfigSchema.pre('save', function(next) {
  // Validate value based on type
  try {
    this.validateValue();
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to validate value
siteConfigSchema.methods.validateValue = function() {
  const { value, type, validation } = this;

  // Required validation
  if (validation.required && (value === null || value === undefined || value === '')) {
    throw new Error(`${this.displayLabel} is required`);
  }

  // Type-specific validation
  switch (type) {
    case 'number':
      if (isNaN(value)) {
        throw new Error(`${this.displayLabel} must be a number`);
      }
      if (validation.min !== undefined && value < validation.min) {
        throw new Error(`${this.displayLabel} must be at least ${validation.min}`);
      }
      if (validation.max !== undefined && value > validation.max) {
        throw new Error(`${this.displayLabel} cannot exceed ${validation.max}`);
      }
      break;

    case 'text':
    case 'textarea':
      if (typeof value !== 'string') {
        throw new Error(`${this.displayLabel} must be a string`);
      }
      if (validation.minLength && value.length < validation.minLength) {
        throw new Error(`${this.displayLabel} must be at least ${validation.minLength} characters`);
      }
      if (validation.maxLength && value.length > validation.maxLength) {
        throw new Error(`${this.displayLabel} cannot exceed ${validation.maxLength} characters`);
      }
      if (validation.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          throw new Error(`${this.displayLabel} format is invalid`);
        }
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error(`${this.displayLabel} must be a valid email address`);
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        throw new Error(`${this.displayLabel} must be a valid URL`);
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean') {
        throw new Error(`${this.displayLabel} must be a boolean`);
      }
      break;

    case 'json':
      if (typeof value === 'string') {
        try {
          JSON.parse(value);
        } catch {
          throw new Error(`${this.displayLabel} must be valid JSON`);
        }
      }
      break;

    case 'color':
      const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!colorRegex.test(value)) {
        throw new Error(`${this.displayLabel} must be a valid hex color`);
      }
      break;
  }
};

// Instance method to get typed value
siteConfigSchema.methods.getTypedValue = function() {
  const { value, type } = this;

  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return Boolean(value);
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    default:
      return value;
  }
};

// Static method to get config by key
siteConfigSchema.statics.getByKey = async function(key) {
  const config = await this.findOne({ key });
  return config ? config.getTypedValue() : null;
};

// Static method to get configs by category
siteConfigSchema.statics.getByCategory = async function(category, publicOnly = false) {
  const query = { category };
  if (publicOnly) {
    query.isPublic = true;
  }

  const configs = await this.find(query).sort({ sortOrder: 1, key: 1 });

  const result = {};
  configs.forEach(config => {
    result[config.key] = config.getTypedValue();
  });

  return result;
};

// Static method to get all public configs
siteConfigSchema.statics.getPublicConfigs = async function() {
  const configs = await this.find({ isPublic: true }).sort({ category: 1, sortOrder: 1 });

  const result = {};
  configs.forEach(config => {
    if (!result[config.category]) {
      result[config.category] = {};
    }
    result[config.category][config.key] = config.getTypedValue();
  });

  return result;
};

// Static method to bulk update configs
siteConfigSchema.statics.bulkUpdate = async function(updates, userId) {
  const results = [];

  for (const [key, value] of Object.entries(updates)) {
    try {
      const config = await this.findOneAndUpdate(
        { key },
        {
          value,
          lastModifiedBy: userId,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );

      if (config) {
        results.push({ key, success: true, config });
      } else {
        results.push({ key, success: false, error: 'Config not found' });
      }
    } catch (error) {
      results.push({ key, success: false, error: error.message });
    }
  }

  return results;
};

// Static method to get config statistics
siteConfigSchema.statics.getStatistics = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        publicCount: {
          $sum: { $cond: [{ $eq: ['$isPublic', true] }, 1, 0] }
        },
        editableCount: {
          $sum: { $cond: [{ $eq: ['$isEditable', true] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const totalStats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalConfigs: { $sum: 1 },
        publicConfigs: {
          $sum: { $cond: [{ $eq: ['$isPublic', true] }, 1, 0] }
        },
        editableConfigs: {
          $sum: { $cond: [{ $eq: ['$isEditable', true] }, 1, 0] }
        }
      }
    }
  ]);

  return {
    byCategory: stats,
    total: totalStats[0] || {
      totalConfigs: 0,
      publicConfigs: 0,
      editableConfigs: 0
    }
  };
};

// Static method to initialize default configs
siteConfigSchema.statics.initializeDefaults = async function() {
  const defaultConfigs = [
    // SEO
    { key: 'site_title', value: 'Credit Card Checker', type: 'text', category: 'seo', label: 'Site Title', isPublic: true },
    { key: 'site_description', value: 'Professional Credit Card Checking Service', type: 'textarea', category: 'seo', label: 'Site Description', isPublic: true },
    { key: 'site_keywords', value: 'credit card, checker, validation, security', type: 'text', category: 'seo', label: 'Site Keywords', isPublic: true },

    // Extended SEO / Social meta
    { key: 'canonical_url', value: 'https://checkcc.live', type: 'url', category: 'seo', label: 'Canonical Base URL', isPublic: true },
    { key: 'robots_index', value: true, type: 'boolean', category: 'seo', label: 'Robots: Index', isPublic: true },
    { key: 'robots_follow', value: true, type: 'boolean', category: 'seo', label: 'Robots: Follow', isPublic: true },
    { key: 'robots_advanced', value: '', type: 'text', category: 'seo', label: 'Robots Advanced (optional)', isPublic: true },
    { key: 'og_type', value: 'website', type: 'text', category: 'seo', label: 'OpenGraph Type', isPublic: true },
    { key: 'og_site_name', value: 'Credit Card Checker', type: 'text', category: 'seo', label: 'OpenGraph Site Name', isPublic: true },
    { key: 'og_image', value: '/logo.png', type: 'file', category: 'seo', label: 'OpenGraph Image', isPublic: true },
    { key: 'og_title', value: 'Credit Card Checker', type: 'text', category: 'seo', label: 'OpenGraph Title', isPublic: true },
    { key: 'og_description', value: 'Professional Credit Card Checking Service', type: 'textarea', category: 'seo', label: 'OpenGraph Description', isPublic: true },
    { key: 'twitter_card', value: 'summary_large_image', type: 'text', category: 'seo', label: 'Twitter Card', isPublic: true },
    { key: 'twitter_site', value: '', type: 'text', category: 'seo', label: 'Twitter @site', isPublic: true },
    { key: 'twitter_creator', value: '', type: 'text', category: 'seo', label: 'Twitter @creator', isPublic: true },
    { key: 'twitter_image', value: '/logo.png', type: 'file', category: 'seo', label: 'Twitter Image', isPublic: true },

    // Social Links
    { key: 'social_links', value: { facebook: '', twitter: '', linkedin: '', youtube: '' }, type: 'json', category: 'social', label: 'Social Links', isPublic: true },
    // General
    { key: 'site_logo', value: '/logo.png', type: 'file', category: 'general', label: 'Site Logo', isPublic: true },
    { key: 'site_favicon', value: '/favicon.ico', type: 'file', category: 'general', label: 'Site Favicon', isPublic: true },
    { key: 'site_thumbnail', value: '/logo.png', type: 'file', category: 'general', label: 'Site Thumbnail', isPublic: true },
    { key: 'contact_email', value: 'support@example.com', type: 'email', category: 'general', label: 'Contact Email', isPublic: true },

    // Pricing
    { key: 'default_price_per_card', value: 0.1, type: 'number', category: 'pricing', label: 'Default Price Per Card' },
    { key: 'min_cards_per_check', value: 1, type: 'number', category: 'pricing', label: 'Minimum Cards Per Check' },
    { key: 'max_cards_per_check', value: 1000, type: 'number', category: 'pricing', label: 'Maximum Cards Per Check' },

    // Payment
    { key: 'min_deposit_amount', value: 10, type: 'number', category: 'payment', label: 'Minimum Deposit Amount' },
    { key: 'max_deposit_amount', value: 10000, type: 'number', category: 'payment', label: 'Maximum Deposit Amount' },
    { key: 'payment_usd_to_credit_rate', value: 10, type: 'number', category: 'payment', label: 'USD to Credit Conversion Rate' },
    { key: 'payment_show_buy_credits', value: true, type: 'boolean', category: 'payment', label: 'Show Buy Credits Menu', isPublic: true },
    { key: 'payment_show_crypto_payment', value: true, type: 'boolean', category: 'payment', label: 'Show Crypto Payment Menu', isPublic: true },
    { key: 'payment_credit_packages', value: [
      { id: 1, name: 'Starter', credits: 100, price: 10, popular: false },
      { id: 2, name: 'Basic', credits: 500, price: 45, popular: true },
      { id: 3, name: 'Pro', credits: 1000, price: 80, popular: false },
      { id: 4, name: 'Enterprise', credits: 5000, price: 350, popular: false }
    ], type: 'json', category: 'payment', label: 'Credit Packages' },
    { key: 'payment_credit_per_usd', value: 10, type: 'number', category: 'payment', label: 'Credits per 1 USD', isPublic: true },
    // Crypto USD prices per coin (public)
    { key: 'crypto_usd_prices', value: { 'btc': 60000, 'ltc': 70, 'eth': 3000, 'bep20/usdt': 1, 'trc20/usdt': 1, 'erc20/usdt': 1, 'sol/sol': 150, 'polygon/pol': 0.7 }, type: 'json', category: 'payment', label: 'Crypto USD Prices (per 1 coin)', isPublic: true },

    // UI / Language
    { key: 'ui_default_language', value: 'vi', type: 'text', category: 'ui', label: 'Default Language', isPublic: true },
    { key: 'ui_language_switcher_enabled', value: true, type: 'boolean', category: 'ui', label: 'Show Language Switcher', isPublic: true },
    { key: 'ui_available_languages', value: ['en','vi'], type: 'json', category: 'ui', label: 'Available Languages', isPublic: true },

    // CryptAPI
    { key: 'cryptapi_merchant_address', value: '', type: 'text', category: 'api', label: 'CryptAPI Merchant Address', isPublic: false },
    { key: 'cryptapi_merchant_addresses', value: { 'btc': '', 'ltc': '', 'bep20/usdt': '', 'trc20/usdt': '', 'erc20/usdt': '' }, type: 'json', category: 'api', label: 'CryptAPI Merchant Addresses (per coin)', isPublic: false },
    { key: 'cryptapi_webhook_domain', value: '', type: 'text', category: 'api', label: 'CryptAPI Webhook Public Domain', isPublic: false },
    { key: 'cryptapi_enabled_coins', value: { 'btc': true, 'ltc': true, 'bep20/usdt': true, 'trc20/usdt': false, 'erc20/usdt': false, 'eth': false, 'sol/sol': false, 'polygon/pol': false }, type: 'json', category: 'api', label: 'Enabled Crypto Coins', isPublic: true },

    // Post API (ZennoPoster) config
    { key: 'post_api_token', value: '', type: 'text', category: 'api', label: 'POST API Token', isPublic: false },
    { key: 'post_api_tokens', value: [], type: 'json', category: 'api', label: 'POST API Token List', isPublic: false },
    { key: 'post_api_user_id', value: '', type: 'text', category: 'api', label: 'POST API System User ID (stock)', isPublic: false },

    // Features
    { key: 'enable_registration', value: true, type: 'boolean', category: 'features', label: 'Enable Registration', isPublic: true },
    { key: 'enable_card_generator', value: true, type: 'boolean', category: 'features', label: 'Enable Card Generator', isPublic: true },
    { key: 'maintenance_mode', value: false, type: 'boolean', category: 'features', label: 'Maintenance Mode', isPublic: true },
    { key: 'feature_show_buy_credits', value: true, type: 'boolean', category: 'features', label: 'Show Buy Credits menu', isPublic: true },
    { key: 'feature_show_crypto_payment', value: true, type: 'boolean', category: 'features', label: 'Show Crypto Payment menu', isPublic: true }
  ];

  for (const cfg of defaultConfigs) {
    // Bước 1: upsert chỉ với $setOnInsert để KHÔNG xung đột key khi đồng thời có $set
    await this.updateOne(
      { key: cfg.key },
      {
        $setOnInsert: {
          key: cfg.key,
          value: cfg.value
        }
      },
      { upsert: true }
    );

    // Bước 2: cập nhật metadata bằng $set ở MỘT lệnh riêng (tránh conflict Mongo code 40)
    await this.updateOne(
      { key: cfg.key },
      {
        $set: {
          type: cfg.type,
          category: cfg.category,
          label: cfg.label,
          description: cfg.description || undefined,
          placeholder: cfg.placeholder || undefined,
          defaultValue: cfg.defaultValue || undefined,
          isPublic: !!cfg.isPublic,
          isEditable: cfg.isEditable !== undefined ? cfg.isEditable : true,
          sortOrder: cfg.sortOrder || 0
        }
      }
    );
  }

  return defaultConfigs.length;
};

module.exports = mongoose.model('SiteConfig', siteConfigSchema);
