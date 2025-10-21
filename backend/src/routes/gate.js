const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const Gate = require('../models/Gate');
const logger = require('../config/logger');

// @desc    Get all active gates (public)
// @route   GET /api/gates
// @access  Public
router.get('/', async (req, res) => {
  try {
    const gates = await Gate.getActiveGates();
    
    res.json({
      success: true,
      data: {
        gates: gates.map(g => ({
          id: g._id,
          name: g.name,
          typeCheck: g.typeCheck,
          description: g.description,
          creditCost: g.creditCost
        }))
      }
    });
  } catch (error) {
    logger.error('Get gates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gates',
      error: error.message
    });
  }
});

// @desc    Get all gates (admin)
// @route   GET /api/gates/admin
// @access  Private (Admin only)
router.get('/admin', protect, async (req, res) => {
  try {
    const gates = await Gate.find().sort({ sortOrder: 1, createdAt: -1 });
    
    res.json({
      success: true,
      data: { gates }
    });
  } catch (error) {
    logger.error('Get admin gates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get gates',
      error: error.message
    });
  }
});

// @desc    Create gate
// @route   POST /api/gates/admin
// @access  Private (Admin only)
router.post('/admin', protect, async (req, res) => {
  try {
    const { name, typeCheck, description, isActive, sortOrder, creditCost } = req.body;
    
    const gate = await Gate.create({
      name,
      typeCheck,
      description,
      creditCost,
      isActive,
      sortOrder,
      createdBy: req.user._id
    });
    
    logger.info(`Gate created: ${gate.name} by admin ${req.user.username}`);
    
    res.status(201).json({
      success: true,
      message: 'Gate created successfully',
      data: { gate }
    });
  } catch (error) {
    logger.error('Create gate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create gate',
      error: error.message
    });
  }
});

// @desc    Update gate
// @route   PUT /api/gates/admin/:id
// @access  Private (Admin only)
router.put('/admin/:id', protect, async (req, res) => {
  try {
    const { name, typeCheck, description, isActive, sortOrder, creditCost } = req.body;
    
    const gate = await Gate.findByIdAndUpdate(
      req.params.id,
      {
        name,
        typeCheck,
        description,
        creditCost,
        isActive,
        sortOrder,
        updatedBy: req.user._id
      },
      { new: true, runValidators: true }
    );
    
    if (!gate) {
      return res.status(404).json({
        success: false,
        message: 'Gate not found'
      });
    }
    
    logger.info(`Gate updated: ${gate.name} by admin ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Gate updated successfully',
      data: { gate }
    });
  } catch (error) {
    logger.error('Update gate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update gate',
      error: error.message
    });
  }
});

// @desc    Delete gate
// @route   DELETE /api/gates/admin/:id
// @access  Private (Admin only)
router.delete('/admin/:id', protect, async (req, res) => {
  try {
    const gate = await Gate.findByIdAndDelete(req.params.id);
    
    if (!gate) {
      return res.status(404).json({
        success: false,
        message: 'Gate not found'
      });
    }
    
    logger.info(`Gate deleted: ${gate.name} by admin ${req.user.username}`);
    
    res.json({
      success: true,
      message: 'Gate deleted successfully'
    });
  } catch (error) {
    logger.error('Delete gate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete gate',
      error: error.message
    });
  }
});

module.exports = router;
