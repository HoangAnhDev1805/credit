// Script to clear old unknown cards from database
require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('./src/models/Card');

async function clearOldCards() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creditchecker');
    console.log('Connected to MongoDB');
    
    // Delete ALL unknown cards (both zennoposter=0 and zennoposter=1)
    const result = await Card.deleteMany({ 
      status: 'unknown'
    });
    
    console.log(`Deleted ${result.deletedCount} unknown cards`);
    
    // Also show cards that will be cached
    const cachedCount = await Card.countDocuments({
      status: { $in: ['live', 'die', 'error'] },
      zennoposter: 1
    });
    console.log(`Remaining cached cards (live/die/error with zennoposter=1): ${cachedCount}`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

clearOldCards();
