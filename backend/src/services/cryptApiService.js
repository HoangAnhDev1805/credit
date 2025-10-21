const CryptAPI = require('@cryptapi/api');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../config/logger');
const SiteConfig = require('../models/SiteConfig');

class CryptAPIService {
  constructor() {
    this.merchantAddress = null;  // Will load from database
    this.baseUrl = 'https://checkcc.live';  // Default webhook domain
    this.defaultCoin = 'btc';
    this.publicKey = null;
    this.merchantAddresses = {};  // Will load from database
    this.enabledCoins = null;  // Will load from database

    // Fetch public key khi khởi tạo
    this.fetchPublicKey();
  }

  async isConfigured() {
    try {
      // Try to load from database first
      await this.loadDynamicConfig();
      // Check if we have merchant address from env or database
      const hasMerchantAddress = !!(this.merchantAddress || (this.merchantAddresses && Object.keys(this.merchantAddresses).length > 0));
      
      if (!hasMerchantAddress) {
        logger.warn('[CryptAPIService] No merchant address configured', {
          merchantAddress: this.merchantAddress,
          merchantAddresses: this.merchantAddresses
        });
      }
      
      return hasMerchantAddress;
    } catch (error) {
      logger.error('[CryptAPIService] Error checking configuration:', error);
      return false;
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
      
      if (merchant) {
        this.merchantAddress = merchant;
        logger.info('[CryptAPIService] Loaded merchant address from database');
      }
      if (merchantMap && typeof merchantMap === 'object') {
        this.merchantAddresses = merchantMap;
        logger.info('[CryptAPIService] Loaded merchant addresses from database:', Object.keys(merchantMap));
      }
      if (webhookDomain) {
        this.baseUrl = webhookDomain;
        logger.info('[CryptAPIService] Webhook domain:', webhookDomain);
      }
      this.enabledCoins = enabled || { btc: true, ltc: true, 'bep20/usdt': true, 'trc20/usdt': true };
    } catch (e) {
      // Keep env fallbacks
      logger.error('[CryptAPIService] Failed to load dynamic config:', e.message);
      if (!this.enabledCoins) {
        this.enabledCoins = { btc: true, ltc: true, 'bep20/usdt': true, 'trc20/usdt': true };
      }
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

  // Convert USD to crypto amount
  async convertAmount(coin, usdAmount) {
    try {
      const url = `https://api.cryptapi.io/${coin}/convert/?value=${usdAmount}&from=usd`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      logger.error('[CryptAPIService] Convert failed:', error.message);
      throw error;
    }
  }

  // Get QR code
  async getQRCode(coin, address, value = null) {
    try {
      let url = `https://api.cryptapi.io/${coin}/qrcode/?address=${address}&size=512`;
      if (value) {
        url += `&value=${value}`;
      }
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      logger.error('[CryptAPIService] QR code generation failed:', error.message);
      return null;
    }
  }

  // Get coin info (minimum transaction, etc)
  async getCoinInfo(coin) {
    try {
      const url = `https://api.cryptapi.io/${coin}/info/`;
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      logger.error('[CryptAPIService] Get info failed:', error.message);
      throw error;
    }
  }

  // Tạo địa chỉ thanh toán theo docs CryptAPI
  async createPaymentAddress(orderData) {
    try {
      const {
        orderId,
        coin = this.defaultCoin,
        amount,
        confirmations = 1
      } = orderData;

      logger.info('[CryptAPIService] Creating payment:', { orderId, coin, amount });

      // Load latest admin config
      await this.loadDynamicConfig();

      if (!this.isCoinEnabled(coin)) {
        throw new Error(`Cryptocurrency ${coin} is currently disabled`);
      }

      const merchantAddress = this.getMerchantAddressForCoin(coin);
      if (!merchantAddress) {
        logger.error('[CryptAPIService] No merchant address for coin:', coin);
        throw new Error(`Merchant address not configured for ${coin}`);
      }

      logger.info('[CryptAPIService] Using merchant address:', { coin, address: merchantAddress });

      // Build callback URL
      const callbackUrl = `${this.baseUrl}/api/payments/cryptapi/webhook?order_id=${encodeURIComponent(orderId)}`;

      // Call CryptAPI create endpoint directly
      const params = new URLSearchParams({
        callback: callbackUrl,
        address: merchantAddress,
        pending: '1',
        post: '1',
        json: '1',
        convert: '1',
        confirmations: confirmations.toString()
      });

      const apiUrl = `https://api.cryptapi.io/${coin}/create/?${params.toString()}`;
      logger.info('[CryptAPIService] Calling CryptAPI:', apiUrl.replace(merchantAddress, 'MERCHANT_ADDRESS'));

      const response = await axios.get(apiUrl);
      const data = response.data;

      if (!data || !data.address_in) {
        logger.error('[CryptAPIService] Invalid response:', data);
        throw new Error(data.error || 'Failed to create payment address');
      }

      // Get QR code
      const qrData = await this.getQRCode(coin, data.address_in, amount);

      logger.info('[CryptAPIService] Payment address created successfully:', {
        orderId,
        coin,
        address_in: data.address_in,
        minimum: data.minimum_transaction_coin
      });

      return {
        success: true,
        data: {
          orderId,
          coin,
          amount,
          address_in: data.address_in,
          address_out: data.address_out || merchantAddress,
          callback_url: data.callback_url || callbackUrl,
          minimum_transaction_coin: data.minimum_transaction_coin || 0.00001,
          priority: data.priority || 'default',
          qr_code: qrData?.qr_code || null,
          qrcode_url: qrData?.qr_code ? `data:image/png;base64,${qrData.qr_code}` : null,
          payment_uri: qrData?.payment_uri || null,
          status: data.status || 'success'
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
