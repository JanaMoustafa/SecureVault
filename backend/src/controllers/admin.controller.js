'use strict';

const User = require('../models/User');
const File = require('../models/File');
const logger = require('../config/logger');

// ── GET /api/admin/users ──────────────────────────────────
exports.listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(),
    ]);

    res.json({ success: true, data: { users, pagination: { page, limit, total } } });
  } catch (err) { next(err); }
};

// ── PATCH /api/admin/users/:id/status ────────────────────
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Prevent admin from deactivating themselves
    if (user._id.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot change your own status.' });
    }

    user.isActive = !user.isActive;
    await user.save();

    logger.info(`Admin ${req.user.id} toggled status for user ${user._id} → ${user.isActive}`);
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// ── PATCH /api/admin/users/:id/role ──────────────────────
exports.changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true, runValidators: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    logger.info(`Admin ${req.user.id} changed role of user ${user._id} to ${role}`);
    res.json({ success: true, data: { user } });
  } catch (err) { next(err); }
};

// ── GET /api/admin/stats ──────────────────────────────────
exports.getStats = async (req, res, next) => {
  try {
    const [totalUsers, totalFiles, activeUsers, adminCount] = await Promise.all([
      User.countDocuments(),
      File.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'admin' }),
    ]);

    // Storage usage
    const storageAgg = await File.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalBytes: { $sum: '$size' }, count: { $sum: 1 } } },
    ]);
    const storage = storageAgg[0] || { totalBytes: 0, count: 0 };

    res.json({
      success: true,
      data: { stats: { totalUsers, activeUsers, adminCount, totalFiles, storage } },
    });
  } catch (err) { next(err); }
};
