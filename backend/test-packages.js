const mongoose = require('mongoose');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/creditv2');
  console.log('✓ Connected to MongoDB');
  console.log('ReadyState:', mongoose.connection.readyState);
  
  const db = mongoose.connection.db;
  console.log('DB object:', !!db);
  
  const packages = await db.collection('creditpackages')
    .find({ isActive: true })
    .sort({ displayOrder: 1, amount: 1 })
    .toArray();
  
  console.log('✓ Found', packages.length, 'packages');
  if (packages.length > 0) {
    console.log('Sample:', packages[0]);
  }
  
  process.exit(0);
}

test().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
