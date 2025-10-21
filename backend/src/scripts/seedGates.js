require('dotenv').config();
const mongoose = require('mongoose');
const Gate = require('../models/Gate');
const logger = require('../config/logger');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    logger.info('MongoDB Connected for seeding gates');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};

const seedGates = async () => {
  try {
    await connectDB();

    // Clear existing gates
    await Gate.deleteMany({});
    logger.info('Cleared existing gates');

    // Default gates
    const defaultGates = [
      {
        name: 'Check Live',
        typeCheck: 1,
        description: 'Basic live check for credit cards',
        isActive: true,
        sortOrder: 1
      },
      {
        name: 'Check Charge',
        typeCheck: 2,
        description: 'Check card charge capability',
        isActive: true,
        sortOrder: 2
      }
    ];

    const gates = await Gate.insertMany(defaultGates);
    logger.info(`Seeded ${gates.length} gates successfully`);
    
    console.log('\n✅ Gates seeded successfully:');
    gates.forEach(gate => {
      console.log(`  - ${gate.name} (TypeCheck: ${gate.typeCheck})`);
    });

    process.exit(0);
  } catch (error) {
    logger.error('Seed gates error:', error);
    console.error('❌ Error seeding gates:', error.message);
    process.exit(1);
  }
};

seedGates();
