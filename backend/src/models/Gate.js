const mongoose = require('mongoose');

const gateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Gate name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  typeCheck: {
    type: Number,
    required: [true, 'TypeCheck is required'],
    min: [1, 'TypeCheck must be at least 1']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0,
    min: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for better performance
gateSchema.index({ isActive: 1, sortOrder: 1 });
gateSchema.index({ typeCheck: 1 });
gateSchema.index({ createdAt: -1 });

// Static method to get all active gates
gateSchema.statics.getActiveGates = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

// Static method to get gate by typeCheck
gateSchema.statics.getByTypeCheck = function(typeCheck) {
  return this.findOne({ typeCheck, isActive: true });
};

module.exports = mongoose.model('Gate', gateSchema);
