const User = require('../models/User');
const Card = require('../models/Card');
const PaymentRequest = require('../models/PaymentRequest');
const PaymentMethod = require('../models/PaymentMethod');
const Transaction = require('../models/Transaction');
const SiteConfig = require('../models/SiteConfig');
const PricingConfig = require('../models/PricingConfig');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

// @desc    Get admin dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
const getDashboard = async (req, res, next) => {
  try {
    const timeRange = req.query.range || '30d'; // 7d, 30d, 90d, all

    // Build date filter
    let dateFilter = {};
    if (timeRange !== 'all') {
      const days = parseInt(timeRange.replace('d', ''));
      dateFilter = {
        createdAt: {
          $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        }
      };
    }

    // Get user statistics
    const userStats = await User.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalBalance: { $sum: '$balance' }
        }
      }
    ]);

    // Get card statistics (map status -> tiles expected by dashboard)
    const cardStatsRaw = await Card.aggregate([
      { $match: dateFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const formattedCardStats = { total: 0, live: 0, dead: 0, pending: 0, error: 0 };
    cardStatsRaw.forEach(stat => {
      formattedCardStats.total += stat.count;
      const s = String(stat._id);
      if (s === 'live') formattedCardStats.live += stat.count;
      else if (s === 'die') formattedCardStats.dead += stat.count; // map 'die' -> 'dead'
      else if (s === 'unknown' || s === 'checking') formattedCardStats.pending += stat.count;
    });
    // Error = có errorMessage khác rỗng trong khoảng thời gian chọn
    try {
      const errFilter = { ...dateFilter, errorMessage: { $exists: true, $ne: '' } };
      formattedCardStats.error = await Card.countDocuments(errFilter);
    } catch (_) {}

    // Get payment statistics
    const paymentStats = await PaymentRequest.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          totalFinalAmount: { $sum: '$finalAmount' }
        }
      }
    ]);

    // Get transaction statistics
    const transactionStats = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get recent activities
    const recentUsers = await User.find(dateFilter)
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username email role status createdAt')
      .lean();

    const recentPayments = await PaymentRequest.find(dateFilter)
      .populate('userId', 'username')
      .populate('paymentMethodId', 'name')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Format statistics
    const formattedUserStats = {
      total: 0,
      active: 0,
      inactive: 0,
      banned: 0,
      totalBalance: 0
    };

    userStats.forEach(stat => {
      const status = stat._id;
      // Map 'blocked' to 'banned' for frontend compatibility
      const mappedStatus = status === 'blocked' ? 'banned' : status;
      formattedUserStats[mappedStatus] = stat.count;
      formattedUserStats.total += stat.count;
      formattedUserStats.totalBalance += stat.totalBalance;
    });

    const formattedPaymentStats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      totalAmount: 0,
      totalApproved: 0
    };

    paymentStats.forEach(stat => {
      formattedPaymentStats[stat._id] = stat.count;
      formattedPaymentStats.total += stat.count;
      formattedPaymentStats.totalAmount += stat.totalAmount;
      if (stat._id === 'approved') {
        formattedPaymentStats.totalApproved += stat.totalFinalAmount;
      }
    });

    const formattedTransactionStats = {};
    transactionStats.forEach(stat => {
      formattedTransactionStats[stat._id] = {
        count: stat.count,
        amount: stat.totalAmount
      };
    });

    res.json({
      success: true,
      data: {
        users: formattedUserStats,
        cards: formattedCardStats,
        payments: formattedPaymentStats,
        transactions: formattedTransactionStats,
        recentActivities: {
          users: recentUsers,
          payments: recentPayments
        },
        timeRange
      }
    });
  } catch (error) {
    logger.error('Get dashboard error:', error);
    next(error);
  }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private (Admin only)
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search;
    const status = req.query.status;
    const role = req.query.role;

    // Build query
    const query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    if (role) {
      query.role = role;
    }

    // Get users with pagination
    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Get total count
    const total = await User.countDocuments(query);

    // Aggregate real-time stats from Card by originUserId for these users
    const userIds = users.map(u => u._id);
    const cardAgg = await Card.aggregate([
      { $match: { originUserId: { $in: userIds } } },
      { $group: { _id: { uid: '$originUserId', status: '$status' }, cnt: { $sum: 1 } } }
    ]);
    const statMap = new Map();
    for (const row of cardAgg) {
      const uid = String(row._id.uid);
      const statusKey = row._id.status;
      if (!statMap.has(uid)) statMap.set(uid, { submitted: 0, live: 0, die: 0 });
      const cur = statMap.get(uid);
      cur.submitted += row.cnt;
      if (statusKey === 'live') cur.live += row.cnt;
      if (statusKey === 'die') cur.die += row.cnt;
    }

    // Format response (prefer realtime agg over stored counters)
    const formattedUsers = users.map(user => {
      const s = statMap.get(String(user._id)) || { submitted: 0, live: 0, die: 0 };
      const successRate = s.submitted > 0 ? ((s.live / s.submitted) * 100).toFixed(2) : '0';
      return {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        checker: Number(user.checker || 0),
        balance: user.balance,
        totalCardsSubmitted: s.submitted,
        totalLiveCards: s.live,
        totalDieCards: s.die,
        successRate,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      };
    });

    res.json({
      success: true,
      data: {
        users: formattedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get users error:', error);
    next(error);
  }
};

// @desc    Update user
// @route   PUT /api/admin/users/:id
// @access  Private (Admin only)
const updateUser = async (req, res, next) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { status, role, balance, addAmount, subtractAmount, newPassword, checker } = req.body;
    const passwordAlias = typeof req.body.password === 'string' ? req.body.password : undefined;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy người dùng'
      });
    }

    // Cho phép admin thay đổi vai trò/trạng thái của chính mình theo yêu cầu

    // Update fields
    if (status) user.status = status;
    if (role) user.role = role;
    if (checker !== undefined && checker !== null && (checker === 0 || checker === 1 || checker === '0' || checker === '1')) {
      user.checker = Number(checker);
    }
    
    // Handle balance updates
    const oldBalance = user.balance;
    let balanceChanged = false;
    
    // Ưu tiên add/subtract (chỉ một trong hai), nếu không có thì dùng balance tuyệt đối
    if (addAmount !== undefined && addAmount !== null && addAmount !== '') {
      const amount = Number(addAmount);
      if (amount > 0) {
        user.balance = oldBalance + amount;
        balanceChanged = true;
      }
    } else if (subtractAmount !== undefined && subtractAmount !== null && subtractAmount !== '') {
      const amount = Number(subtractAmount);
      if (amount > 0) {
        user.balance = Math.max(0, oldBalance - amount);
        balanceChanged = true;
      }
    } else if (balance !== undefined && balance !== null && balance !== '') {
      user.balance = Math.max(0, Number(balance));
      balanceChanged = true;
    }

    // Create transaction if balance changed
    if (balanceChanged) {
      const diff = user.balance - oldBalance;
      if (diff !== 0) {
        await Transaction.create({
          userId: user._id,
          type: diff > 0 ? 'admin_credit' : 'admin_debit',
          amount: diff,
          description: `Admin ${diff > 0 ? 'cộng' : 'trừ'} ${Math.abs(diff)} credits`,
          balanceBefore: oldBalance,
          balanceAfter: user.balance,
          status: 'completed',
          metadata: { adminId: req.user.id, adminUsername: req.user.username }
        });
        
        // Emit realtime balance update
        try {
          const io = req.app.get('io');
          if (io) {
            io.to(String(user._id)).emit('user:balance-changed', { balance: user.balance });
            logger.info(`[Admin] Emitted balance update for user ${user._id}: ${user.balance}`);
          }
        } catch (err) {
          logger.error('[Admin] Failed to emit balance update:', err);
        }
      }
    }

    // Cập nhật mật khẩu nếu có (chấp nhận newPassword hoặc password)
    const finalNewPass = (typeof newPassword === 'string' && newPassword) || passwordAlias;
    if (finalNewPass && typeof finalNewPass === 'string' && finalNewPass.length >= 6) {
      user.password = finalNewPass; // sẽ được hash bởi pre('save')
    }

    await user.save();

    logger.info(`User updated by admin ${req.user.username}`, {
      adminId: req.user.id,
      userId: user._id,
      username: user.username,
      changes: req.body
    });

    res.json({
      success: true,
      message: 'Cập nhật người dùng thành công',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          status: user.status,
          balance: user.balance,
          checker: Number(user.checker || 0)
        }
      }
    });
  } catch (error) {
    logger.error('Update user error:', error);
    next(error);
  }
};

// @desc    Create user (admin)
// @route   POST /api/admin/users
// @access  Private (Admin only)
const createUser = async (req, res, next) => {
  try {
    const { username, email, password, role = 'user', status = 'active', balance = 0 } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Thiếu username, email hoặc password' });
    }

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Username hoặc Email đã tồn tại' });
    }

    const user = new User({ username, email, password, role, status, balance });
    await user.save();

    res.status(201).json({
      success: true,
      message: 'Tạo người dùng thành công',
      data: { user: { id: user._id, username: user.username, email: user.email, role: user.role, status: user.status, balance: user.balance } }
    });
  } catch (error) {
    logger.error('Create user error:', error);
    next(error);
  }
};


// @desc    Get payment requests for admin
// @route   GET /api/admin/payments
// @access  Private (Admin only)
const getPaymentRequests = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const search = req.query.search;

    // Build query
    const query = {};
    if (status) {
      query.status = status;
    }

    // Get requests with pagination
    let requestsQuery = PaymentRequest.find(query)
      .populate('userId', 'username email')
      .populate('paymentMethodId', 'name type bankName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Add search if provided
    if (search) {
      requestsQuery = requestsQuery.populate({
        path: 'userId',
        match: {
          $or: [
            { username: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }
      });
    }

    const requests = await requestsQuery.lean();

    // Filter out null users if search was applied
    const filteredRequests = search ?
      requests.filter(req => req.userId) : requests;

    // Get total count
    const total = await PaymentRequest.countDocuments(query);

    res.json({
      success: true,
      data: {
        requests: filteredRequests,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get payment requests error:', error);
    next(error);
  }
};

// Card Management
const getCards = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      q = '',
      mode = 'contains', // startsWith|contains|endsWith
      status = '',
      statuses = '', // comma-separated
      brand = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {};

    // Back-compat: prefer q over search
    const term = (q || search || '').trim();
    if (term) {
      let pattern = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (mode === 'startsWith') pattern = `^${pattern}`;
      else if (mode === 'endsWith') pattern = `${pattern}$`;
      else pattern = `${pattern}`; // contains
      const regex = { $regex: pattern, $options: 'i' };
      filter.$or = [
        { fullCard: regex },
        { cardNumber: regex }
      ];
    }

    if (status) {
      filter.status = status;
    }
    if (statuses) {
      const arr = String(statuses)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      if (arr.length > 0) filter.status = { $in: arr };
    }

    if (brand) {
      filter.brand = brand;
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [cards, total, filteredStats, dupAgg, globalAgg] = await Promise.all([
      Card.find(filter)
        .populate('userId', 'username email')
        .populate('originUserId', 'username email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      Card.countDocuments(filter),
      // Totals by status in FILTERED set (not global)
      Card.aggregate([
        { $match: filter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      // Duplicate count for FILTERED set by cardNumber
      Card.aggregate([
        { $match: { ...filter, cardNumber: { $exists: true, $ne: '' } } },
        { $group: { _id: '$cardNumber', c: { $sum: 1 } } },
        { $match: { c: { $gt: 1 } } },
        { $count: 'dups' }
      ]),
      // Global totals across entire collection (không áp filter), case-insensitive + alias
      Card.aggregate([
        { $match: { status: { $exists: true, $ne: null } } },
        { $group: { _id: { $toLower: '$status' }, count: { $sum: 1 } } }
      ])
    ]);

    const statMap = new Map();
    for (const it of filteredStats) statMap.set(String(it._id || ''), it.count || 0);
    const stats = {
      foundTotal: total,
      duplicateCount: dupAgg?.[0]?.dups || 0,
      liveCount: statMap.get('live') || 0,
      dieCount: statMap.get('die') || 0,
      unknownCount: (statMap.get('unknown') || 0) + (statMap.get('checking') || 0),
      pendingCount: (statMap.get('pending') || 0) + (statMap.get('checking') || 0)
    };

    // Build globalStats (toàn bộ DB) folding aliases
    let gTotal = 0, gLive = 0, gDie = 0, gUnknown = 0, gChecking = 0;
    for (const it of globalAgg || []) {
      const key = String(it._id || '').toLowerCase();
      const c = Number(it.count || 0);
      gTotal += c;
      if (key === 'live') gLive += c;
      else if (key === 'die' || key === 'dead') gDie += c;
      else if (key === 'unknown') gUnknown += c;
      else if (key === 'checking' || key === 'pending') gChecking += c;
    }
    const globalStats = { total: gTotal, live: gLive, die: gDie, unknown: gUnknown, checking: gChecking };

    res.json({
      success: true,
      data: {
        cards,
        stats,
        globalStats,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get cards',
      error: error.message
    });
  }
};

// Payment Method Management
const getPaymentMethods = async (req, res, next) => {
  try {
    const paymentMethods = await PaymentMethod.find()
      .sort({ sortOrder: 1, createdAt: 1 })
      .populate('createdBy', 'username')
      .populate('updatedBy', 'username');

    res.json({
      success: true,
      data: { paymentMethods }
    });
  } catch (error) {
    logger.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods',
      error: error.message
    });
  }
};

const createPaymentMethod = async (req, res, next) => {
  try {
    const paymentMethodData = {
      ...req.body,
      createdBy: req.user.id
    };

    const paymentMethod = await PaymentMethod.create(paymentMethodData);
    await paymentMethod.populate('createdBy', 'username');

    res.status(201).json({
      success: true,
      message: 'Payment method created successfully',
      data: { paymentMethod }
    });
  } catch (error) {
    logger.error('Create payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment method',
      error: error.message
    });
  }
};

const updatePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = {
      ...req.body,
      updatedBy: req.user.id
    };

    const paymentMethod = await PaymentMethod.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    ).populate('createdBy updatedBy', 'username');

    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment method updated successfully',
      data: { paymentMethod }
    });
  } catch (error) {
    logger.error('Update payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update payment method',
      error: error.message
    });
  }
};

const deletePaymentMethod = async (req, res, next) => {
  try {
    const { id } = req.params;

    const paymentMethod = await PaymentMethod.findByIdAndDelete(id);
    if (!paymentMethod) {
      return res.status(404).json({
        success: false,
        message: 'Payment method not found'
      });
    }

    res.json({
      success: true,
      message: 'Payment method deleted successfully'
    });
  } catch (error) {
    logger.error('Delete payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment method',
      error: error.message
    });
  }
};

// Rate Limit Management
exports.getRateLimitConfig = async (req, res) => {
  try {
    const { loadRateLimitsFromDB, rateLimitCache } = require('../middleware/security');
    
    // Force reload from DB
    await loadRateLimitsFromDB();
    
    // Get configs from database
    const configs = await SiteConfig.find({ category: 'ratelimit' }).lean();
    const configMap = {};
    configs.forEach(c => { configMap[c.key] = c; });
    
    res.json({
      success: true,
      data: {
        configs: configMap,
        currentCache: rateLimitCache
      }
    });
  } catch (error) {
    logger.error('Get rate limit config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rate limit configuration',
      error: error.message
    });
  }
};

exports.updateRateLimitConfig = async (req, res) => {
  try {
    const { loadRateLimitsFromDB } = require('../middleware/security');
    const updates = req.body;
    
    // Update each config
    const updatePromises = Object.keys(updates).map(key => 
      SiteConfig.findOneAndUpdate(
        { key },
        { $set: { value: updates[key] } },
        { new: true, upsert: false }
      )
    );
    
    await Promise.all(updatePromises);
    
    // Force reload cache
    await loadRateLimitsFromDB();
    
    // Emit to frontend via Socket.IO
    const io = req.app && req.app.get ? req.app.get('io') : null;
    if (io) {
      io.emit('ratelimit:config:updated', { timestamp: new Date() });
    }
    
    res.json({
      success: true,
      message: 'Rate limit configuration updated successfully'
    });
  } catch (error) {
    logger.error('Update rate limit config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rate limit configuration',
      error: error.message
    });
  }
};

// Realtime request monitoring (simplified - actual implementation would track requests)
let requestStats = {
  total: 0,
  byEndpoint: {},
  byIP: {},
  recent: []
};

// Middleware to track requests
exports.trackRequest = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    const endpoint = req.originalUrl || req.url;
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const method = req.method;
    const statusCode = res.statusCode;
    
    // Update stats
    requestStats.total++;
    requestStats.byEndpoint[endpoint] = (requestStats.byEndpoint[endpoint] || 0) + 1;
    requestStats.byIP[ip] = (requestStats.byIP[ip] || 0) + 1;
    
    // Add to recent (keep last 100)
    requestStats.recent.unshift({
      timestamp: new Date(),
      method,
      endpoint,
      ip,
      statusCode,
      duration
    });
    if (requestStats.recent.length > 100) {
      requestStats.recent = requestStats.recent.slice(0, 100);
    }
    
    // Emit to admin via Socket.IO
    const io = req.app && req.app.get ? req.app.get('io') : null;
    if (io) {
      io.emit('admin:request:stats', {
        total: requestStats.total,
        recentCount: requestStats.recent.length,
        topEndpoints: Object.entries(requestStats.byEndpoint)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([endpoint, count]) => ({ endpoint, count })),
        topIPs: Object.entries(requestStats.byIP)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ip, count]) => ({ ip, count }))
      });
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

exports.getRequestStats = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        total: requestStats.total,
        recentCount: requestStats.recent.length,
        topEndpoints: Object.entries(requestStats.byEndpoint)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([endpoint, count]) => ({ endpoint, count })),
        topIPs: Object.entries(requestStats.byIP)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([ip, count]) => ({ ip, count })),
        recent: requestStats.recent.slice(0, 50) // Last 50 requests
      }
    });
  } catch (error) {
    logger.error('Get request stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get request statistics',
      error: error.message
    });
  }
};

module.exports = {
  getDashboard,
  getUsers,
  createUser,
  // Checker metrics: queue sizes and recent activity
  getCheckerMetrics: async (req, res) => {
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      // Aggregate counts by status and typeCheck
      const byStatusType = await Card.aggregate([
        { $group: { _id: { status: '$status', typeCheck: '$typeCheck' }, count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id.status', typeCheck: '$_id.typeCheck', count: 1 } }
      ]);
      // Current queue sizes
      const [pending, checking, unknown, live, die] = await Promise.all([
        Card.countDocuments({ status: 'pending' }),
        Card.countDocuments({ status: 'checking' }),
        Card.countDocuments({ status: 'unknown' }),
        Card.countDocuments({ status: 'live' }),
        Card.countDocuments({ status: 'die' })
      ]);
      // Recent fetch rate (cards moved to checking recently)
      const recentFetch = await Card.countDocuments({ status: 'checking', lastCheckAt: { $gte: oneMinuteAgo } });
      // Recent update rate (cards updated to result recently)
      const recentUpdate = await Card.countDocuments({ zennoposter: 1, updatedAt: { $gte: oneMinuteAgo } });
      res.json({ success: true, data: { byStatusType, queue: { pending, checking, unknown, live, die }, tps: { fetchPerMin: recentFetch, updatePerMin: recentUpdate }, ts: now.toISOString() } });
    } catch (error) {
      logger.error('Get checker metrics error:', error);
      res.status(500).json({ success: false, message: 'Failed to get checker metrics', error: error.message });
    }
  },
  // Device stats: per-device daily and total counts
  getDeviceStats: async (req, res) => {
    try {
      const DeviceStat = require('../models/DeviceStat');
      const { from, to } = req.query;
      const data = await DeviceStat.getStats({ from, to });
      res.json({ success: true, data: { devices: data } });
    } catch (error) {
      logger.error('Get device stats error:', error);
      res.status(500).json({ success: false, message: 'Failed to get device stats', error: error.message });
    }
  },
  getUserById: async (req, res, next) => {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select('-password -refreshToken');
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's card statistics
      const cardStats = await Card.getStatistics(id);

      res.json({
        success: true,
        data: {
          user,
          cardStats
        }
      });
    } catch (error) {
      logger.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user',
        error: error.message
      });
    }
  },
  updateUser,
  deleteUser: async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Don't allow deleting admin users
      if (user.role === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete admin users'
        });
      }

      // Delete user and related data
      await Promise.all([
        User.findByIdAndDelete(id),
        Card.deleteMany({ userId: id }),
        PaymentRequest.deleteMany({ userId: id }),
        Transaction.deleteMany({ userId: id })
      ]);

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete user',
        error: error.message
      });
    }
  },
  getUserCards: async (req, res, next) => {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 1000,
        status = '',
        search = ''
      } = req.query;

      // Build filter (thẻ do user này gửi lên): lọc theo originUserId
      const filter = { originUserId: id };

      if (status) {
        filter.status = status;
      }

      if (search) {
        filter.fullCard = { $regex: search, $options: 'i' };
      }

      // Execute query with pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [cards, total] = await Promise.all([
        Card.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Card.countDocuments(filter)
      ]);

      res.json({
        success: true,
        data: {
          cards,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Get user cards error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user cards',
        error: error.message
      });
    }
  },
  getCards,
  // Bulk delete cards by IDs
  deleteCardsBulk: async (req, res, next) => {
    try {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : [];
      if (!ids.length) {
        return res.status(400).json({ success: false, message: 'Thiếu danh sách ID cần xóa' });
      }
      const result = await Card.deleteMany({ _id: { $in: ids } });
      res.json({ success: true, message: 'Đã xóa thẻ', data: { deletedCount: result.deletedCount || 0 } });
    } catch (error) {
      logger.error('Bulk delete cards error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete cards', error: error.message });
    }
  },
  deleteCardsByStatus: async (req, res, next) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: 'Thiếu trạng thái cần xóa' });
      }
      const validStatuses = ['live', 'die', 'unknown', 'checking'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
      }
      
      // Special case: 'checking' includes both 'checking' and 'pending' status
      let deleteQuery = { status };
      if (status === 'checking') {
        deleteQuery = { status: { $in: ['checking', 'pending'] } };
      }
      
      const result = await Card.deleteMany(deleteQuery);
      logger.info(`Admin deleted all cards with status: ${status}, count: ${result.deletedCount}`, { userId: req.user.id });
      res.json({ success: true, message: `Đã xóa tất cả thẻ ${status}`, data: { deletedCount: result.deletedCount || 0 } });
    } catch (error) {
      logger.error('Delete cards by status error:', error);
      res.status(500).json({ success: false, message: 'Failed to delete cards by status', error: error.message });
    }
  },
  getPaymentRequests,
  updatePaymentRequest: async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, adminNote } = req.body;

      const paymentRequest = await PaymentRequest.findByIdAndUpdate(
        id,
        {
          status,
          adminNote,
          processedBy: req.user.id,
          processedAt: new Date()
        },
        { new: true, runValidators: true }
      ).populate('userId', 'username email');

      if (!paymentRequest) {
        return res.status(404).json({
          success: false,
          message: 'Payment request not found'
        });
      }

      // If approved, use the PaymentRequest approve method which handles conversion
      if (status === 'approved') {
        await paymentRequest.approve(req.user.id, adminNote);
      }

      res.json({
        success: true,
        message: 'Payment request updated successfully',
        data: { paymentRequest }
      });
    } catch (error) {
      logger.error('Update payment request error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update payment request',
        error: error.message
      });
    }
  },
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  getSiteConfig: async (req, res, next) => {
    try {
      // đảm bảo có dữ liệu mẫu
      await SiteConfig.initializeDefaults();
      const seo = await SiteConfig.getByCategory('seo', false);
      const general = await SiteConfig.getByCategory('general', false);
      const social = await SiteConfig.getByCategory('social', false);

      const siteConfig = {
        // Branding
        logo: general?.site_logo || '/logo.png',
        favicon: general?.site_favicon || '/favicon.ico',
        thumbnail: general?.site_thumbnail || '/logo.png',
        // Base SEO
        siteName: seo?.site_title || 'Credit Card Checker',
        siteDescription: seo?.site_description || 'Professional Credit Card Checking Service',
        siteKeywords: seo?.site_keywords || 'credit card, checker, validation, security',
        seoTitle: seo?.site_title || 'Credit Card Checker',
        seoDescription: seo?.site_description || 'Professional Credit Card Checking Service',
        canonicalUrl: seo?.canonical_url || '',
        // Robots
        robotsIndex: seo?.robots_index !== false,
        robotsFollow: seo?.robots_follow !== false,
        robotsAdvanced: seo?.robots_advanced || '',
        // Open Graph
        ogTitle: seo?.og_title || seo?.site_title || 'Credit Card Checker',
        ogDescription: seo?.og_description || seo?.site_description || 'Professional Credit Card Checking Service',
        ogType: seo?.og_type || 'website',
        ogSiteName: seo?.og_site_name || seo?.site_title || 'Credit Card Checker',
        ogImage: seo?.og_image || general?.site_thumbnail || '/logo.png',
        // Twitter
        twitterCard: seo?.twitter_card || 'summary_large_image',
        twitterSite: seo?.twitter_site || '',
        twitterCreator: seo?.twitter_creator || '',
        twitterImage: seo?.twitter_image || general?.site_thumbnail || '/logo.png',
        // Social links
        socialLinks: social?.social_links || { facebook: '', twitter: '', linkedin: '', youtube: '' },
        // Contact
        contactEmail: general?.contact_email || 'support@example.com',
        supportPhone: general?.support_phone || '',
        address: general?.address || '',
        footerText: general?.footer_text || '',
        telegramSupportUrl: general?.telegram_support_url || '',
        // Socket.IO URL
        socketUrl: general?.socket_url || '',
        // Checker config
        checkerDefaultBatchSize: await SiteConfig.getByKey('checker_default_batch_size') || 5,
        checkerCardTimeoutSec: await SiteConfig.getByKey('checker_card_timeout_sec') || 120
      };

      res.json({
        success: true,
        data: { siteConfig }
      });
    } catch (error) {
      logger.error('Get site config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get site configuration',
        error: error.message
      });
    }
  },
  updateSiteConfig: async (req, res, next) => {
    try {
      const payload = req.body || {};
      const updates = {};
      
      // Get io instance from app
      const io = req.app.get('io');
      // Branding
      if (payload.logo !== undefined) updates['site_logo'] = payload.logo;
      if (payload.favicon !== undefined) updates['site_favicon'] = payload.favicon;
      if (payload.thumbnail !== undefined) updates['site_thumbnail'] = payload.thumbnail;
      // Base SEO
      if (payload.siteName !== undefined) updates['site_title'] = payload.siteName;
      if (payload.siteDescription !== undefined) updates['site_description'] = payload.siteDescription;
      if (payload.siteKeywords !== undefined) updates['site_keywords'] = payload.siteKeywords;
      if (payload.seoTitle !== undefined) updates['site_title'] = payload.seoTitle; // alias
      if (payload.seoDescription !== undefined) updates['site_description'] = payload.seoDescription; // alias
      if (payload.canonicalUrl !== undefined) updates['canonical_url'] = payload.canonicalUrl;
      // Robots
      if (payload.robotsIndex !== undefined) updates['robots_index'] = !!payload.robotsIndex;
      if (payload.robotsFollow !== undefined) updates['robots_follow'] = !!payload.robotsFollow;
      if (payload.robotsAdvanced !== undefined) updates['robots_advanced'] = payload.robotsAdvanced;
      // Open Graph
      if (payload.ogTitle !== undefined) updates['og_title'] = payload.ogTitle;
      if (payload.ogDescription !== undefined) updates['og_description'] = payload.ogDescription;
      if (payload.ogType !== undefined) updates['og_type'] = payload.ogType;
      if (payload.ogSiteName !== undefined) updates['og_site_name'] = payload.ogSiteName;
      if (payload.ogImage !== undefined) updates['og_image'] = payload.ogImage;
      // Twitter
      if (payload.twitterCard !== undefined) updates['twitter_card'] = payload.twitterCard;
      if (payload.twitterSite !== undefined) updates['twitter_site'] = payload.twitterSite;
      if (payload.twitterCreator !== undefined) updates['twitter_creator'] = payload.twitterCreator;
      if (payload.twitterImage !== undefined) updates['twitter_image'] = payload.twitterImage;
      // Social
      if (payload.socialLinks !== undefined) updates['social_links'] = payload.socialLinks;
      // Contact
      if (payload.contactEmail !== undefined) updates['contact_email'] = payload.contactEmail;
      if (payload.supportPhone !== undefined) updates['support_phone'] = payload.supportPhone;
      if (payload.address !== undefined) updates['address'] = payload.address;
      if (payload.footerText !== undefined) updates['footer_text'] = payload.footerText;
      if (payload.telegramSupportUrl !== undefined) updates['telegram_support_url'] = payload.telegramSupportUrl;
      // Realtime Socket
      if (payload.socketUrl !== undefined) updates['socket_url'] = payload.socketUrl;
      // Checker settings
      if (payload.checkerDefaultBatchSize !== undefined) updates['checker_default_batch_size'] = Number(payload.checkerDefaultBatchSize);
      if (payload.checkerCardTimeoutSec !== undefined) updates['checker_card_timeout_sec'] = Number(payload.checkerCardTimeoutSec);

      // cập nhật hàng loạt theo key-value
      await SiteConfig.initializeDefaults();
      await SiteConfig.bulkUpdate(updates, req.user.id);

      // Emit socket event to notify all clients about config update
      if (io) {
        io.emit('config:updated', { timestamp: new Date() });
        logger.info('Emitted config:updated event via Socket.IO');
      }

      res.json({
        success: true,
        message: 'Site configuration updated successfully'
      });
    } catch (error) {
      logger.error('Update site config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update site configuration',
        error: error.message
      });
    }
  },
  getPricingConfig: async (req, res, next) => {
    try {
      const pricingConfig = await PricingConfig.findOne() || {};
      res.json({
        success: true,
        data: { pricingConfig }
      });
    } catch (error) {
      logger.error('Get pricing config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pricing configuration',
        error: error.message
      });
    }
  },
  updatePricingConfig: async (req, res, next) => {
    try {
      const pricingConfig = await PricingConfig.findOneAndUpdate(
        {},
        { ...req.body, updatedBy: req.user.id },
        { new: true, upsert: true, runValidators: true }
      );

      // Emit socket event to notify all clients about config update
      if (req.app.get('io')) {
        req.app.get('io').emit('config:updated', { timestamp: new Date() });
        logger.info('Emitted config:updated event via Socket.IO');
      }
      
      res.json({
        success: true,
        message: 'Pricing configuration updated successfully',
        data: { pricingConfig }
      });
    } catch (error) {
      logger.error('Update pricing config error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update pricing configuration',
        error: error.message
      });
    }
  },
  // ...
  getPricingTiers: async (req, res, next) => {
    try {
      const tiers = await PricingConfig.find().sort({ minCards: 1 }).lean();
      res.json({ success: true, data: { tiers } });
    } catch (error) {
      logger.error('Get pricing tiers error:', error);
      res.status(500).json({ success: false, message: 'Failed to get pricing tiers', error: error.message });
    }
  },
  updatePricingTiers: async (req, res, next) => {
    try {
      const { tiers } = req.body;
      if (!Array.isArray(tiers) || tiers.length === 0) {
        return res.status(400).json({ success: false, message: 'Tiers payload is invalid' });
      }

      // Replace all tiers with provided list (simple approach)
      await PricingConfig.deleteMany({});
      const docs = await PricingConfig.insertMany(
        tiers.map((t, idx) => ({
          name: t.name || `${t.minCards}-${t.maxCards ?? '∞'} Cards Tier`,
          description: t.description || '',
          minCards: t.minCards,
          maxCards: t.maxCards === null || t.maxCards === undefined ? null : t.maxCards,
          pricePerCard: t.pricePerCard,
          discountPercentage: t.discountPercentage || 0,
          isActive: t.isActive !== false,
          priority: t.priority ?? idx,
          applicableUserRoles: Array.isArray(t.applicableUserRoles) && t.applicableUserRoles.length > 0 ? t.applicableUserRoles : ['user'],
          createdBy: req.user.id,
          updatedBy: req.user.id
        }))
      );

      res.json({ success: true, message: 'Pricing tiers updated successfully', data: { tiers: docs } });
    } catch (error) {
      logger.error('Update pricing tiers error:', error);
      res.status(500).json({ success: false, message: 'Failed to update pricing tiers', error: error.message });
    }
  },
  // UI / Language config (admin)
  getUiConfig: async (req, res, next) => {
    try {
      await SiteConfig.initializeDefaults();
      const defaultLanguage = await SiteConfig.getByKey('ui_default_language');
      const languageSwitcher = await SiteConfig.getByKey('ui_language_switcher_enabled');
      const availableLanguages = await SiteConfig.getByKey('ui_available_languages');
      res.json({ success: true, data: { uiConfig: { defaultLanguage, languageSwitcher, availableLanguages } } });
    } catch (error) {
      logger.error('Get UI config error:', error);
      res.status(500).json({ success: false, message: 'Failed to get UI configuration', error: error.message });
    }
  },
  updateUiConfig: async (req, res, next) => {
    try {
      const payload = req.body || {};
      const updates = {};
      if (payload.defaultLanguage !== undefined) updates['ui_default_language'] = payload.defaultLanguage;
      if (payload.languageSwitcher !== undefined) updates['ui_language_switcher_enabled'] = payload.languageSwitcher;
      if (payload.availableLanguages !== undefined) updates['ui_available_languages'] = payload.availableLanguages;
      await SiteConfig.bulkUpdate(updates, req.user.id);
      res.json({ success: true, message: 'UI configuration updated successfully' });
    } catch (error) {
      logger.error('Update UI config error:', error);
      res.status(500).json({ success: false, message: 'Failed to update UI configuration', error: error.message });
    }
  },

  // CryptAPI config (admin)
  getCryptApiConfig: async (req, res, next) => {
    try {
      await SiteConfig.initializeDefaults();
      const merchantAddress = await SiteConfig.getByKey('cryptapi_merchant_address');
      const merchantAddresses = await SiteConfig.getByKey('cryptapi_merchant_addresses');
      const webhookDomain = await SiteConfig.getByKey('cryptapi_webhook_domain');
      const enabledCoins = await SiteConfig.getByKey('cryptapi_enabled_coins');
      res.json({ success: true, data: { cryptapi: { merchantAddress, merchantAddresses, webhookDomain, enabledCoins } } });
    } catch (error) {
      logger.error('Get CryptAPI config error:', error);
      res.status(500).json({ success: false, message: 'Failed to get CryptAPI configuration', error: error.message });
    }
  },
  updateCryptApiConfig: async (req, res, next) => {
    try {
      const payload = req.body || {};
      const updates = {};
      if (payload.merchantAddress !== undefined) updates['cryptapi_merchant_address'] = payload.merchantAddress;
      if (payload.merchantAddresses !== undefined) updates['cryptapi_merchant_addresses'] = payload.merchantAddresses;
      if (payload.webhookDomain !== undefined) updates['cryptapi_webhook_domain'] = payload.webhookDomain;
      if (payload.enabledCoins !== undefined) updates['cryptapi_enabled_coins'] = payload.enabledCoins;
      await SiteConfig.bulkUpdate(updates, req.user.id);
      res.json({ success: true, message: 'CryptAPI configuration updated successfully' });
    } catch (error) {
      logger.error('Update CryptAPI config error:', error);
      res.status(500).json({ success: false, message: 'Failed to update CryptAPI configuration', error: error.message });
    }
  },



  // Payment/UI config (admin)
  getPaymentConfig: async (req, res, next) => {
    try {
      await SiteConfig.initializeDefaults();
      const usdToCreditRate = await SiteConfig.getByKey('payment_usd_to_credit_rate');
      const showBuy = await SiteConfig.getByKey('payment_show_buy_credits');
      const showCrypto = await SiteConfig.getByKey('payment_show_crypto_payment');
      const creditPackages = await SiteConfig.getByKey('payment_credit_packages');
      const minDeposit = await SiteConfig.getByKey('min_deposit_amount');
      const maxDeposit = await SiteConfig.getByKey('max_deposit_amount');
      const cryptoUsdPrices = await SiteConfig.getByKey('crypto_usd_prices');

      res.json({
        success: true,
        data: {
          payment: {
            usdToCreditRate: Number(usdToCreditRate || 10),
            showBuyCredits: showBuy !== false,
            showCryptoPayment: showCrypto !== false,
            creditPackages: creditPackages || [],
            minDepositAmount: Number(minDeposit || 10),
            maxDepositAmount: Number(maxDeposit || 10000),
            cryptoUsdPrices: cryptoUsdPrices || {}
          }
        }
      });
    } catch (error) {
      logger.error('Get Payment config error:', error);
      res.status(500).json({ success: false, message: 'Failed to get Payment configuration', error: error.message });
    }
  },
  updatePaymentConfig: async (req, res, next) => {
    try {
      const payload = req.body || {};
      const updates = {};
      if (payload.usdToCreditRate !== undefined) updates['payment_usd_to_credit_rate'] = Number(payload.usdToCreditRate);
      if (payload.showBuyCredits !== undefined) updates['payment_show_buy_credits'] = !!payload.showBuyCredits;
      if (payload.showCryptoPayment !== undefined) updates['payment_show_crypto_payment'] = !!payload.showCryptoPayment;
      if (payload.creditPackages !== undefined) updates['payment_credit_packages'] = payload.creditPackages;
      if (payload.minDepositAmount !== undefined) updates['min_deposit_amount'] = Number(payload.minDepositAmount);
      if (payload.maxDepositAmount !== undefined) updates['max_deposit_amount'] = Number(payload.maxDepositAmount);
      if (payload.cryptoUsdPrices !== undefined) updates['crypto_usd_prices'] = payload.cryptoUsdPrices;
      await SiteConfig.bulkUpdate(updates, req.user.id);
      res.json({ success: true, message: 'Payment configuration updated successfully' });
    } catch (error) {
      logger.error('Update Payment config error:', error);
      res.status(500).json({ success: false, message: 'Failed to update Payment configuration', error: error.message });
    }
  },
  
  // Rate Limit endpoints
  getRateLimitConfig: exports.getRateLimitConfig,
  updateRateLimitConfig: exports.updateRateLimitConfig,
  getRequestStats: exports.getRequestStats,
  trackRequest: exports.trackRequest

};
