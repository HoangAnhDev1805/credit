const mongoose = require('mongoose');
const Card = require('../models/Card');
const SiteConfig = require('../models/SiteConfig');
const Transaction = require('../models/Transaction');
const CheckSession = require('../models/CheckSession');
const logger = require('../config/logger');
const DeviceStat = require('../models/DeviceStat');

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
    const cards = await Card.find({
      status: { $in: ['pending', 'unknown'] },
      typeCheck
    })
      .sort({ createdAt: 1 })
      .limit(amount);

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

      return res.json({ 
        ErrorId: 1, 
        Title: 'error', 
        Message: 'Out of stock', 
        Content: [],
        PauseZenno: true,
        pausezenno: true
      });
    }

    // Mark cards as "checking" and set per-card deadline
    const ids = cards.map(c => c._id);
    const timeoutSec = Number(await SiteConfig.getByKey('checker_card_timeout_sec')) || 120;
    const deadline = new Date(Date.now() + timeoutSec * 1000);
    await Card.updateMany({ _id: { $in: ids } }, {
      $set: { status: 'checking', lastCheckAt: new Date(), checkDeadlineAt: deadline },
      $inc: { checkAttempts: 1 }
    });

    // Notify frontend (only now start timeout countdown)
    try {
      const io = req.app && req.app.get ? req.app.get('io') : null;
      if (io && req.user && req.user.id) {
        io.to(String(req.user.id)).emit('checker:fetch', { timeoutSec, count: cards.length });
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

      const update = {
        status: newStatus,
        errorMessage: msgVal || '',
        lastCheckAt: new Date(),
        zennoposter: 1
      };
      if (['live','die','unknown'].includes(String(newStatus))) update.checkedAt = new Date();
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

      const card = await Card.findByIdAndUpdate(id, { $set: update }, { new: true });
      if (!card) return { id: String(id), ok: false, message: 'Card not found' };

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
        if (finished && card.originUserId && !card.billed) {
          // Determine credit cost by gate
          const Gate = require('../models/Gate');
          const tc = Number(card.typeCheck ?? rawTypeCheck ?? rawType ?? p.TypeCheck ?? item?.TypeCheck);
          let priceToCharge = 1;
          try {
            const g = await Gate.getByTypeCheck(Number(tc));
            if (g && typeof g.creditCost === 'number') priceToCharge = Math.max(0, Number(g.creditCost));
          } catch {}

          await Card.updateOne({ _id: card._id }, { $set: { billed: true, billAmount: priceToCharge } });
          const User = require('../models/User');
          await User.updateOne({ _id: card.originUserId }, { $inc: { balance: -priceToCharge } });
          const Transaction = require('../models/Transaction');
          await Transaction.createTransaction({
            userId: card.originUserId,
            type: 'card_check',
            amount: -priceToCharge,
            description: `Check card ${card.cardNumber ? card.cardNumber.slice(0,6)+'...' : 'unknown'}`,
            metadata: { cardId: String(card._id), sessionId: card.sessionId, typeCheck: tc }
          });
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
          }
        } catch (_) {}
      } catch (e) {
        logger.error('Billing/update session error (bulk item):', e);
      }

      return { id: String(id), ok: true };
    }

    // Batch mode: Content/Results array
    const body = { ...req.query, ...req.body };
    const items = Array.isArray(body.Content) ? body.Content : (Array.isArray(body.Results) ? body.Results : null);
    if (Array.isArray(items) && items.length > 0) {
      const results = [];
      for (const it of items) {
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
      ErrorId: 0,
      Title: 'error',
      Message: 'Failed to update card status',
      Content: ''
    });
  }
}

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

    // Save to CheckSession or similar for tracking
    const checkSession = new CheckSession({
      userId: req.user.id,
      type: 'receive_result',
      loaiDV: 2,
      payload: parsedResult,
      receivedAt: new Date()
    });
    
    await checkSession.save();

    return res.json({ 
      success: true, 
      message: 'Result received and logged', 
      data: {
        sessionId: checkSession._id,
        receivedAt: checkSession.receivedAt
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
