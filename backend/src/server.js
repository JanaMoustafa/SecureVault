'use strict';

require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');
const logger = require('./config/logger');

const PORT = process.env.PORT || 5001;

// ── Graceful Shutdown ──────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown…`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ── Unhandled Rejections / Exceptions ─────────────────────-
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// ── Boot ───────────────────────────────────────────────────
(async () => {
  await connectDB();
  app.listen(PORT, () => {
    logger.info(`🔐 SecureVault API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });
})();
