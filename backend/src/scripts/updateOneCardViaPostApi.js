/* Find one card for stock user and update via POST API */
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const SiteConfig = require('../models/SiteConfig');
const Card = require('../models/Card');

(async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_card_checker';
    await mongoose.connect(uri);

    const token = (await SiteConfig.getByKey('post_api_token')) || 'TEST_TOKEN_123';
    const stockUserId = await SiteConfig.getByKey('post_api_user_id');

    const card = await Card.findOne({ userId: stockUserId, status: { $in: ['unknown', 'checking'] } }).sort({ createdAt: -1 });
    if (!card) throw new Error('No card found to update');

    const id = String(card._id);

    const payload = new URLSearchParams({
      LoaiDV: '2',
      token: token,
      Id: id,
      Status: '2', // live
      From: '3',
      Msg: 'Approved 00',
      BIN: card.cardNumber ? String(card.cardNumber).slice(0, 6) : '411111',
      Brand: card.brand || 'visa',
      Country: card.country || 'US',
      Bank: card.bank || 'TESTBANK',
      Level: card.level || 'platinum',
      Type: String(card.typeCheck || 1)
    });

    const base = process.env.BASE_URL || 'http://localhost:5001';
    const res = await axios.post(`${base}/api/post/update-status`, payload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log('HTTP', res.status, res.data);
    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
})();

