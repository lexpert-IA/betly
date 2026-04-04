/**
 * copier.js — Auto-copy agent for Betly.
 *
 * Polls Polyfrench /api/alerts every POLL_INTERVAL ms.
 * For each new whale trade detected, finds all Betly users who follow that
 * wallet with copyEnabled + mode 'auto', and executes a copy trade.
 */

const axios      = require('axios');
const logger     = require('../utils/logger');
const CopyConfig = require('../../db/models/CopyConfig');
const CopyTrade  = require('../../db/models/CopyTrade');
const User       = require('../../db/models/User');
const Notification = require('../../db/models/Notification');

const POLYFRENCH_URL = process.env.POLYFRENCH_API_URL || 'http://localhost:3000';
const POLL_INTERVAL  = 8_000;   // 8 seconds
const COPY_FEE_PCT   = 0.005;   // 0.5%
const MIN_AMOUNT     = 0.50;    // minimum trade size

// In-memory deduplication — alert IDs we've already processed
const _processed = new Set();
const PRUNE_AFTER = 60 * 60 * 1000; // 1 hour
let _lastPrune = Date.now();

function _prune() {
  if (Date.now() - _lastPrune < PRUNE_AFTER) return;
  _processed.clear();
  _lastPrune = Date.now();
  logger.debug('[COPIER] Pruned processed alert cache');
}

// ── Daily loss reset helper ──────────────────────────────────────────────────

function checkDailyReset(cfg) {
  if (!cfg.dailyLossResetAt) return;
  const now   = new Date();
  const reset = new Date(cfg.dailyLossResetAt);
  if (now.toDateString() !== reset.toDateString()) {
    cfg.dailyLoss        = 0;
    cfg.dailyLossResetAt = now;
  }
}

// ── Execute a single copy trade ──────────────────────────────────────────────

async function executeCopy(user, cfg, alert) {
  const wallet = cfg.followedWallets.find(
    w => w.address?.toLowerCase() === alert.walletAddress?.toLowerCase() && w.active
  );
  if (!wallet) return;

  checkDailyReset(cfg);

  // Check daily loss limit
  if (cfg.dailyLoss >= cfg.dailyLossLimit) {
    logger.debug(`[COPIER] Daily limit reached for user ${user._id}`);
    return;
  }

  // Calculate amount: allocation % of balance, capped by maxPerTrade
  const allocationAmount = (user.balance || 0) * (wallet.allocation || 5) / 100;
  const effectiveAmount = Math.min(allocationAmount, cfg.maxPerTrade || 10);

  if (effectiveAmount < MIN_AMOUNT) {
    logger.debug(`[COPIER] Amount too low for user ${user._id}: ${effectiveAmount}`);
    return;
  }

  const fee = Math.round(effectiveAmount * COPY_FEE_PCT * 100) / 100;

  // Paper mode — simulate without balance change
  if (cfg.paperMode) {
    const ct = await CopyTrade.create({
      userId: user._id,
      whaleAddress: alert.walletAddress,
      marketId: alert.marketId || null,
      marketTitle: alert.question || '',
      outcome: alert.outcome || 'YES',
      price: alert.price || 0,
      amount: effectiveAmount,
      fee: 0,
      status: 'paper',
      mode: 'auto',
    });
    logger.info(`[COPIER][PAPER] User ${user._id} → ${alert.walletAddress} ${alert.outcome} ${effectiveAmount} USDC`);
    return ct;
  }

  // Real mode — check balance
  if ((user.balance || 0) < effectiveAmount) {
    logger.debug(`[COPIER] Insufficient balance for user ${user._id}`);
    return;
  }

  // Deduct balance
  await User.findByIdAndUpdate(user._id, {
    $inc: { balance: -effectiveAmount, lockedBalance: effectiveAmount },
  });

  // Update config
  cfg.dailyLoss += effectiveAmount;
  cfg.totalCopied += effectiveAmount;
  if (!cfg.dailyLossResetAt) cfg.dailyLossResetAt = new Date();
  cfg.updatedAt = new Date();
  await cfg.save();

  // Record platform fee
  try {
    const PlatformRevenue = require('../../db/models/PlatformRevenue');
    await PlatformRevenue.create({
      type: 'copy_fee',
      amount: fee,
      userId: user._id,
      meta: { whaleAddress: alert.walletAddress, marketTitle: alert.question, outcome: alert.outcome },
    });
  } catch (err) {
    logger.debug(`[COPIER] PlatformRevenue error: ${err.message}`);
  }

  const ct = await CopyTrade.create({
    userId: user._id,
    whaleAddress: alert.walletAddress,
    marketId: alert.marketId || null,
    marketTitle: alert.question || '',
    outcome: alert.outcome || 'YES',
    price: alert.price || 0,
    amount: effectiveAmount,
    fee,
    status: 'executed',
    mode: 'auto',
  });

  // Notify
  await Notification.create({
    userId: user._id.toString(),
    type: 'trade_copied',
    message: `Auto-copie : ${alert.outcome} ${effectiveAmount.toFixed(2)} USDC sur "${(alert.question || '').slice(0, 40)}"`,
    marketId: alert.marketId || null,
    amount: effectiveAmount,
  }).catch(() => {});

  logger.info(`[COPIER] Executed: user ${user._id} → ${alert.walletAddress} ${alert.outcome} ${effectiveAmount} USDC`);
  return ct;
}

// ── Main cycle ───────────────────────────────────────────────────────────────

async function runCycle() {
  try {
    _prune();

    const { data } = await axios.get(`${POLYFRENCH_URL}/api/alerts`, {
      params: { limit: 30 },
      timeout: 6000,
    });

    const alerts = data?.alerts || data || [];
    if (alerts.length === 0) return;

    let copied = 0;

    for (const alert of alerts) {
      const alertId = alert.id || alert._id || `${alert.walletAddress}-${alert.marketId}-${alert.outcome}`;
      if (_processed.has(alertId)) continue;
      _processed.add(alertId);

      // Find all users following this whale with auto mode
      const configs = await CopyConfig.find({
        'followedWallets.address': { $regex: new RegExp(`^${(alert.walletAddress || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        copyEnabled: true,
        mode: 'auto',
      });

      for (const cfg of configs) {
        try {
          const user = await User.findById(cfg.userId).lean();
          if (!user) continue;
          const result = await executeCopy(user, cfg, alert);
          if (result) copied++;
        } catch (err) {
          logger.error(`[COPIER] Error for user ${cfg.userId}: ${err.message}`);
        }
      }
    }

    if (copied > 0) {
      logger.info(`[COPIER] Cycle complete: ${copied} trade(s) copied`);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNABORTED') {
      logger.debug(`[COPIER] Polyfrench API unreachable — skipping cycle`);
    } else {
      logger.error(`[COPIER] Cycle error: ${err.message}`);
    }
  }
}

// ── Start ────────────────────────────────────────────────────────────────────

let _timer = null;

function startCopier() {
  if (_timer) return;
  logger.info('[COPIER] Agent démarré — polling toutes les 8s');
  runCycle(); // first run immediately
  _timer = setInterval(runCycle, POLL_INTERVAL);
}

function stopCopier() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startCopier, stopCopier };
