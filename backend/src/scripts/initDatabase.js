require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');

// Import models
const User = require('../models/User');
const SiteConfig = require('../models/SiteConfig');
const PricingConfig = require('../models/PricingConfig');
const PaymentMethod = require('../models/PaymentMethod');

async function initializeDatabase() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    logger.info('Connected to MongoDB');
    console.log('🔗 Connected to MongoDB');

    // Initialize site configuration
    console.log('📝 Initializing site configuration...');
    await SiteConfig.initializeDefaults();
    console.log('✅ Site configuration initialized');

    // Create default admin user
    console.log('👤 Creating default admin user...');
    const adminExists = await User.findOne({ username: 'admin' });
    
    if (!adminExists) {
      const adminUser = new User({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin123',
        role: 'admin',
        status: 'active',
        balance: 1000 // Give admin some initial balance
      });

      await adminUser.save();
      console.log('✅ Admin user created (username: admin, password: admin123)');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create test user
    console.log('👤 Creating test user...');
    const testUserExists = await User.findOne({ username: 'testuser' });
    
    if (!testUserExists) {
      const testUser = new User({
        username: 'testuser',
        email: 'test@example.com',
        password: 'test123',
        role: 'user',
        status: 'active',
        balance: 100 // Give test user some initial balance
      });

      await testUser.save();
      console.log('✅ Test user created (username: testuser, password: test123)');
    } else {
      console.log('ℹ️  Test user already exists');
    }

    // Initialize pricing configuration
    console.log('💰 Initializing pricing configuration...');
    const pricingExists = await PricingConfig.findOne();
    
    if (!pricingExists) {
      const pricingConfigs = [
        {
          name: 'Basic Tier',
          description: 'For small volume checking',
          minCards: 1,
          maxCards: 100,
          pricePerCard: 0.10,
          isActive: true,
          priority: 1
        },
        {
          name: 'Standard Tier',
          description: 'For medium volume checking',
          minCards: 101,
          maxCards: 500,
          pricePerCard: 0.08,
          discountPercentage: 20,
          isActive: true,
          priority: 2
        },
        {
          name: 'Premium Tier',
          description: 'For high volume checking',
          minCards: 501,
          maxCards: null, // unlimited
          pricePerCard: 0.05,
          discountPercentage: 50,
          isActive: true,
          priority: 3
        }
      ];

      await PricingConfig.insertMany(pricingConfigs);
      console.log('✅ Pricing configuration initialized');
    } else {
      console.log('ℹ️  Pricing configuration already exists');
    }

    // Initialize payment methods
    console.log('💳 Initializing payment methods...');
    const paymentMethodExists = await PaymentMethod.findOne();
    
    if (!paymentMethodExists) {
      const paymentMethods = [
        {
          name: 'Vietcombank',
          type: 'bank_transfer',
          accountNumber: '1234567890',
          accountName: 'NGUYEN VAN A',
          bankName: 'Vietcombank',
          bankCode: 'VCB',
          instructions: 'Chuyển khoản với nội dung: [USERNAME] nap tien',
          minAmount: 10,
          maxAmount: 10000,
          isActive: true,
          sortOrder: 1
        },
        {
          name: 'Techcombank',
          type: 'bank_transfer',
          accountNumber: '0987654321',
          accountName: 'TRAN THI B',
          bankName: 'Techcombank',
          bankCode: 'TCB',
          instructions: 'Chuyển khoản với nội dung: [USERNAME] deposit',
          minAmount: 10,
          maxAmount: 5000,
          isActive: true,
          sortOrder: 2
        },
        {
          name: 'MoMo Wallet',
          type: 'e_wallet',
          accountNumber: '0123456789',
          accountName: 'LE VAN C',
          instructions: 'Chuyển tiền MoMo với tin nhắn: [USERNAME]',
          minAmount: 5,
          maxAmount: 2000,
          isActive: true,
          sortOrder: 3
        }
      ];

      await PaymentMethod.insertMany(paymentMethods);
      console.log('✅ Payment methods initialized');
    } else {
      console.log('ℹ️  Payment methods already exist');
    }

    // Create indexes
    console.log('📊 Creating database indexes...');
    
    // User indexes
    await User.collection.createIndex({ username: 1 }, { unique: true });
    await User.collection.createIndex({ email: 1 }, { unique: true });
    await User.collection.createIndex({ role: 1 });
    await User.collection.createIndex({ status: 1 });
    await User.collection.createIndex({ createdAt: -1 });

    // Site config indexes
    await SiteConfig.collection.createIndex({ key: 1 }, { unique: true });
    await SiteConfig.collection.createIndex({ category: 1 });

    // Pricing config indexes
    await PricingConfig.collection.createIndex({ isActive: 1, priority: -1 });
    await PricingConfig.collection.createIndex({ minCards: 1, maxCards: 1 });

    // Payment method indexes
    await PaymentMethod.collection.createIndex({ isActive: 1, sortOrder: 1 });
    await PaymentMethod.collection.createIndex({ type: 1 });

    console.log('✅ Database indexes created');

    // Display summary
    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📊 Summary:');
    
    const userCount = await User.countDocuments();
    const configCount = await SiteConfig.countDocuments();
    const pricingCount = await PricingConfig.countDocuments();
    const paymentMethodCount = await PaymentMethod.countDocuments();

    console.log(`👥 Users: ${userCount}`);
    console.log(`⚙️  Site Configs: ${configCount}`);
    console.log(`💰 Pricing Tiers: ${pricingCount}`);
    console.log(`💳 Payment Methods: ${paymentMethodCount}`);

    console.log('\n🔐 Default Credentials:');
    console.log('Admin: username=admin, password=admin123');
    console.log('Test User: username=testuser, password=test123');

    console.log('\n🌐 Next Steps:');
    console.log('1. Start the server: npm run dev');
        console.log('2. Test API: https://checkcc.live/api/health');
        console.log('3. View API docs: https://checkcc.live/api/docs');

  } catch (error) {
    logger.error('Database initialization failed:', error);
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
}

// Run initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase;
