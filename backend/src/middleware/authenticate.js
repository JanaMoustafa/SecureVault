'use strict';

const jwt    = require('jsonwebtoken');
const logger = require('../config/logger');

/**
 * Verifies the JWT Bearer token on every protected request.
 * Zero-Trust: no request is trusted without a valid, unexpired token.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No authentication token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id:       decoded.id,
      username: decoded.username,
      role:     decoded.role,
    };
    next();
  } catch (err) {
    logger.warn(`JWT verification failed: ${err.message} | IP: ${req.ip}`);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }
};

module.exports = authenticate;
