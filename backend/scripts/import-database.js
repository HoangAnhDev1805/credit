const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/credit_card_checker';

async function importDatabase(backupFile) {
  try {
    console.log('🔄 Reading backup file...');
    const filepath = path.join(__dirname, '..', 'database_export', backupFile);
    
    if (!fs.existsSync(filepath)) {
      console.error('❌ Backup file not found:', filepath);
      console.log('\n📁 Available backups:');
      const exportDir = path.join(__dirname, '..', 'database_export');
      if (fs.existsSync(exportDir)) {
        const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
        files.forEach(f => console.log(`  - ${f}`));
      }
      process.exit(1);
    }
    
    const backupData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    
    console.log('✅ Backup file loaded');
    console.log(`📅 Export date: ${backupData.exportDate}`);
    console.log(`🗄️  Database: ${backupData.database}`);
    
    console.log('\n🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    console.log('\n📦 Importing collections:');
    for (const [collName, documents] of Object.entries(backupData.collections)) {
      if (documents.length === 0) {
        console.log(`  ⏭️  Skipping empty collection: ${collName}`);
        continue;
      }
      
      console.log(`  🔄 Importing ${collName}...`);
      
      // Drop existing collection
      try {
        await db.collection(collName).drop();
        console.log(`    🗑️  Dropped existing ${collName}`);
      } catch (err) {
        // Collection might not exist, ignore error
      }
      
      // Insert documents
      await db.collection(collName).insertMany(documents);
      console.log(`  ✅ Imported ${documents.length} documents to ${collName}`);
    }
    
    console.log(`\n✅ Database imported successfully!`);
    console.log(`📊 Total collections: ${Object.keys(backupData.collections).length}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2];

if (!backupFile) {
  console.error('❌ Please provide backup filename');
  console.log('\nUsage: node scripts/import-database.js <backup-filename>');
  console.log('Example: node scripts/import-database.js database_backup_2025-10-19.json');
  
  const exportDir = path.join(__dirname, '..', 'database_export');
  if (fs.existsSync(exportDir)) {
    console.log('\n📁 Available backups:');
    const files = fs.readdirSync(exportDir).filter(f => f.endsWith('.json'));
    files.forEach(f => console.log(`  - ${f}`));
  }
  process.exit(1);
}

importDatabase(backupFile);
