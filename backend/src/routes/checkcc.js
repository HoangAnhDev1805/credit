const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkcc } = require('../controllers/checkccController');

// ZennoPoster API endpoint - requires JWT authentication
// POST /api/checkcc
// LoaiDV=1: Fetch random cards for checking
// LoaiDV=2: Update card status after checking
router.post('/checkcc', protect, checkcc);

module.exports = router;
