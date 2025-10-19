const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/credit_card_checker';

async function exportDatabase() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const exportDir = path.join(__dirname, '..', 'database_export');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    
    const exportData = {
      exportDate: new Date().toISOString(),
      database: MONGODB_URI.split('/').pop().split('?')[0],
      mongodbUri: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials
      collections: {}
    };
    
    console.log('\n📦 Exporting collections:');
    for (const collection of collections) {
      const collName = collection.name;
      console.log(`  🔄 Exporting ${collName}...`);
      const data = await db.collection(collName).find({}).toArray();
      exportData.collections[collName] = data;
      console.log(`  ✅ Exported ${data.length} documents from ${collName}`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = `database_backup_${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    
    console.log(`\n✅ Database exported successfully!`);
    console.log(`📁 Location: database_export/${filename}`);
    console.log(`📊 Total collections: ${collections.length}`);
    console.log(`💾 File size: ${(fs.statSync(filepath).size / 1024 / 1024).toFixed(2)} MB`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  }
}

exportDatabase();
