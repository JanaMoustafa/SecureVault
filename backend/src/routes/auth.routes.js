'use strict';

const express    = require('express');
const rateLimit  = require('express-rate-limit');
const controller = require('../controllers/auth.controller');
const auth       = require('../middleware/authenticate');
const { registerRules, loginRules } = require('../middleware/validate');

const router = express.Router();

// Strict rate limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  // Scope brute-force protection to the login "identifier" instead of just IP.
  // This prevents one email's failed attempts from blocking subsequent tests/users.
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (email) return `auth:${String(email).toLowerCase()}:${req.ip}`;
    return `auth:ip:${req.ip}`;
  },
  message:  { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

router.post('/register', authLimiter, registerRules, controller.register);
router.post('/login',    authLimiter, loginRules,    controller.login);
router.post('/refresh',  authLimiter,                controller.refresh);
router.post('/logout',   auth,                       controller.logout);
router.get('/me',        auth,                       controller.getMe);

module.exports = router;
