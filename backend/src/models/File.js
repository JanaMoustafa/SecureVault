'use strict';

const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    owner: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    originalName: {
      type:     String,
      required: true,
      // stored encrypted by client — just a hint for display
    },
    encryptedName: {
      type:     String,
      required: true,
      unique:   true,
    },
    mimeType: {
      type:    String,
      default: 'application/octet-stream',
    },
    // Size in bytes of the encrypted blob
    size: {
      type:     Number,
      required: true,
    },
    // SHA-256 digest of the encrypted blob (hex) — for integrity checks
    sha256Hash: {
      type:     String,
      required: true,
      match:    [/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash'],
    },
    // Client-generated IV (base64) used during AES-GCM encryption
    iv: {
      type:     String,
      required: true,
    },
    // Client-generated salt (base64) used for PBKDF2 key derivation
    salt: {
      type:     String,
      required: true,
    },
    // Storage path on the server filesystem
    storagePath: {
      type:     String,
      required: true,
      select:   false,  // never exposed via API
    },
    sharedWith: [
      {
        user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        sharedAt:   { type: Date, default: Date.now },
        permission: { type: String, enum: ['read', 'download'], default: 'read' },
      },
    ],
    isDeleted: {
      type:    Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Soft-delete helper ─────────────────────────────────────
fileSchema.methods.softDelete = function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// ── Default query filter: exclude deleted ──────────────────
fileSchema.pre(/^find/, function (next) {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

module.exports = mongoose.model('File', fileSchema);
