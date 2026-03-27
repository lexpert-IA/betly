const logger = require('../utils/logger');

async function resolveMarket(market) {
  logger.info(`resolver: market ${market._id} — oracle level ${market.oracleLevel}`);
  // Phase 1 stub — full implementation in Phase 3
  return null;
}

module.exports = { resolveMarket };
