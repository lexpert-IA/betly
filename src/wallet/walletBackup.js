/**
 * walletBackup.js — Encrypted backup of all custodial wallet keys
 *
 * Creates a JSON export of all user wallet addresses + encrypted keys.
 * The export itself is encrypted with a separate backup passphrase.
 * Run manually via: node -e "require('./src/wallet/walletBackup').createBackup()"
 */

const crypto  = require('crypto');
const fs      = require('fs');
const path    = require('path');
const logger  = require('../utils/logger');

const ALGO = 'aes-256-gcm';

/**
 * Create an encrypted backup of all custodial wallets
 * @param {string} backupPassphrase - Passphrase used to encrypt the backup file
 * @param {string} outputDir - Directory to write backup to
 */
async function createBackup(backupPassphrase, outputDir) {
  const User = require('../../db/models/User');

  if (!backupPassphrase || backupPassphrase.length < 12) {
    throw new Error('Backup passphrase must be at least 12 characters');
  }

  // Find all users with custodial wallets
  const users = await User.find(
    { encryptedPrivateKey: { $exists: true, $ne: null } },
    { uniqueId: 1, walletAddress: 1, encryptedPrivateKey: 1, username: 1 }
  ).lean();

  if (users.length === 0) {
    logger.info('[BACKUP] No custodial wallets to backup');
    return null;
  }

  // Build backup payload
  const payload = {
    version: 1,
    createdAt: new Date().toISOString(),
    walletCount: users.length,
    wallets: users.map(u => ({
      userId: u.uniqueId,
      username: u.username,
      walletAddress: u.walletAddress,
      encryptedPrivateKey: u.encryptedPrivateKey,
    })),
  };

  // Derive key from passphrase
  const salt = crypto.randomBytes(32);
  const key = crypto.scryptSync(backupPassphrase, salt, 32);
  const iv = crypto.randomBytes(12);

  // Encrypt payload
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const backupData = {
    format: 'betly-wallet-backup-v1',
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    data: encrypted.toString('hex'),
  };

  // Write to file
  const dir = outputDir || path.join(__dirname, '../../backups');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = `wallet-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.enc.json`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

  logger.info(`[BACKUP] ${users.length} wallets backed up → ${filepath}`);
  return filepath;
}

/**
 * Restore/verify a backup file (read-only, does not overwrite DB)
 * @param {string} filepath - Path to backup file
 * @param {string} backupPassphrase - Passphrase used to decrypt
 * @returns {object} Decrypted payload
 */
function readBackup(filepath, backupPassphrase) {
  const raw = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  if (raw.format !== 'betly-wallet-backup-v1') {
    throw new Error('Format de backup non reconnu');
  }

  const salt = Buffer.from(raw.salt, 'hex');
  const key = crypto.scryptSync(backupPassphrase, salt, 32);
  const iv = Buffer.from(raw.iv, 'hex');
  const tag = Buffer.from(raw.tag, 'hex');
  const data = Buffer.from(raw.data, 'hex');

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = decipher.update(data).toString('utf8') + decipher.final('utf8');

  return JSON.parse(decrypted);
}

module.exports = { createBackup, readBackup };
