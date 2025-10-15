const express = require('express');
const router = express.Router();
const { getCardsForCheck, updateCardStatus } = require('../../controllers/postApiController');

// Hai endpoint theo yeu cau cua ZennoPoster:
// 1) Lay the ngau nhien de kiem tra
router.post('/checkcc', getCardsForCheck);

// 2) Cap nhat trang thai the sau khi check
router.post('/update-status', updateCardStatus);

module.exports = router;

