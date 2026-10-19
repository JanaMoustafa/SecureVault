'use strict';

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const File   = require('../models/File');
const logger = require('../config/logger');

// ── Multer: store encrypted blobs to disk ──────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = process.env.STORAGE_PATH || path.join(__dirname, '../../uploads');
    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${uuidv4()}.enc`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Accept all types — server never inspects content, only encrypted blobs
    cb(null, true);
  },
}).single('encryptedFile');

// ── Helper: compute SHA-256 of a file on disk ──────────────
const computeFileSha256 = (filePath) =>
  new Promise((resolve, reject) => {
    const hash   = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (d) => hash.update(d));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

// ── POST /api/files/upload ────────────────────────────────
exports.uploadFile = (req, res, next) => {
  upload(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }
    if (err) return next(err);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    try {
      const { originalName, sha256Hash, iv, salt } = req.body;

      // Validate required metadata
      if (!originalName || !sha256Hash || !iv || !salt) {
        fs.unlinkSync(req.file.path);
        return res.status(422).json({ success: false, message: 'Missing encryption metadata.' });
      }

      // Server-side integrity verification
      const serverHash = await computeFileSha256(req.file.path);
      if (serverHash !== sha256Hash.toLowerCase()) {
        fs.unlinkSync(req.file.path);
        logger.warn(`Hash mismatch on upload. User: ${req.user.id}, expected: ${sha256Hash}, got: ${serverHash}`);
        return res.status(400).json({ success: false, message: 'File integrity check failed.' });
      }

      const fileDoc = await File.create({
        owner:         req.user.id,
        originalName,
        encryptedName: req.file.filename,
        mimeType:      req.file.mimetype || 'application/octet-stream',
        size:          req.file.size,
        sha256Hash:    serverHash,
        iv,
        salt,
        storagePath:   req.file.path,
      });

      logger.info(`File uploaded: ${fileDoc._id} by user ${req.user.id}`);
      res.status(201).json({ success: true, data: { file: fileDoc } });
    } catch (e) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      next(e);
    }
  });
};

// ── GET /api/files ────────────────────────────────────────
exports.listFiles = async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [files, total] = await Promise.all([
      File.find({ owner: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      File.countDocuments({ owner: req.user.id }),
    ]);

    res.json({
      success: true,
      data: { files, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/files/:id ────────────────────────────────────
exports.getFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user.id });
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });
    res.json({ success: true, data: { file } });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/files/:id/download ───────────────────────────
exports.downloadFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user.id }).select('+storagePath');
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });

    if (!fs.existsSync(file.storagePath)) {
      return res.status(404).json({ success: false, message: 'Encrypted file not found on storage.' });
    }

    // Return IV and salt so client can decrypt
    res.set({
      'Content-Type':        'application/octet-stream',
      'Content-Disposition': `attachment; filename="${file.encryptedName}"`,
      'X-File-IV':           file.iv,
      'X-File-Salt':         file.salt,
      'X-File-Hash':         file.sha256Hash,
      'X-Original-Name':     Buffer.from(file.originalName).toString('base64'),
    });

    const stream = fs.createReadStream(file.storagePath);
    stream.on('error', next);
    stream.pipe(res);

    logger.info(`File downloaded: ${file._id} by user ${req.user.id}`);
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/files/:id ─────────────────────────────────
exports.deleteFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.id, owner: req.user.id }).select('+storagePath');
    if (!file) return res.status(404).json({ success: false, message: 'File not found.' });

    await file.softDelete();
    // Optionally schedule physical removal
    logger.info(`File soft-deleted: ${file._id} by user ${req.user.id}`);
    res.json({ success: true, message: 'File deleted.' });
  } catch (err) {
    next(err);
  }
};
