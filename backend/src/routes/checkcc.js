const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { checkcc, receiveResult } = require('../controllers/checkccController');

// ZennoPoster API endpoint - requires JWT authentication
// GET/POST /api/checkcc
// LoaiDV=1: Fetch random cards for checking
// LoaiDV=2: Update card status after checking
router.get('/checkcc', protect, checkcc);
router.post('/checkcc', protect, checkcc);

// Receive result from external sender (LoaiDV=2 from admin/api-tester)
// Router is mounted at /api, so this creates /api/checkcc/receive-result
router.post('/checkcc/receive-result', protect, receiveResult);

module.exports = router;
