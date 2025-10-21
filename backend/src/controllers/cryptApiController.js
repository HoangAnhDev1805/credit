const PaymentRequest = require('../models/PaymentRequest');
const PaymentMethod = require('../models/PaymentMethod');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const cryptApiService = require('../services/cryptApiService');
const logger = require('../config/logger');

// Set để lưu các webhook UUID đã xử lý (idempotency)
const processedWebhooks = new Set();

// @desc    Tạo địa chỉ thanh toán CryptAPI
// @route   POST /api/payments/cryptapi/create-address
// @access  Private
const createCryptApiAddress = async (req, res, next) => {
  try {
    const isConfigured = await cryptApiService.isConfigured();
    if (!isConfigured) {
      return res.status(503).json({
        success: false,
        message: 'CryptAPI chưa được cấu hình. Vui lòng cấu hình CryptAPI trong Admin Settings.'
      });
    }

    const { amount, coin = 'btc', confirmations = 1 } = req.body;
    const userId = req.user.id;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền không hợp lệ'
      });
    }

    // Tạo order ID unique
    const orderId = `CRYPTO_${userId}_${Date.now()}`;

    // Tìm hoặc tạo payment method cho CryptAPI
    let cryptApiMethod = await PaymentMethod.findOne({ 
      type: 'crypto',
      name: 'CryptAPI'
    });

    if (!cryptApiMethod) {
      cryptApiMethod = await PaymentMethod.create({
        name: 'CryptAPI',
        type: 'crypto',
        accountNumber: 'CRYPTAPI_GATEWAY',
        accountName: 'CryptAPI Payment Gateway',
        instructions: 'Thanh toán qua CryptAPI - Hỗ trợ BTC, ETH, USDT và nhiều loại crypto khác',
        minAmount: 0.0001,
        maxAmount: 100000,
        isActive: true,
        sortOrder: 0
      });
    }

    // Tạo payment request trong database
    const paymentRequest = await PaymentRequest.create({
      userId,
      paymentMethodId: cryptApiMethod._id,
      amount,
      fee: 0, // CryptAPI tính phí tự động
      finalAmount: amount,
      note: `CryptAPI ${coin.toUpperCase()} - ${orderId}`,
      status: 'pending',
      transactionId: orderId,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 giờ
    });

    // Tạo địa chỉ thanh toán với CryptAPI
    const addressResult = await cryptApiService.createPaymentAddress({
      orderId,
      coin,
      amount,  // Changed from 'value' to 'amount'
      confirmations
    });

    if (!addressResult.success) {
      // Cập nhật payment request thành failed
      await PaymentRequest.findByIdAndUpdate(paymentRequest._id, {
        status: 'failed',
        adminNote: `CryptAPI error: ${addressResult.error}`
      });

      return res.status(400).json({
        success: false,
        message: 'Không thể tạo địa chỉ thanh toán CryptAPI',
        error: addressResult.error
      });
    }

    // Cập nhật payment request với thông tin từ CryptAPI
    await PaymentRequest.findByIdAndUpdate(paymentRequest._id, {
      metadata: {
        cryptapi_address_in: addressResult.data.address_in,
        cryptapi_address_out: addressResult.data.address_out,
        cryptapi_coin: addressResult.data.coin,
        cryptapi_minimum_transaction: addressResult.data.minimum_transaction_coin,
        cryptapi_qr_code: addressResult.data.qr_code,
        cryptapi_payment_uri: addressResult.data.payment_uri,
        cryptapi_callback_url: addressResult.data.callback_url
      }
    });

    logger.info('CryptAPI address created:', {
      userId,
      orderId,
      coin,
      amount,
      address_in: addressResult.data.address_in
    });

    res.json({
      success: true,
      message: 'Địa chỉ thanh toán CryptAPI đã được tạo',
      data: {
        paymentRequestId: paymentRequest._id,
        orderId,
        coin: addressResult.data.coin,
        amount,
        address_in: addressResult.data.address_in,
        minimum_transaction_coin: addressResult.data.minimum_transaction_coin,
        qrcode_url: addressResult.data.qrcode_url,
        qr_code: addressResult.data.qr_code,
        payment_uri: addressResult.data.payment_uri,
        expiresAt: paymentRequest.expiresAt,
        instructions: `Send at least ${addressResult.data.minimum_transaction_coin} ${coin.toUpperCase()} to the address above`
      }
    });
  } catch (error) {
    logger.error('Create CryptAPI address error:', error);
    next(error);
  }
};

// @desc    Webhook callback từ CryptAPI
// @route   POST /api/payments/cryptapi/webhook
// @access  Public
const handleCryptApiWebhook = async (req, res) => {
  try {
    // Get webhook data from body (post=1&json=1)
    const webhookData = req.body || {};
    
    // Custom params ALWAYS in query string
    const { order_id } = req.query;
    
    const {
      uuid,
      pending,
      coin,
      address_in,
      address_out,
      txid_in,
      txid_out,
      confirmations,
      value_coin,
      value_coin_convert,
      value_forwarded_coin,
      value_forwarded_coin_convert,
      fee_coin,
      price
    } = webhookData;

    logger.info('[CryptAPI Webhook] Received:', {
      uuid,
      order_id,
      pending: pending === 1 ? 'pending' : 'confirmed',
      coin,
      value_coin,
      confirmations
    });

    // Idempotency check
    if (!uuid || processedWebhooks.has(uuid)) {
      logger.info('[CryptAPI Webhook] Duplicate webhook, skipping:', uuid);
      return res.status(200).send('*ok*');
    }

    // Find payment request by order_id
    const paymentRequest = await PaymentRequest.findOne({
      transactionId: order_id
    }).populate('userId');

    if (!paymentRequest) {
      logger.error('[CryptAPI Webhook] Payment request not found:', order_id);
      return res.status(200).send('*ok*');
    }

    // Process based on pending status
    if (pending === 1) {
      // Payment detected but not confirmed
      logger.info('[CryptAPI Webhook] Pending payment:', {
        order_id,
        txid: txid_in,
        amount: value_coin
      });

      await PaymentRequest.findByIdAndUpdate(paymentRequest._id, {
        status: 'processing',
        adminNote: `Pending: ${value_coin} ${coin.toUpperCase()} (tx: ${txid_in})`
      });

      // Mark as processed
      processedWebhooks.add(uuid);
      
      return res.status(200).send('*ok*');

    } else if (pending === 0 && confirmations >= 1) {
      // Payment confirmed
      logger.info('[CryptAPI Webhook] Confirmed payment:', {
        order_id,
        txid: txid_in,
        amount: value_coin,
        forwarded: value_forwarded_coin,
        fee: fee_coin
      });

      // Calculate credits (using payment request amount)
      const creditAmount = paymentRequest.amount;

      // Update payment request
      await PaymentRequest.findByIdAndUpdate(paymentRequest._id, {
        status: 'approved',
        adminNote: `Confirmed: ${value_forwarded_coin} ${coin.toUpperCase()} forwarded (tx: ${txid_out}, fee: ${fee_coin}), Price: $${price}`,
        approvedBy: null, // Auto-approved by system
        approvedAt: new Date()
      });

      // Credit user account
      const user = await User.findById(paymentRequest.userId);
      if (user) {
        user.balance += creditAmount;
        await user.save();

        // Create transaction record
        await Transaction.create({
          userId: user._id,
          type: 'payment',
          amount: creditAmount,
          balance: user.balance,
          description: `CryptAPI payment confirmed: ${value_coin} ${coin.toUpperCase()}`,
          metadata: {
            payment_request_id: paymentRequest._id,
            crypto_coin: coin,
            crypto_amount: value_coin,
            forwarded_amount: value_forwarded_coin,
            fee: fee_coin,
            txid_in,
            txid_out,
            address_in,
            price_usd: price
          }
        });

        logger.info('[CryptAPI Webhook] User credited:', {
          userId: user._id,
          credits: creditAmount,
          newBalance: user.balance
        });

        // Emit Socket.IO event for real-time UI update
        const io = req.app.get('io');
        if (io) {
          io.to(user._id.toString()).emit('payment:completed', {
            success: true,
            credits: creditAmount,
            balance: user.balance,
            coin: coin.toUpperCase(),
            amount: value_coin,
            txid: txid_in
          });
        }
      }

      // Mark as processed
      processedWebhooks.add(uuid);

      return res.status(200).send('*ok*');
    }

    // Unknown state
    logger.warn('[CryptAPI Webhook] Unknown state:', { pending, confirmations });
    return res.status(200).send('*ok*');

  } catch (error) {
    logger.error('[CryptAPI Webhook] Error:', error);
    // Always respond with *ok* to stop retries
    return res.status(200).send('*ok*');
  }
};

// @desc    Kiểm tra trạng thái đơn hàng CryptAPI
// @route   GET /api/payments/cryptapi/status/:orderId
// @access  Private
const checkCryptApiOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    // Kiểm tra quyền truy cập
    const paymentRequest = await PaymentRequest.findOne({
      transactionId: orderId,
      userId: req.user.id
    });

    if (!paymentRequest) {
      return res.status(404).json({
        success: false,
        message: 'Đơn hàng không tồn tại'
      });
    }

    res.json({
      success: true,
      data: {
        orderId,
        status: paymentRequest.status,
        amount: paymentRequest.amount,
        coin: paymentRequest.metadata?.cryptapi_coin || 'unknown',
        address_in: paymentRequest.metadata?.cryptapi_address_in,
        txid_in: paymentRequest.metadata?.cryptapi_txid_in,
        value_coin: paymentRequest.metadata?.cryptapi_value_coin,
        createdAt: paymentRequest.createdAt,
        expiresAt: paymentRequest.expiresAt,
        processedAt: paymentRequest.processedAt
      }
    });
  } catch (error) {
    logger.error('Check CryptAPI order status error:', error);
    next(error);
  }
};

// @desc    Get payment history
// @route   GET /api/payments/cryptapi/history
// @access  Private
const getPaymentHistory = async (req, res, next) => {
  try {
    const { limit = 5, skip = 0 } = req.query;
    const userId = req.user.id;

    // Find all crypto payments for this user
    const query = {
      userId,
      note: { $regex: 'CryptAPI', $options: 'i' }
    };

    const payments = await PaymentRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .select('transactionId amount status metadata createdAt expiresAt approvedAt qrcode_url');

    const total = await PaymentRequest.countDocuments(query);

    const formattedPayments = payments.map(p => ({
      id: p._id,
      orderId: p.transactionId,
      amount: p.amount,
      status: p.status,
      coin: p.metadata?.cryptapi_coin || 'unknown',
      address_in: p.metadata?.cryptapi_address_in,
      txid_in: p.metadata?.cryptapi_txid_in,
      value_coin: p.metadata?.cryptapi_value_coin,
      minimum_transaction_coin: p.metadata?.cryptapi_minimum_transaction,
      qrcode_url: p.metadata?.cryptapi_qr_code,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      completedAt: p.approvedAt
    }));

    res.json({
      success: true,
      data: {
        payments: formattedPayments,
        total,
        hasMore: total > parseInt(skip) + parseInt(limit)
      }
    });
  } catch (error) {
    logger.error('[CryptAPI History] Error:', error);
    next(error);
  }
};

// @desc    Check if user has pending crypto payment
// @route   GET /api/payments/cryptapi/check-pending
// @access  Private
const checkPendingPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const pendingPayment = await PaymentRequest.findOne({
      userId,
      status: { $in: ['pending', 'processing'] },
      note: { $regex: 'CryptAPI', $options: 'i' },
      expiresAt: { $gt: new Date() }
    }).select('transactionId amount metadata createdAt expiresAt');

    if (pendingPayment) {
      return res.json({
        success: true,
        data: {
          hasPending: true,
          payment: {
            orderId: pendingPayment.transactionId,
            amount: pendingPayment.amount,
            coin: pendingPayment.metadata?.cryptapi_coin,
            address_in: pendingPayment.metadata?.cryptapi_address_in,
            createdAt: pendingPayment.createdAt,
            expiresAt: pendingPayment.expiresAt
          }
        }
      });
    }

    res.json({
      success: true,
      data: { hasPending: false }
    });
  } catch (error) {
    logger.error('[CryptAPI Check Pending] Error:', error);
    next(error);
  }
};

// @desc    Lấy danh sách coins hỗ trợ
// @route   GET /api/payments/cryptapi/coins
// @access  Private
const getSupportedCoins = async (req, res, next) => {
  try {
    const result = await cryptApiService.getSupportedCoins();
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể lấy danh sách coins',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Get supported coins error:', error);
    next(error);
  }
};

// @desc    Ước tính phí
// @route   GET /api/payments/cryptapi/estimate
// @access  Private
const getEstimate = async (req, res, next) => {
  try {
    const { coin = 'btc', addresses = 1, priority = 'default' } = req.query;
    
    const result = await cryptApiService.getEstimate(coin, parseInt(addresses), priority);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể ước tính phí',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Get estimate error:', error);
    next(error);
  }
};

// @desc    Quy đổi tiền
// @route   GET /api/payments/cryptapi/convert
// @access  Private
const getConvert = async (req, res, next) => {
  try {
    const { coin = 'btc', value, from = 'USD' } = req.query;
    
    if (!value) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu tham số value'
      });
    }
    
    const result = await cryptApiService.getConvert(coin, parseFloat(value), from);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Không thể quy đổi tiền',
        error: result.error
      });
    }
  } catch (error) {
    logger.error('Get convert error:', error);
    next(error);
  }
};

// @desc    Test CryptAPI connection
// @route   GET /api/payments/cryptapi/test
// @access  Private (Admin only)
const testCryptApiConnection = async (req, res, next) => {
  try {
    const testResult = await cryptApiService.testConnection();
    
    res.json({
      success: testResult.success,
      message: testResult.success ? 'CryptAPI connection OK' : 'CryptAPI connection failed',
      data: testResult.data || { error: testResult.error }
    });
  } catch (error) {
    logger.error('Test CryptAPI connection error:', error);
    next(error);
  }
};

module.exports = {
  createCryptApiAddress,
  handleCryptApiWebhook,
  checkCryptApiOrderStatus,
  getPaymentHistory,
  checkPendingPayment,
  getSupportedCoins,
  getEstimate,
  getConvert,
  testCryptApiConnection
};
