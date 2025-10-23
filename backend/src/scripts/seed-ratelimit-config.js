const mongoose = require('mongoose');
const SiteConfig = require('../models/SiteConfig');

const rateLimitConfigs = [
  {
    key: 'ratelimit_auth_window_ms',
    value: 900000, // 15 minutes
    type: 'number',
    category: 'ratelimit',
    label: 'Auth Window (ms)',
    description: 'Thời gian cửa sổ rate limit cho auth endpoints (milliseconds). 900000ms = 15 phút',
    defaultValue: 900000
  },
  {
    key: 'ratelimit_auth_max',
    value: 1000000,
    type: 'number',
    category: 'ratelimit',
    label: 'Auth Max Requests',
    description: 'Số lượng requests tối đa cho auth endpoints trong 1 cửa sổ thời gian',
    defaultValue: 1000000
  },
  {
    key: 'ratelimit_api_window_ms',
    value: 60000, // 1 minute
    type: 'number',
    category: 'ratelimit',
    label: 'API Window (ms)',
    description: 'Thời gian cửa sổ rate limit cho API endpoints (milliseconds). 60000ms = 1 phút',
    defaultValue: 60000
  },
  {
    key: 'ratelimit_api_max',
    value: 1000000,
    type: 'number',
    category: 'ratelimit',
    label: 'API Max Requests',
    description: 'Số lượng requests tối đa cho API endpoints trong 1 cửa sổ thời gian',
    defaultValue: 1000000
  },
  {
    key: 'ratelimit_cardcheck_window_ms',
    value: 300000, // 5 minutes
    type: 'number',
    category: 'ratelimit',
    label: 'Card Check Window (ms)',
    description: 'Thời gian cửa sổ rate limit cho card check endpoints (milliseconds). 300000ms = 5 phút',
    defaultValue: 300000
  },
  {
    key: 'ratelimit_cardcheck_max',
    value: 999999999,
    type: 'number',
    category: 'ratelimit',
    label: 'Card Check Max Requests',
    description: 'Số lượng requests tối đa cho card check endpoints trong 1 cửa sổ thời gian. 999999999 = Unlimited',
    defaultValue: 999999999
  },
  {
    key: 'ratelimit_enabled',
    value: true,
    type: 'boolean',
    category: 'ratelimit',
    label: 'Enable Rate Limiting',
    description: 'Bật/tắt rate limiting cho toàn bộ hệ thống',
    defaultValue: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creditcard');
    console.log('✅ Connected to MongoDB');
    
    for (const config of rateLimitConfigs) {
      await SiteConfig.findOneAndUpdate(
        { key: config.key },
        { $set: config },
        { upsert: true, new: true }
      );
      console.log(`✅ Seeded: ${config.key} = ${config.value}`);
    }
    
    console.log('\n✅ All rate limit configs seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding configs:', error);
    process.exit(1);
  }
}

seed();
