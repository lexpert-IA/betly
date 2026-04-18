const logger = require('../utils/logger');

// Memoize recent bets per market to detect patterns without DB queries on every bet
const recentBets = new Map(); // marketId => [{ userId, side, amount, ip, ts }]
const WINDOW_MS  = 60_000; // look-back window: 1 minute

function record(marketId, bet) {
  const list = recentBets.get(marketId) || [];
  const now  = Date.now();
  // Keep only recent entries
  const fresh = list.filter(b => now - b.ts < WINDOW_MS);
  fresh.push({ userId: bet.userId, side: bet.side, amount: bet.amount, ip: bet.ip, ts: now });
  recentBets.set(marketId, fresh);
  return fresh;
}

/**
 * Analyse a bet for suspicious patterns.
 * Returns { suspicious: boolean, reason?: string }
 */
async function checkForFraud(marketId, bet) {
  try {
    const list = record(marketId, bet);
    const reasons = [];

    // ── Rule 1: same IP betting both sides ────────────────────────────────────
    if (bet.ip) {
      const sameIp = list.filter(b => b.ip === bet.ip);
      const sides  = new Set(sameIp.map(b => b.side));
      if (sides.size > 1) {
        reasons.push(`same_ip_both_sides:${bet.ip}`);
      }
    }

    // ── Rule 2: same user — bets < 1s apart ───────────────────────────────────
    const byUser = list.filter(b => b.userId === bet.userId);
    if (byUser.length >= 2) {
      const sorted = byUser.sort((a, b) => a.ts - b.ts);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].ts - sorted[i - 1].ts < 1000) {
          reasons.push('rapid_fire:<1s');
          break;
        }
      }
    }

    // ── Rule 3: single bet > 50% of pool ──────────────────────────────────────
    // We receive poolSize from the caller if available
    if (bet.poolSize && bet.amount > bet.poolSize * 0.5) {
      reasons.push(`pool_domination:${((bet.amount / bet.poolSize) * 100).toFixed(0)}%`);
    }

    // ── Rule 4: same userId betting both sides within window ───────────────────
    const userSides = new Set(byUser.map(b => b.side));
    if (userSides.size > 1) {
      reasons.push('user_both_sides');
    }

    if (reasons.length > 0) {
      logger.warn(`[watcher] Suspicious bet on market ${marketId} — ${reasons.join(', ')}`);
      return { suspicious: true, reasons };
    }

    return { suspicious: false };
  } catch (err) {
    logger.error(`[watcher] Error checking fraud: ${err.message}`);
    return { suspicious: false };
  }
}

module.exports = { checkForFraud };
