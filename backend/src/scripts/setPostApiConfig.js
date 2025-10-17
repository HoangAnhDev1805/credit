/* Utility script to set POST API config for testing */
require('dotenv').config();
const mongoose = require('mongoose');
const SiteConfig = require('../models/SiteConfig');
const User = require('../models/User');

(async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_card_checker';
    await mongoose.connect(uri);

    // Ensure defaults exist
    await SiteConfig.initializeDefaults();

    const admin = await User.findOne({ username: 'admin' });
    let stock = await User.findOne({ username: 'testuser' });
    if (!stock) stock = admin;

    const token = process.env.TEST_POST_API_TOKEN || 'TEST_TOKEN_123';

    const updates = [
      { key: 'post_api_token', value: token },
      { key: 'post_api_tokens', value: [token] },
      { key: 'post_api_user_id', value: String(stock._id) },
    ];

    for (const u of updates) {
      await SiteConfig.updateOne(
        { key: u.key },
        {
          $set: {
            value: u.value,
            key: u.key,
            category: 'api',
            type: Array.isArray(u.value) ? 'json' : 'text',
            isEditable: true,
          },
        },
        { upsert: true }
      );
    }

    const out = await SiteConfig.find({ key: { $in: updates.map((u) => u.key) } }).lean();
    console.log(JSON.stringify({ ok: true, out }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e);
    process.exit(1);
  }
})();

