const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// ── Firebase Auth handler proxy (same-domain auth to avoid 3rd-party cookie issues) ──
const https = require('https');
app.get('/__/auth/*', (req, res) => {
  const fbUrl = `https://betly-1a8e6.firebaseapp.com${req.originalUrl}`;
  https.get(fbUrl, (fbRes) => {
    res.status(fbRes.statusCode);
    Object.entries(fbRes.headers).forEach(([k, v]) => {
      if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
        res.setHeader(k, v);
      }
    });
    fbRes.pipe(res);
  }).on('error', (err) => {
    logger.error(`Firebase auth proxy error: ${err.message}`);
    res.status(502).send('Auth proxy error');
  });
});

// ── Serve React frontend (built by Vite into web/dist/) ──────────────────────
const DIST = path.join(__dirname, 'web', 'dist');
app.use(express.static(DIST));

// ── OpenGraph injection for /market/:id ──────────────────────────────────────
const SITE_URL = 'https://betly-clean.vercel.app';

function getMockById(id) {
  const now = new Date();
  const day = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const mocks = [
    { _id: 'mock-1', title: 'Le Bitcoin dépassera 150 000$ avant le 1er juin 2026 ?', totalYes: 2840, totalNo: 1120, resolutionDate: day(66), category: 'crypto' },
    { _id: 'mock-2', title: "L'équipe de France gagnera l'Euro 2026 ?", totalYes: 1950, totalNo: 2100, resolutionDate: day(95), category: 'sport' },
    { _id: 'mock-3', title: 'ChatGPT-5 sera lancé avant fin 2026 ?', totalYes: 3100, totalNo: 890, resolutionDate: day(280), category: 'autre' },
    { _id: 'mock-4', title: 'Emmanuel Macron finira son mandat présidentiel ?', totalYes: 1200, totalNo: 650, resolutionDate: day(390), category: 'politique' },
    { _id: 'mock-5', title: 'Severance saison 3 sera annoncée en 2026 ?', totalYes: 780, totalNo: 420, resolutionDate: day(275), category: 'culture' },
    { _id: 'mock-6', title: "Le ratio ETH/BTC dépassera 0.08 en 2026 ?", totalYes: 560, totalNo: 1340, resolutionDate: day(280), category: 'crypto' },
  ];
  return mocks.find(m => m._id === id) || null;
}

app.get('/market/:id', async (req, res) => {
  const { id } = req.params;
  let title  = 'Marché de prédiction — BETLY';
  let desc   = 'Parie sur l\'issue de cet événement sur BETLY. Paris communautaires, oracle IA.';
  let yesPct = 50;
  let volume = 0;

  try {
    await ensureMongo();
    let market = null;
    if (id.startsWith('mock-')) {
      market = getMockById(id);
    } else {
      const Market = require('./db/models/Market');
      market = await Market.findById(id).lean();
    }
    if (market) {
      title  = `${market.title} — BETLY`;
      const total = (market.totalYes || 0) + (market.totalNo || 0);
      yesPct = total > 0 ? Math.round((market.totalYes / total) * 100) : 50;
      volume = total;
      const msLeft = market.resolutionDate ? new Date(market.resolutionDate) - Date.now() : 0;
      const daysLeft = msLeft > 0 ? Math.ceil(msLeft / 86400000) : 0;
      const expire = daysLeft > 0 ? `Expire dans ${daysLeft}j` : 'Terminé';
      desc = `OUI ${yesPct}% · Volume $${volume.toLocaleString('fr-FR')} · ${expire}`;
    }
  } catch (e) {
    logger.warn(`OG fetch error for market ${id}: ${e.message}`);
  }

  const pageUrl = `${SITE_URL}/market/${id}`;
  const ogTags = `
    <meta property="og:type"        content="website" />
    <meta property="og:url"         content="${pageUrl}" />
    <meta property="og:title"       content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />
    <meta property="og:site_name"   content="BETLY" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}" />
    <meta name="description"         content="${desc.replace(/"/g, '&quot;')}" />`;

  try {
    let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    html = html.replace('<head>', `<head>${ogTags}`);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch {
    res.sendFile(path.join(DIST, 'index.html'));
  }
});

// ── OpenGraph injection for /share/:betId ─────────────────────────────────────
app.get('/share/:betId', async (req, res) => {
  const { betId } = req.params;
  let title = 'Un pari sur BETLY — Marchés de prédiction';
  let desc  = 'Rejoins BETLY et parie sur les événements du moment.';

  try {
    await ensureMongo();
    const Bet    = require('./db/models/Bet');
    const Market = require('./db/models/Market');
    const User   = require('./db/models/User');

    const bet = await Bet.findById(betId).lean();
    if (bet) {
      const market = await Market.findById(bet.marketId).lean();
      const bettor = await User.findOne({ userId: bet.userId }).select('username').lean();
      if (market) {
        const side   = bet.side === 'YES' ? 'OUI' : 'NON';
        const pseudo = bettor?.username || 'Quelqu\'un';
        const gain   = bet.payout && bet.amount ? Math.round(((bet.payout - bet.amount) / bet.amount) * 100) : null;
        title = `${pseudo} parie ${side} sur "${market.title.slice(0, 50)}" — BETLY`;
        desc  = `Mise : ${bet.amount} USDC${gain ? ` · Gain potentiel : +${gain}%` : ''} · Rejoins BETLY et parie toi aussi !`;
      }
    }
  } catch (e) {
    logger.warn(`OG share fetch error for bet ${betId}: ${e.message}`);
  }

  const pageUrl = `${SITE_URL}/share/${betId}`;
  const ogTags  = `
    <meta property="og:type"        content="website" />
    <meta property="og:url"         content="${pageUrl}" />
    <meta property="og:title"       content="${title.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />
    <meta property="og:site_name"   content="BETLY" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${title.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}" />
    <meta name="description"         content="${desc.replace(/"/g, '&quot;')}" />`;

  try {
    let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    html = html.replace('<head>', `<head>${ogTags}`);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch {
    res.sendFile(path.join(DIST, 'index.html'));
  }
});

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
    const { startTrending } = require('./src/agents/trending');
    const { startPipeline, startSnapshotJob, startWithdrawalProcessor } = require('./src/pipeline');
    const { startShareBotAgent } = require('./src/agents/shareBotAgent');
    const _Market = require('./db/models/Market');
    const _Bet    = require('./db/models/Bet');
    const { startCopier } = require('./src/agents/copier');
    startResolver();
    startTrending();
    startPipeline();
    startSnapshotJob();
    startWithdrawalProcessor();
    startShareBotAgent(_Market, _Bet);
    startCopier();
  });
}
