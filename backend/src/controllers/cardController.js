const Card = require('../models/Card');
const User = require('../models/User');
const PricingConfig = require('../models/PricingConfig');
const Transaction = require('../models/Transaction');
const ExternalCardAPI = require('../services/ExternalCardAPI');
const CardGeneratorService = require('../services/CardGeneratorService');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

// @desc    Check cards
// @route   POST /api/cards/check
// @access  Private
const checkCards = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { cards, checkType = 1 } = req.body;
    const userId = req.user.id;

    // Get pricing for the number of cards
    const pricing = await PricingConfig.findApplicablePricing(cards.length);
    if (!pricing) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy gói giá phù hợp'
      });
    }

    const totalCost = pricing.pricePerCard * cards.length;

    // Check user balance
    const user = await User.findById(userId);
    if (user.balance < totalCost) {
      return res.status(400).json({
        success: false,
        message: `Số dư không đủ. Cần ${totalCost}$, hiện có ${user.balance}$`
      });
    }

    // Deduct balance
    user.balance -= totalCost;
    await user.save();

    // Create transaction record
    const transaction = await Transaction.create({
      user: userId,
      type: 'card_check',
      amount: totalCost,
      description: `Kiểm tra ${cards.length} thẻ tín dụng`,
      status: 'completed',
      metadata: {
        cardCount: cards.length,
        checkType,
        pricingTier: pricing.name
      }
    });

    // Process cards
    const results = [];
    const cardDocuments = [];

    for (const cardData of cards) {
      try {
        // Create card document
        const card = new Card({
          user: userId,
          cardNumber: cardData.cardNumber,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cvv: cardData.cvv,
          checkType,
          status: 'pending',
          transaction: transaction._id
        });

        await card.save();
        cardDocuments.push(card);

        // Check card via external API
        const checkResult = await ExternalCardAPI.getCardsToCheck({
          cardNumber: cardData.cardNumber,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cvv: cardData.cvv,
          checkType
        });

        // Update card with result
        card.status = checkResult.status;
        card.response = checkResult.response;
        card.checkedAt = new Date();
        await card.save();

        results.push({
          cardId: card._id,
          cardNumber: card.maskedCardNumber,
          status: card.status,
          response: card.response,
          brand: card.brand,
          bin: card.bin
        });

        // Update user card statistics
        user.cardStats.total += 1;
        if (checkResult.status === 'live') {
          user.cardStats.live += 1;
        } else if (checkResult.status === 'dead') {
          user.cardStats.dead += 1;
        }

      } catch (error) {
        logger.error(`Error checking card: ${cardData.cardNumber}`, error);
        
        // Create failed card record
        const card = new Card({
          user: userId,
          cardNumber: cardData.cardNumber,
          expiryMonth: cardData.expiryMonth,
          expiryYear: cardData.expiryYear,
          cvv: cardData.cvv,
          checkType,
          status: 'error',
          response: { error: error.message },
          transaction: transaction._id,
          checkedAt: new Date()
        });

        await card.save();
        cardDocuments.push(card);

        results.push({
          cardId: card._id,
          cardNumber: card.maskedCardNumber,
          status: 'error',
          response: { error: 'Lỗi kiểm tra thẻ' },
          brand: card.brand,
          bin: card.bin
        });

        user.cardStats.total += 1;
        user.cardStats.error += 1;
      }
    }

    await user.save();

    // Update transaction with results
    transaction.metadata.results = {
      total: results.length,
      live: results.filter(r => r.status === 'live').length,
      dead: results.filter(r => r.status === 'dead').length,
      error: results.filter(r => r.status === 'error').length
    };
    await transaction.save();

    logger.info(`Cards checked for user ${user.username}`, {
      userId,
      cardCount: cards.length,
      totalCost,
      results: transaction.metadata.results
    });

    res.json({
      success: true,
      message: `Đã kiểm tra ${cards.length} thẻ thành công`,
      data: {
        results,
        summary: {
          total: results.length,
          live: results.filter(r => r.status === 'live').length,
          dead: results.filter(r => r.status === 'dead').length,
          error: results.filter(r => r.status === 'error').length,
          cost: totalCost,
          remainingBalance: user.balance
        },
        transaction: {
          id: transaction._id,
          amount: transaction.amount,
          createdAt: transaction.createdAt
        }
      }
    });
  } catch (error) {
    logger.error('Check cards error:', error);
    next(error);
  }
};

// @desc    Get card check history
// @route   GET /api/cards/history
// @access  Private
const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const checkType = req.query.checkType;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query: history of cards submitted by this user
    const query = { originUserId: userId };

    if (status) {
      // accept both 'die' and 'dead'
      query.status = status === 'dead' ? 'die' : status;
    }

    if (checkType) {
      query.typeCheck = parseInt(checkType);
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get cards with pagination
    const cards = await Card.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const total = await Card.countDocuments(query);

    // Format response
    const formattedCards = cards.map(card => ({
      id: card._id,
      // prefer masked or full when available
      cardNumber: card.maskedCardNumber || card.fullCard || card.cardNumber,
      brand: card.brand,
      bin: card.bin,
      status: card.status === 'die' ? 'dead' : (card.status || 'unknown'),
      checkType: card.typeCheck,
      response: card.response || card.errorMessage,
      checkedAt: card.checkedAt,
      createdAt: card.createdAt
    }));

    res.json({
      success: true,
      data: {
        cards: formattedCards,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get history error:', error);
    next(error);
  }
};

// @desc    Generate cards
// @route   POST /api/cards/generate
// @access  Private
const generateCards = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { bin, quantity, month, year } = req.body;

    // Generate cards
    const cards = CardGeneratorService.generateCards({
      bin,
      quantity,
      month,
      year
    });

    logger.info(`Generated ${quantity} cards for user ${req.user.username}`, {
      userId: req.user.id,
      quantity,
      bin
    });

    res.json({
      success: true,
      message: `Đã tạo ${cards.length} thẻ thành công`,
      data: {
        cards,
        count: cards.length
      }
    });
  } catch (error) {
    logger.error('Generate cards error:', error);
    next(error);
  }
};

// @desc    Get card statistics
// @route   GET /api/cards/stats
// @access  Private
const getStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const timeRange = req.query.range || '30d'; // 7d, 30d, 90d, all

    // Build date filter
    let dateFilter = {};
    if (timeRange !== 'all') {
      const days = parseInt(timeRange.replace('d', ''));
      dateFilter = {
        createdAt: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      };
    }

    // Get card statistics (by originUserId - cards submitted by this user)
    const stats = await Card.aggregate([
      {
        $match: { originUserId: require('mongoose').Types.ObjectId(userId), ...dateFilter }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          brands: { $addToSet: '$brand' }
        }
      }
    ]);

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      {
        $match: { 
          userId: require('mongoose').Types.ObjectId(userId), 
          type: 'card_check',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    // Format response
    const formattedStats = {
      total: 0,
      live: 0,
      dead: 0,
      error: 0,
      pending: 0
    };

    stats.forEach(stat => {
      formattedStats[stat._id] = stat.count;
      formattedStats.total += stat.count;
    });

    const successRate = formattedStats.total > 0 ? 
      ((formattedStats.live / formattedStats.total) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      data: {
        cardStats: formattedStats,
        successRate: parseFloat(successRate),
        spending: {
          totalSpent: transactionStats[0]?.totalSpent || 0,
          totalTransactions: transactionStats[0]?.totalTransactions || 0
        },
        timeRange
      }
    });
  } catch (error) {
    logger.error('Get stats error:', error);
    next(error);
  }
};

module.exports = {
  checkCards,
  getHistory,
  generateCards,
  getStats
};
