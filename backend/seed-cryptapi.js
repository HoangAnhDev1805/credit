#!/usr/bin/env node
/**
 * Seed CryptAPI Configuration
 * Run: node backend/seed-cryptapi.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/creditv2';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const SiteConfig = mongoose.model('SiteConfig', new mongoose.Schema({
      key: String,
      value: mongoose.Schema.Types.Mixed,
      category: String,
      isPublic: Boolean,
      updatedBy: mongoose.Schema.Types.ObjectId,
      updatedAt: Date
    }));

    // CryptAPI Merchant Addresses (example - replace with real addresses)
    const configs = [
      {
        key: 'cryptapi_merchant_address',
        value: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', // Example BTC address
        category: 'api',
        isPublic: false
      },
      {
        key: 'cryptapi_merchant_addresses',
        value: {
          btc: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          ltc: 'LYWKqJhtPeGyBAw7WC8R3F7ovxtzAiubdM',
          'trc20/usdt': 'TYWKqJhtPeGyBAw7WC8R3F7ovxtzAiubdM',
          'bep20/usdt': '0x1234567890123456789012345678901234567890'
        },
        category: 'api',
        isPublic: false
      },
      {
        key: 'cryptapi_webhook_domain',
        value: 'https://checkcc.live',
        category: 'api',
        isPublic: false
      },
      {
        key: 'cryptapi_enabled_coins',
        value: {
          btc: true,
          ltc: true,
          'bep20/usdt': true,
          'trc20/usdt': true,
          'erc20/usdt': false,
          eth: false,
          'sol/sol': false,
          'polygon/pol': false
        },
        category: 'api',
        isPublic: true
      }
    ];

    for (const config of configs) {
      await SiteConfig.findOneAndUpdate(
        { key: config.key },
        {
          ...config,
          updatedAt: new Date()
        },
        { upsert: true }
      );
      console.log(`✓ Seeded: ${config.key}`);
    }

    console.log('\n✓ CryptAPI configuration seeded successfully!');
    console.log('\n⚠️  IMPORTANT: Replace example addresses with your real merchant addresses!');
    console.log('   Go to Admin Settings > API Config to update.');

  } catch (error) {
    console.error('✗ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
