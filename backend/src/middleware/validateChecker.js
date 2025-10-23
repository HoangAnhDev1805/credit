const logger = require('../config/logger');

/**
 * Validate request body for /checkcc/start endpoint
 */
exports.validateStartRequest = (req, res, next) => {
  try {
    const { cards, checkType, gate } = req.body || {};
    
    // Log request body for debugging
    logger.info('[validateStartRequest] Body:', {
      hasCards: !!cards,
      cardsType: Array.isArray(cards) ? 'array' : typeof cards,
      cardsLength: Array.isArray(cards) ? cards.length : 'n/a',
      checkType,
      gate,
      userId: req.user?.id
    });
    
    // Validate cards
    if (!cards) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: cards'
      });
    }
    
    if (!Array.isArray(cards) && typeof cards !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Field "cards" must be an array of card objects or a string'
      });
    }
    
    if (Array.isArray(cards)) {
      if (cards.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cards array cannot be empty'
        });
      }
      
      // Validate first card format
      const firstCard = cards[0];
      if (typeof firstCard === 'object') {
        if (!firstCard.cardNumber || !firstCard.expiryMonth || !firstCard.expiryYear || !firstCard.cvv) {
          return res.status(400).json({
            success: false,
            message: 'Invalid card format. Each card must have: cardNumber, expiryMonth, expiryYear, cvv'
          });
        }
      }
    }
    
    next();
  } catch (error) {
    logger.error('[validateStartRequest] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Validation error: ' + error.message
    });
  }
};

/**
 * Validate request body for /checkcc/stop endpoint
 */
exports.validateStopRequest = (req, res, next) => {
  try {
    const { sessionId, stop } = req.body || {};
    
    if (stop && !sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: sessionId'
      });
    }
    
    next();
  } catch (error) {
    logger.error('[validateStopRequest] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Validation error: ' + error.message
    });
  }
};
