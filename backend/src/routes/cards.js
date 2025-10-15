const express = require('express');
const router = express.Router();
const {
  checkCards,
  getHistory,
  generateCards,
  getStats
} = require('../controllers/cardController');
const { protect, checkBalance } = require('../middleware/auth');
const { validateCardCheck, validateCardGenerate } = require('../middleware/validation');
const { cardCheckLimiter } = require('../middleware/security');

// Apply authentication to all routes
router.use(protect);

// @route   POST /api/cards/check
// @desc    Check credit cards
// @access  Private
router.post('/check', cardCheckLimiter, validateCardCheck, checkBalance, checkCards);

// @route   GET /api/cards/history
// @desc    Get card check history
// @access  Private
router.get('/history', getHistory);

// @route   POST /api/cards/generate
// @desc    Generate credit cards
// @access  Private
router.post('/generate', validateCardGenerate, generateCards);

// @route   GET /api/cards/stats
// @desc    Get card statistics
// @access  Private
router.get('/stats', getStats);

module.exports = router;
