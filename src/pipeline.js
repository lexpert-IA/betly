/**
 * BETLY Auto-Pipeline Orchestrator
 * Connects all 4 modules: Trend Detector → NATHAN → Publisher → Distribution
 *
 * Runs every 15 minutes. Target: < 3 minutes per full cycle.
 *
 * Flow:
 *   1. trendDetector.detectTrends()     → scored trends from Twitter, Reddit, Google
 *   2. marketGenerator.generateFromTrends() → NATHAN generates 1-3 markets per trend
 *   3. autoPublisher.publishAll()        → moderation + MongoDB insert + notifications
 *   4. distribution.distributeAll()      → Twitter (Postiz), Reddit, Telegram
 */

const { detectTrends }       = require('./agents/trendDetector');
const { generateFromTrends } = require('./agents/marketGenerator');
const { publishAll }         = require('./agents/autoPublisher');
const { distributeAll }      = require('./agents/distribution');
const { startWithdrawalProcessor, stopWithdrawalProcessor } = require('./wallet/withdrawalProcessor');
const logger                 = require('./utils/logger');

const PIPELINE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_MARKETS_PER_CYCLE = 5; // safety cap

let _running = false;
let _timer = null;
let _stats = {
  lastRun: null,
  lastDurationMs: 0,
  totalRuns: 0,
  totalMarketsCreated: 0,
  totalDistributed: 0,
  errors: 0,
};

async function runPipeline() {
  if (_running) {
    logger.warn('pipeline: already running — skipping');
    return;
  }

  _running = true;
  const start = Date.now();
  logger.info('═══════════════════════════════════════════════════');
  logger.info('pipeline: cycle started');

  try {
    // ── Module 1: Trend Detection ─────────────────────────────────────────
    const trends = await detectTrends();
    if (trends.length === 0) {
      logger.info('pipeline: no qualifying trends — cycle complete');
      _stats.lastRun = new Date();
      _stats.totalRuns++;
      return;
    }

    // ── Module 2: Market Generation (NATHAN) ──────────────────────────────
    const generatedMarkets = await generateFromTrends(trends);
    if (generatedMarkets.length === 0) {
      logger.info('pipeline: NATHAN generated 0 markets — cycle complete');
      _stats.lastRun = new Date();
      _stats.totalRuns++;
      return;
    }

    // Safety cap
    const capped = generatedMarkets.slice(0, MAX_MARKETS_PER_CYCLE);
    if (generatedMarkets.length > MAX_MARKETS_PER_CYCLE) {
      logger.info(`pipeline: capped from ${generatedMarkets.length} to ${MAX_MARKETS_PER_CYCLE} markets`);
    }

    // ── Module 3: Auto-Publish ────────────────────────────────────────────
    const published = await publishAll(capped);

    // ── Module 4: Distribution ────────────────────────────────────────────
    let distResults = [];
    if (published.length > 0) {
      distResults = await distributeAll(published);
    }

    // ── Stats ─────────────────────────────────────────────────────────────
    const duration = Date.now() - start;
    _stats.lastRun = new Date();
    _stats.lastDurationMs = duration;
    _stats.totalRuns++;
    _stats.totalMarketsCreated += published.length;
    _stats.totalDistributed += distResults.length;

    logger.info(`pipeline: cycle complete in ${(duration / 1000).toFixed(1)}s — ${trends.length} trends → ${generatedMarkets.length} generated → ${published.length} published → ${distResults.length} distributed`);
  } catch (err) {
    _stats.errors++;
    logger.error(`pipeline: fatal error — ${err.message}`);
    logger.error(err.stack);
  } finally {
    _running = false;
    logger.info('═══════════════════════════════════════════════════');
  }
}

function startPipeline() {
  if (_timer) {
    logger.warn('pipeline: already started');
    return;
  }

  logger.info('pipeline: starting auto-pipeline (15min interval)');
  logger.info('pipeline: modules — trendDetector → NATHAN → autoPublisher → distribution');

  // First run after 30s delay (let MongoDB connect first)
  setTimeout(() => {
    runPipeline();
    _timer = setInterval(runPipeline, PIPELINE_INTERVAL_MS);
  }, 30_000);
}

function stopPipeline() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
    logger.info('pipeline: stopped');
  }
}

function getPipelineStats() {
  return { ..._stats, running: _running };
}

// ── Hourly Market Snapshot Job ────────────────────────────────────────────────
async function runSnapshotJob() {
  try {
    const Market          = require('../db/models/Market');
    const MarketSnapshot  = require('../db/models/MarketSnapshot');

    const markets = await Market.find({ status: 'active' })
      .select('_id totalYes totalNo')
      .lean();

    const docs = markets.map(m => {
      const total  = (m.totalYes || 0) + (m.totalNo || 0);
      const pYes   = total > 0 ? Math.round((m.totalYes / total) * 100) : 50;
      return {
        marketId:  m._id,
        priceYes:  pYes,
        priceNo:   100 - pYes,
        volume:    total,
        timestamp: new Date(),
      };
    });

    if (docs.length > 0) {
      await MarketSnapshot.insertMany(docs, { ordered: false });
      logger.info(`snapshot: saved ${docs.length} snapshots`);
    }

    // Prune old snapshots (keep last 720 per market = 30 days)
    const cutoff = new Date(Date.now() - 30 * 24 * 3600_000);
    await MarketSnapshot.deleteMany({ timestamp: { $lt: cutoff } });
  } catch (err) {
    logger.error(`snapshot job error: ${err.message}`);
  }
}

let _snapshotTimer = null;

function startSnapshotJob() {
  if (_snapshotTimer) return;
  logger.info('snapshot: starting hourly job');
  setTimeout(() => {
    runSnapshotJob();
    _snapshotTimer = setInterval(runSnapshotJob, 60 * 60 * 1000);
  }, 60_000); // start after 1 min
}

module.exports = {
  startPipeline, stopPipeline, runPipeline, getPipelineStats,
  startSnapshotJob,
  startWithdrawalProcessor, stopWithdrawalProcessor,
};
