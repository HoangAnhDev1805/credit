const mongoose = require('mongoose');
const crypto = require('crypto');
const Card = require('../models/Card');
const User = require('../models/User');
const SiteConfig = require('../models/SiteConfig');
const PricingConfig = require('../models/PricingConfig');
const CheckSession = require('../models/CheckSession');
const Transaction = require('../models/Transaction');
const logger = require('../config/logger');

function determineBrandLocal(cardNumber) {
  const firstDigit = cardNumber.charAt(0);
  const firstTwoDigits = cardNumber.substring(0, 2);
  const firstThreeDigits = cardNumber.substring(0, 3);
  const firstFourDigits = cardNumber.substring(0, 4);
  if (firstDigit === '4') return 'visa';
  if ((firstTwoDigits >= '51' && firstTwoDigits <= '55') || (firstFourDigits >= '2221' && firstFourDigits <= '2720')) return 'mastercard';
  if (firstTwoDigits === '34' || firstTwoDigits === '37') return 'amex';
  if (firstFourDigits === '6011' || firstTwoDigits === '65' || (firstThreeDigits >= '644' && firstThreeDigits <= '649')) return 'discover';
  if (firstFourDigits >= '3528' && firstFourDigits <= '3589') return 'jcb';
  if ((firstTwoDigits >= '30' && firstTwoDigits <= '38') || firstTwoDigits === '36' || firstTwoDigits === '38') return 'diners';
  return 'unknown';
}

function parseCards(input) {
  // input có thể là array các object {cardNumber,expiryMonth,expiryYear,cvv}
  // hoặc là string (textarea) chia dòng "cc|mm|yy|cvv"
  const lines = Array.isArray(input)
    ? input.map(c => `${c.cardNumber}|${c.expiryMonth}|${c.expiryYear}|${c.cvv}`)
    : String(input || '').split('\n');
  const out = [];
  for (const raw of lines) {
    const line = String(raw).trim();
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length < 4) continue;
    const [num, mm, yy, cvv] = parts;
    if (!/^\d{13,19}$/.test(num)) continue;
    const mm2 = mm.padStart(2, '0');
    if (!/^(0[1-9]|1[0-2])$/.test(mm2)) continue;
    if (!/^\d{2,4}$/.test(yy)) continue;
    if (!/^\d{3,4}$/.test(cvv)) continue;
    out.push({ cardNumber: num, expiryMonth: mm2, expiryYear: yy, cvv, fullCard: `${num}|${mm2}|${yy}|${cvv}` });
  }
  return out;
}

async function getPricePerCard(count) {
  // Ưu tiên PricingConfig theo số lượng
  const tier = await PricingConfig.findApplicablePricing(count, 'user');
  if (tier) return Number(tier.effectivePrice || tier.pricePerCard || 0);
  // fallback SiteConfig
  const def = await SiteConfig.getByKey('default_price_per_card');
  return Number(def || 0);
}

exports.startOrStop = async (req, res) => {
  try {
    const { cards, stop = false, sessionId, checkType = 1, gate = 'cvv_veo' } = req.body || {};
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (stop) {
      if (!sessionId) return res.status(400).json({ success: false, message: 'Thiếu sessionId' });
      const session = await CheckSession.findOneAndUpdate(
        { sessionId, userId },
        { $set: { stopRequested: true, status: 'stopped', endedAt: new Date() } },
        { new: true }
      );
      if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });
      return res.json({ success: true, message: 'Đã yêu cầu dừng', data: { session } });
    }

    // Bắt đầu session mới
    const parsed = parseCards(cards);
    if (parsed.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách thẻ không hợp lệ' });
    }

    const pricePerCard = await getPricePerCard(parsed.length);

    // Kiểm tra số dư
    const user = await User.findById(userId);
    const estimated = Math.round(parsed.length * pricePerCard * 100) / 100;
    if ((user.balance || 0) < estimated) {
      return res.status(400).json({ success: false, message: `Số dư không đủ Credits. Cần ${estimated.toFixed(0)} credits, hiện có ${(user.balance||0).toFixed(0)} credits` });
    }

    // Lấy userId stock zenno
    const stockUserId = await SiteConfig.getByKey('post_api_user_id');
    if (!stockUserId || !mongoose.Types.ObjectId.isValid(String(stockUserId))) {
      return res.status(500).json({ success: false, message: 'Chưa cấu hình post_api_user_id (stock)' });
    }

    const sid = crypto.randomUUID();
    const session = await CheckSession.create({ sessionId: sid, userId, total: parsed.length, pending: parsed.length, pricePerCard, gate });

    // Insert cards vào stock user, gắn originUserId + sessionId
    const docs = parsed.map(c => {
      const bin = c.cardNumber?.slice(0,6) || undefined;
      const brand = c.cardNumber ? determineBrandLocal(c.cardNumber) : 'unknown';
      return {
        cardNumber: c.cardNumber,
        expiryMonth: c.expiryMonth,
        expiryYear: c.expiryYear,
        cvv: c.cvv,
        fullCard: c.fullCard,
        status: 'unknown',
        userId: new mongoose.Types.ObjectId(String(stockUserId)),
        originUserId: new mongoose.Types.ObjectId(String(userId)),
        sessionId: sid,
        price: pricePerCard,
        typeCheck: Number(checkType) === 2 ? 2 : 1,
        bin,
        brand
      };
    });

    // Handle duplicate cards - use upsert instead of insertMany
    const bulkOps = docs.map(doc => ({
      updateOne: {
        filter: { cardNumber: doc.cardNumber, userId: doc.userId },
        update: { $set: doc },
        upsert: true
      }
    }));

    await Card.bulkWrite(bulkOps, { ordered: false });

    return res.json({ success: true, message: 'Đã tạo phiên kiểm tra', data: { sessionId: sid, estimatedCost: estimated, pricePerCard, total: parsed.length } });
  } catch (err) {
    logger.error('startOrStop error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: err.message });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const sessionId = req.params.sessionId || req.query.sessionId;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const session = await CheckSession.findOne({ sessionId, userId });
    if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });

    // Tính toán lại thống kê từ collection Card (tránh sai lệch)
    const agg = await Card.aggregate([
      { $match: { sessionId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const counts = agg.reduce((acc, it) => { acc[it._id] = it.count; return acc; }, {});
    const total = await Card.countDocuments({ sessionId });
    const processed = total - (counts['unknown'] || 0) - (counts['checking'] || 0);
    const live = counts['live'] || 0;
    const die = counts['die'] || 0;
    const error = 0; // chưa có cờ riêng, lỗi được map vào errorMessage nếu cần
    const unknown = counts['unknown'] || 0;
    const pending = total - processed;

    const pricePerCard = session.pricePerCard || 0;
    const billedAmount = await Card.aggregate([
      { $match: { sessionId, billed: true } },
      { $group: { _id: null, total: { $sum: '$billAmount' } } }
    ]).then(r => (r[0]?.total || 0));

    // Cập nhật session snapshot
    session.set({ processed, pending, live, die, error, unknown, billedAmount });
    if (pending === 0 && session.status !== 'completed') {
      session.status = 'completed';
      session.endedAt = new Date();
    }

    // Handle billing when session is completed and not yet billed
    if (session.status === 'completed' && !session.billedAt) {
      // Bill only finished cards (live + die) that haven't been billed
      const cardsToBill = await Card.find({ sessionId, status: { $in: ['live', 'die'] }, billed: { $ne: true } });
      const finishedCount = cardsToBill.length;

      if (finishedCount > 0) {
        // Determine pricing tier based on number of successfully checked cards
        const tier = await PricingConfig.findApplicablePricing(finishedCount, 'user');
        const pricePerCardToUse = Number(tier?.effectivePrice ?? tier?.pricePerCard ?? session.pricePerCard ?? 0);

        const totalBill = finishedCount * pricePerCardToUse;

        if (totalBill > 0) {
          await Transaction.createTransaction({
            userId: session.userId,
            type: 'card_check',
            amount: -totalBill,
            description: `Charge for card check session ${sessionId}`,
            relatedId: session._id,
            relatedModel: 'CheckSession',
            metadata: {
              sessionId,
              cardCount: finishedCount,
              pricePerCard: pricePerCardToUse
            }
          });

          // Mark cards as billed with the applied per-card price
          const cardIdsToUpdate = cardsToBill.map(c => c._id);
          await Card.updateMany(
            { _id: { $in: cardIdsToUpdate } },
            { $set: { billed: true, billAmount: pricePerCardToUse } }
          );

          session.billedAmount = totalBill;
          session.billedAt = new Date();
        }
      }
    }

    await session.save();

    // Lấy 50 kết quả mới nhất để hiển thị realtime
    const recent = await Card.find({ sessionId }).sort({ updatedAt: -1 }).limit(50).select('fullCard status errorMessage');

    return res.json({
      success: true,
      data: {
        session: {
          sessionId: session.sessionId,
          status: session.status,
          stopRequested: session.stopRequested,
          total,
          processed,
          pending,
          live,
          die,
          error,
          unknown,
          pricePerCard,
          billedAmount,
          progress: total > 0 ? Math.round((processed / total) * 100) : 0
        },
        results: recent.map(c => ({ card: c.fullCard, status: c.status, response: c.errorMessage }))
      }
    });
  } catch (err) {
    logger.error('getStatus error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: err.message });
  }
};

