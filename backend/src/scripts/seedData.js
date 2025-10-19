require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const PaymentMethod = require('../models/PaymentMethod');
const PaymentRequest = require('../models/PaymentRequest');
const SiteConfig = require('../models/SiteConfig');

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const summary = {};

  // Ensure site config defaults
  await SiteConfig.initializeDefaults?.();

  // Admin and demo users
  const admin = await User.findOneAndUpdate(
    { username: 'admin' },
    { $setOnInsert: { email: 'admin@example.com', password: 'admin123', role: 'admin', status: 'active', balance: 1000 } },
    { upsert: true, new: true }
  );
  const demo = await User.findOneAndUpdate(
    { username: 'demo' },
    { $setOnInsert: { email: 'demo@example.com', password: 'demo123', role: 'user', status: 'active', balance: 200 } },
    { upsert: true, new: true }
  );
  summary.users = await User.countDocuments();

  // Payment methods
  const existingPM = await PaymentMethod.countDocuments();
  if (existingPM === 0) {
    await PaymentMethod.insertMany([
      { name: 'Vietcombank', type: 'bank_transfer', accountNumber: '1234567890', accountName: 'NGUYEN VAN A', bankName: 'Vietcombank', bankCode: 'VCB', instructions: 'Chuyen khoan [USERNAME] nap tien', minAmount: 10, maxAmount: 10000, isActive: true, sortOrder: 1 },
      { name: 'Techcombank', type: 'bank_transfer', accountNumber: '0987654321', accountName: 'TRAN THI B', bankName: 'Techcombank', bankCode: 'TCB', instructions: 'Chuyen khoan [USERNAME] deposit', minAmount: 10, maxAmount: 5000, isActive: true, sortOrder: 2 },
      { name: 'MoMo Wallet', type: 'e_wallet', accountNumber: '0123456789', accountName: 'LE VAN C', instructions: 'MoMo [USERNAME]', minAmount: 5, maxAmount: 2000, isActive: true, sortOrder: 3 }
    ]);
  }
  summary.paymentMethods = await PaymentMethod.countDocuments();

  // Demo payment requests for UI
  const anyPR = await PaymentRequest.countDocuments();
  if (anyPR === 0 && demo) {
    const methods = await PaymentMethod.find().sort({ sortOrder: 1 }).limit(2);
    for (const [i, pm] of methods.entries()) {
      await PaymentRequest.create({
        userId: demo._id,
        amount: 100 + i * 50,
        paymentMethodId: pm._id,
        note: 'Demo topup',
        status: 'pending'
      });
    }
  }
  summary.paymentRequests = await PaymentRequest.countDocuments();

  console.log('Seed summary:', summary);
  await mongoose.disconnect();
}

if (require.main === module) {
  seed().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = seed;
