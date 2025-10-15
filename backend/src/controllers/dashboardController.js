const mongoose = require('mongoose');
const User = require('../models/User');
const Card = require('../models/Card');
const PaymentRequest = require('../models/PaymentRequest');
const logger = require('../config/logger');

// GET /api/dashboard/stats
exports.getStats = async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const now = new Date();

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diffToMonday = (day + 6) % 7; // 0=Sunday => 6
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalChecked,
      liveCount,
      activeUsers,
      todayChecked,
      weekChecked,
      monthChecked,
      avgResponseAgg,
      approvedAmountAgg,
    ] = await Promise.all([
      Card.countDocuments({}),
      Card.countDocuments({ status: 'live' }),
      User.countDocuments({ status: 'active' }),
      Card.countDocuments({ createdAt: { $gte: startOfDay } }),
      Card.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Card.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Card.aggregate([
        { $match: { checkedAt: { $ne: null } } },
        { $project: { diff: { $subtract: ['$checkedAt', '$createdAt'] } } },
        { $group: { _id: null, avg: { $avg: '$diff' } } },
      ]),
      PaymentRequest.aggregate([
        { $match: { status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const avgResponseTime = Math.round((avgResponseAgg[0]?.avg || 0));
    const totalRevenue = approvedAmountAgg[0]?.total || 0;
    const successRate = totalChecked > 0 ? Number(((liveCount / totalChecked) * 100).toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        totalChecked,
        successRate,
        avgResponseTime,
        activeUsers,
        todayChecked,
        thisWeekChecked: weekChecked,
        thisMonthChecked: monthChecked,
        totalRevenue,
      },
    });
  } catch (error) {
    logger.error('Dashboard getStats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get dashboard stats' });
  }
};

// GET /api/dashboard/activity
exports.getActivity = async (req, res) => {
  try {
    // Lấy 10 hoạt động gần đây từ thẻ và thanh toán
    const [recentCards, recentPayments] = await Promise.all([
      Card.find().sort({ createdAt: -1 }).limit(5).select('status createdAt').lean(),
      PaymentRequest.find().sort({ createdAt: -1 }).limit(5).select('status createdAt').lean(),
    ]);

    const activities = [
      ...recentCards.map((c) => ({
        action: 'Card checked',
        status: c.status,
        timestamp: c.createdAt,
      })),
      ...recentPayments.map((p) => ({
        action: 'Payment request',
        status: p.status,
        timestamp: p.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10);

    return res.json({ success: true, data: activities });
  } catch (error) {
    logger.error('Dashboard getActivity error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get recent activity' });
  }
};

// GET /api/dashboard/status
exports.getStatus = async (req, res) => {
  try {
    const mongooseConn = mongoose.connection.readyState === 1 ? 'online' : 'offline';
    const paymentMethodCount = await require('../models/PaymentMethod').countDocuments();

    return res.json({
      success: true,
      data: {
        api: 'online',
        database: mongooseConn === 'online' ? 'online' : 'offline',
        payment: paymentMethodCount > 0 ? 'online' : 'offline',
      },
    });
  } catch (error) {
    logger.error('Dashboard getStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get system status' });
  }
};

