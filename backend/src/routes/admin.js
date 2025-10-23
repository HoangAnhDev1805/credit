const express = require('express');
const router = express.Router();
const admin = require('../controllers/adminController');
// Provide safe fallback to avoid undefined handler crashes
const safe = (fnName) => {
  const fn = admin && admin[fnName];
  if (typeof fn === 'function') return fn;
  return (req, res) => res.status(501).json({ success: false, message: `Handler ${fnName} not implemented` });
};
const { protect, authorize } = require('../middleware/auth');
const { validateUserUpdate } = require('../middleware/validation');

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard routes
router.get('/dashboard', safe('getDashboard'));
router.get('/device-stats', safe('getDeviceStats'));
router.get('/devices', safe('getDeviceStats')); // Alias for frontend
router.get('/checker/metrics', safe('getCheckerMetrics'));

// User management routes
router.get('/users', safe('getUsers'));
router.post('/users', safe('createUser'));
router.get('/users/:id', safe('getUserById'));
router.put('/users/:id', validateUserUpdate, safe('updateUser'));
router.delete('/users/:id', safe('deleteUser'));
router.get('/users/:id/cards', safe('getUserCards'));

// Card management routes
router.get('/cards', safe('getCards'));
router.delete('/cards', safe('deleteCardsBulk'));
router.delete('/cards/by-status', safe('deleteCardsByStatus'));

// Payment management routes
router.get('/payments', safe('getPaymentRequests'));
router.put('/payments/:id', safe('updatePaymentRequest'));
// Alias routes to match frontend expectations
router.get('/payment-requests', safe('getPaymentRequests'));
router.put('/payment-requests/:id', safe('updatePaymentRequest'));
router.get('/payment-methods', safe('getPaymentMethods'));
router.post('/payment-methods', safe('createPaymentMethod'));
router.put('/payment-methods/:id', safe('updatePaymentMethod'));
router.delete('/payment-methods/:id', safe('deletePaymentMethod'));

// Site configuration routes

// UI / Language config routes
router.get('/ui-config', safe('getUiConfig'));
router.put('/ui-config', safe('updateUiConfig'));

// Payment config routes
router.get('/payment-config', safe('getPaymentConfig'));
router.put('/payment-config', safe('updatePaymentConfig'));

// CryptAPI config routes
router.get('/cryptapi-config', safe('getCryptApiConfig'));
router.put('/cryptapi-config', safe('updateCryptApiConfig'));



router.get('/site-config', safe('getSiteConfig'));
router.put('/site-config', safe('updateSiteConfig'));
router.get('/pricing-config', safe('getPricingConfig'));
router.put('/pricing-config', safe('updatePricingConfig'));

// Pricing tiers routes
router.get('/pricing-tiers', safe('getPricingTiers'));
router.put('/pricing-tiers', safe('updatePricingTiers'));

// Rate Limit management routes
router.get('/ratelimit-config', safe('getRateLimitConfig'));
router.put('/ratelimit-config', safe('updateRateLimitConfig'));
router.get('/request-stats', safe('getRequestStats'));

module.exports = router;
