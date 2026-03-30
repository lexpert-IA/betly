/**
 * withdrawalProcessor.js — Background job that processes pending withdrawals
 *
 * Flow:
 *   1. Find all Withdrawal docs with status = 'pending'
 *   2. For each: decrypt user's private key → sign USDC transfer → broadcast
 *   3. Update status to 'completed' or 'failed'
 *   4. Notify user
 *
 * Runs every 60 seconds when started.
 */

const { ethers } = require('ethers');
const config     = require('../../config');
const logger     = require('../utils/logger');
const { decryptPrivateKey } = require('./custodialWallet');

const Withdrawal = require('../../db/models/Withdrawal');
const User       = require('../../db/models/User');

// Minimal ERC-20 ABI for transfer
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
];

const USDC_DECIMALS = 6;
const PROCESS_INTERVAL_MS = 60_000; // 1 minute
const MAX_PER_BATCH = 5;            // max withdrawals per cycle
const MAX_RETRIES = 3;

let _timer = null;
let _processing = false;

/**
 * Get an ethers provider for Polygon
 */
function getProvider() {
  return new ethers.JsonRpcProvider(config.polygon.rpcUrl, {
    name: 'polygon',
    chainId: config.polygon.chainId,
  });
}

/**
 * Get a signer from encrypted private key
 */
function getSigner(encryptedKey, provider) {
  const privateKey = decryptPrivateKey(encryptedKey);
  return new ethers.Wallet(privateKey, provider);
}

/**
 * Determine which USDC contract the user holds (native or bridged)
 */
async function detectUsdcContract(walletAddress, provider) {
  const native = new ethers.Contract(config.polygon.usdcAddress, ERC20_ABI, provider);
  const bridged = new ethers.Contract(config.polygon.usdcBridged, ERC20_ABI, provider);

  const [balNative, balBridged] = await Promise.all([
    native.balanceOf(walletAddress).catch(() => 0n),
    bridged.balanceOf(walletAddress).catch(() => 0n),
  ]);

  // Use whichever has a higher balance; prefer native if equal
  if (balBridged > balNative) {
    return { contract: bridged, address: config.polygon.usdcBridged, balance: balBridged, label: 'USDC.e' };
  }
  return { contract: native, address: config.polygon.usdcAddress, balance: balNative, label: 'USDC' };
}

/**
 * Process a single withdrawal
 */
async function processOne(withdrawal) {
  const startMs = Date.now();
  const { _id, userId, toAddress, amount } = withdrawal;

  logger.info(`[WITHDRAW] Processing #${_id} — ${amount} USDC → ${toAddress}`);

  // Mark as processing
  withdrawal.status = 'processing';
  await withdrawal.save();

  try {
    // 1. Find user + encrypted key
    const user = await User.findOne({ $or: [{ uniqueId: userId }, { visitorId: userId }] });
    if (!user || !user.encryptedPrivateKey) {
      throw new Error('Wallet custodial introuvable pour cet utilisateur');
    }

    // 2. Init provider + signer
    const provider = getProvider();
    const signer = getSigner(user.encryptedPrivateKey, provider);

    // Verify signer address matches user
    if (signer.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
      throw new Error('Clé privée décryptée ne correspond pas à l\'adresse wallet');
    }

    // 3. Detect USDC contract and check balance
    const usdc = await detectUsdcContract(user.walletAddress, provider);
    const amountWei = ethers.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

    if (usdc.balance < amountWei) {
      throw new Error(
        `Solde on-chain insuffisant: ${ethers.formatUnits(usdc.balance, USDC_DECIMALS)} ${usdc.label} ` +
        `< ${amount} USDC demandé`
      );
    }

    // 4. Check MATIC for gas
    const maticBalance = await provider.getBalance(user.walletAddress);
    if (maticBalance < ethers.parseEther('0.005')) {
      throw new Error(
        `Pas assez de MATIC pour le gas: ${ethers.formatEther(maticBalance)} MATIC. ` +
        `Minimum ~0.005 MATIC requis.`
      );
    }

    // 5. Sign and send USDC transfer
    const usdcWithSigner = usdc.contract.connect(signer);
    const tx = await usdcWithSigner.transfer(toAddress, amountWei);
    logger.info(`[WITHDRAW] #${_id} tx sent: ${tx.hash}`);

    // 6. Wait for confirmation (2 blocks)
    const receipt = await tx.wait(2);
    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction échouée on-chain: ${tx.hash}`);
    }

    // 7. Success — update withdrawal
    withdrawal.status = 'completed';
    withdrawal.txHash = tx.hash;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    // 8. Debit user balance (was already locked)
    user.balance = Math.max(0, (user.balance || 0) - amount);
    user.lockedBalance = Math.max(0, (user.lockedBalance || 0) - amount);
    await user.save();

    // 9. Notify user
    const Notification = require('../../db/models/Notification');
    await Notification.create({
      userId,
      type: 'withdrawal_completed',
      message: `✅ Retrait de ${amount.toFixed(2)} USDC envoyé ! Tx: ${tx.hash.slice(0, 10)}…`,
      amount,
      link: `https://polygonscan.com/tx/${tx.hash}`,
    });

    const durationMs = Date.now() - startMs;
    logger.info(`[WITHDRAW] #${_id} completed in ${(durationMs / 1000).toFixed(1)}s — tx: ${tx.hash}`);
    return { success: true, txHash: tx.hash };

  } catch (err) {
    logger.error(`[WITHDRAW] #${_id} failed: ${err.message}`);

    // Increment retry or mark failed
    const retries = (withdrawal.retries || 0) + 1;
    if (retries >= MAX_RETRIES) {
      withdrawal.status = 'failed';
      withdrawal.failReason = err.message;
      withdrawal.processedAt = new Date();
      await withdrawal.save();

      // Unlock user's balance since withdrawal failed
      const user = await User.findOne({ $or: [{ uniqueId: userId }, { visitorId: userId }] });
      if (user) {
        user.lockedBalance = Math.max(0, (user.lockedBalance || 0) - amount);
        await user.save();
      }

      // Notify failure
      const Notification = require('../../db/models/Notification');
      await Notification.create({
        userId,
        type: 'withdrawal_failed',
        message: `❌ Retrait de ${amount.toFixed(2)} USDC échoué: ${err.message.slice(0, 80)}. Tes fonds sont de nouveau disponibles.`,
        amount,
      });
    } else {
      // Back to pending for retry
      withdrawal.status = 'pending';
      withdrawal.retries = retries;
      await withdrawal.save();
      logger.info(`[WITHDRAW] #${_id} queued for retry (${retries}/${MAX_RETRIES})`);
    }

    return { success: false, error: err.message };
  }
}

/**
 * Process all pending withdrawals (batch)
 */
async function processPendingWithdrawals() {
  if (_processing) {
    logger.debug('[WITHDRAW] Already processing — skip');
    return;
  }

  _processing = true;
  try {
    const pending = await Withdrawal.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(MAX_PER_BATCH)
      .exec();

    if (pending.length === 0) return;

    logger.info(`[WITHDRAW] Processing ${pending.length} pending withdrawal(s)`);

    const results = [];
    for (const w of pending) {
      const result = await processOne(w);
      results.push(result);
    }

    const ok = results.filter(r => r.success).length;
    const fail = results.length - ok;
    logger.info(`[WITHDRAW] Batch done: ${ok} completed, ${fail} failed/retrying`);
  } catch (err) {
    logger.error(`[WITHDRAW] Batch error: ${err.message}`);
  } finally {
    _processing = false;
  }
}

/**
 * Start the withdrawal processor background job
 */
function startWithdrawalProcessor() {
  if (_timer) {
    logger.warn('[WITHDRAW] Processor already running');
    return;
  }
  logger.info('[WITHDRAW] Starting withdrawal processor (60s interval)');
  // First run after 15s
  setTimeout(() => {
    processPendingWithdrawals();
    _timer = setInterval(processPendingWithdrawals, PROCESS_INTERVAL_MS);
  }, 15_000);
}

/**
 * Stop the withdrawal processor
 */
function stopWithdrawalProcessor() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    logger.info('[WITHDRAW] Processor stopped');
  }
}

module.exports = {
  startWithdrawalProcessor,
  stopWithdrawalProcessor,
  processPendingWithdrawals,
  processOne,
};
