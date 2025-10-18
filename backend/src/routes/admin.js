const express = require('express');
const router = express.Router();
const {
  getDashboard,
  getUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  getUserCards,
  getCards,
  getPaymentRequests,
  updatePaymentRequest,
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getSiteConfig,
  updateSiteConfig,
  getPricingConfig,
  updatePricingConfig,
  getPricingTiers,
  updatePricingTiers,
  getUiConfig,
  updateUiConfig,
  getCryptApiConfig,
  updateCryptApiConfig,

  getPaymentConfig,
  updatePaymentConfig
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const { validateUserUpdate } = require('../middleware/validation');

// Apply authentication and admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard routes
router.get('/dashboard', getDashboard);

// User management routes
router.get('/users', getUsers);
router.post('/users', createUser);
router.get('/users/:id', getUserById);
router.put('/users/:id', validateUserUpdate, updateUser);
router.delete('/users/:id', deleteUser);
router.get('/users/:id/cards', getUserCards);

// Card management routes
router.get('/cards', getCards);

// Payment management routes
router.get('/payments', getPaymentRequests);
router.put('/payments/:id', updatePaymentRequest);
router.get('/payment-methods', getPaymentMethods);
router.post('/payment-methods', createPaymentMethod);
router.put('/payment-methods/:id', updatePaymentMethod);
router.delete('/payment-methods/:id', deletePaymentMethod);

// Site configuration routes

// UI / Language config routes
router.get('/ui-config', getUiConfig);
router.put('/ui-config', updateUiConfig);

// Payment config routes
router.get('/payment-config', getPaymentConfig);
router.put('/payment-config', updatePaymentConfig);

// CryptAPI config routes
router.get('/cryptapi-config', getCryptApiConfig);
router.put('/cryptapi-config', updateCryptApiConfig);



router.get('/site-config', getSiteConfig);
router.put('/site-config', updateSiteConfig);
router.get('/pricing-config', getPricingConfig);
router.put('/pricing-config', updatePricingConfig);

// Pricing tiers routes
router.get('/pricing-tiers', getPricingTiers);
router.put('/pricing-tiers', updatePricingTiers);

module.exports = router;
