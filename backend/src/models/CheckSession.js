const mongoose = require('mongoose');

const checkSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['running', 'stopped', 'completed'],
    default: 'running',
    index: true
  },
  stopRequested: {
    type: Boolean,
    default: false
  },
  total: { type: Number, default: 0, min: 0 },
  processed: { type: Number, default: 0, min: 0 },
  pending: { type: Number, default: 0, min: 0 },
  live: { type: Number, default: 0, min: 0 },
  die: { type: Number, default: 0, min: 0 },
  error: { type: Number, default: 0, min: 0 },
  unknown: { type: Number, default: 0, min: 0 },
  pricePerCard: { type: Number, default: 0, min: 0 },
  billedAmount: { type: Number, default: 0, min: 0 },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
}, {
  timestamps: true
});

checkSessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('CheckSession', checkSessionSchema);

