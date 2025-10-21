// Script to check cards in database
require('dotenv').config();
const mongoose = require('mongoose');
const Card = require('./src/models/Card');

async function checkCards() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/creditchecker');
    console.log('Connected to MongoDB');
    
    // Count cards by status
    const statuses = await Card.aggregate([
      { $group: { 
        _id: { status: '$status', zennoposter: '$zennoposter' }, 
        count: { $sum: 1 } 
      }},
      { $sort: { '_id.status': 1 } }
    ]);
    
    console.log('\nCards by status and zennoposter:');
    statuses.forEach(s => {
      console.log(`  status: ${s._id.status}, zennoposter: ${s._id.zennoposter} => ${s.count} cards`);
    });
    
    // Show sample unknown cards
    const unknownCards = await Card.find({ status: 'unknown' })
      .limit(5)
      .select('cardNumber status errorMessage zennoposter updatedAt')
      .lean();
    
    console.log('\nSample unknown cards:');
    unknownCards.forEach(c => {
      console.log(`  ${c.cardNumber}: zennoposter=${c.zennoposter}, msg="${c.errorMessage}", updated=${c.updatedAt}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkCards();
