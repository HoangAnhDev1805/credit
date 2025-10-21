const express = require('express');
const router = express.Router();
const { protect, protectToken } = require('../middleware/auth');
const { checkcc, receiveResult } = require('../controllers/checkccController');

// ZennoPoster API endpoint - requires JWT authentication
// GET/POST /api/checkcc
// LoaiDV=1: Fetch random cards for checking
// LoaiDV=2: Update card status after checking
router.get('/checkcc', protect, checkcc);
// Allow POST with Token in body/query (no login session required)
router.post('/checkcc', protectToken, checkcc);

// Utility: return requester IP for ZennoPoster to verify networking
router.get('/checkcc/ip', (req, res) => {
  const xfwd = req.headers['x-forwarded-for'] || '';
  const ips = Array.isArray(xfwd) ? xfwd.join(',') : String(xfwd);
  const ip = (ips && ips.split(',')[0].trim()) || req.ip || req.connection?.remoteAddress || '';
  res.json({
    success: true,
    ip,
    xForwardedFor: ips,
    userAgent: req.headers['user-agent'] || '',
    headers: {
      'cf-connecting-ip': req.headers['cf-connecting-ip'] || '',
      'x-real-ip': req.headers['x-real-ip'] || ''
    }
  });
});

// Receive result from external sender (LoaiDV=2 from admin/api-tester)
// Router is mounted at /api, so this creates /api/checkcc/receive-result
router.post('/checkcc/receive-result', protect, receiveResult);

module.exports = router;
