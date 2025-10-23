const mongoose = require('mongoose');

const DeviceStatSchema = new mongoose.Schema({
  device: { type: String, index: true },
  day: { type: String, index: true }, // YYYY-MM-DD in server timezone
  count: { type: Number, default: 0 },
}, { timestamps: true });

DeviceStatSchema.index({ device: 1, day: 1 }, { unique: true });

DeviceStatSchema.statics.bump = async function(device) {
  const dv = String(device || 'unknown').trim() || 'unknown';
  const day = new Date();
  const dayKey = day.toISOString().slice(0,10);
  await this.updateOne(
    { device: dv, day: dayKey },
    { $inc: { count: 1 } },
    { upsert: true }
  );
};

DeviceStatSchema.statics.getStats = async function({ from, to }) {
  const match = {};
  if (from || to) {
    match.day = {};
    if (from) match.day.$gte = from;
    if (to) match.day.$lte = to;
  }
  
  // Get today's date in YYYY-MM-DD format (server timezone)
  const today = new Date().toISOString().slice(0, 10);
  
  const pipeline = [
    { $match: match },
    { $group: { _id: { device: '$device', day: '$day' }, count: { $sum: '$count' } } },
    { 
      $group: { 
        _id: '$_id.device', 
        daily: { $push: { day: '$_id.day', count: '$count' } }, 
        total: { $sum: '$count' },
        // Calculate today's count
        today: {
          $sum: {
            $cond: [
              { $eq: ['$_id.day', today] },
              '$count',
              0
            ]
          }
        }
      } 
    },
    { $project: { _id: 0, device: '$_id', total: 1, today: 1, daily: 1 } },
    { $sort: { device: 1 } }
  ];
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('DeviceStat', DeviceStatSchema);
