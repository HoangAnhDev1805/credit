/* E2E: LoaiDV=1 -> LoaiDV=2 to update metadata and verify card document */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const qs = require('querystring');
const SiteConfig = require('../models/SiteConfig');
const Card = require('../models/Card');

(async () => {
  const base = process.env.BASE_URL || 'http://localhost:5001';
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/credit_card_checker';
  try {
    await mongoose.connect(mongoUri);

    // Ensure defaults exist so read operations don't fail
    await SiteConfig.initializeDefaults();

    let token = await SiteConfig.getByKey('post_api_token');
    const stockUserId = await SiteConfig.getByKey('post_api_user_id');
    if (!token) token = 'TEST_TOKEN_123';

    console.log('[Step1] POST /api/post/checkcc (LoaiDV=1) ...');
    const res1 = await axios.post(
      base + '/api/post/checkcc',
      qs.stringify({ LoaiDV: '1', token, Amount: '1', TypeCheck: '1' }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    let body1 = res1.data;
    console.log('  status:', res1.status);
    console.log('  body:', typeof body1 === 'string' ? body1 : JSON.stringify(body1));

    // Try to extract Id
    let cardId;
    try {
      if (typeof body1 === 'string') body1 = JSON.parse(body1);
      cardId = body1?.Content?.[0]?.Id || body1?.content?.[0]?.Id;
    } catch {}

    if (!cardId) {
      // Fallback: find the latest unknown/checking card of stock user
      const latest = await Card.findOne({ userId: stockUserId, status: { $in: ['unknown', 'checking'] } })
        .sort({ createdAt: -1 })
        .lean();
      if (!latest) throw new Error('Không tìm thấy thẻ để cập nhật');
      cardId = String(latest._id);
    }

    // Read card to prepare metadata
    const cardDoc = await Card.findById(cardId).lean();
    if (!cardDoc) throw new Error('Card không tồn tại: ' + cardId);

    const bin = (cardDoc.cardNumber || '').slice(0, 6) || '411111';
    const brand = cardDoc.brand || 'visa';
    const country = cardDoc.country || 'US';
    const bank = cardDoc.bank || 'CHASE';
    const level = cardDoc.level || 'platinum';
    const typeCheck = String(cardDoc.typeCheck || 1);

    console.log('[Step2] POST /api/post/update-status (LoaiDV=2) ...');
    const res2 = await axios.post(
      base + '/api/post/update-status',
      qs.stringify({
        LoaiDV: '2',
        token,
        Id: cardId,
        Status: '2',
        From: '3',
        Msg: 'Approved 00',
        BIN: bin,
        Brand: brand,
        Country: country,
        Bank: bank,
        Level: level,
        Type: typeCheck
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    console.log('  status:', res2.status);
    console.log('  body:', typeof res2.data === 'string' ? res2.data : JSON.stringify(res2.data));

    // Verify card updated
    const updated = await Card.findById(cardId).lean();
    console.log('[Verify] Card updated fields:');
    console.log({
      _id: String(updated._id),
      status: updated.status,
      checkedAt: updated.checkedAt,
      bin: updated.bin,
      brand: updated.brand,
      country: updated.country,
      bank: updated.bank,
      level: updated.level,
      typeCheck: updated.typeCheck
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.response?.data || e.message);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();

