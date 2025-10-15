const express = require('express');
const router = express.Router();
const { getPublicConfigs, getPricingTiersPublic, getCreditPackages } = require('../controllers/configController');

// Public (no auth) configs
router.get('/public', getPublicConfigs);
router.get('/pricing-tiers', getPricingTiersPublic);
router.get('/credit-packages', getCreditPackages);

module.exports = router;
