const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixDuplicateIndex() {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in .env file');
    }
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('cards');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Drop old cardNumber_1_userId_1 index if exists
    try {
      await collection.dropIndex('cardNumber_1_userId_1');
      console.log('\n✅ Dropped old index: cardNumber_1_userId_1');
    } catch (err) {
      if (err.code === 27) {
        console.log('\n⚠️  Index cardNumber_1_userId_1 does not exist (already dropped)');
      } else {
        throw err;
      }
    }

    // Verify remaining indexes
    const newIndexes = await collection.indexes();
    console.log('\n📋 Remaining indexes:');
    newIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    console.log('\n✅ Index fix completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixDuplicateIndex();
