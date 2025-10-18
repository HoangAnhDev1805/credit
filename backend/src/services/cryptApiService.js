const CryptAPI = require('@cryptapi/api');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../config/logger');
const SiteConfig = require('../models/SiteConfig');

class CryptAPIService {
  constructor() {
    this.merchantAddress = process.env.CRYPTAPI_MERCHANT_ADDRESS;
        this.baseUrl = process.env.BACKEND_URL || 'https://checkcc.live';
    this.defaultCoin = process.env.CRYPTAPI_DEFAULT_COIN || 'btc';
    this.publicKey = null;

    // Fetch public key khi khởi tạo
    this.fetchPublicKey();

    if (!this.merchantAddress) {
      logger.warn('CryptAPI merchant address not configured');
    }
  }

  // Lấy public key để verify signature
  async fetchPublicKey() {
    try {
      const response = await axios.get('https://api.cryptapi.io/pubkey/');
      if (response.data && response.data.pubkey) {
        this.publicKey = response.data.pubkey;
        logger.info('CryptAPI public key fetched successfully');
      } else {
        throw new Error('Invalid public key response format');
      }
    } catch (error) {
      logger.error('Failed to fetch CryptAPI public key:', error.message);
    }

  }

  async loadDynamicConfig() {
    try {
      await SiteConfig.initializeDefaults();
      const merchant = await SiteConfig.getByKey('cryptapi_merchant_address');
      const merchantMap = await SiteConfig.getByKey('cryptapi_merchant_addresses');
      const webhookDomain = await SiteConfig.getByKey('cryptapi_webhook_domain');
      const enabled = await SiteConfig.getByKey('cryptapi_enabled_coins');
      if (merchant) this.merchantAddress = merchant;
      if (merchantMap && typeof merchantMap === 'object') this.merchantAddresses = merchantMap;
      if (webhookDomain) this.baseUrl = webhookDomain;
      this.enabledCoins = enabled || { btc: true, ltc: true, 'bep20/usdt': true, 'trc20/usdt': false, 'erc20/usdt': false };
    } catch (e) {
      // Keep env fallbacks
      logger.warn('Failed to load dynamic CryptAPI config, using environment values');
      if (!this.enabledCoins) this.enabledCoins = { btc: true, ltc: true, 'bep20/usdt': true, 'trc20/usdt': false, 'erc20/usdt': false };
    }
  }

  isCoinEnabled(coin) {
    if (!this.enabledCoins) return true;
    return !!this.enabledCoins[coin];
  }

  getMerchantAddressForCoin(coin) {
    if (this.merchantAddresses && this.merchantAddresses[coin]) {
      return this.merchantAddresses[coin];
    }
    // fallback to single address if provided
    return this.merchantAddress;
  }

  // Tạo địa chỉ thanh toán
  async createPaymentAddress(orderData) {
    try {
      const {
        orderId,
        coin = this.defaultCoin,
        value,
        confirmations = 1
      } = orderData;

      // Load latest admin config
      await this.loadDynamicConfig();

      if (!this.isCoinEnabled(coin)) {
        throw new Error('This cryptocurrency is currently disabled by admin');
      }

      const merchantAddress = this.getMerchantAddressForCoin(coin);
      if (!merchantAddress) {
        throw new Error('Merchant address not configured for selected coin');
      }

      // Tạo callback URL với order ID
      const callbackUrl = `${this.baseUrl}/api/payments/cryptapi/webhook?order_id=${encodeURIComponent(orderId)}`;

      // Cấu hình CryptAPI
      const cryptapiParams = {
        json: 1,           // Webhook dạng POST + JSON
        pending: 1,        // Nhận thông báo pending
        confirmations,     // Số confirmations cần thiết
        convert: 1         // Trả kèm giá trị quy đổi FIAT
      };

      const params = { order_id: orderId };

      // Tạo instance CryptAPI
      const ca = new CryptAPI(coin, merchantAddress, callbackUrl, params, cryptapiParams);

      // Lấy địa chỉ thanh toán
      const addressResponse = await ca.getAddress();

      // CryptAPI SDK có thể trả về string address hoặc object
      let address_in;
      if (typeof addressResponse === 'string') {
        address_in = addressResponse;
      } else if (addressResponse && addressResponse.address_in) {
        address_in = addressResponse.address_in;
      }

      if (!address_in) {
        throw new Error('Failed to create payment address');
      }

      // Tạo QR code (cần gọi getAddress trước)
      let qrData = null;
      try {
        qrData = await ca.getQrcode(value, 512);
      } catch (qrError) {
        logger.warn('Failed to generate QR code:', qrError.message);
      }

      logger.info('CryptAPI payment address created:', {
        orderId,
        coin,
        address_in: addressResponse.address_in,
        minimum_transaction: addressResponse.minimum_transaction_coin
      });

      return {
        success: true,
        data: {
          orderId,
          coin,
          address_in: address_in,
          address_out: typeof addressResponse === 'object' ? addressResponse.address_out : merchantAddress,
          minimum_transaction_coin: typeof addressResponse === 'object' ? addressResponse.minimum_transaction_coin : 0.00001,
          callback_url: typeof addressResponse === 'object' ? addressResponse.callback_url : callbackUrl,
          priority: typeof addressResponse === 'object' ? addressResponse.priority : 'default',
          qr_code: qrData?.qr_code || null,
          payment_uri: qrData?.payment_uri || null,
          status: typeof addressResponse === 'object' ? addressResponse.status : 'success'
        }
      };
    } catch (error) {
      logger.error('CryptAPI create address error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(req) {
    try {
      if (!this.publicKey) {
        logger.warn('CryptAPI public key not available for signature verification');
        return false;
      }

      const sigB64 = req.headers['x-ca-signature'];
      if (!sigB64) {
        logger.warn('Missing x-ca-signature header');
        return false;
      }

      const verifier = crypto.createVerify('RSA-SHA256');
      const data = req.rawBody || '';
      verifier.update(data);

      const isValid = verifier.verify(this.publicKey, Buffer.from(sigB64, 'base64'));

      if (!isValid) {
        logger.warn('Invalid CryptAPI webhook signature');
      }

      return isValid;
    } catch (error) {
      logger.error('Signature verification error:', error.message);
      return false;
    }
  }

  // Xử lý webhook payload
  async processWebhook(webhookData) {
    try {
      const {
        uuid,
        pending,
        coin,
        address_in,
        address_out,
        txid_in,
        txid_out,
        confirmations,
        value_coin,
        value_forwarded_coin,
        order_id,
        price
      } = webhookData;

      logger.info('Processing CryptAPI webhook:', {
        uuid,
        pending: pending === 1 ? 'pending' : 'confirmed',
        coin,
        order_id,
        value_coin,
        confirmations
      });

      return {
        success: true,
        data: {
          uuid,
          orderId: order_id,
          isPending: pending === 1,
          coin,
          address_in,
          address_out,
          txid_in,
          txid_out,
          confirmations: parseInt(confirmations) || 0,
          value_coin: parseFloat(value_coin) || 0,
          value_forwarded_coin: parseFloat(value_forwarded_coin) || 0,
          price_usd: price ? parseFloat(price) : null,
          status: pending === 1 ? 'pending' : 'confirmed'
        }
      };
    } catch (error) {
      logger.error('Webhook processing error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Lấy danh sách coins hỗ trợ
  async getSupportedCoins() {
    try {
      const coins = await CryptAPI.getSupportedCoins();
      return {
        success: true,
        data: coins
      };
    } catch (error) {
      logger.error('Get supported coins error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Ước tính phí
  async getEstimate(coin, addresses = 1, priority = 'default') {
    try {
      const estimate = await CryptAPI.getEstimate(coin, addresses, priority);
      return {
        success: true,
        data: estimate
      };
    } catch (error) {
      logger.error('Get estimate error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Quy đổi tiền
  async getConvert(coin, value, from = 'USD') {
    try {
      const conversion = await CryptAPI.getConvert(coin, value, from);
      return {
        success: true,
        data: conversion
      };
    } catch (error) {
      logger.error('Get convert error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Kiểm tra logs
  async checkLogs(orderId, coin) {
    try {
      if (!this.merchantAddress) {
        throw new Error('Merchant address not configured');
      }

      const callbackUrl = `${this.baseUrl}/api/payments/cryptapi/webhook?order_id=${encodeURIComponent(orderId)}`;
      const params = { order_id: orderId };
      const cryptapiParams = { json: 1 };

      const ca = new CryptAPI(coin, this.merchantAddress, callbackUrl, params, cryptapiParams);
      const logs = await ca.checkLogs();

      return {
        success: true,
        data: logs
      };
    } catch (error) {
      logger.error('Check logs error:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Kiểm tra cấu hình
  isConfigured() {
    return !!(this.merchantAddress && this.publicKey);
  }

  // Test connection
  async testConnection() {
    try {
      // Test bằng cách lấy danh sách coins
      const coinsResult = await this.getSupportedCoins();

      if (coinsResult.success) {
        return {
          success: true,
          message: 'CryptAPI connection successful',
          data: {
            merchantAddress: this.merchantAddress,
            defaultCoin: this.defaultCoin,
            publicKeyLoaded: !!this.publicKey,
            supportedCoinsCount: Object.keys(coinsResult.data).length
          }
        };
      } else {
        return {
          success: false,
          error: 'Failed to fetch supported coins'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new CryptAPIService();
