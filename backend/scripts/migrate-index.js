#!/usr/bin/env node

/**
 * Migrate Card unique index from { cardNumber, userId } to { fullCard, userId }
 * 
 * Steps:
 * 1. Backup DB (manual: mongodump before running this)
 * 2. Create new index { fullCard: 1, userId: 1 } unique (background)
 * 3. Wait for index creation
 * 4. Drop old index { cardNumber: 1, userId: 1 }
 * 
 * Usage:
 *   node backend/scripts/migrate-index.js
 * 
 * Rollback:
 *   If issues, restore from backup and drop new index
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://admin:password123@localhost:27017/credit_card_checker?authSource=admin';

async function migrateIndex() {
  console.log('🔧 Starting index migration...\n');

  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('cards');

    // Check existing indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    console.log('');

    // Check if new index already exists
    const hasNewIndex = indexes.some(idx => 
      idx.key.fullCard === 1 && idx.key.userId === 1 && idx.unique === true
    );

    if (hasNewIndex) {
      console.log('✅ New index { fullCard: 1, userId: 1 } already exists');
    } else {
      console.log('🔨 Creating new index { fullCard: 1, userId: 1 } (background: true)...');
      await collection.createIndex(
        { fullCard: 1, userId: 1 },
        { unique: true, background: true, name: 'fullCard_1_userId_1' }
      );
      console.log('✅ New index created successfully');
    }

    // Wait a bit for index to be ready
    console.log('\n⏳ Waiting 5 seconds for index to be ready...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify new index is active
    const updatedIndexes = await collection.indexes();
    const newIndexActive = updatedIndexes.some(idx => 
      idx.name === 'fullCard_1_userId_1' && idx.unique === true
    );

    if (!newIndexActive) {
      throw new Error('New index not found after creation. Aborting.');
    }

    console.log('✅ New index is active\n');

    // Check if old index exists
    const hasOldIndex = updatedIndexes.some(idx => 
      idx.key.cardNumber === 1 && idx.key.userId === 1 && idx.unique === true
    );

    if (!hasOldIndex) {
      console.log('ℹ️  Old index { cardNumber: 1, userId: 1 } does not exist (already removed or never existed)');
      console.log('\n✅ Migration complete!');
      process.exit(0);
    }

    // Prompt to drop old index (safety check)
    console.log('⚠️  Ready to drop old index { cardNumber: 1, userId: 1 }');
    console.log('⚠️  Make sure you have a backup and the system is stable!');
    console.log('\nTo drop the old index, run:');
    console.log('  node backend/scripts/migrate-index.js --drop-old\n');

    if (process.argv.includes('--drop-old')) {
      console.log('🗑️  Dropping old index cardNumber_1_userId_1...');
      
      // Find exact index name
      const oldIndexName = updatedIndexes.find(idx => 
        idx.key.cardNumber === 1 && idx.key.userId === 1 && idx.unique === true
      )?.name || 'cardNumber_1_userId_1';

      await collection.dropIndex(oldIndexName);
      console.log('✅ Old index dropped successfully');
    }

    console.log('\n✅ Migration complete!');
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n🔄 Rollback steps:');
    console.error('  1. Restore from backup: mongorestore --drop /path/to/backup');
    console.error('  2. Or manually drop new index: db.cards.dropIndex("fullCard_1_userId_1")');
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n📡 Disconnected from MongoDB');
  }
}

// Run migration
migrateIndex();
