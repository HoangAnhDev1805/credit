const axios = require('axios');
const logger = require('../config/logger');

class ExternalCardAPI {
  constructor() {
    this.baseURL = process.env.EXTERNAL_API_BASE_URL || 'http://160.25.168.79/api';
    this.token = process.env.EXTERNAL_API_TOKEN || 'abc';
    this.device = process.env.EXTERNAL_API_DEVICE || 'test';
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'CreditCardChecker/1.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.info('External API Request:', {
          url: config.url,
          method: config.method,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('External API Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.info('External API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data
        });
        return response;
      },
      (error) => {
        logger.error('External API Response Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Lấy thẻ để kiểm tra từ API bên ngoài
   * @param {number} amount - Số lượng thẻ cần lấy
   * @param {number} typeCheck - Loại kiểm tra (1=CheckLive, 2=CheckCharge)
   * @returns {Promise<Object>} Response từ API
   */
  async getCardsToCheck(amount = 10, typeCheck = 1) {
    try {
      const params = {
        token: this.token,
        LoaiDV: 1, // Service type for getting cards
        Device: this.device,
        Amount: amount,
        TypeCheck: typeCheck
      };

      const response = await this.client.get('/TrungLOL.aspx', { params });
      
      // Parse response
      const result = this.parseResponse(response.data);
      
      if (result.ErrorId === 0) {
        logger.info(`Successfully retrieved ${amount} cards for checking`);
        return {
          success: true,
          data: result.Content,
          message: 'Cards retrieved successfully'
        };
      } else {
        logger.warn(`Failed to retrieve cards: ${result.Message}`);
        return {
          success: false,
          error: result.Message,
          errorId: result.ErrorId
        };
      }
    } catch (error) {
      logger.error('Error getting cards to check:', error);
      return {
        success: false,
        error: 'Failed to connect to external API',
        details: error.message
      };
    }
  }

  /**
   * Cập nhật trạng thái thẻ lên API bên ngoài
   * @param {string} id - ID của thẻ từ API
   * @param {number} status - Trạng thái (0=chưa chạy, 1=đang chạy, 2=Live, 3=Die, 4=Unknown, 5=Charge Success)
   * @param {number} state - State (0=default)
   * @param {number} from - Nguồn (1=Google, 2=WM, 3=Zenno, 4=777)
   * @param {string} msg - Thông điệp
   * @returns {Promise<Object>} Response từ API
   */
  async updateCardStatus(id, status, state = 0, from = 4, msg = '') {
    try {
      const params = {
        token: this.token,
        LoaiDV: 2, // Service type for updating status
        Device: this.device,
        Id: id,
        Status: status,
        State: state,
        From: from,
        Msg: msg
      };

      const response = await this.client.get('/TrungLOL.aspx', { params });
      
      // Parse response
      const result = this.parseResponse(response.data);
      
      if (result.ErrorId === 1) { // Success is 1 for update operations
        logger.info(`Successfully updated card status: ID=${id}, Status=${status}`);
        return {
          success: true,
          message: 'Card status updated successfully'
        };
      } else {
        logger.warn(`Failed to update card status: ${result.Message || 'Unknown error'}`);
        return {
          success: false,
          error: result.Message || 'Failed to update card status',
          errorId: result.ErrorId
        };
      }
    } catch (error) {
      logger.error('Error updating card status:', error);
      return {
        success: false,
        error: 'Failed to connect to external API',
        details: error.message
      };
    }
  }

  /**
   * Parse response từ API (có thể là JSON hoặc text)
   * @param {string|Object} data - Response data
   * @returns {Object} Parsed response
   */
  parseResponse(data) {
    try {
      // Nếu đã là object thì return luôn
      if (typeof data === 'object') {
        return data;
      }

      // Nếu là string thì parse JSON
      if (typeof data === 'string') {
        return JSON.parse(data);
      }

      // Fallback
      return {
        ErrorId: -1,
        Message: 'Invalid response format'
      };
    } catch (error) {
      logger.error('Error parsing API response:', error);
      return {
        ErrorId: -1,
        Message: 'Failed to parse response',
        rawData: data
      };
    }
  }

  /**
   * Kiểm tra kết nối với API bên ngoài
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    try {
      // Thử lấy 1 thẻ để test kết nối
      const result = await this.getCardsToCheck(1, 1);
      
      return {
        success: true,
        status: 'connected',
        message: 'External API is accessible',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('External API health check failed:', error);
      return {
        success: false,
        status: 'disconnected',
        message: 'External API is not accessible',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Batch update multiple card statuses
   * @param {Array} updates - Array of {id, status, msg} objects
   * @returns {Promise<Object>} Batch update results
   */
  async batchUpdateCardStatus(updates) {
    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const result = await this.updateCardStatus(
          update.id,
          update.status,
          update.state || 0,
          update.from || 4,
          update.msg || ''
        );

        if (result.success) {
          results.push({
            id: update.id,
            success: true,
            status: update.status
          });
        } else {
          errors.push({
            id: update.id,
            error: result.error
          });
        }

        // Add delay between requests to avoid rate limiting
        await this.delay(100);
      } catch (error) {
        errors.push({
          id: update.id,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      totalUpdates: updates.length,
      successfulUpdates: results.length,
      failedUpdates: errors.length,
      results,
      errors
    };
  }

  /**
   * Get API statistics
   * @returns {Object} API usage statistics
   */
  getStatistics() {
    return {
      baseURL: this.baseURL,
      device: this.device,
      timeout: this.client.defaults.timeout,
      lastHealthCheck: this.lastHealthCheck || null
    };
  }

  /**
   * Delay helper function
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Map internal status to external API status
   * @param {string} internalStatus - Internal status (live, die, unknown, checking)
   * @returns {number} External API status code
   */
  mapStatusToExternal(internalStatus) {
    const statusMap = {
      'checking': 1,  // đang chạy
      'live': 2,      // Live
      'die': 3,       // Die
      'unknown': 4    // Unknown
    };

    return statusMap[internalStatus] || 4;
  }

  /**
   * Map external API status to internal status
   * @param {number} externalStatus - External API status code
   * @returns {string} Internal status
   */
  mapStatusToInternal(externalStatus) {
    const statusMap = {
      0: 'unknown',   // chưa chạy
      1: 'checking',  // đang chạy
      2: 'live',      // Live
      3: 'die',       // Die
      4: 'unknown',   // Unknown
      5: 'live'       // Charge Success (treat as live)
    };

    return statusMap[externalStatus] || 'unknown';
  }
}

module.exports = new ExternalCardAPI();
