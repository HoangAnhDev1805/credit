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
    if (!cryptApiService.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'CryptAPI chưa được cấu hình'
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
      value: amount,
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
        qr_code_base64: addressResult.data.qr_code,
        payment_uri: addressResult.data.payment_uri,
        expiresAt: paymentRequest.expiresAt,
        instructions: `Chuyển tối thiểu ${addressResult.data.minimum_transaction_coin} ${coin.toUpperCase()} đến địa chỉ trên`
      }
    });
  } catch (error) {
    logger.error('Create CryptAPI address error:', error);
    next(error);
  }
};

// @desc    Webhook callback từ CryptAPI
// @route   POST /api/payments/cryptapi/webhook
// @access  Public (với signature verification)
const handleCryptApiWebhook = async (req, res) => {
  try {
    // Verify signature
    if (!cryptApiService.verifyWebhookSignature(req)) {
      logger.warn('Invalid CryptAPI webhook signature');
      return res.status(401).send('invalid signature');
    }

    // Parse webhook data
    const webhookData = req.body ? JSON.parse(req.body.toString()) : req.body || {};
    
    // Idempotency check
    if (!webhookData.uuid || processedWebhooks.has(webhookData.uuid)) {
      return res.send('*ok*');
    }

    // Process webhook
    const webhookResult = await cryptApiService.processWebhook(webhookData);
    
    if (!webhookResult.success) {
      logger.error('Webhook processing failed:', webhookResult.error);
      return res.send('*ok*'); // Vẫn trả ok để tránh retry
    }

    const { orderId, isPending, coin, value_coin, value_forwarded_coin, txid_in, status } = webhookResult.data;

    // Tìm payment request
    const paymentRequest = await PaymentRequest.findOne({
      transactionId: orderId
    }).populate('userId');

    if (!paymentRequest) {
      logger.warn('Payment request not found for webhook:', orderId);
      return res.send('*ok*');
    }

    // Mark webhook as processed
    processedWebhooks.add(webhookData.uuid);

    if (isPending) {
      // Thanh toán pending
      logger.info('CryptAPI payment pending:', {
        orderId,
        coin,
        value_coin,
        txid_in
      });

      await PaymentRequest.findByIdAndUpdate(paymentRequest._id, {
        adminNote: `CryptAPI pending - TX: ${txid_in}`,
        metadata: {
          ...paymentRequest.metadata,
          cryptapi_txid_in: txid_in,
          cryptapi_status: 'pending',
          cryptapi_value_coin: value_coin
        }
      });
    } else {
      // Thanh toán confirmed
      logger.info('CryptAPI payment confirmed:', {
        orderId,
        coin,
        value_coin,
        value_forwarded_coin,
        txid_in
      });

      // Update payment request metadata
      await PaymentRequest.findByIdAndUpdate(paymentRequest._id, {
        adminNote: `CryptAPI confirmed - TX: ${txid_in}`,
        metadata: {
          ...paymentRequest.metadata,
          cryptapi_txid_in: txid_in,
          cryptapi_status: 'confirmed',
          cryptapi_value_coin: value_coin,
          cryptapi_value_forwarded: value_forwarded_coin
        }
      });

      // Use PaymentRequest approve method which handles USD to credits conversion
      await paymentRequest.approve(null, `CryptAPI confirmed - TX: ${txid_in}`);

      logger.info('CryptAPI payment completed:', {
        userId: user._id,
        username: user.username,
        amount: paymentRequest.finalAmount,
        txid_in,
        newBalance
      });
    }

    // Trả về *ok* cho CryptAPI (bắt buộc)
    res.send('*ok*');
  } catch (error) {
    logger.error('CryptAPI webhook error:', error);
    res.send('*ok*'); // Vẫn trả ok để tránh retry vô hạn
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
  getSupportedCoins,
  getEstimate,
  getConvert,
  testCryptApiConnection
};
