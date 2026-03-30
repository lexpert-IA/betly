/**
 * custodialWallet.js — Wallets custodial ethers.js pour Betly
 * Clé privée chiffrée AES-256-GCM, jamais exposée.
 */

const { ethers } = require('ethers');
const crypto    = require('crypto');
const config    = require('../../config');
const logger    = require('../utils/logger');

const ALGO = 'aes-256-gcm';

function _getEncKey() {
  const k = config.walletEncryptionKey;
  if (!k || k.length !== 64) {
    throw new Error('WALLET_ENCRYPTION_KEY invalide — requis : 32 octets hex (64 caractères)');
  }
  return Buffer.from(k, 'hex');
}

function encryptPrivateKey(privateKey) {
  const key    = _getEncKey();
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc    = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

function decryptPrivateKey(encrypted) {
  const key     = _getEncKey();
  const [ivHex, tagHex, dataHex] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(dataHex, 'hex')).toString('utf8') + decipher.final('utf8');
}

async function createWallet() {
  const wallet    = ethers.Wallet.createRandom();
  const encrypted = encryptPrivateKey(wallet.privateKey);
  logger.info(`[WALLET] Nouveau wallet custodial Betly créé : ${wallet.address}`);
  return {
    walletAddress:       wallet.address,
    encryptedPrivateKey: encrypted,
  };
}

module.exports = { createWallet, encryptPrivateKey, decryptPrivateKey };
