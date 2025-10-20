#!/usr/bin/env node
/*
  Seed checker gates into SiteConfig
  - TypeCheck 1: Check Live
  - TypeCheck 2: Check Charge

  Usage:
    node backend/src/scripts/seedGates.js
*/
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const SiteConfig = require('../models/SiteConfig');

(async () => {
  try {
    await connectDB();
    await SiteConfig.initializeDefaults();

    const gates = [
      { id: 1, key: 'check_live', name: 'Check Live', typeCheck: 1 },
      { id: 2, key: 'check_charge', name: 'Check Charge', typeCheck: 2 }
    ];

    await SiteConfig.updateOne(
      { key: 'checker_gates' },
      { $set: { value: gates, type: 'json', category: 'features', label: 'Checker Gates', isPublic: true } },
      { upsert: true }
    );

    const saved = await SiteConfig.findOne({ key: 'checker_gates' }).lean();
    console.log('Seeded checker_gates:', saved?.value);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seed gates error:', err);
    try { await mongoose.connection.close(); } catch {}
    process.exit(1);
  }
})();

