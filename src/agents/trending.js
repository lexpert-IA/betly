/**
 * Trending Score Calculator
 * Runs every 15 minutes, updates trendingScore on all active markets.
 *
 * score = (volume_24h × 0.4)
 *       + (growth_rate  × 0.3)   ← bets in last 1h × 24 (extrapolated daily rate)
 *       + (comments_24h × 0.2)
 *       + (new_bettors  × 0.1)
 */

const Market  = require('../../db/models/Market');
const Bet     = require('../../db/models/Bet');
const Comment = require('../../db/models/Comment');
const logger  = require('../utils/logger');

const INTERVAL_MS = 15 * 60 * 1000; // 15 min

async function computeTrendingScores() {
  try {
    const now  = Date.now();
    const h24  = new Date(now - 24 * 60 * 60 * 1000);
    const h1   = new Date(now - 60 * 60 * 1000);

    const markets = await Market.find({ status: 'active' }).select('_id').lean();
    if (markets.length === 0) return;

    const marketIds = markets.map(m => m._id);

    // ── Aggregations in parallel ──────────────────────────────────────────────

    // 1. volume_24h per market (sum of bet amounts in last 24h)
    const vol24Agg = await Bet.aggregate([
      { $match: { marketId: { $in: marketIds }, placedAt: { $gte: h24 } } },
      { $group: { _id: '$marketId', volume: { $sum: '$amount' } } },
    ]);
    const vol24 = {};
    vol24Agg.forEach(r => { vol24[r._id.toString()] = r.volume; });

    // 2. growth_rate = bets count in last 1h × 24
    const growth1hAgg = await Bet.aggregate([
      { $match: { marketId: { $in: marketIds }, placedAt: { $gte: h1 } } },
      { $group: { _id: '$marketId', count: { $sum: 1 } } },
    ]);
    const growth = {};
    growth1hAgg.forEach(r => { growth[r._id.toString()] = r.count * 24; });

    // 3. comments_24h per market
    const comments24Agg = await Comment.aggregate([
      { $match: { marketId: { $in: marketIds.map(id => id.toString()) }, createdAt: { $gte: h24 } } },
      { $group: { _id: '$marketId', count: { $sum: 1 } } },
    ]);
    const comments24 = {};
    comments24Agg.forEach(r => { comments24[r._id.toString()] = r.count; });

    // 4. new_bettors = distinct users in last 24h
    const bettors24Agg = await Bet.aggregate([
      { $match: { marketId: { $in: marketIds }, placedAt: { $gte: h24 } } },
      { $group: { _id: '$marketId', users: { $addToSet: '$userId' } } },
      { $project: { count: { $size: '$users' } } },
    ]);
    const bettors24 = {};
    bettors24Agg.forEach(r => { bettors24[r._id.toString()] = r.count; });

    // ── Compute and bulk-write scores ─────────────────────────────────────────
    const bulkOps = markets.map(m => {
      const id  = m._id.toString();
      const v   = vol24[id]     || 0;
      const g   = growth[id]    || 0;
      const c   = comments24[id]|| 0;
      const b   = bettors24[id] || 0;

      const score = (v * 0.4) + (g * 0.3) + (c * 0.2) + (b * 0.1);
      const rounded = Math.round(score * 100) / 100;

      return {
        updateOne: {
          filter: { _id: m._id },
          update: { $set: { trendingScore: rounded } },
        },
      };
    });

    await Market.bulkWrite(bulkOps);
    logger.info(`Trending scores updated for ${markets.length} active markets`);
  } catch (err) {
    logger.error(`Trending score error: ${err.message}`);
  }
}

function startTrending() {
  // Run immediately on boot, then every 15 min
  computeTrendingScores();
  setInterval(computeTrendingScores, INTERVAL_MS);
  logger.info('Trending score calculator started (15min interval)');
}

module.exports = { startTrending, computeTrendingScores };
