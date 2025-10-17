/* Seed one test card into stock user (post_api_user_id) */
require('dotenv').config();
const mongoose = require('mongoose');
const SiteConfig = require('../models/SiteConfig');
const Card = require('../models/Card');

(async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_card_checker';
    await mongoose.connect(uri);

    const stockUserId = await SiteConfig.getByKey('post_api_user_id');
    if (!stockUserId) throw new Error('Missing post_api_user_id in SiteConfig');

    const fullCard = '4111111111111111|12|26|123';
    const [cardNumber, expiryMonth, expiryYear, cvv] = fullCard.split('|');

    const doc = new Card({
      fullCard,
      cardNumber,
      expiryMonth,
      expiryYear,
      cvv,
      status: 'unknown',
      userId: stockUserId,
      originUserId: stockUserId,
      billed: false,
      price: 0,
      typeCheck: 1,
      checkSource: 'seed-script'
    });

    await doc.save();
    console.log(JSON.stringify({ ok: true, id: String(doc._id), cardNumber }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e);
    process.exit(1);
  }
})();

