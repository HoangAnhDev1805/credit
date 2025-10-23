const mongoose = require('mongoose');

const checkReceiverLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  loaiDV: {
    type: Number,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  headers: {
    type: mongoose.Schema.Types.Mixed
  },
  ip: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// TTL index: tự động xóa sau 7 ngày
checkReceiverLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('CheckReceiverLog', checkReceiverLogSchema);
