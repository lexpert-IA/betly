const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const config = require('./config');
const logger = require('./src/utils/logger');
const apiRouter = require('./src/api/router');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ── MongoDB lazy connection (cached across warm lambda invocations) ─────────
let dbState = 'disconnected';

async function ensureMongo() {
  if (dbState === 'connected') return true;
  if (dbState === 'connecting') return false;
  if (!config.db.uri) {
    logger.warn('MONGODB_URI non défini — mode mock uniquement');
    dbState = 'failed';
    return false;
  }
  dbState = 'connecting';
  try {
    await mongoose.connect(config.db.uri, {
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 5_000,
    });
    dbState = 'connected';
    logger.info('MongoDB connecté');
    return true;
  } catch (err) {
    dbState = 'failed';
    logger.error(`MongoDB erreur: ${err.message}`);
    return false;
  }
}

// ── API routes ───────────────────────────────────────────────────────────────
app.use('/api', async (req, res, next) => {
  await ensureMongo();
  next();
});
app.use('/api', apiRouter);

// ── Serve React frontend (built by Vite into web/dist/) ──────────────────────
const DIST = path.join(__dirname, 'web', 'dist');
app.use(express.static(DIST));
// SPA fallback — all non-API routes → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// ── Export for Vercel serverless ─────────────────────────────────────────────
module.exports = app;

// ── Local dev server ──────────────────────────────────────────────────────────
if (require.main === module) {
  ensureMongo().then(() => {
    app.listen(config.port, () => {
      logger.info(`API BETLY démarrée sur le port ${config.port}`);
    });
    const { startResolver } = require('./src/agents/resolver');
    startResolver();
  });
}
