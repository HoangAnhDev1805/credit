const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { startOrStop, getStatus } = require('../controllers/checkerController');

// Website triggers start/stop via POST /api/checker/start
router.post('/checker/start', protect, startOrStop);

// Website polls realtime status via GET /api/checker/status/:sessionId
router.get('/checker/status/:sessionId', protect, getStatus);

module.exports = router;

