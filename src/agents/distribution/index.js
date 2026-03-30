/**
 * Module 4 — Distribution Orchestrator
 * Routes published markets to all active distribution channels.
 */

const twitterAgent  = require('./twitterAgent');
const redditAgent   = require('./redditAgent');
const telegramAgent = require('./telegramAgent');
const logger        = require('../../utils/logger');

const CHANNELS = [
  { name: 'twitter',  agent: twitterAgent },
  { name: 'reddit',   agent: redditAgent },
  { name: 'telegram', agent: telegramAgent },
];

/**
 * Distribute a single market to all channels
 * @param {Object} market — MongoDB Market document
 * @returns {Object} — { channel: boolean } results
 */
async function distributeMarket(market) {
  const results = {};

  const promises = CHANNELS.map(async ({ name, agent }) => {
    try {
      results[name] = await agent.distribute(market);
    } catch (err) {
      logger.warn(`distribution: ${name} error for market ${market._id} — ${err.message}`);
      results[name] = false;
    }
  });

  await Promise.allSettled(promises);

  const successCount = Object.values(results).filter(Boolean).length;
  logger.info(`distribution: market ${market._id} → ${successCount}/${CHANNELS.length} channels`);

  return results;
}

/**
 * Distribute a batch of markets
 * @param {Array} markets — array of MongoDB Market documents
 * @returns {Array} — distribution results per market
 */
async function distributeAll(markets) {
  const allResults = [];

  for (const market of markets) {
    // Only distribute active markets
    if (market.status !== 'active') {
      logger.debug(`distribution: skipping market ${market._id} (status: ${market.status})`);
      continue;
    }

    const result = await distributeMarket(market);
    allResults.push({ marketId: market._id, ...result });

    // Small delay between markets to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  return allResults;
}

module.exports = { distributeMarket, distributeAll };
