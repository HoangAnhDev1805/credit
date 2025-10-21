#!/usr/bin/env node
/**
 * Seed Test User
 * Run: node backend/seed-user.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './backend/.env' });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/creditv2';

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({
      email: String,
      password: String,
      username: String,
      balance: Number,
      role: String,
      isActive: Boolean,
      emailVerified: Boolean,
      createdAt: Date
    }));

    // Check if admin exists
    const existingAdmin = await User.findOne({ email: 'admin@checkcc.live' });
    if (existingAdmin) {
      console.log('✓ Admin user already exists:', existingAdmin._id);
      
      // Set as post_api_user_id
      const SiteConfig = mongoose.model('SiteConfig', new mongoose.Schema({
        key: String,
        value: mongoose.Schema.Types.Mixed,
        category: String,
        isPublic: Boolean,
        updatedAt: Date
      }));
      
      await SiteConfig.updateOne(
        { key: 'post_api_user_id' },
        {
          key: 'post_api_user_id',
          value: existingAdmin._id.toString(),
          category: 'api',
          isPublic: false,
          updatedAt: new Date()
        },
        { upsert: true }
      );
      console.log('✓ Set post_api_user_id to:', existingAdmin._id);
      
      await mongoose.disconnect();
      process.exit(0);
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const adminUser = await User.create({
      email: 'admin@checkcc.live',
      password: hashedPassword,
      username: 'admin',
      balance: 10000,
      role: 'admin',
      isActive: true,
      emailVerified: true,
      createdAt: new Date()
    });

    console.log('✓ Admin user created:');
    console.log('  Email: admin@checkcc.live');
    console.log('  Password: admin123');
    console.log('  ID:', adminUser._id);
    console.log('  Balance: 10000 credits');

    // Set as post_api_user_id for stock source
    const SiteConfig = mongoose.model('SiteConfig', new mongoose.Schema({
      key: String,
      value: mongoose.Schema.Types.Mixed,
      category: String,
      isPublic: Boolean,
      updatedAt: Date
    }));
    
    await SiteConfig.updateOne(
      { key: 'post_api_user_id' },
      {
        key: 'post_api_user_id',
        value: adminUser._id.toString(),
        category: 'api',
        isPublic: false,
        updatedAt: new Date()
      },
      { upsert: true }
    );
    console.log('✓ Set post_api_user_id to:', adminUser._id);

  } catch (error) {
    console.error('✗ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
