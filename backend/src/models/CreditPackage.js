const mongoose = require('mongoose');

const creditPackageSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  credits: {
    type: Number,
    required: true,
    min: 0
  },
  bonus: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  displayOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for querying active packages
creditPackageSchema.index({ isActive: 1, displayOrder: 1 });

module.exports = mongoose.model('CreditPackage', creditPackageSchema, 'creditpackages');
