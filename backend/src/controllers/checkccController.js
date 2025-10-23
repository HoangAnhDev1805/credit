const mongoose = require('mongoose');
const Card = require('../models/Card');
const SiteConfig = require('../models/SiteConfig');
const Transaction = require('../models/Transaction');
const CheckSession = require('../models/CheckSession');
const logger = require('../config/logger');
const DeviceStat = require('../models/DeviceStat');
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

// Helper functions
const normalizeBody = (req) => {
  const h = {
    token: req.get('Token') || req.get('token') || req.get('x-token') || req.get('x-api-token') || '',
    LoaiDV: req.get('LoaiDV') || req.get('loaidv') || req.get('X-LoaiDV'),
    Device: req.get('Device') || req.get('device'),
    Amount: req.get('Amount') || req.get('amount'),
    TypeCheck: req.get('TypeCheck') || req.get('typecheck') || req.get('X-TypeCheck'),
    Id: req.get('Id') || req.get('id'),
    Status: req.get('Status') || req.get('status'),
    State: req.get('State') || req.get('state'),
    From: req.get('From') || req.get('from'),
    Msg: req.get('Msg') || req.get('msg')
  };
  const b = req.body || {};
  const q = req.query || {};
  return {
    token: b.Token || b.token || q.Token || q.token || h.token || '',
    LoaiDV: Number(b.LoaiDV ?? q.LoaiDV ?? h.LoaiDV ?? 0),
    Device: b.Device || q.Device || h.Device || '',
    Amount: Number(b.Amount ?? q.Amount ?? h.Amount ?? 0),
    TypeCheck: Number(b.TypeCheck ?? q.TypeCheck ?? h.TypeCheck ?? 2),
    Id: b.Id || q.Id || h.Id || '',
    Status: b.Status !== undefined ? Number(b.Status) : (q.Status !== undefined ? Number(q.Status) : (h.Status !== undefined ? Number(h.Status) : undefined)),
    State: b.State !== undefined ? Number(b.State) : (q.State !== undefined ? Number(q.State) : (h.State !== undefined ? Number(h.State) : undefined)),
    From: b.From !== undefined ? Number(b.From) : (q.From !== undefined ? Number(q.From) : (h.From !== undefined ? Number(h.From) : undefined)),
    Msg: b.Msg || q.Msg || h.Msg || ''
  };
};

async function getSystemUserId() {
  const uid = await SiteConfig.getByKey('post_api_user_id');
  return uid ? String(uid) : '';
}

function buildFullCardString(card) {
  if (card.fullCard) return card.fullCard;
  const mm = card.expiryMonth || '';
  const yy = card.expiryYear || '';
  const cvv = card.cvv || '';
  return `${card.cardNumber || ''}|${mm}|${yy}|${cvv}`;
}

function mapStatusToCard(statusCode) {
  // 0: reset, 1:dang chay, 2:live, 3:die, 4:unknown, 5:charge success
  switch (Number(statusCode)) {
    case 0: return 'unknown';
    case 1: return 'checking';
    case 2: return 'live';
    case 3: return 'die';
    case 4: return 'unknown';
    case 5: return 'live';
    default: return 'unknown';
  }
}

// POST /api/checkcc - Main endpoint for ZennoPoster
exports.checkcc = async (req, res) => {
  try {
    const p = normalizeBody(req);
    
    // Validate JWT token (from req.user set by protect middleware)
    if (!req.user) {
      return res.json({ 
        ErrorId: 1, 
        Title: 'unauthorized', 
        Message: 'Invalid or missing JWT token', 
        Content: '' 
      });
    }

    // Enforce Checker permission (must be enabled by admin)
    if (Number(req.user.checker) !== 1) {
      return res.json({
        ErrorId: 1,
        Title: 'forbidden',
        Message: 'Checker disabled',
        Content: ''
      });
    }

    if (p.LoaiDV === 1) {
      // Fetch random cards for checking
      return await handleFetchCards(req, res, p);
    } else if (p.LoaiDV === 2) {
      // Update card status after checking
      return await handleUpdateStatus(req, res, p);
    } else {
      return res.json({ 
        ErrorId: 1, 
        Title: 'error', 
        Message: 'LoaiDV must be 1 (fetch cards) or 2 (update status)', 
        Content: '' 
      });
    }
  } catch (err) {
    logger.error('CheckCC API error:', err);
    return res.status(500).json({ 
      ErrorId: 1, 
      Title: 'error', 
      Message: 'Internal server error', 
      Content: '' 
    });
  }
};

// Handle LoaiDV=1: Fetch random cards
async function handleFetchCards(req, res, p) {
  try {
    // Handle pause request explicitly to let ZennoPoster stop tools gracefully
    const body = { ...req.query, ...req.body, ...req.headers };
    const pauseFlag = String(body.pausezenno || body.PauseZenno || body['x-pause-zenno'] || '').toLowerCase();
    const shouldPause = pauseFlag === 'true' || pauseFlag === '1';
    if (shouldPause) {
      try {
        const io = req.app && req.app.get ? req.app.get('io') : null;
        if (io && req.user && req.user.id) {
          io.to(String(req.user.id)).emit('checker:session:update', { stopRequested: true, status: 'stopped' });
        }
      } catch (_) {}
      // If SessionId and Content provided, target only those cards
      const SessionId = body.SessionId || body.sessionId || body['x-session-id'] || '';
      let contentList = [];
      try {
        const raw = body.Content || body.content || [];
        const arr = Array.isArray(raw) ? raw : [];
        contentList = arr.map(it => ({
          FullThe: String(it?.FullThe || it?.fullThe || it?.Card || it?.card || '').trim()
        })).filter(it => it.FullThe);
      } catch {}
      if (SessionId && contentList.length) {
        try {
          const ids = await Card.find({ sessionId: SessionId, fullCard: { $in: contentList.map(c => c.FullThe) }, status: { $in: ['pending','checking'] } }).select('_id').lean();
          const idList = ids.map(i => i._id);
          if (idList.length) {
            await Card.updateMany({ _id: { $in: idList } }, { $set: { status: 'unknown', errorMessage: 'Stopped by user', zennoposter: 0, checkedAt: new Date() } });
          }
          return res.json({ ErrorId: 1, Title: 'pause', Message: 'Pause requested', Content: idList.map(i => ({ Id: String(i) })) });
        } catch (_) {
          return res.json({ ErrorId: 1, Title: 'pause', Message: 'Pause requested', Content: [] });
        }
      }
      return res.json({ ErrorId: 1, Title: 'pause', Message: 'Pause requested', Content: '' });
    }
    // Log incoming request parameters for ZennoPoster debugging
    console.log('\n========== /api/checkcc REQUEST (LoaiDV=1) ==========');
    console.log('Token:', req.headers.authorization ? 'Bearer ***' : 'None');
    console.log('LoaiDV:', p.LoaiDV);
    console.log('Device:', p.Device);
    console.log('Amount:', p.Amount);
    console.log('TypeCheck:', p.TypeCheck);
    console.log('=====================================================\n');

    logger.info(`[CheckCC LoaiDV=1] Fetch cards request:`, {
      userId: req.user?.id,
      username: req.user?.username,
      device: p.Device,
      amount: p.Amount,
      typeCheck: p.TypeCheck
    });

    // Amount & TypeCheck validation
    const minAmount = await SiteConfig.getByKey('min_cards_per_check') || 1;
    const maxAmount = await SiteConfig.getByKey('max_cards_per_check') || 1000;
    const defaultBatch = await SiteConfig.getByKey('checker_default_batch_size') || minAmount;
    let amount = Number.isFinite(p.Amount) && p.Amount > 0 ? p.Amount : defaultBatch;
    amount = Math.min(Math.max(amount, minAmount), maxAmount);
    const typeCheck = p.TypeCheck === 1 ? 1 : 2; // default 2 (charge)

    // Backpressure: limit concurrent checking per typeCheck
    try {
      const maxConcurrent = Number(await SiteConfig.getByKey('checker_max_concurrent_checking')) || 1000;
      if (maxConcurrent > 0) {
        const currentChecking = await Card.countDocuments({ status: 'checking', zennoposter: { $in: [0, null] }, typeCheck });
        const capacity = Math.max(0, maxConcurrent - currentChecking);
        if (capacity <= 0) {
          return res.json({ ErrorId: 1, Title: 'card store not found', Message: 'Capacity reached', PauseZenno: true, Content: [] });
        }
        if (amount > capacity) amount = capacity;
      }
    } catch (_) {}

    // Helper to create or fetch a test card safely (handles duplicates)
    async function createOrGetTestCard(uId, num, mm, yy, cvv, tCheck) {
      try {
        const created = await Card.create({
          userId: new mongoose.Types.ObjectId(uId),
          cardNumber: num,
          expiryMonth: mm,
          expiryYear: yy,
          cvv,
          fullCard: `${num}|${mm}|${yy}|${cvv}`,
          status: 'unknown',
          typeCheck: tCheck,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        return created;
      } catch (e) {
        // Duplicate card for this user -> return existing
        if (e && String(e.code) === '11000') {
          const existing = await Card.findOne({ userId: new mongoose.Types.ObjectId(uId), cardNumber: num });
          if (existing) return existing;
        }
        throw e;
      }
    }

    // Guaranteed test mode for Admin Tester
    if (String(p.Device).toLowerCase() === 'api-tester') {
      let systemUserId = await getSystemUserId();
      if (!systemUserId || !mongoose.Types.ObjectId.isValid(systemUserId)) {
        if (req.user && req.user.id && mongoose.Types.ObjectId.isValid(String(req.user.id))) {
          systemUserId = String(req.user.id);
        }
      }
      try {
        // ensure uniqueness by varying last 4 digits
        const base = '4532015112830';
        const suffix = String(Math.floor(1000 + Math.random() * 8999));
        const sampleNumber = base + suffix;
        const sampleMonth = '12';
        const sampleYear = '25';
        const sampleCvv = '123';
        if (!systemUserId) throw new Error('No systemUserId for API-Tester mode');
        const created = await createOrGetTestCard(systemUserId, sampleNumber, sampleMonth, sampleYear, sampleCvv, typeCheck);
        const content = [{
          Id: String(created._id),
          FullThe: buildFullCardString(created),
          TypeCheck: Number(created.typeCheck || typeCheck),
          Price: Number(created.price || 0)
        }];
        return res.json({ ErrorId: 0, Title: '', Message: '', Content: content });
      } catch (e) {
        // fallthrough to normal stock flow
        logger.warn('API-Tester sample create failed, falling back to stock flow:', e?.message);
      }
    }

    let systemUserId = await getSystemUserId();
    if (!systemUserId || !mongoose.Types.ObjectId.isValid(systemUserId)) {
      // Fallback: use current authenticated user to allow testing when not configured
      if (req.user && req.user.id && mongoose.Types.ObjectId.isValid(String(req.user.id))) {
        systemUserId = String(req.user.id);
      } else {
        return res.json({ 
          ErrorId: 1, 
          Title: 'error', 
          Message: 'Stock source (post_api_user_id) not configured', 
          Content: '' 
        });
      }

      // As a last resort, create a default sample test card to allow UI testing
      try {
        // Randomize to avoid duplicate key
        const base = '4532015112830';
        const suffix = String(Math.floor(1000 + Math.random() * 8999));
        const sampleNumber = base + suffix;
        const sampleMonth = '12';
        const sampleYear = '25';
        const sampleCvv = '123';
        const created = await createOrGetTestCard(systemUserId, sampleNumber, sampleMonth, sampleYear, sampleCvv, typeCheck);

        const content = [{
          Id: String(created._id),
          FullThe: buildFullCardString(created),
          TypeCheck: Number(created.typeCheck || typeCheck),
          Price: Number(created.price || 0)
        }];

        return res.json({ ErrorId: 0, Title: '', Message: '', Content: content });
      } catch (e) {
        logger.error('Create default sample test card failed:', e);
      }
    }

    // Get random cards with status unknown from system user
    const match = { 
      userId: new mongoose.Types.ObjectId(systemUserId), 
      status: { $in: ['unknown', null] } 
    };

    const sampleSize = Math.min(amount, 1000);
    const pipeline = [
      { $match: match }, 
      { $sample: { size: sampleSize } }
    ];
    // Optimized bulk fetch with atomic update
    // Strategy: Over-fetch candidates, then atomic bulk update to handle concurrent requests
    const timeoutSec = Number(await SiteConfig.getByKey('checker_card_timeout_sec')) || 120;
    const deadline = new Date(Date.now() + timeoutSec * 1000);
    const now = new Date();
    
    // Step 1: Find candidate cards (over-fetch 3x to handle concurrency)
    // Exclude cards with status='stopped' or from stopped sessions
    const candidateCards = await Card.find({
      userId: new mongoose.Types.ObjectId(systemUserId),
      originUserId: { $ne: null },
      sessionId: { $ne: null },
      zennoposter: { $in: [0, null] },
      status: { $in: ['pending', 'unknown'] }, // Exclude 'stopped' status
      typeCheck
    })
      .sort({ sessionId: 1, createdAt: 1 }) // FIFO per session
      .limit(amount * 3)
      .select('_id sessionId originUserId') // Need sessionId for session check
      .lean();
    
    // Step 1.5: Filter out cards from stopped sessions AND check user credits
    if (candidateCards.length > 0) {
      const CheckSession = require('../models/CheckSession');
      const User = require('../models/User');
      
      const sessionIds = [...new Set(candidateCards.map(c => c.sessionId))];
      const stoppedSessions = await CheckSession.find({
        sessionId: { $in: sessionIds },
        stopRequested: true
      }).select('sessionId').lean();
      
      const stoppedSessionIds = new Set(stoppedSessions.map(s => s.sessionId));
      
      // Filter out cards from stopped sessions
      let filteredCandidates = candidateCards.filter(c => !stoppedSessionIds.has(c.sessionId));
      
      if (stoppedSessionIds.size > 0) {
        logger.info(`[checkcc] Filtered out ${candidateCards.length - filteredCandidates.length} cards from ${stoppedSessionIds.size} stopped sessions`);
      }
      
      // Step 1.6: Check credit for each user before fetching their cards
      const userIds = [...new Set(filteredCandidates.map(c => c.originUserId).filter(Boolean))];
      if (userIds.length > 0) {
        const users = await User.find({ _id: { $in: userIds } }).select('_id balance').lean();
        const userBalanceMap = new Map(users.map(u => [String(u._id), u.balance || 0]));
        
        // Get price per card for this typeCheck
        const Gate = require('../models/Gate');
        const CheckSession = require('../models/CheckSession');
        let pricePerCard = 1; // default
        try {
          const gate = await Gate.findOne({ typeCheck }).select('price').lean();
          if (gate && gate.price) pricePerCard = gate.price;
        } catch (err) {
          logger.warn('[checkcc] Failed to get gate price, using default:', err.message);
        }
        
        // Filter out cards from users with insufficient balance
        const cardsWithSufficientCredit = filteredCandidates.filter(c => {
          const balance = userBalanceMap.get(String(c.originUserId)) || 0;
          return balance >= pricePerCard;
        });
        
        const creditFiltered = filteredCandidates.length - cardsWithSufficientCredit.length;
        if (creditFiltered > 0) {
          logger.info(`[checkcc] Filtered out ${creditFiltered} cards from users with insufficient credits`);
        }
        
        filteredCandidates = cardsWithSufficientCredit;
      }
      
      // Update candidateCards to filtered list
      candidateCards.length = 0;
      candidateCards.push(...filteredCandidates);
    }
    
    let cards = [];
    
    if (candidateCards.length > 0) {
      const candidateIds = candidateCards.map(c => c._id);
      
      // Step 2: Atomic bulk update WITHOUT checkDeadlineAt (set it later only for fetched cards)
      const updateResult = await Card.updateMany(
        {
          _id: { $in: candidateIds },
          zennoposter: { $in: [0, null] },
          status: { $in: ['pending', 'unknown'] } // Double-check status
        },
        {
          $set: { 
            status: 'checking', 
            lastCheckAt: now, 
            zennoposter: 0
          },
          $inc: { checkAttempts: 1 }
        }
      );
      
      // Step 3: Fetch actually updated cards (only amount cards)
      cards = await Card.find({
        _id: { $in: candidateIds },
        status: 'checking',
        lastCheckAt: { $gte: new Date(now.getTime() - 1000) } // Updated within 1s
      })
        .limit(amount)
        .lean();
      
      // Step 4: Set checkDeadlineAt ONLY for cards that are actually being fetched
      if (cards.length > 0) {
        const fetchedIds = cards.map(c => c._id);
        await Card.updateMany(
          { _id: { $in: fetchedIds } },
          { $set: { checkDeadlineAt: deadline } }
        );
        
        // Update cards array with deadline for response
        cards.forEach(card => {
          card.checkDeadlineAt = deadline;
        });
      }
    }
    
    if (cards.length === 0) {
      // If manual card fields are provided, create a temporary test card for this user to allow API testing
      const body = { ...req.query, ...req.body };
      const cardNumber = String(body.cardNumber || '').trim();
      const cardMonth = String(body.cardMonth || '').trim();
      const cardYear = String(body.cardYear || '').trim();
      const cardCvv = String(body.cardCvv || '').trim();

      const hasManual = /^(\d{13,19})$/.test(cardNumber) && /^(0[1-9]|1[0-2])$/.test(cardMonth) && /^\d{2,4}$/.test(cardYear) && /^\d{3,4}$/.test(cardCvv);
      if (hasManual) {
        try {
          const created = await createOrGetTestCard(systemUserId, cardNumber, cardMonth, cardYear, cardCvv, typeCheck);
          const content = [{
            Id: String(created._id),
            FullThe: buildFullCardString(created),
            TypeCheck: Number(created.typeCheck || typeCheck),
            Price: Number(created.price || 0)
          }];
          return res.json({ ErrorId: 0, Title: '', Message: '', Content: content });
        } catch (e) {
          logger.error('Create test card failed:', e);
          // continue to default sample below
        }
      }

      // Hết thẻ: trả về thông điệp chuẩn để Zenno tạm dừng
      return res.json({ 
        ErrorId: 1, 
        Title: 'card store not found', 
        Message: 'No cards available to fetch', 
        PauseZenno: true,
        Content: []
      });
    }

    // Notify frontend (only now start timeout countdown)
    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io) {
        // Emit to all origin users of these cards so their dashboards start countdown
        const originIds = Array.from(new Set(cards.map(c => String(c.originUserId || '')))).filter(Boolean);
        for (const oid of originIds) {
          io.to(oid).emit('checker:fetch', { timeoutSec, count: cards.length });
          io.to(oid).emit('session:update', { timeoutSec, count: cards.length });
        }
        // Optionally also notify the Zenno user fetching
        if (req.user && req.user.id) {
          io.to(String(req.user.id)).emit('checker:fetch', { timeoutSec, count: cards.length });
          io.to(String(req.user.id)).emit('session:update', { timeoutSec, count: cards.length });
        }
      }
    } catch (_) {}

    const content = cards.map(c => ({
      Id: String(c._id),
      FullThe: buildFullCardString(c),
      TypeCheck: Number(c.typeCheck || typeCheck),
      Price: Number(c.price || 0)
    }));

    return res.json({ 
      ErrorId: 0, 
      Title: '', 
      Message: '', 
      Content: content 
    });
  } catch (err) {
    logger.error('Fetch cards error:', err);
    return res.json({ 
      ErrorId: 1, 
      Title: 'error', 
      Message: 'Failed to fetch cards', 
      Content: '' 
    });
  }
}

// Handle LoaiDV=2: Update card status
async function handleUpdateStatus(req, res, p) {
  try {
    // Log incoming update request for ZennoPoster debugging
    console.log('\n========== /api/checkcc REQUEST (LoaiDV=2) ==========');
    console.log('Token:', req.headers.authorization ? 'Bearer ***' : 'None');
    console.log('LoaiDV:', p.LoaiDV);
    console.log('Device:', p.Device);
    console.log('Id:', p.Id);
    console.log('Status:', p.Status);
    console.log('State:', p.State);
    console.log('From:', p.From);
    console.log('Msg:', p.Msg);
    console.log('=====================================================\n');

    logger.info(`[CheckCC LoaiDV=2] Update status request:`, {
      userId: req.user?.id,
      username: req.user?.username,
      device: p.Device,
      cardId: p.Id,
      status: p.Status,
      from: p.From,
      msg: p.Msg
    });

    // Helper to process a single update item
    const io = req.app && req.app.get ? req.app.get('io') : null;
    async function processOne(item) {
      const id = item?.Id ?? p.Id;
      if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
        return { id: String(id || ''), ok: false, message: 'Invalid Id' };
      }

      const newStatus = mapStatusToCard(item?.Status ?? p.Status);
      const fromVal = item?.From ?? p.From;
      const msgVal = item?.Msg ?? p.Msg;

      const rawBin = String(item?.BIN ?? item?.Bin ?? item?.bin ?? '').trim();
      const rawBrand = String((item?.Brand ?? item?.brand ?? '')).trim().toLowerCase();
      const rawCountry = String((item?.Country ?? item?.country ?? '')).trim().toUpperCase();
      const rawBank = String(item?.Bank ?? item?.bank ?? '').trim();
      const rawLevel = String((item?.Level ?? item?.level ?? '')).trim().toLowerCase();
      const rawType = item?.Type !== undefined ? Number(item.Type) : (item?.type !== undefined ? Number(item.type) : undefined);
      const rawTypeCheck = item?.TypeCheck !== undefined ? Number(item.TypeCheck) : undefined;

      if (newStatus === 'unknown') {
        try {
          await Card.updateOne({ _id: id }, { $set: { lastCheckAt: new Date(), errorMessage: msgVal || '' } });
        } catch (_) {}
        return { id: String(id || ''), ok: true };
      }

      const update = {
        status: newStatus,
        errorMessage: msgVal || '',
        lastCheckAt: new Date(),
        zennoposter: 1
      };
      if (['live','die'].includes(String(newStatus))) update.checkedAt = new Date();
      if (fromVal !== undefined) update.checkSource = ['unknown','google','wm','zenno','777'][Number(fromVal)] || 'unknown';
      if (/^\d{6}$/.test(rawBin)) update.bin = rawBin;
      const allowedBrands = new Set(['visa','mastercard','amex','discover','jcb','diners','unknown']);
      if (rawBrand && allowedBrands.has(rawBrand)) update.brand = rawBrand;
      if (/^[A-Z]{2}$/.test(rawCountry)) update.country = rawCountry;
      if (rawBank) update.bank = rawBank;
      const allowedLevels = new Set(['classic','gold','platinum','black','unknown']);
      if (rawLevel && allowedLevels.has(rawLevel)) update.level = rawLevel;
      if (rawType === 1 || rawType === 2) update.typeCheck = rawType;
      if (rawTypeCheck === 1 || rawTypeCheck === 2) update.typeCheck = rawTypeCheck;

      let card = await Card.findByIdAndUpdate(id, { $set: update }, { new: true });
      if (!card) {
        try {
          const full = String(item?.FullThe || item?.fullThe || item?.Card || item?.card || '').trim();
          if (full) {
            card = await Card.findOneAndUpdate({ fullCard: full }, { $set: update }, { new: true });
          }
        } catch (_) {}
      }
      if (!card) return { id: String(id), ok: false, message: 'Card not found' };

      // Cache DIE cards in Redis for fast lookup
      if (newStatus === 'die' && card.fullCard && card.typeCheck) {
        try {
          await RedisCache.set(card.fullCard, String(card.typeCheck), {
            status: 'die',
            response: msgVal || 'Declined',
            checkedAt: new Date().toISOString()
          });
        } catch (err) {
          logger.warn('Redis cache set failed (non-critical):', err.message);
        }
      }

      // Bump device stat (per successful status update) and emit realtime to admin
      try {
        const dev = item?.Device ?? p.Device;
        await DeviceStat.bump(dev);
        if (io) {
          const dayKey = new Date().toISOString().slice(0,10);
          io.emit('admin:device-stats:update', { device: String(dev||'unknown'), day: dayKey, inc: 1 });
        }
      } catch (e) { logger.warn('DeviceStat bump failed:', e?.message); }

      // Billing and session updates (best effort)
      try {
        const finished = ['live','die'].includes(String(newStatus));
        if (finished && card.originUserId) {
          // Determine credit cost priority: session.pricePerCard > Gate.creditCost > SiteConfig.default
          const Gate = require('../models/Gate');
          const tc = Number(card.typeCheck ?? rawTypeCheck ?? rawType ?? p.TypeCheck ?? item?.TypeCheck);
          let priceToCharge = 0;
          let sessionPrice = 0;
          try {
            if (card.sessionId) {
              const sess = await CheckSession.findOne({ sessionId: card.sessionId }).lean();
              if (sess && typeof sess.pricePerCard === 'number') sessionPrice = Math.max(0, Number(sess.pricePerCard));
            }
          } catch {}
          if (!sessionPrice || sessionPrice <= 0) {
            try {
              const g = await Gate.getByTypeCheck(Number(tc));
              if (g && typeof g.creditCost === 'number') sessionPrice = Math.max(0, Number(g.creditCost));
            } catch {}
          }
          if (!sessionPrice || sessionPrice <= 0) {
            try {
              const def = await SiteConfig.getByKey('default_price_per_card');
              sessionPrice = Math.max(0, Number(def || 0));
            } catch {}
          }
          priceToCharge = sessionPrice;

          // Per-session flags to avoid double count/bill between flows
          let shouldInc = false;
          let shouldBill = false;
          try {
            const r1 = await Card.updateOne(
              { _id: card._id, sessionId: card.sessionId, sessionCounted: { $ne: true } },
              { $set: { sessionCounted: true } }
            );
            shouldInc = (r1 && (r1.modifiedCount === 1 || r1.nModified === 1));
          } catch {}
          try {
            const r2 = await Card.updateOne(
              { _id: card._id, sessionId: card.sessionId, billedInSession: { $ne: true } },
              { $set: { billedInSession: true, billAmount: priceToCharge } }
            );
            shouldBill = (r2 && (r2.modifiedCount === 1 || r2.nModified === 1));
          } catch {}

          if (shouldBill && priceToCharge > 0) {
            const User = require('../models/User');
            await User.updateOne({ _id: card.originUserId }, { $inc: { balance: -priceToCharge } });
            const Transaction = require('../models/Transaction');
            await Transaction.createTransaction({
              userId: card.originUserId,
              type: 'card_check',
              amount: -priceToCharge,
              description: `Charge for card (session ${String(card.sessionId||'')})`,
              relatedId: card._id,
              relatedModel: 'Card',
              metadata: { cardId: String(card._id), sessionId: card.sessionId, typeCheck: tc, pricePerCard: priceToCharge }
            });
          }
          // Notify user balance changed with actual value
          try {
            if (io) {
              const User = require('../models/User');
              const udoc = await User.findById(card.originUserId).select('balance').lean();
              io.to(String(card.originUserId)).emit('user:balance-changed', { balance: udoc ? udoc.balance : undefined });
            }
          } catch (_) {}
        }
        // Emit realtime update (admin/cards & dashboards)
        try {
          if (io) {
            io.emit('card:updated', {
              _id: String(card._id),
              status: String(card.status),
              updatedAt: new Date(),
              originUserId: card.originUserId ? String(card.originUserId) : null,
              sessionId: card.sessionId || null
            });
            // Also push to the owner dashboard in realtime
            if (card.originUserId) {
              io.to(String(card.originUserId)).emit('checker:card', {
                sessionId: card.sessionId || null,
                cardId: String(card._id),
                card: card.fullCard,
                status: String(card.status),
                response: card.errorMessage || ''
              });
            }
          }
        } catch (_) {}

        // Recompute and emit session snapshot so FE counters/billed update realtime
        try {
          if (card.sessionId && io && card.originUserId) {
            const sid = String(card.sessionId);
            const ownerRoom = String(card.originUserId);
            const counts = await Card.aggregate([
              { $match: { sessionId: card.sessionId, originUserId: card.originUserId } },
              { $group: { _id: '$status', c: { $sum: 1 } } }
            ]);
            const map = new Map(counts.map(it => [String(it._id || 'unknown'), Number(it.c || 0)]));
            const live = Number(map.get('live') || 0);
            const die = Number(map.get('die') || 0);
            const unknown = Number(map.get('unknown') || 0);
            const error = Number(map.get('error') || 0);
            const checking = Number(map.get('checking') || 0) + Number(map.get('pending') || 0);
            const processed = live + die + unknown + error;

            // billedAmount from cards in this session
            const billedAgg = await Card.aggregate([
              { $match: { sessionId: card.sessionId, originUserId: card.originUserId, billedInSession: true } },
              { $group: { _id: null, sum: { $sum: { $ifNull: ['$billAmount', 0] } } } }
            ]);
            const billedAmount = Number((billedAgg[0] && billedAgg[0].sum) || 0);

            // Read pricePerCard from session if exists
            let pricePerCard = undefined;
            try {
              const sess = await CheckSession.findById(card.sessionId).lean();
              if (sess && typeof sess.pricePerCard === 'number') pricePerCard = sess.pricePerCard;
            } catch (_) {}

            emitSessionUpdateDebounced(io, ownerRoom, sid, {
              sessionId: sid,
              live,
              die,
              unknown,
              error,
              pending: checking,
              processed,
              total: processed + checking,
              billedAmount,
              pricePerCard,
              progress: (processed + checking) > 0 ? Math.round((processed / (processed + checking)) * 100) : 0
            });
          }
        } catch (e) { logger.warn('Emit session snapshot failed:', e?.message); }
      } catch (e) {
        logger.error('Billing/update session error (bulk item):', e);
      }

      return { id: String(id), ok: true };
    }

    // Batch mode: Content/Results array
    const body = { ...req.query, ...req.body };
    const itemsArr = Array.isArray(body.items) ? body.items
      : (Array.isArray(body.Content) ? body.Content
      : (Array.isArray(body.Results) ? body.Results : null));
    if (Array.isArray(itemsArr) && itemsArr.length > 0) {
      const results = [];
      for (const it of itemsArr) {
        const merged = { ...p, ...it };
        const r = await processOne(merged);
        results.push(r);
      }
      return res.json({ ErrorId: 0, Title: '', Message: '', Content: results });
    }

    // Single item mode: process current payload p
    const singleResult = await processOne(p);
    return res.json({ ErrorId: 0, Title: '', Message: '', Content: singleResult });
  } catch (err) {
    logger.error('Update status error:', err);
    return res.json({
      ErrorId: 1,
      Title: 'error',
      Message: 'Failed to update card status',
      Content: ''
    });
  }
}

// Evict cards for a session (used by Stop semantics)
exports.evict = async (req, res) => {
  try {
    const { sessionId, userId } = { ...req.query, ...req.body };
    if (!sessionId) return res.json({ ErrorId: 1, Title: 'error', Message: 'sessionId required', Content: '' });
    // Only evict cards that are pending/checking/unknown and not yet posted by Zenno
    const match = { sessionId, zennoposter: { $ne: 1 }, status: { $in: ['pending','checking','unknown'] } };
    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      match.originUserId = new mongoose.Types.ObjectId(String(userId));
    }
    const r = await Card.updateMany(match, { $set: { status: 'unknown', errorMessage: 'Stopped by user', zennoposter: 0, lastCheckAt: new Date() } });
    const removed = r?.modifiedCount ?? r?.nModified ?? 0;
    return res.json({ ErrorId: 1, Title: 'card store not found', Message: 'Evicted pending cards', PauseZenno: true, Content: { removed } });
  } catch (err) {
    logger.error('Evict error:', err);
    return res.json({ ErrorId: 1, Title: 'error', Message: 'Failed to evict', Content: '' });
  }
};

// Handle LoaiDV=2 from frontend: Receive result from external sender
exports.receiveResult = async (req, res) => {
  try {
    // Require authentication
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - JWT token required' 
      });
    }

    const { loaiDV, result } = req.body;

    // Validate loaiDV=2
    if (loaiDV !== 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid loaiDV. Must be 2 (receive mode)' 
      });
    }

    // Parse result - can be JSON string or object
    let parsedResult = result;
    if (typeof result === 'string') {
      try {
        parsedResult = JSON.parse(result);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid JSON in result field' 
        });
      }
    }

    logger.info(`Received result from user ${req.user.id}:`, parsedResult);

    // Save to CheckReceiverLog for debugging (TTL 7 days)
    const CheckReceiverLog = require('../models/CheckReceiverLog');
    const log = await CheckReceiverLog.create({
      userId: req.user.id,
      loaiDV: 2,
      payload: parsedResult,
      headers: {
        'user-agent': req.get('user-agent'),
        'x-forwarded-for': req.get('x-forwarded-for')
      },
      ip: req.ip
    });

    return res.json({ 
      success: true, 
      message: 'Result received and logged', 
      data: {
        logId: log._id,
        receivedAt: log.createdAt
      }
    });
  } catch (err) {
    logger.error('Receive result error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to receive result',
      error: err.message 
    });
  }
}
