const PaymentMethod = require('../models/PaymentMethod');
const PaymentRequest = require('../models/PaymentRequest');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

// @desc    Get payment methods
// @route   GET /api/payments/methods
// @access  Private
const getPaymentMethods = async (req, res, next) => {
  try {
    const methods = await PaymentMethod.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .lean();

    // Format response to hide sensitive info for regular users
    const formattedMethods = methods.map(method => ({
      id: method._id,
      name: method.name,
      type: method.type,
      bankName: method.bankName,
      bankCode: method.bankCode,
      accountNumber: method.accountNumber,
      accountName: method.accountName,
      qrCode: method.qrCode,
      instructions: method.instructions,
      minAmount: method.minAmount,
      maxAmount: method.maxAmount,
      fee: method.fees,
      feeType: method.feeType
    }));

    res.json({
      success: true,
      data: {
        methods: formattedMethods
      }
    });
  } catch (error) {
    logger.error('Get payment methods error:', error);
    next(error);
  }
};

// @desc    Create payment request
// @route   POST /api/payments/request
// @access  Private
const createPaymentRequest = async (req, res, next) => {
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

    const { paymentMethodId, amount, note } = req.body;
    const userId = req.user.id;

    // Get payment method
    const paymentMethod = await PaymentMethod.findById(paymentMethodId);
    if (!paymentMethod || !paymentMethod.isActive) {
      return res.status(400).json({
        success: false,
        message: 'Phương thức thanh toán không hợp lệ'
      });
    }

    // Validate amount
    if (amount < paymentMethod.minAmount || amount > paymentMethod.maxAmount) {
      return res.status(400).json({
        success: false,
        message: `Số tiền phải từ ${paymentMethod.minAmount}$ đến ${paymentMethod.maxAmount}$`
      });
    }

    // Check for pending requests
    const pendingRequest = await PaymentRequest.findOne({
      userId: userId,
      status: 'pending'
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã có yêu cầu nạp tiền đang chờ xử lý'
      });
    }

    // Calculate fee
    const calculatedFee = paymentMethod.calculateFee(amount);
    const finalAmount = amount - calculatedFee;

    // Create payment request
    const paymentRequest = await PaymentRequest.create({
      userId: userId,
      paymentMethodId: paymentMethodId,
      amount,
      fee: calculatedFee,
      finalAmount,
      note,
      status: 'pending',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    await paymentRequest.populate('paymentMethodId', 'name type accountNumber accountName bankName instructions');

    logger.info(`Payment request created for user ${req.user.username}`, {
      userId,
      requestId: paymentRequest._id,
      amount,
      paymentMethod: paymentMethod.name
    });

    res.status(201).json({
      success: true,
      message: 'Yêu cầu nạp tiền đã được tạo',
      data: {
        request: {
          id: paymentRequest._id,
          amount: paymentRequest.amount,
          fee: paymentRequest.fee,
          finalAmount: paymentRequest.finalAmount,
          status: paymentRequest.status,
          note: paymentRequest.note,
          expiresAt: paymentRequest.expiresAt,
          createdAt: paymentRequest.createdAt,
          paymentMethod: {
            name: paymentRequest.paymentMethodId.name,
            type: paymentRequest.paymentMethodId.type,
            accountNumber: paymentRequest.paymentMethodId.accountNumber,
            accountName: paymentRequest.paymentMethodId.accountName,
            bankName: paymentRequest.paymentMethodId.bankName,
            instructions: paymentRequest.paymentMethodId.instructions
          }
        }
      }
    });
  } catch (error) {
    logger.error('Create payment request error:', error);
    next(error);
  }
};

// @desc    Get payment requests
// @route   GET /api/payments/requests
// @access  Private
const getPaymentRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    // Build query
    const query = { userId: userId };
    if (status) {
      query.status = status;
    }

    // Get requests with pagination
    const requests = await PaymentRequest.find(query)
      .populate('paymentMethodId', 'name type bankName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const total = await PaymentRequest.countDocuments(query);

    // Format response
    const formattedRequests = requests.map(request => ({
      id: request._id,
      amount: request.amount,
      fee: request.fee,
      finalAmount: request.finalAmount,
      status: request.status,
      note: request.note,
      adminNote: request.adminNote,
      expiresAt: request.expiresAt,
      processedAt: request.processedAt,
      createdAt: request.createdAt,
      paymentMethod: {
        name: request.paymentMethodId?.name,
        type: request.paymentMethodId?.type,
        bankName: request.paymentMethodId?.bankName
      }
    }));

    res.json({
      success: true,
      data: {
        requests: formattedRequests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get payment requests error:', error);
    next(error);
  }
};

// @desc    Cancel payment request
// @route   DELETE /api/payments/requests/:id
// @access  Private
const cancelPaymentRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const paymentRequest = await PaymentRequest.findOne({
      _id: id,
      userId: userId
    });

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy yêu cầu thanh toán'
      });
    }

    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hủy yêu cầu đang chờ xử lý'
      });
    }

    paymentRequest.status = 'cancelled';
    paymentRequest.processedAt = new Date();
    await paymentRequest.save();

    logger.info(`Payment request cancelled by user ${req.user.username}`, {
      userId,
      requestId: id
    });

    res.json({
      success: true,
      message: 'Đã hủy yêu cầu nạp tiền'
    });
  } catch (error) {
    logger.error('Cancel payment request error:', error);
    next(error);
  }
};

// @desc    Get payment statistics
// @route   GET /api/payments/stats
// @access  Private
const getPaymentStats = async (req, res, next) => {
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

    // Get payment request statistics
    const requestStats = await PaymentRequest.aggregate([
      {
        $match: { userId: userId, ...dateFilter }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalFinalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Get transaction statistics (deposits)
    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          type: 'deposit',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: null,
          totalDeposited: { $sum: '$amount' },
          totalTransactions: { $sum: 1 }
        }
      }
    ]);

    // Format response
    const formattedStats = {
      requests: {
        pending: 0,
        approved: 0,
        rejected: 0,
        cancelled: 0,
        expired: 0
      },
      amounts: {
        totalRequested: 0,
        totalApproved: 0,
        totalDeposited: transactionStats[0]?.totalDeposited || 0
      },
      transactions: transactionStats[0]?.totalTransactions || 0
    };

    requestStats.forEach(stat => {
      formattedStats.requests[stat._id] = stat.count;
      formattedStats.amounts.totalRequested += stat.totalAmount;
      if (stat._id === 'approved') {
        formattedStats.amounts.totalApproved += stat.totalFinalAmount;
      }
    });

    res.json({
      success: true,
      data: {
        stats: formattedStats,
        timeRange
      }
    });
  } catch (error) {
    logger.error('Get payment stats error:', error);
    next(error);
  }
};

module.exports = {
  getPaymentMethods,
  createPaymentRequest,
  getPaymentRequests,
  cancelPaymentRequest,
  getPaymentStats
};
