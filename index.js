const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./src/utils/logger');
const apiRouter = require('./src/api/router');

async function main() {
  logger.info('BETLY démarré');

  try {
    await mongoose.connect(config.db.uri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    logger.info(`MongoDB connecté — db: betly`);
  } catch (err) {
    logger.error(`MongoDB erreur: ${err.message}`);
    process.exit(1);
  }

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', apiRouter);

  app.listen(config.port, () => {
    logger.info(`API BETLY démarrée sur le port ${config.port}`);
  });
}

main();
