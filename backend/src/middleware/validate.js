'use strict';

const { body, validationResult } = require('express-validator');

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors:  errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

const registerRules = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username contains invalid characters'),
  body('email')
    .trim().normalizeEmail()
    .isEmail().withMessage('Invalid email address'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain at least one special character'),
  handleValidation,
];

const loginRules = [
  body('email').trim().normalizeEmail().isEmail().withMessage('Invalid email address'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
];

const fileMetaRules = [
  body('originalName').trim().notEmpty().withMessage('Original filename is required').isLength({ max: 255 }),
  body('sha256Hash').matches(/^[a-f0-9]{64}$/).withMessage('Invalid SHA-256 hash'),
  body('iv').notEmpty().withMessage('IV is required'),
  body('salt').notEmpty().withMessage('Salt is required'),
  handleValidation,
];

module.exports = { registerRules, loginRules, fileMetaRules };
