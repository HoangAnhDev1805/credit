#!/usr/bin/env node
/**
 * Seed Sample Cards
 * Run: node backend/seed-cards.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/creditv2';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Get post_api_user_id
    const SiteConfig = mongoose.model('SiteConfig', new mongoose.Schema({
      key: String,
      value: mongoose.Schema.Types.Mixed
    }));
    
    const config = await SiteConfig.findOne({ key: 'post_api_user_id' });
    if (!config || !config.value) {
      console.log('✗ post_api_user_id not configured. Run seed-user.js first.');
      process.exit(1);
    }

    const userId = new mongoose.Types.ObjectId(config.value);
    console.log('✓ Using user ID:', userId);

    const Card = mongoose.model('Card', new mongoose.Schema({
      userId: mongoose.Schema.Types.ObjectId,
      cardNumber: String,
      expiryMonth: String,
      expiryYear: String,
      cvv: String,
      fullCard: String,
      status: String,
      typeCheck: Number,
      price: Number,
      createdAt: Date
    }));

    // Sample cards (fake data for testing)
    const sampleCards = [
      { cardNumber: '4532015112830366', expiryMonth: '12', expiryYear: '25', cvv: '123', typeCheck: 1 },
      { cardNumber: '5425233430109903', expiryMonth: '11', expiryYear: '26', cvv: '456', typeCheck: 1 },
      { cardNumber: '374245455400126', expiryMonth: '10', expiryYear: '25', cvv: '789', typeCheck: 1 },
      { cardNumber: '6011000991001201', expiryMonth: '09', expiryYear: '27', cvv: '321', typeCheck: 2 },
      { cardNumber: '3566002020360505', expiryMonth: '08', expiryYear: '26', cvv: '654', typeCheck: 2 },
      { cardNumber: '4916338506082832', expiryMonth: '07', expiryYear: '25', cvv: '987', typeCheck: 1 },
      { cardNumber: '5309137099448084', expiryMonth: '06', expiryYear: '28', cvv: '147', typeCheck: 2 },
      { cardNumber: '4556229836495866', expiryMonth: '05', expiryYear: '26', cvv: '258', typeCheck: 1 },
      { cardNumber: '5527617290816611', expiryMonth: '04', expiryYear: '27', cvv: '369', typeCheck: 2 },
      { cardNumber: '4024007197026039', expiryMonth: '03', expiryYear: '25', cvv: '741', typeCheck: 1 }
    ];

    const cards = sampleCards.map(card => ({
      userId,
      cardNumber: card.cardNumber,
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cvv: card.cvv,
      fullCard: `${card.cardNumber}|${card.expiryMonth}|${card.expiryYear}|${card.cvv}`,
      status: 'unknown',
      typeCheck: card.typeCheck,
      price: 0,
      createdAt: new Date()
    }));

    await Card.insertMany(cards);
    console.log(`✓ Seeded ${cards.length} sample cards`);
    console.log('  Status: unknown (ready for checking)');
    console.log('  TypeCheck: Mixed (1=Live, 2=Charge)');

  } catch (error) {
    console.error('✗ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
