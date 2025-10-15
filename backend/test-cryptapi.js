#!/usr/bin/env node

/**
 * CryptAPI Integration Test Script
 * 
 * Script để test tích hợp CryptAPI
 * Chạy: node test-cryptapi.js
 */

require('dotenv').config();
const axios = require('axios');
const CryptAPI = require('@cryptapi/api');

class CryptAPITester {
  constructor() {
    this.merchantAddress = process.env.CRYPTAPI_MERCHANT_ADDRESS;
    this.defaultCoin = process.env.CRYPTAPI_DEFAULT_COIN || 'btc';
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:5001';
    this.baseUrl = 'https://api.cryptapi.io';
    
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const icons = {
      info: '📝',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      config: '🔧'
    };
    
    console.log(`${icons[type]} ${message}`);
  }

  async runTest(testName, testFunction) {
    try {
      this.log(`Test: ${testName}`, 'info');
      await testFunction();
      this.testResults.passed++;
      this.testResults.tests.push({ name: testName, status: 'PASSED' });
      this.log(`✓ ${testName} - PASSED`, 'success');
    } catch (error) {
      this.testResults.failed++;
      this.testResults.tests.push({ name: testName, status: 'FAILED', error: error.message });
      this.log(`✗ ${testName} - FAILED: ${error.message}`, 'error');
    }
  }

  async testConfiguration() {
    this.log('Kiểm tra cấu hình CryptAPI...', 'config');
    
    const config = {
      'Merchant Address': this.merchantAddress ? '✅ Configured' : '❌ Missing',
      'Default Coin': this.defaultCoin,
      'Backend URL': this.backendUrl
    };
    
    Object.entries(config).forEach(([key, value]) => {
      this.log(`   ${key}: ${value}`);
    });

    if (!this.merchantAddress) {
      throw new Error('Thiếu cấu hình CRYPTAPI_MERCHANT_ADDRESS trong file .env');
    }
  }

  async testPublicKeyFetch() {
    this.log('Test lấy public key từ CryptAPI...', 'info');

    const response = await axios.get(`${this.baseUrl}/pubkey/`);

    if (!response.data || !response.data.pubkey || !response.data.pubkey.includes('BEGIN PUBLIC KEY')) {
      throw new Error('Public key không hợp lệ');
    }

    this.log('   Public key fetched successfully');
    this.log(`   Key length: ${response.data.pubkey.length} characters`);
  }

  async testSupportedCoins() {
    this.log('Test lấy danh sách coins hỗ trợ...', 'info');
    
    const coins = await CryptAPI.getSupportedCoins();
    
    if (!coins || typeof coins !== 'object') {
      throw new Error('Không thể lấy danh sách coins');
    }
    
    const coinCount = Object.keys(coins).length;
    this.log(`   Hỗ trợ ${coinCount} loại coins`);
    
    // Kiểm tra một số coins phổ biến
    const popularCoins = ['btc', 'eth', 'trc20/usdt'];
    popularCoins.forEach(coin => {
      if (coins[coin]) {
        this.log(`   ✓ ${coin.toUpperCase()} supported`);
      } else {
        this.log(`   ⚠️ ${coin.toUpperCase()} not found`, 'warning');
      }
    });
  }

  async testCreateAddress() {
    this.log('Test tạo địa chỉ thanh toán...', 'info');

    const orderId = `TEST_${Date.now()}`;
    const callbackUrl = `${this.backendUrl}/api/payments/cryptapi/webhook?order_id=${orderId}`;

    const cryptapiParams = {
      json: 1,
      pending: 1,
      confirmations: 1
    };

    const params = { order_id: orderId };

    try {
      const ca = new CryptAPI(this.defaultCoin, this.merchantAddress, callbackUrl, params, cryptapiParams);
      const addressResponse = await ca.getAddress();

      this.log(`   Raw response: ${JSON.stringify(addressResponse)}`);

      // CryptAPI SDK có thể trả về string address hoặc object
      let address_in;
      if (typeof addressResponse === 'string') {
        address_in = addressResponse;
      } else if (addressResponse && addressResponse.address_in) {
        address_in = addressResponse.address_in;
      }

      if (!address_in) {
        throw new Error(`Không thể tạo địa chỉ thanh toán. Response: ${JSON.stringify(addressResponse)}`);
      }

      this.log(`   Order ID: ${orderId}`);
      this.log(`   Address In: ${address_in}`);
      if (typeof addressResponse === 'object') {
        this.log(`   Address Out: ${addressResponse.address_out}`);
        this.log(`   Minimum Transaction: ${addressResponse.minimum_transaction_coin} ${this.defaultCoin.toUpperCase()}`);
      }

      return { orderId, addressResponse: { address_in } };
    } catch (error) {
      this.log(`   Error details: ${error.message}`, 'error');
      this.log(`   Error stack: ${error.stack}`, 'error');
      throw error;
    }
  }

  async testQRCode() {
    this.log('Test tạo QR code...', 'info');
    
    const orderId = `TEST_QR_${Date.now()}`;
    const callbackUrl = `${this.backendUrl}/api/payments/cryptapi/webhook?order_id=${orderId}`;
    
    const ca = new CryptAPI(this.defaultCoin, this.merchantAddress, callbackUrl, { order_id: orderId }, { json: 1 });
    
    // Phải gọi getAddress trước
    await ca.getAddress();
    
    const qrData = await ca.getQrcode(0.001, 256);
    
    if (!qrData || !qrData.qr_code) {
      throw new Error('Không thể tạo QR code');
    }
    
    this.log(`   QR Code generated (${qrData.qr_code.length} chars)`);
    this.log(`   Payment URI: ${qrData.payment_uri}`);
  }

  async testEstimate() {
    this.log('Test ước tính phí...', 'info');
    
    const estimate = await CryptAPI.getEstimate(this.defaultCoin, 1, 'default');
    
    if (!estimate || typeof estimate !== 'object') {
      throw new Error('Không thể ước tính phí');
    }
    
    this.log(`   Estimated fee: ${JSON.stringify(estimate)}`);
  }

  async testConvert() {
    this.log('Test quy đổi tiền...', 'info');
    
    const conversion = await CryptAPI.getConvert(this.defaultCoin, 100, 'USD');
    
    if (!conversion || typeof conversion !== 'object') {
      throw new Error('Không thể quy đổi tiền');
    }
    
    this.log(`   100 USD = ${JSON.stringify(conversion)} ${this.defaultCoin.toUpperCase()}`);
  }

  async testBackendEndpoints() {
    this.log('Test backend endpoints...', 'info');
    
    try {
      // Test health check
      const healthResponse = await axios.get(`${this.backendUrl}/health`);
      this.log(`   Health check: ${healthResponse.status === 200 ? 'OK' : 'FAILED'}`);
    } catch (error) {
      this.log(`   Health check: FAILED (${error.message})`, 'warning');
    }
    
    try {
      // Test CryptAPI test endpoint (cần auth)
      const testResponse = await axios.get(`${this.backendUrl}/api/payments/cryptapi/test`);
      this.log(`   CryptAPI test endpoint: ${testResponse.status === 200 ? 'OK' : 'FAILED'}`);
    } catch (error) {
      if (error.response?.status === 401) {
        this.log(`   CryptAPI test endpoint: Protected (401) - OK`, 'info');
      } else {
        this.log(`   CryptAPI test endpoint: FAILED (${error.message})`, 'warning');
      }
    }
  }

  async testLogs() {
    this.log('Test kiểm tra logs...', 'info');
    
    const orderId = `TEST_LOGS_${Date.now()}`;
    const callbackUrl = `${this.backendUrl}/api/payments/cryptapi/webhook?order_id=${orderId}`;
    
    const ca = new CryptAPI(this.defaultCoin, this.merchantAddress, callbackUrl, { order_id: orderId }, { json: 1 });
    
    // Tạo address trước
    await ca.getAddress();
    
    // Kiểm tra logs
    const logs = await ca.checkLogs();
    
    if (!logs || typeof logs !== 'object') {
      throw new Error('Không thể kiểm tra logs');
    }
    
    this.log(`   Logs retrieved: ${JSON.stringify(logs).substring(0, 100)}...`);
  }

  async runAllTests() {
    this.log('🚀 Bắt đầu test tích hợp CryptAPI...', 'config');
    console.log('');

    const tests = [
      ['Kiểm tra cấu hình', () => this.testConfiguration()],
      ['Lấy public key', () => this.testPublicKeyFetch()],
      ['Lấy danh sách coins', () => this.testSupportedCoins()],
      ['Tạo địa chỉ thanh toán', () => this.testCreateAddress()],
      ['Tạo QR code', () => this.testQRCode()],
      ['Ước tính phí', () => this.testEstimate()],
      ['Quy đổi tiền', () => this.testConvert()],
      ['Test backend endpoints', () => this.testBackendEndpoints()],
      ['Kiểm tra logs', () => this.testLogs()]
    ];

    for (const [testName, testFunction] of tests) {
      await this.runTest(testName, testFunction);
      console.log('');
    }

    this.printSummary();
  }

  printSummary() {
    console.log('📊 Kết quả tổng quan:');
    console.log(`   Passed: ${this.testResults.passed}/${this.testResults.passed + this.testResults.failed}`);
    console.log(`   Success Rate: ${Math.round((this.testResults.passed / (this.testResults.passed + this.testResults.failed)) * 100)}%`);
    
    if (this.testResults.failed > 0) {
      console.log('');
      console.log('❌ Các test thất bại:');
      this.testResults.tests
        .filter(test => test.status === 'FAILED')
        .forEach(test => {
          console.log(`   - ${test.name}: ${test.error}`);
        });
      
      console.log('');
      console.log('📝 Hướng dẫn khắc phục:');
      console.log('   1. Kiểm tra cấu hình trong file .env');
      console.log('   2. Đảm bảo có kết nối internet');
      console.log('   3. Kiểm tra backend server đang chạy');
      console.log('   4. Xem logs chi tiết ở trên');
    } else {
      console.log('');
      console.log('🎉 Tất cả tests đều PASSED!');
      console.log('');
      console.log('📝 Hướng dẫn tiếp theo:');
      console.log('   1. Cấu hình webhook URL trong production');
      console.log('   2. Test qua frontend: http://localhost:3002/test/cryptapi');
      console.log('   3. Thực hiện giao dịch test với số tiền nhỏ');
      console.log('   4. Kiểm tra webhook callbacks');
    }
  }
}

// Chạy tests
if (require.main === module) {
  const tester = new CryptAPITester();
  tester.runAllTests().catch(error => {
    console.error('❌ Test runner error:', error);
    process.exit(1);
  });
}

module.exports = CryptAPITester;
