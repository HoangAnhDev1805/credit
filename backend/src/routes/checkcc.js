const express = require('express');
const router = express.Router();
const { protect, protectToken } = require('../middleware/auth');
const { checkcc, receiveResult, evict } = require('../controllers/checkccController');
const { checkExistingCards, startOrStop, getStatus } = require('../controllers/checkerController');
const { validateHMAC, validateIPAllowlist, validateRateLimit } = require('../middleware/zennoSecurity');
const { validateStartRequest, validateStopRequest } = require('../middleware/validateChecker');

// ZennoPoster API endpoint - requires JWT authentication + security validations
// GET/POST /api/checkcc
// LoaiDV=1: Fetch random cards for checking
// LoaiDV=2: Update card status after checking
// Security: IP allowlist, rate limit, optional HMAC (configurable via SiteConfig)
router.get('/checkcc', protect, checkcc);
// Allow POST with Token in body/query (no login session required)
router.post('/checkcc', validateIPAllowlist, validateRateLimit, validateHMAC, protectToken, checkcc);

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

// Evict cards for a session (Stop semantics) - with security
router.post('/checkcc/evict', validateIPAllowlist, validateRateLimit, protectToken, evict);

// Canonical check-existing for FE (adapter still available at /api/checker/check-existing)
router.post('/checkcc/check-existing', protect, checkExistingCards);

// Canonical FE routes (adapters to checkerController)
router.post('/checkcc/start', protect, validateStartRequest, startOrStop);
router.get('/checkcc/status/:sessionId', protect, getStatus);
router.post('/checkcc/stop', protect, validateStopRequest, startOrStop);

module.exports = router;
