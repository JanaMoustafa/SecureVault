/**
 * SecureVault Crypto Service
 * ──────────────────────────────────────────────────────────────────────
 * Implements client-side encryption using the Web Crypto API (SubtleCrypto).
 * The server NEVER sees plaintext data or cryptographic keys.
 *
 *  Algorithm:   AES-256-GCM (authenticated encryption)
 *  Key derivation: PBKDF2 with SHA-256, 310,000 iterations (NIST recommendation)
 *  Integrity:   SHA-256 hash of the encrypted blob
 *  Salt:        16 bytes (cryptographically random)
 *  IV:          12 bytes (cryptographically random, one-per-encryption)
 */

const PBKDF2_ITERATIONS = 310_000;
const SALT_LENGTH       = 16;  // bytes
const IV_LENGTH         = 12;  // bytes — optimal for AES-GCM
const KEY_LENGTH_BITS   = 256;

// ── Helpers ────────────────────────────────────────────────────────────

/** Convert ArrayBuffer → Base64 string (safe for JSON / HTTP headers) */
const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary  = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

/** Convert Base64 string → ArrayBuffer */
const base64ToBuffer = (b64) => {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

/** Convert ArrayBuffer → hex string (for SHA-256 display) */
const bufferToHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

// ── Key Derivation ──────────────────────────────────────────────────────

/**
 * Derive an AES-256-GCM key from a user password using PBKDF2.
 * @param {string} password - User's password
 * @param {Uint8Array} salt  - 16-byte random salt
 * @returns {CryptoKey}
 */
const deriveKey = async (password, salt) => {
  const encoder  = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    false,    // key is NOT extractable — stays in browser memory only
    ['encrypt', 'decrypt']
  );
};

// ── Encryption ──────────────────────────────────────────────────────────

/**
 * Encrypt a file on the client device before upload.
 * @param {File}   file     - The file to encrypt
 * @param {string} password - User's password for key derivation
 * @param {Function} onProgress - Progress callback (0–100)
 * @returns {{ encryptedBlob, iv, salt, sha256Hash, originalName, mimeType }}
 */
export const encryptFile = async (file, password, onProgress = () => {}) => {
  if (!file || !password) throw new Error('File and password are required.');
  if (typeof crypto.subtle === 'undefined') throw new Error('Web Crypto API not available.');

  onProgress(5);

  // 1. Read file as ArrayBuffer
  const fileBuffer = await file.arrayBuffer();
  onProgress(15);

  // 2. Generate cryptographically random salt and IV
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv   = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  onProgress(25);

  // 3. Derive AES-256-GCM key from password
  const key = await deriveKey(password, salt);
  onProgress(40);

  // 4. Encrypt the file buffer
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  );
  onProgress(70);

  // 5. Compute SHA-256 of the encrypted blob for integrity verification
  const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedBuffer);
  const sha256Hash = bufferToHex(hashBuffer);
  onProgress(85);

  // 6. Package result
  const encryptedBlob = new Blob([encryptedBuffer], { type: 'application/octet-stream' });
  onProgress(100);

  return {
    encryptedBlob,
    iv:           bufferToBase64(iv),
    salt:         bufferToBase64(salt),
    sha256Hash,
    originalName: file.name,
    mimeType:     file.type,
  };
};

// ── Decryption ──────────────────────────────────────────────────────────

/**
 * Decrypt a downloaded encrypted blob on the client device.
 * @param {ArrayBuffer} encryptedBuffer - The encrypted blob from the server
 * @param {string}      password        - User's password for key derivation
 * @param {string}      ivBase64        - Base64-encoded IV from server header
 * @param {string}      saltBase64      - Base64-encoded salt from server header
 * @param {string}      expectedHash    - Expected SHA-256 hash (hex) for verification
 * @returns {ArrayBuffer} - The decrypted file content
 */
export const decryptFile = async (encryptedBuffer, password, ivBase64, saltBase64, expectedHash) => {
  if (!encryptedBuffer || !password || !ivBase64 || !saltBase64) {
    throw new Error('Missing required decryption parameters.');
  }

  // 1. Verify integrity before decryption (fail-fast on tampering)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encryptedBuffer);
  const actualHash = bufferToHex(hashBuffer);
  if (expectedHash && actualHash !== expectedHash.toLowerCase()) {
    throw new Error('Integrity check failed: file may have been tampered with.');
  }

  // 2. Reconstruct salt and IV
  const salt = new Uint8Array(base64ToBuffer(saltBase64));
  const iv   = new Uint8Array(base64ToBuffer(ivBase64));

  // 3. Derive the same key
  const key = await deriveKey(password, salt);

  // 4. Decrypt
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedBuffer
    );
    return decryptedBuffer;
  } catch {
    throw new Error('Decryption failed. Incorrect password or corrupted file.');
  }
};

// ── SHA-256 Hashing ─────────────────────────────────────────────────────

/**
 * Compute the SHA-256 hash of any data.
 * Used for background hashing of files before upload.
 * @param {ArrayBuffer|Uint8Array} data
 * @returns {string} hex digest
 */
export const sha256 = async (data) => {
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(buffer);
};

/**
 * Generate a cryptographically random hex string (e.g., for tokens).
 * @param {number} bytes - Number of random bytes
 * @returns {string}
 */
export const randomHex = (bytes = 32) => {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return bufferToHex(arr.buffer);
};

/**
 * Securely wipe a string from memory by overwriting with zeros.
 * Used to clear password strings after use.
 * NOTE: JS strings are immutable; this signals intent and clears refs.
 * @param {object} stateRef - Zustand state slice to clear
 * @param {Function} setter - Zustand setter
 */
export const wipeFromMemory = (setter, keys) => {
  const wipe = {};
  keys.forEach((k) => (wipe[k] = null));
  setter(wipe);
};
