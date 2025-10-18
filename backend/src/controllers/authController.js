const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwtService = require('../utils/jwt');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
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

    const { username, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email ? 
          'Email đã được sử dụng' : 'Tên đăng nhập đã được sử dụng'
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role: 'user',
      status: 'active'
    });

    // Generate tokens
    const tokens = jwtService.generateTokenPair(user);

    // Save refresh token to user
    user.refreshToken = tokens.refreshToken;
    await user.save();

    logger.info(`New user registered: ${user.username}`, {
      userId: user._id,
      email: user.email
    });

    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          balance: user.balance,
          createdAt: user.createdAt
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
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

    const { login: loginField, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { email: loginField },
        { username: loginField }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Thông tin đăng nhập không chính xác'
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản đã bị khóa hoặc chưa được kích hoạt'
      });
    }

    // Check password
    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Thông tin đăng nhập không chính xác'
      });
    }

    // Generate tokens
    const tokens = jwtService.generateTokenPair(user);

    // Save refresh token to user
    user.refreshToken = tokens.refreshToken;
    user.lastLogin = new Date();
    await user.save();

    logger.info(`User logged in: ${user.username}`, {
      userId: user._id,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          balance: user.balance,
          lastLogin: user.lastLogin
        },
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    // Clear refresh token
    await User.findByIdAndUpdate(req.user.id, {
      $unset: { refreshToken: 1 }
    });

    logger.info(`User logged out: ${req.user.username}`, {
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Đăng xuất thành công'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          balance: user.balance,
          avatar: user.avatar,
          bio: user.bio,
          cardStats: user.cardStats,
          successRate: user.successRate,
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    logger.error('Get me error:', error);
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
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

    const { username, email, currentPassword, newPassword, avatar, bio } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    // Update username if provided
    if (username && username !== user.username) {
      // Check if username is already taken
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Tên đăng nhập đã được sử dụng'
        });
      }
      user.username = username;
    }

    // Update email if provided
    if (email && email !== user.email) {
      // Check if email is already taken
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email đã được sử dụng'
        });
      }
      user.email = email;
    }

    // Update avatar/bio if provided
    if (typeof avatar === 'string') {
      user.avatar = avatar;
    }
    if (typeof bio === 'string') {
      user.bio = bio;
    }

    // Update password if provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mật khẩu hiện tại'
        });
      }

      // Verify current password
      const isCurrentPasswordValid = await user.matchPassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Mật khẩu hiện tại không chính xác'
        });
      }

      user.password = newPassword;
    }

    await user.save();

    logger.info(`User profile updated: ${user.username}`, {
      userId: user._id,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          balance: user.balance,
          avatar: user.avatar,
          bio: user.bio
        }
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    next(error);
  }
};

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không được cung cấp'
      });
    }

    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ'
      });
    }

    // Find user and check if refresh token matches
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token không hợp lệ'
      });
    }

    // Generate new tokens
    const newTokens = jwtService.generateTokenPair(user);

    // Update refresh token
    user.refreshToken = newTokens.refreshToken;
    await user.save();

    res.json({
      success: true,
      message: 'Token đã được làm mới',
      data: {
        token: newTokens.accessToken,
        refreshToken: newTokens.refreshToken
      }
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe,
  updateProfile,
  refreshToken
};
