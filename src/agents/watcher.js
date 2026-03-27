const logger = require('../utils/logger');

async function checkForFraud(marketId, bet) {
  // Phase 1 stub — full implementation in Phase 2
  logger.debug(`watcher: checking bet on market ${marketId}`);
  return { suspicious: false };
}

module.exports = { checkForFraud };
