/**
 * CPMM (Constant Product Market Maker) for binary prediction markets.
 *
 * State: poolYes (y), poolNo (n)
 * Invariant: K = y × n (constant across trades)
 * Price YES = n / (y + n), Price NO = y / (y + n)
 *
 * Each YES share pays $1 if YES wins. Each NO share pays $1 if NO wins.
 * Payout is GUARANTEED at trade time, not at resolution.
 */

const EPSILON = 1e-10;

function getPriceYes(y, n) {
  const total = y + n;
  if (total <= 0) return 0.5;
  return n / total;
}

function getPriceNo(y, n) {
  return 1 - getPriceYes(y, n);
}

/**
 * Buy shares on a side.
 * @param {number} y - current poolYes
 * @param {number} n - current poolNo
 * @param {'YES'|'NO'} side
 * @param {number} amount - USDC to spend (before fee)
 * @param {number} feePct - fee as decimal (e.g. 0.03 = 3%)
 * @returns {{ shares, newY, newN, fee, avgPrice, newPrice }}
 */
function buyShares(y, n, side, amount, feePct = 0.03) {
  if (amount <= 0) throw new Error('Amount must be positive');
  if (y <= 0 || n <= 0) throw new Error('Pool is empty');

  const fee = amount * feePct;
  const net = amount - fee;
  if (net <= 0) throw new Error('Amount too small after fee');

  const K = y * n;
  let shares, newY, newN;

  if (side === 'YES') {
    // shares = net × (y + n + net) / (n + net)
    shares = net * (y + n + net) / (n + net);
    newY = y + net - shares;
    newN = n + net;
  } else {
    shares = net * (y + n + net) / (y + net);
    newY = y + net;
    newN = n + net - shares;
  }

  // Clamp pools to avoid numerical drift
  if (newY < EPSILON) newY = EPSILON;
  if (newN < EPSILON) newN = EPSILON;

  const avgPrice = net / shares;
  const newPrice = side === 'YES' ? getPriceYes(newY, newN) : getPriceNo(newY, newN);

  return { shares, newY, newN, fee, avgPrice, newPrice };
}

/**
 * Get a quote (simulate buy without mutating state).
 */
function getQuote(y, n, side, amount, feePct = 0.03) {
  const currentPrice = side === 'YES' ? getPriceYes(y, n) : getPriceNo(y, n);

  if (amount <= 0) {
    return {
      shares: 0, avgPrice: currentPrice, newPrice: currentPrice,
      fee: 0, potentialPayout: 0, netProfit: 0, slippage: 0,
    };
  }

  const result = buyShares(y, n, side, amount, feePct);
  const slippage = currentPrice > 0
    ? Math.abs(result.avgPrice - currentPrice) / currentPrice * 100
    : 0;

  return {
    shares: result.shares,
    avgPrice: result.avgPrice,
    newPrice: result.newPrice,
    fee: result.fee,
    potentialPayout: result.shares, // 1 share = $1 if wins
    netProfit: result.shares - amount,
    slippage,
    currentPrice,
  };
}

/**
 * Sell shares back to the AMM.
 * Selling N shares of YES = buying N shares of NO and returning the cost.
 */
function sellShares(y, n, side, sharesToSell, feePct = 0.03) {
  if (sharesToSell <= 0) throw new Error('Shares must be positive');

  // How much does the AMM pay for sharesToSell?
  // Selling YES shares: remove shares from user, add back to pool
  // This is the inverse: find amount such that buyShares(opposite, amount) = sharesToSell
  // Binary search for simplicity
  let lo = 0, hi = sharesToSell * 2, mid;
  const opposite = side === 'YES' ? 'NO' : 'YES';

  for (let i = 0; i < 100; i++) {
    mid = (lo + hi) / 2;
    try {
      const res = buyShares(y, n, opposite, mid, 0); // no fee on internal calc
      if (Math.abs(res.shares - sharesToSell) < 0.0001) break;
      if (res.shares < sharesToSell) lo = mid;
      else hi = mid;
    } catch {
      hi = mid;
    }
  }

  const grossPayout = mid;
  const fee = grossPayout * feePct;
  const netPayout = grossPayout - fee;

  // Actually execute the sell (add shares back, remove cash equivalent)
  let newY, newN;
  if (side === 'YES') {
    // Adding YES shares back to pool, removing NO shares
    const res = buyShares(y, n, 'NO', grossPayout, 0);
    newY = res.newY;
    newN = res.newN;
  } else {
    const res = buyShares(y, n, 'YES', grossPayout, 0);
    newY = res.newY;
    newN = res.newN;
  }

  return { payout: netPayout, fee, newY, newN };
}

/**
 * Create initial pool for a market.
 * @param {number} totalSeed - total virtual shares (e.g. 40)
 * @param {number} initialProbYes - initial YES probability (0-1, e.g. 0.5)
 * @returns {{ poolYes, poolNo, poolK }}
 */
function createPool(totalSeed = 40, initialProbYes = 0.5) {
  const prob = Math.max(0.01, Math.min(0.99, initialProbYes));
  const poolYes = totalSeed * (1 - prob);
  const poolNo = totalSeed * prob;
  return {
    poolYes,
    poolNo,
    poolK: poolYes * poolNo,
  };
}

module.exports = {
  getPriceYes,
  getPriceNo,
  buyShares,
  sellShares,
  getQuote,
  createPool,
};
