'use strict';

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const morgan        = require('morgan');
const compression   = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit     = require('express-rate-limit');
const path          = require('path');

const authRoutes    = require('./routes/auth.routes');
const fileRoutes    = require('./routes/file.routes');
const adminRoutes   = require('./routes/admin.routes');
const errorHandler  = require('./middleware/errorHandler');
const logger        = require('./config/logger');

const app = express();

// Express sets `X-Powered-By` by default; explicitly disable to avoid header leakage.
app.disable('x-powered-by');

// ── Security Headers (Helmet + CSP) ───────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'"],
        styleSrc:       ["'self'", "'unsafe-inline'"],
        imgSrc:         ["'self'", 'data:'],
        connectSrc:     ["'self'"],
        fontSrc:        ["'self'"],
        objectSrc:      ["'none'"],
        frameSrc:       ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy:   { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy:            { policy: 'strict-origin-when-cross-origin' },
    xFrameOptions:             { action: 'deny' },
  })
);

// ── CORS ───────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Global Rate Limiter ────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', globalLimiter);

// ── Body Parsing & Sanitisation ────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());      // block NoSQL injection via query/body
app.use(compression());

// ── Request Logging ────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url === '/api/health',
  })
);

// ── Routes ─────────────────────────────────────────────────
app.use('/api/auth',  authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 404 ────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// ── Global Error Handler ────────────────────────────────────
app.use(errorHandler);

module.exports = app;
