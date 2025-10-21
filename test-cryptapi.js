const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/creditv2';

async function test() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const SiteConfig = require('./backend/src/models/SiteConfig');
    
    console.log('\n=== Testing CryptAPI Config ===');
    
    const merchant = await SiteConfig.getByKey('cryptapi_merchant_address');
    console.log('1. merchant_address:', merchant);
    
    const merchantMap = await SiteConfig.getByKey('cryptapi_merchant_addresses');
    console.log('2. merchant_addresses:', merchantMap);
    
    const webhookDomain = await SiteConfig.getByKey('cryptapi_webhook_domain');
    console.log('3. webhook_domain:', webhookDomain);
    
    const enabled = await SiteConfig.getByKey('cryptapi_enabled_coins');
    console.log('4. enabled_coins:', enabled);
    
    console.log('\n=== Testing CryptAPIService ===');
    const cryptApiService = require('./backend/src/services/cryptApiService');
    
    const isConfigured = await cryptApiService.isConfigured();
    console.log('5. isConfigured():', isConfigured);
    
    console.log('6. merchantAddress:', cryptApiService.merchantAddress);
    console.log('7. merchantAddresses:', cryptApiService.merchantAddresses);
    console.log('8. baseUrl:', cryptApiService.baseUrl);
    console.log('9. enabledCoins:', cryptApiService.enabledCoins);

  } catch (error) {
    console.error('✗ Test error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

test();
