'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

let _memServer = null;  // holds the MongoMemoryServer instance in dev

const connectDB = async () => {
  let uri = process.env.MONGO_URI;

  // ── Development: spin up embedded MongoDB if needed ────────
  if (process.env.NODE_ENV !== 'production' && (!uri || uri.includes('localhost'))) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      _memServer = await MongoMemoryServer.create({
        instance: { port: 27018 },  // avoid conflict with any real mongod on 27017
        binary: { version: '7.0.14' },
      });
      uri = _memServer.getUri();
      logger.info('🧪 [DEV] Using embedded MongoDB Memory Server: ' + uri);
    } catch (err) {
      logger.warn('mongodb-memory-server not available, falling back to MONGO_URI: ' + err.message);
      // Fall through to use whatever MONGO_URI is set
    }
  }

  if (!uri) throw new Error('MONGO_URI is not defined. Set it in .env or install mongodb-memory-server for dev.');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected.');
  });

  logger.info('✅ MongoDB connected successfully');
};

// Gracefully stop the memory server on process exit
process.on('SIGINT', async () => { if (_memServer) await _memServer.stop(); process.exit(0); });
process.on('SIGTERM', async () => { if (_memServer) await _memServer.stop(); process.exit(0); });

module.exports = connectDB;

