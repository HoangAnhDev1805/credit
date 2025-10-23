const mongoose = require('mongoose');
const crypto = require('crypto');
const Card = require('../models/Card');
const User = require('../models/User');
const SiteConfig = require('../models/SiteConfig');
const PricingConfig = require('../models/PricingConfig');
const Gate = require('../models/Gate');
const CheckSession = require('../models/CheckSession');
const Transaction = require('../models/Transaction');
const logger = require('../config/logger');
const RedisCache = require('../services/RedisCache');

// Debounce map for session:update events
const sessionDebounceTimers = new Map();
const sessionDebouncePayloads = new Map();

function emitSessionUpdateDebounced(io, userRoom, sid, payload, delayMs = 200) {
  try {
    const key = String(sid || '');
    const merged = { ...(sessionDebouncePayloads.get(key) || {}), ...(payload || {}) };
    sessionDebouncePayloads.set(key, merged);
    if (sessionDebounceTimers.has(key)) {
      clearTimeout(sessionDebounceTimers.get(key));
    }
    const t = setTimeout(() => {
      try {
        const p = sessionDebouncePayloads.get(key) || payload || {};
        if (io) {
          if (userRoom) io.to(String(userRoom)).emit('checker:session:update', p);
          io.to(`session:${key}`).emit('checker:session:update', p);
        }
      } finally {
        sessionDebounceTimers.delete(key);
        sessionDebouncePayloads.delete(key);
      }
    }, delayMs);
    sessionDebounceTimers.set(key, t);
  } catch (_) {}
}

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
  
  if (!input) return [];
  
  const lines = Array.isArray(input)
    ? input.map(c => {
        // Handle object format
        if (c && typeof c === 'object') {
          const num = String(c.cardNumber || '').trim();
          const mm = String(c.expiryMonth || '').trim();
          const yy = String(c.expiryYear || '').trim();
          const cvv = String(c.cvv || '').trim();
          if (!num || !mm || !yy || !cvv) return '';
          return `${num}|${mm}|${yy}|${cvv}`;
        }
        return String(c || '');
      })
    : String(input || '').split('\n');
    
  const out = [];
  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length < 4) continue;
    const [num, mm, yy, cvv] = parts.map(p => String(p || '').trim());
    if (!num || !mm || !yy || !cvv) continue;
    if (!/^\d{13,19}$/.test(num)) continue;
    const mm2 = mm.padStart(2, '0');
    if (!/^(0[1-9]|1[0-2])$/.test(mm2)) continue;
    if (!/^\d{2,4}$/.test(yy)) continue;
    if (!/^\d{3,4}$/.test(cvv)) continue;
    out.push({ cardNumber: num, expiryMonth: mm2, expiryYear: yy, cvv, fullCard: `${num}|${mm2}|${yy}|${cvv}` });
  }
  return out;
}

async function getPricePerCardByTypeCheck(typeCheck) {
  // Ưu tiên giá theo từng GATE (creditCost)
  try {
    const g = await Gate.getByTypeCheck(Number(typeCheck));
    if (g && typeof g.creditCost === 'number') return Math.max(0, Number(g.creditCost));
  } catch {}
  // fallback SiteConfig
  const def = await SiteConfig.getByKey('default_price_per_card');
  const v = Number(def || 1);
  return isNaN(v) ? 1 : v;
}

exports.startOrStop = async (req, res) => {
  try {
    const { cards, stop = false, sessionId, checkType = 1, gate = 'cvv_veo' } = req.body || {};
    const userId = req.user && req.user.id;
    
    logger.info('[startOrStop] Request:', { userId, stop, sessionId, checkType, gate, cardsCount: Array.isArray(cards) ? cards.length : 'not-array' });
    
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    if (stop) {
      if (!sessionId) return res.status(400).json({ success: false, message: 'Thiếu sessionId' });
      
      // Update session status
      const session = await CheckSession.findOneAndUpdate(
        { sessionId, userId },
        { $set: { stopRequested: true, status: 'stopped', endedAt: new Date() } },
        { new: true }
      );
      if (!session) return res.status(404).json({ success: false, message: 'Session không tồn tại' });
      
      // Update all pending/checking cards to 'stopped' status (NOT 'unknown' to prevent requeue)
      const updateResult = await Card.updateMany(
        { 
          sessionId, 
          status: { $in: ['pending', 'checking'] },
          zennoposter: 0 // Chỉ update cards chưa có result từ ZennoPoster
        },
        { 
          $set: { 
            status: 'stopped',
            errorMessage: 'Stopped by user',
            zennoposter: 0 // KHÔNG mark zennoposter=1 vì đây KHÔNG phải kết quả từ ZennoPoster
          } 
        }
      );
      
      logger.info(`[StopChecking] Session ${sessionId}: Updated ${updateResult.modifiedCount || 0} pending/checking cards to stopped`);
      
      // Emit socket event to notify user
      try {
        const io = req.app.get('io');
        if (io) {
          io.to(String(userId)).emit('checker:session:stopped', { sessionId });
          io.to(`session:${sessionId}`).emit('checker:session:stopped', { sessionId });
        }
      } catch (err) {
        logger.error('[StopChecking] Failed to emit socket event:', err);
      }
      
      return res.json({ success: true, message: 'Đã dừng checking và cập nhật trạng thái thẻ', data: { session } });
    }

    // Bắt đầu session mới
    const parsed = parseCards(cards);
    logger.info('[startOrStop] Parsed cards:', { parsedCount: parsed.length, inputType: typeof cards });
    
    if (parsed.length === 0) {
      logger.warn('[startOrStop] No valid cards parsed');
      return res.status(400).json({ success: false, message: 'Danh sách thẻ không hợp lệ. Định dạng: CC|MM|YY|CVV' });
    }

    const pricePerCard = await getPricePerCardByTypeCheck(checkType);

    // Kiểm tra số dư
    const user = await User.findById(userId);
    const estimated = Math.round(parsed.length * pricePerCard * 100) / 100;
    if ((user.balance || 0) < estimated) {
      return res.status(400).json({ success: false, message: `Số dư không đủ Credits. Cần ${estimated.toFixed(0)} credits, hiện có ${(user.balance||0).toFixed(0)} credits` });
    }

    // Lấy userId stock zenno
    const stockUserId = await SiteConfig.getByKey('post_api_user_id');
    let stockIdStr = String(stockUserId || '').trim();
    if (!stockIdStr || !mongoose.Types.ObjectId.isValid(stockIdStr)) {
      stockIdStr = String(userId);
    }

    const sid = crypto.randomUUID();
    // Lấy timeoutSec từ cấu hình
    let timeoutSec = Number(await SiteConfig.getByKey('checker_card_timeout_sec')) || 120;
    
    // Insert cards vào stock user, gắn originUserId + sessionId
    const docsAll = parsed.map(c => {
      const bin = c.cardNumber?.slice(0,6) || undefined;
      const brand = c.cardNumber ? determineBrandLocal(c.cardNumber) : 'unknown';
      return {
        cardNumber: c.cardNumber,
        expiryMonth: c.expiryMonth,
        expiryYear: c.expiryYear,
        cvv: c.cvv,
        fullCard: `${c.cardNumber}|${String(c.expiryMonth).padStart(2,'0')}|${c.expiryYear}|${c.cvv}`,
        userId: stockIdStr,
        originUserId: userId,
        sessionId: sid,
        status: 'pending',
        typeCheck: Number(checkType),
        brand,
        bin
      };
    });
    
    // Deduplicate by fullCard to prevent E11000 error when user submits same card multiple times
    const seenFullCards = new Map();
    const docs = [];
    for (const doc of docsAll) {
      if (!seenFullCards.has(doc.fullCard)) {
        seenFullCards.set(doc.fullCard, true);
        docs.push(doc);
      }
    }
    
    if (docsAll.length !== docs.length) {
      logger.info(`[startOrStop] Deduplicated ${docsAll.length - docs.length} duplicate cards in batch`);
    }
    
    // Create session AFTER deduplication to have correct total count
    const session = await CheckSession.create({ 
      sessionId: sid, 
      userId, 
      total: docs.length,      // Use deduplicated count
      pending: docs.length,    // Use deduplicated count
      pricePerCard, 
      gate 
    });
    
    // Emit session start event
    try {
      const io = req.app.get('io');
      if (io) {
        const payload = { sessionId: sid, total: docs.length, pricePerCard, timeoutSec };
        io.to(String(userId)).emit('checker:session:start', payload);
        io.to(`session:${sid}`).emit('checker:session:start', payload);
      }
    } catch (err) {
      logger.warn('[startOrStop] Failed to emit session:start event:', err.message);
    }

    // Check Redis cache first for DIE cards
    const fullCards = Array.from(new Set(docs.map(d => d.fullCard))).filter(Boolean);
    const cachedResults = new Map();
    try {
      for (const fullCard of fullCards) {
        const cached = await RedisCache.get(fullCard, String(checkType));
        if (cached && (cached.status === 'die' || cached.status === 'Die')) {
          cachedResults.set(fullCard, cached);
        }
      }
    } catch (err) {
      logger.warn('Redis cache check failed (skipping):', err.message);
    }

    // Find duplicates among existing stock cards (DB)
    // Chỉ lấy các record đã có kết quả từ ZennoPoster (zennoposter=1)
    const existingCards = await Card.find({ userId: stockIdStr, $or: [ { fullCard: { $in: fullCards } }, { cardNumber: { $in: docs.map(d=>d.cardNumber) } } ], zennoposter: 1 });
    const existingByFull = new Map(existingCards.map(ec => [ec.fullCard, ec]));
    const existingByNumberMap = new Map();
    for (const ec of existingCards) {
      if (!existingByNumberMap.has(ec.cardNumber)) existingByNumberMap.set(ec.cardNumber, []);
      existingByNumberMap.get(ec.cardNumber).push(ec);
    }

    // Prepare immediate results and updates for existing docs
    const io = req.app && req.app.get ? req.app.get('io') : null;
    let immediateDieCount = 0;
    for (const d of docs) {
      // Check Redis cache first
      const cachedDie = cachedResults.get(d.fullCard);
      let ex = null;
      
      if (cachedDie) {
        // Create a pseudo-existing card from cache to reuse delay logic
        ex = {
          _id: null, // Will create new doc
          fullCard: d.fullCard,
          cardNumber: d.cardNumber,
          status: 'die',
          errorMessage: cachedDie.response || 'Declined (cached)',
          fromCache: true
        };
      } else {
        // Check DB existing cards
        ex = existingByFull.get(d.fullCard);
        if (!ex) {
          const list = existingByNumberMap.get(d.cardNumber) || [];
          // Prefer DIE among same cardNumber
          ex = list.find(it => String(it.status||'').toLowerCase()==='die' || String(it.status||'').toLowerCase()==='dead') || list[0];
        }
      }
      
      if (!ex) continue;
      const exStatus = String(ex.status || '').toLowerCase();
      if (exStatus === 'die' || exStatus === 'dead') {
        // Assign to session and prevent Zenno from fetching; keep UI as Checking until reveal
        const minDelay = 30; // seconds
        const maxDelay = 600; // seconds
        const delaySec = Math.floor(minDelay + Math.random() * (maxDelay - minDelay + 1));
        const revealAt = new Date(Date.now() + delaySec * 1000);
        
        let cardDoc = ex;
        if (ex.fromCache) {
          // Upsert card from cache (prevent race condition with duplicate inserts)
          // Split fields: static fields in $setOnInsert, dynamic fields in $set
          const result = await Card.findOneAndUpdate(
            { fullCard: d.fullCard, userId: d.userId },
            {
              $setOnInsert: {
                // Static fields - only set on INSERT
                cardNumber: d.cardNumber,
                expiryMonth: d.expiryMonth,
                expiryYear: d.expiryYear,
                cvv: d.cvv,
                fullCard: d.fullCard,
                userId: d.userId,
                originUserId: d.originUserId,
                typeCheck: d.typeCheck,
                brand: d.brand,
                bin: d.bin,
                createdAt: new Date()
              },
              $set: {
                // Dynamic fields - always update
                sessionId: sid,
                status: 'checking',
                zennoposter: 1,
                checkDeadlineAt: revealAt,
                lastCheckAt: new Date(),
                errorMessage: ex.errorMessage || 'Declined (cached)',
                price: d.price
              }
            },
            { upsert: true, new: true }
          );
          cardDoc = result;
        } else {
          // Update existing card from DB
          await Card.updateOne(
            { _id: ex._id },
            { $set: { sessionId: sid, status: 'checking', zennoposter: 1, checkDeadlineAt: revealAt, lastCheckAt: new Date() } }
          );
        }
        immediateDieCount++;

        // Schedule delayed reveal, billing, and UI updates to align with per-card timeout
        const cardId = cardDoc._id || ex._id;
        setTimeout(async () => {
          try {
            await Card.updateOne({ _id: cardId }, { $set: { status: 'die', checkedAt: new Date() } });
          } catch (_) {}

          try {
            const pricePerCardToUse = Number(pricePerCard || 0) || 0;
            // Mark counted once per session
            let shouldInc = false;
            try {
              const r = await Card.updateOne(
                { _id: cardId, sessionId: sid, sessionCounted: { $ne: true } },
                { $set: { sessionCounted: true } }
              );
              shouldInc = (r && (r.modifiedCount === 1 || r.nModified === 1));
            } catch {}

            // Mark billed once per session (also set billAmount)
            let shouldBill = false;
            try {
              const r2 = await Card.updateOne(
                { _id: cardId, sessionId: sid, billedInSession: { $ne: true } },
                { $set: { billedInSession: true, billAmount: pricePerCardToUse } }
              );
              shouldBill = (r2 && (r2.modifiedCount === 1 || r2.nModified === 1));
            } catch {}

            if (shouldBill && pricePerCardToUse > 0) {
              // Charge the origin owner of the card (use d.originUserId since cardDoc might not have it)
              const chargeUserId = String(d.originUserId || userId);
              await Transaction.createTransaction({
                userId: chargeUserId,
                type: 'card_check',
                amount: -pricePerCardToUse,
                description: `Charge for cached DIE card ${String(cardId)} in session ${String(sid)}`,
                relatedId: cardId,
                relatedModel: 'Card',
                metadata: { sessionId: sid, cachedResult: true, cardId: cardId, status: 'die', delayed: true, fromRedis: ex.fromCache || false }
              });
            }

            let updatedSession = null;
            if (shouldInc) {
              try {
                updatedSession = await CheckSession.findOneAndUpdate(
                  { sessionId: sid },
                  { $inc: { processed: 1, die: 1, billedAmount: shouldBill ? pricePerCardToUse : 0 } },
                  { new: true }
                ).lean();
              } catch {}
            }

            try {
              if (io) {
                const u = await User.findById(userId).select('balance');
                io.to(String(userId)).emit('user:balance-changed', { balance: u ? u.balance : undefined });
                if (updatedSession) {
                  const pendingNow = Math.max(0, Number(updatedSession.total || 0) - Number(updatedSession.processed || 0));
                  const progressNow = Number(updatedSession.total || 0) > 0 ? Math.round((Number(updatedSession.processed || 0) / Number(updatedSession.total || 0)) * 100) : 0;
                  io.to(String(userId)).emit('checker:session:update', {
                    sessionId: sid,
                    total: Number(updatedSession.total || 0),
                    processed: Number(updatedSession.processed || 0),
                    pending: pendingNow,
                    live: Number(updatedSession.live || 0),
                    die: Number(updatedSession.die || 0),
                    error: Number(updatedSession.error || 0),
                    unknown: Number(updatedSession.unknown || 0),
                    pricePerCard: pricePerCardToUse,
                    billedAmount: Number(updatedSession.billedAmount || 0),
                    progress: progressNow
                  });
                }
              }
            } catch {}
          } catch (billErr) {
            logger.error('Delayed DIE billing error:', billErr);
          }

          // Emit card result to FE after delay; indicate serverDelayed to avoid extra FE delay
          try {
            if (io) {
              io.to(String(userId)).emit('checker:card', {
                sessionId: sid,
                cardId: String(ex._id),
                card: ex.fullCard,
                status: 'die',
                response: ex.errorMessage || '',
                cached: true,
                serverDelayed: true
              });
            }
          } catch {}
        }, delaySec * 1000);
      } else {
        // Queue existing card without creating a new one; mark as pending for fetch
        await Card.updateOne({ _id: ex._id }, { $set: { sessionId: sid, status: 'pending', zennoposter: 0, lastCheckAt: new Date() } });
      }
    }

    // After immediate DIE handling, update session counters and emit snapshot
    try {
      if (immediateDieCount > 0) {
        const billedAmountInc = immediateDieCount * (Number(pricePerCard || 0) || 0);
        // Recompute session aggregates best-effort
        const [totalNow, processedNow] = await Promise.all([
          Card.countDocuments({ sessionId: sid }),
          Card.countDocuments({ sessionId: sid, zennoposter: 1 })
        ]);
        const dieNow = await Card.countDocuments({ sessionId: sid, status: { $in: ['die','dead'] } });
        const unknownNow = await Card.countDocuments({ sessionId: sid, status: 'unknown' });
        const errorNow = await Card.countDocuments({ sessionId: sid, status: 'error' });
        const pendingNow = Math.max(0, totalNow - processedNow);
        const progress = totalNow > 0 ? Math.round((processedNow / totalNow) * 100) : 0;

        await CheckSession.updateOne(
          { sessionId: sid },
          { $set: { processed: processedNow, pending: pendingNow, die: dieNow, unknown: unknownNow, error: errorNow }, $inc: { billedAmount: billedAmountInc } }
        );
        try {
          if (io) {
            emitSessionUpdateDebounced(io, String(userId), sid, {
              sessionId: sid,
              total: totalNow,
              processed: processedNow,
              pending: pendingNow,
              live: 0,
              die: dieNow,
              error: errorNow,
              unknown: unknownNow,
              pricePerCard,
              billedAmount: billedAmountInc,
              progress
            });
          }
        } catch {}
      }
    } catch (e) {
      logger.warn('Failed to emit session update after immediate DIE handling:', e);
    }

    // Only create docs for cards that don't exist yet (compare fullCard)
    const docsToInsert = docs.filter(d => !existingByFull.has(d.fullCard));

    // Handle new cards - use upsert to avoid race condition
    const bulkOps = docsToInsert.map(doc => {
      // Disjoint updates to avoid conflicts between $setOnInsert and $set
      const insertDoc = {
        cardNumber: doc.cardNumber,
        expiryMonth: doc.expiryMonth,
        expiryYear: doc.expiryYear,
        cvv: doc.cvv,
        fullCard: doc.fullCard,
        status: doc.status,
        zennoposter: doc.zennoposter,
        userId: doc.userId
      };
      return ({
        updateOne: {
          filter: { fullCard: doc.fullCard, userId: doc.userId },
          update: {
            // Only set base fields on insert
            $setOnInsert: insertDoc,
            // Always set linkage fields and latest metadata
            $set: {
              originUserId: doc.originUserId,
              sessionId: doc.sessionId,
              price: doc.price,
              typeCheck: doc.typeCheck,
              bin: doc.bin,
              brand: doc.brand,
              lastCheckAt: new Date()
            }
          },
          upsert: true
        }
      });
    });

    // Insert new cards only (no checkDeadlineAt yet - set only when ZennoPoster fetches)
    if (bulkOps.length) {
      await Card.bulkWrite(bulkOps, { ordered: false });
    }
    
    // Set status to 'pending' for non-cached cards (zennoposter != 1)
    // Do NOT set checkDeadlineAt here - it will be set only when ZennoPoster fetches the card
    await Card.updateMany(
      { sessionId: sid, userId: stockIdStr, zennoposter: { $ne: 1 } },
      { $set: { status: 'pending', lastCheckAt: new Date(), zennoposter: 0 }, $unset: { checkDeadlineAt: '' } }
    );

    return res.json({ success: true, message: 'Đã tạo phiên kiểm tra', data: { sessionId: sid, estimatedCost: estimated, pricePerCard, total: docs.length, timeoutSec, stockUserId: stockIdStr, gateUsed: gate, checkType } });
  } catch (err) {
    logger.error('[startOrStop] Error:', err);
    logger.error('[startOrStop] Stack:', err.stack);
    return res.status(500).json({ success: false, message: err.message || 'Server error', error: process.env.NODE_ENV === 'development' ? err.stack : undefined });
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
    // processed = số thẻ đã có kết quả từ ZennoPoster (zennoposter=1)
    const processed = await Card.countDocuments({ sessionId, zennoposter: 1 });
    const live = counts['live'] || 0;
    const die = counts['die'] || 0;
    const error = counts['error'] || 0;
    const unknown = counts['unknown'] || 0;
    const pending = total - processed; // Cards còn lại (pending/checking)
    
    logger.info(`[GetStatus] Session ${sessionId}: total=${total}, processed=${processed}, pending=${pending}, live=${live}, die=${die}, unknown=${unknown}`);

    // Compute pricePerCard and billedAmount before optional emit
    const pricePerCard = session.pricePerCard || 0;
    const billedAmount = await Card.aggregate([
      { $match: { sessionId, billedInSession: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$billAmount', 0] } } } }
    ]).then(r => (r[0]?.total || 0));

    // Emit session snapshot via socket if available
    try {
      const io = req.app.get('io');
      if (io) {
        emitSessionUpdateDebounced(io, String(userId), sessionId, {
          sessionId,
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
        });
      }
    } catch {}

    // Cập nhật session snapshot
    session.set({ processed, pending, live, die, error, unknown, billedAmount });
    if (pending === 0 && session.status !== 'completed') {
      session.status = 'completed';
      session.endedAt = new Date();
    }

    // Removed end-of-session bulk billing to prevent double charge; per-card billing happens in postApiController

    await session.save();

    // Lấy kết quả mới nhất - CHỈ trả cards mà ZennoPoster đã POST result (zennoposter=1)
    // Không trả cards chưa có result từ ZennoPoster (zennoposter=0) → Frontend giữ trạng thái "Checking"
    const recent = await Card.find({ 
      sessionId, 
      zennoposter: 1, // CHỈ lấy cards đã có result từ ZennoPoster
      updatedAt: { $gte: new Date(Date.now() - 30000) } // 30s window
    })
      .select('_id fullCard status errorMessage zennoposter')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    
    logger.info(`[GetStatus] Session ${sessionId}: Returning ${recent.length} results from ZennoPoster (zennoposter=1)`);
    // Emit recent results via socket (throttled by caller)
    try {
      const io = req.app.get('io');
      if (io && recent && recent.length) {
        for (const c of recent) {
          io.to(String(userId)).emit('checker:card', {
            sessionId,
            cardId: String(c._id),
            card: c.fullCard,
            status: c.status,
            response: c.errorMessage || ''
          });
        }
      }
    } catch {}

    return res.json({
      success: true,
      data: {
        session: {
          sessionId,
          status: session.status,
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
        results: recent.map(c => ({ 
          cardId: String(c._id),
          card: c.fullCard, 
          status: c.status, 
          response: c.errorMessage || '' 
        }))
      }
    });
  } catch (err) {
    logger.error('getStatus error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: err.message });
  }
};

// Check if cards already exist in database with results
const checkExistingCards = async (req, res, next) => {
  try {
    const { cardNumbers } = req.body;
    if (!Array.isArray(cardNumbers) || cardNumbers.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Find cards by card numbers that have been checked by ZennoPoster
    // Trả TẤT CẢ cards có zennoposter=1: live/die/error/unknown
    // Chỉ cache cards được check trong vòng 7 ngày (tránh cache cũ)
    const cards = await Card.find({
      cardNumber: { $in: cardNumbers },
      zennoposter: 1, // ZennoPoster đã POST result
      updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // 7 days
    })
      .select('cardNumber fullCard status errorMessage response')
      .lean();

    return res.json({ success: true, data: cards });
  } catch (err) {
    logger.error('Check existing cards error:', err);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: err.message });
  }
};

// module.exports is already set by exports.startOrStop and exports.getStatus above
module.exports.checkExistingCards = checkExistingCards;
