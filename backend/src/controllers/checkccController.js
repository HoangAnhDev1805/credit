const mongoose = require('mongoose');
const Card = require('../models/Card');
const SiteConfig = require('../models/SiteConfig');
const Transaction = require('../models/Transaction');
const CheckSession = require('../models/CheckSession');
const logger = require('../config/logger');

// Helper functions
const normalizeBody = (req) => {
  return {
    token: req.body.token || req.query.token || req.get('x-api-token') || '',
    LoaiDV: Number(req.body.LoaiDV ?? req.query.LoaiDV ?? 0),
    Device: req.body.Device || req.query.Device || '',
    Amount: Number(req.body.Amount ?? req.query.Amount ?? 0),
    TypeCheck: Number(req.body.TypeCheck ?? req.query.TypeCheck ?? 2),
    Id: req.body.Id || req.query.Id || '',
    Status: req.body.Status !== undefined ? Number(req.body.Status) : (req.query.Status !== undefined ? Number(req.query.Status) : undefined),
    State: req.body.State !== undefined ? Number(req.body.State) : (req.query.State !== undefined ? Number(req.query.State) : undefined),
    From: req.body.From !== undefined ? Number(req.body.From) : (req.query.From !== undefined ? Number(req.query.From) : undefined),
    Msg: req.body.Msg || req.query.Msg || ''
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
    // Amount & TypeCheck validation
    const minAmount = await SiteConfig.getByKey('min_cards_per_check') || 1;
    const maxAmount = await SiteConfig.getByKey('max_cards_per_check') || 1000;
    let amount = Number.isFinite(p.Amount) && p.Amount > 0 ? p.Amount : minAmount;
    amount = Math.min(Math.max(amount, minAmount), maxAmount);
    const typeCheck = p.TypeCheck === 1 ? 1 : 2; // default 2 (charge)

    const systemUserId = await getSystemUserId();
    if (!systemUserId || !mongoose.Types.ObjectId.isValid(systemUserId)) {
      return res.json({ 
        ErrorId: 1, 
        Title: 'error', 
        Message: 'Stock source (post_api_user_id) not configured', 
        Content: '' 
      });
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
    const cards = await Card.aggregate(pipeline);

    if (!cards || cards.length === 0) {
      return res.json({ 
        ErrorId: 1, 
        Title: 'error', 
        Message: 'Out of stock', 
        Content: '' 
      });
    }

    // Mark cards as "checking"
    const ids = cards.map(c => c._id);
    await Card.updateMany({ _id: { $in: ids } }, {
      $set: { status: 'checking', lastCheckAt: new Date() },
      $inc: { checkAttempts: 1 }
    });

    const content = cards.map(c => ({
      Id: String(c._id),
      FullThe: buildFullCardString(c),
      TypeCheck: typeCheck,
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
    if (!p.Id || !mongoose.Types.ObjectId.isValid(String(p.Id))) {
      return res.json({ 
        ErrorId: 0, 
        Title: 'error', 
        Message: 'Invalid Id', 
        Content: '' 
      });
    }

    const newStatus = mapStatusToCard(p.Status);
    const update = {
      status: newStatus,
      errorMessage: p.Msg || '',
      lastCheckAt: new Date()
    };

    // Save check source
    if (p.From !== undefined) {
      update.checkSource = ['unknown','google','wm','zenno','777'][Number(p.From)] || 'unknown';
    }

    const card = await Card.findByIdAndUpdate(p.Id, { $set: update }, { new: true });
    if (!card) {
      return res.json({ 
        ErrorId: 0, 
        Title: 'error', 
        Message: 'Card not found', 
        Content: '' 
      });
    }

    // Billing realtime per finished card (live/die)
    try {
      const finished = ['live','die'].includes(String(newStatus));
      if (finished && card.originUserId && !card.billed) {
        const amount = Number(card.price || 0);
        if (amount > 0) {
          // Create transaction (deduct)
          await Transaction.createTransaction({
            userId: card.originUserId,
            type: 'card_check',
            amount: -amount,
            description: `Charge for card check (${card.maskedCardNumber || card.cardNumber})`,
            relatedId: card._id,
            relatedModel: 'Card',
            metadata: { pricePerCard: amount, sessionId: card.sessionId, status: newStatus }
          });
        }
        // Mark card billed to avoid double charge
        card.billed = true;
        card.billAmount = amount;
        await card.save();
      }

      // Update session counters snapshot (best-effort)
      if (card.sessionId) {
        const session = await CheckSession.findOne({ sessionId: card.sessionId });
        if (session) {
          const inc = { processed: 0, live: 0, die: 0, unknown: 0 };
          if (newStatus === 'live') inc.live = 1; 
          else if (newStatus === 'die') inc.die = 1; 
          else if (newStatus === 'unknown') inc.unknown = 1;
          inc.processed = 1;
          await CheckSession.updateOne({ _id: session._id }, { $inc: inc });
        }
      }
    } catch (e) {
      logger.error('Billing/update session error:', e);
    }

    // Return ErrorId: 1 = Update Success, 0 = Error (according to user spec)
    return res.json({ 
      ErrorId: 1, 
      Title: 'success', 
      Message: '', 
      Content: '' 
    });
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
