const express = require('express');
const router = express.Router();
const {
  getPaymentMethods,
  createPaymentRequest,
  getPaymentRequests,
  cancelPaymentRequest,
  getPaymentStats,
  getCreditPackages
} = require('../controllers/paymentController');
const {
  createCryptApiAddress,
  handleCryptApiWebhook,
  checkCryptApiOrderStatus,
  getPaymentHistory,
  checkPendingPayment,
  getSupportedCoins,
  getEstimate,
  getConvert,
  testCryptApiConnection
} = require('../controllers/cryptApiController');
const { protect, authorize } = require('../middleware/auth');
const { validatePaymentRequest } = require('../middleware/validation');

// @route   POST /api/payments/cryptapi/webhook
// @desc    CryptAPI webhook callback
// @access  Public (with signature verification)
router.post('/cryptapi/webhook', handleCryptApiWebhook);

// @route   GET /api/payments/packages
// @desc    Get credit packages
// @access  Public
router.get('/packages', getCreditPackages);

// Apply authentication to all other routes
router.use(protect);

// @route   GET /api/payments/methods
// @desc    Get payment methods
// @access  Private
router.get('/methods', getPaymentMethods);

// @route   POST /api/payments/request
// @desc    Create payment request
// @access  Private
router.post('/request', validatePaymentRequest, createPaymentRequest);

// @route   GET /api/payments/requests
// @desc    Get payment requests
// @access  Private
router.get('/requests', getPaymentRequests);

// @route   DELETE /api/payments/requests/:id
// @desc    Cancel payment request
// @access  Private
router.delete('/requests/:id', cancelPaymentRequest);

// @route   GET /api/payments/stats
// @desc    Get payment statistics
// @access  Private
router.get('/stats', getPaymentStats);

// CryptAPI routes
// @route   POST /api/payments/cryptapi/create-address
// @desc    Create CryptAPI payment address
// @access  Private
router.post('/cryptapi/create-address', createCryptApiAddress);

// @route   GET /api/payments/cryptapi/status/:orderId
// @desc    Check CryptAPI order status
// @access  Private
router.get('/cryptapi/status/:orderId', checkCryptApiOrderStatus);

// @route   GET /api/payments/cryptapi/history
// @desc    Get payment history
// @access  Private
router.get('/cryptapi/history', getPaymentHistory);

// @route   GET /api/payments/cryptapi/check-pending
// @desc    Check if user has pending payment
// @access  Private
router.get('/cryptapi/check-pending', checkPendingPayment);

// @route   GET /api/payments/cryptapi/coins
// @desc    Get supported coins
// @access  Private
router.get('/cryptapi/coins', getSupportedCoins);

// @route   GET /api/payments/cryptapi/estimate
// @desc    Get fee estimate
// @access  Private
router.get('/cryptapi/estimate', getEstimate);

// @route   GET /api/payments/cryptapi/convert
// @desc    Convert currency
// @access  Private
router.get('/cryptapi/convert', getConvert);

// @route   GET /api/payments/cryptapi/test
// @desc    Test CryptAPI connection
// @access  Private (Admin only)
router.get('/cryptapi/test', authorize('admin'), testCryptApiConnection);

module.exports = router;
