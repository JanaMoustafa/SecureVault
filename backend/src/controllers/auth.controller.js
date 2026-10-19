'use strict';

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const logger = require('../config/logger');

// ── Token helpers ──────────────────────────────────────────
const signAccessToken = (user) =>
  jwt.sign(
    { id: user._id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m', algorithm: 'HS256' }
  );

const signRefreshToken = (user) =>
  jwt.sign(
    { id: user._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', algorithm: 'HS256' }
  );

// ── POST /api/auth/register ────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email or username already in use.' });
    }

    const user = await User.create({ username, email, password });
    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    user.refreshTokens.push({
      token:     refreshToken,
      userAgent: req.headers['user-agent'],
      ip:        req.ip,
    });
    await user.save();

    logger.info(`New user registered: ${email}`);
    res.status(201).json({ success: true, data: { user, accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ──────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      logger.warn(`Failed login — unknown email: ${email} | IP: ${req.ip}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account suspended.' });
    }

    if (user.isLocked()) {
      return res.status(429).json({ success: false, message: 'Account temporarily locked. Try again later.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      logger.warn(`Failed login attempt for: ${email} | IP: ${req.ip}`);
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    await user.resetLoginAttempts();

    const accessToken  = signAccessToken(user);
    const refreshToken = signRefreshToken(user);

    user.refreshTokens.push({
      token:     refreshToken,
      userAgent: req.headers['user-agent'],
      ip:        req.ip,
    });
    await user.save();

    logger.info(`User logged in: ${email} | IP: ${req.ip}`);
    res.json({ success: true, data: { user, accessToken, refreshToken } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/refresh ────────────────────────────────
exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ success: false, message: 'User not found.' });

    const tokenDoc = user.refreshTokens.find((t) => t.token === refreshToken);
    if (!tokenDoc) {
      // Potential token reuse — invalidate all tokens (security response)
      user.refreshTokens = [];
      await user.save();
      logger.warn(`Refresh token reuse detected for user: ${user.email}`);
      return res.status(401).json({ success: false, message: 'Token reuse detected. Please log in again.' });
    }

    // Rotate refresh token
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== refreshToken);
    const newAccessToken  = signAccessToken(user);
    const newRefreshToken = signRefreshToken(user);
    user.refreshTokens.push({
      token:     newRefreshToken,
      userAgent: req.headers['user-agent'],
      ip:        req.ip,
    });
    await user.save();

    res.json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/logout ─────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { refreshTokens: { token: refreshToken } },
      });
    }
    logger.info(`User logged out: ${req.user.id}`);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ──────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};
