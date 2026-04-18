# WOLVES S1 — Fork BETLY vers plateforme Loup-Garou IA

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forker BETLY en plateforme WOLVES : serveur Express + MongoDB propre, Socket.io live, et 3 agents IA qui discutent de manière crédible en 5 tours.

**Architecture:** Fork le codebase BETLY (Express/MongoDB/Mongoose), supprimer tout ce qui est prediction markets, créer 6 nouveaux models Mongoose pour le jeu Loup-Garou, ajouter Socket.io pour le chat live, et porter la classe Agent de l'ancien wolves (ESM) vers CommonJS. Le wallet USDC et Firebase Auth restent intacts pour réutilisation ultérieure.

**Tech Stack:** Node.js (CommonJS), Express 4, MongoDB/Mongoose 8, Socket.io, @anthropic-ai/sdk, Winston logger

---

## File Structure

### Fichiers BETLY gardés tels quels (ne PAS modifier)
- `src/wallet/custodialWallet.js` — wallet USDC chiffré AES-256-GCM
- `src/wallet/walletBackup.js` — backup wallet
- `src/wallet/withdrawalProcessor.js` — processeur de retraits
- `src/utils/logger.js` — Winston logger
- `src/middleware/firebaseAuth.js` — Firebase Auth middleware
- `src/middleware/geoblock.js` — geo-blocking
- `src/lib/cpmm.js` — CPMM algorithm (gardé pour S6)
- `src/utils/circuitBreaker.js` — circuit breaker
- `src/utils/retry.js` — retry logic

### Fichiers BETLY supprimés
- `src/agents/polymarketSyncer.js`
- `src/agents/copier.js`
- `src/agents/trendDetector.js`
- `src/agents/marketGenerator.js`
- `src/agents/autoPublisher.js`
- `src/agents/postModerator.js`
- `src/agents/moderator.js`
- `src/agents/shareBotAgent.js`
- `src/agents/viralAgent.js`
- `src/agents/watcher.js`
- `src/agents/trending.js`
- `src/agents/distribution/` (tout le dossier)
- `src/pipeline.js`
- `db/models/Market.js` (remplacé par WolfMarket.js)
- `db/models/Bet.js` (remplacé par WolfBet.js)
- `db/models/Vote.js`
- `db/models/Comment.js`
- `db/models/Post.js`
- `db/models/CopyTrade.js`
- `db/models/CopyConfig.js`
- `db/models/Affiliate.js`
- `db/models/Referral.js`
- `db/models/CreatorCommission.js`
- `db/models/CreatorVerification.js`
- `db/models/KnownCreator.js`
- `db/models/Withdrawal.js` (gardé dans wallet/, supprimé comme model)
- `db/models/PlatformRevenue.js`
- `db/models/Notification.js`
- `db/models/MarketSnapshot.js`
- `db/models/AgentAccount.js`

### Fichiers créés (nouveaux)
- `db/models/Character.js` — les 24 personnages IA
- `db/models/Match.js` — une partie de Loup-Garou
- `db/models/MatchEvent.js` — log de tout ce qui se passe
- `db/models/WolfMarket.js` — marchés binaires par partie
- `db/models/WolfBet.js` — paris USDC des spectateurs
- `src/agents/agentRuntime.js` — classe Agent (porté depuis ancien wolves, CommonJS)
- `src/agents/llmRouter.js` — dispatcher LLM (Haiku only pour V1)
- `src/agents/personalities/thesee.json` — personnage test 1
- `src/agents/personalities/lyra.json` — personnage test 2
- `src/agents/personalities/orion.json` — personnage test 3
- `src/utils/socket.js` — Socket.io setup
- `src/api/router.js` — routeur API nettoyé (remplace l'existant)
- `scripts/testAgents.js` — script test 3 agents x 5 tours

### Fichiers modifiés
- `index.js` — nettoyé (plus de mocks, plus d'agents BETLY, ajout Socket.io)
- `config/index.js` — nettoyé (plus de twitter/reddit/postiz)
- `package.json` — renommé wolves, ajout socket.io, suppression deps inutiles
- `vercel.json` — suppression crons polymarket
- `db/models/User.js` — simplifié (garder auth+wallet, supprimer creator/gamification)

---

## Task 1: Copie BETLY et init git

**Files:**
- Copy: `/Users/aifactory/Downloads/betly/` → `/Users/aifactory/wolves/`
- Modify: `/Users/aifactory/wolves/package.json`
- Modify: `/Users/aifactory/wolves/.gitignore`

- [ ] **Step 1: Copier BETLY vers /Users/aifactory/wolves/**

```bash
cp -r /Users/aifactory/Downloads/betly /Users/aifactory/wolves
```

- [ ] **Step 2: Supprimer node_modules et dist pour repartir propre**

```bash
rm -rf /Users/aifactory/wolves/node_modules
rm -rf /Users/aifactory/wolves/web/node_modules
rm -rf /Users/aifactory/wolves/web/dist
rm -rf /Users/aifactory/wolves/.vercel
rm -f /Users/aifactory/wolves/package-lock.json
rm -f /Users/aifactory/wolves/web/package-lock.json
```

- [ ] **Step 3: Renommer le projet dans package.json**

Modifier `/Users/aifactory/wolves/package.json` :

```json
{
  "name": "wolves",
  "version": "0.1.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test:agents": "node scripts/testAgents.js"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.0",
    "ethers": "^6.16.0",
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "socket.io": "^4.7.0",
    "winston": "^3.11.0"
  }
}
```

Deps supprimées : `axios`, `canvas`, `crypto-js`, `geoip-lite`, `oauth-1.0a`, `resend`.

- [ ] **Step 4: Mettre à jour .gitignore**

Ajouter au `.gitignore` existant :

```
node_modules/
web/dist/
.env
.env.local
.env.vercel
.DS_Store
```

- [ ] **Step 5: Initialiser git**

```bash
cd /Users/aifactory/wolves && git init && git add -A && git commit -m "feat: fork BETLY as WOLVES baseline"
```

---

## Task 2: Supprimer les agents et fichiers BETLY spécifiques

**Files:**
- Delete: `src/agents/polymarketSyncer.js`
- Delete: `src/agents/copier.js`
- Delete: `src/agents/trendDetector.js`
- Delete: `src/agents/marketGenerator.js`
- Delete: `src/agents/autoPublisher.js`
- Delete: `src/agents/postModerator.js`
- Delete: `src/agents/moderator.js`
- Delete: `src/agents/shareBotAgent.js`
- Delete: `src/agents/viralAgent.js`
- Delete: `src/agents/watcher.js`
- Delete: `src/agents/trending.js`
- Delete: `src/agents/distribution/` (tout le dossier)
- Delete: `src/pipeline.js`

- [ ] **Step 1: Supprimer tous les agents BETLY**

```bash
cd /Users/aifactory/wolves
rm -f src/agents/polymarketSyncer.js
rm -f src/agents/copier.js
rm -f src/agents/trendDetector.js
rm -f src/agents/marketGenerator.js
rm -f src/agents/autoPublisher.js
rm -f src/agents/postModerator.js
rm -f src/agents/moderator.js
rm -f src/agents/shareBotAgent.js
rm -f src/agents/viralAgent.js
rm -f src/agents/watcher.js
rm -f src/agents/trending.js
rm -f src/agents/resolver.js
rm -rf src/agents/distribution/
rm -f src/pipeline.js
```

- [ ] **Step 2: Supprimer les models BETLY qu'on remplace**

```bash
cd /Users/aifactory/wolves
rm -f db/models/Market.js
rm -f db/models/Bet.js
rm -f db/models/Vote.js
rm -f db/models/Comment.js
rm -f db/models/Post.js
rm -f db/models/CopyTrade.js
rm -f db/models/CopyConfig.js
rm -f db/models/Affiliate.js
rm -f db/models/Referral.js
rm -f db/models/CreatorCommission.js
rm -f db/models/CreatorVerification.js
rm -f db/models/KnownCreator.js
rm -f db/models/Withdrawal.js
rm -f db/models/PlatformRevenue.js
rm -f db/models/Notification.js
rm -f db/models/MarketSnapshot.js
rm -f db/models/AgentAccount.js
```

- [ ] **Step 3: Vérifier qu'il ne reste que User.js dans db/models/**

```bash
ls /Users/aifactory/wolves/db/models/
```

Expected: `User.js` uniquement.

- [ ] **Step 4: Commit**

```bash
cd /Users/aifactory/wolves && git add -A && git commit -m "chore: remove BETLY-specific agents, models, and pipeline"
```

---

## Task 3: Nettoyer index.js (serveur principal)

**Files:**
- Modify: `/Users/aifactory/wolves/index.js`

- [ ] **Step 1: Réécrire index.js nettoyé**

Remplacer tout le contenu de `/Users/aifactory/wolves/index.js` par :

```javascript
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

// -- MongoDB lazy connection (cached across warm lambda invocations)
let dbState = 'disconnected';

async function ensureMongo() {
  if (dbState === 'connected') return true;
  if (dbState === 'connecting') return false;
  if (!config.db.uri) {
    logger.warn('MONGODB_URI non defini');
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
    logger.info('MongoDB connecte');
    return true;
  } catch (err) {
    dbState = 'failed';
    logger.error(`MongoDB erreur: ${err.message}`);
    return false;
  }
}

// -- API routes
app.use('/api', async (req, res, next) => {
  await ensureMongo();
  next();
});
app.use('/api', apiRouter);

// -- Firebase Auth handler proxy
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

// -- Serve React frontend (built by Vite into web/dist/)
const DIST = path.join(__dirname, 'web', 'dist');
app.use(express.static(DIST));

// -- SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

// -- Export for Vercel serverless
module.exports = app;

// -- Local dev server
if (require.main === module) {
  ensureMongo().then(() => {
    const http = require('http');
    const server = http.createServer(app);

    // Socket.io integration
    const { attachSocket } = require('./src/utils/socket');
    attachSocket(server);

    server.listen(config.port, () => {
      logger.info(`WOLVES API sur le port ${config.port}`);
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/aifactory/wolves && git add index.js && git commit -m "feat: clean index.js for WOLVES (remove mocks, OG injection, BETLY agents)"
```

---

## Task 4: Nettoyer config/index.js

**Files:**
- Modify: `/Users/aifactory/wolves/config/index.js`

- [ ] **Step 1: Réécrire config/index.js**

Remplacer tout le contenu de `/Users/aifactory/wolves/config/index.js` par :

```javascript
require('dotenv').config();

module.exports = {
  db: { uri: process.env.MONGODB_URI },
  walletEncryptionKey: (process.env.WALLET_ENCRYPTION_KEY || '').trim() || null,
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  // -- Polygon Mainnet (wallet USDC)
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: 137,
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    usdcBridged: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  },
};
```

- [ ] **Step 2: Créer .env.example**

Créer `/Users/aifactory/wolves/.env.example` :

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/wolves
ANTHROPIC_API_KEY=sk-ant-...
NODE_ENV=development
PORT=3001
WALLET_ENCRYPTION_KEY=
POLYGON_RPC_URL=https://polygon-rpc.com
```

- [ ] **Step 3: Commit**

```bash
cd /Users/aifactory/wolves && git add config/index.js .env.example && git commit -m "feat: clean config for WOLVES (remove twitter/reddit/postiz/telegram)"
```

---

## Task 5: Nettoyer vercel.json

**Files:**
- Modify: `/Users/aifactory/wolves/vercel.json`

- [ ] **Step 1: Réécrire vercel.json sans crons polymarket**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node",
      "config": {
        "includeFiles": [
          "web/dist/**",
          "src/**",
          "db/**",
          "config/**"
        ]
      }
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "/index.js" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/aifactory/wolves && git add vercel.json && git commit -m "chore: remove polymarket crons from vercel.json"
```

---

## Task 6: Créer les 6 models Mongoose WOLVES

**Files:**
- Create: `db/models/Character.js`
- Create: `db/models/Match.js`
- Create: `db/models/MatchEvent.js`
- Create: `db/models/WolfMarket.js`
- Create: `db/models/WolfBet.js`
- Modify: `db/models/User.js`

- [ ] **Step 1: Créer Character.js**

Créer `/Users/aifactory/wolves/db/models/Character.js` :

```javascript
const mongoose = require('mongoose');

const CharacterSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true },
  archetype:   { type: String, enum: ['manipulator', 'emotive', 'logical', 'troublemaker', 'discreet', 'leader'], required: true },
  trait:       { type: String, required: true },
  backstory:   { type: String, required: true },
  speechStyle: { type: String, required: true },
  llmModel:    { type: String, enum: ['haiku', 'flash', 'llama'], default: 'haiku' },
  portraitUrl: { type: String, default: null },

  stats: {
    gamesPlayed:      { type: Number, default: 0 },
    gamesWon:         { type: Number, default: 0 },
    timesWolf:        { type: Number, default: 0 },
    timesVillager:    { type: Number, default: 0 },
    timesEliminated:  { type: Number, default: 0 },
    avgSurvivalRound: { type: Number, default: 0 },
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Character', CharacterSchema);
```

- [ ] **Step 2: Créer Match.js**

Créer `/Users/aifactory/wolves/db/models/Match.js` :

```javascript
const mongoose = require('mongoose');

const PlayerSubSchema = new mongoose.Schema({
  characterId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Character', required: true },
  role:           { type: String, enum: ['wolf', 'villager'], required: true },
  alive:          { type: Boolean, default: true },
  eliminatedAt:   { type: Date, default: null },
  eliminatedPhase:{ type: String, default: null },
}, { _id: false });

const MatchSchema = new mongoose.Schema({
  status:       { type: String, enum: ['scheduled', 'active', 'completed'], default: 'scheduled', index: true },
  scheduledAt:  { type: Date, required: true },
  startedAt:    { type: Date, default: null },
  endedAt:      { type: Date, default: null },

  phase:        { type: String, enum: ['pre', 'day1', 'night1', 'day2', 'night2', 'day3', 'verdict'], default: 'pre' },
  phaseEndsAt:  { type: Date, default: null },

  players:      [PlayerSubSchema],
  winnerSide:   { type: String, enum: ['wolves', 'villagers'], default: null },

  spectatorCount:  { type: Number, default: 0 },
  totalBetVolume:  { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Match', MatchSchema);
```

- [ ] **Step 3: Créer MatchEvent.js**

Créer `/Users/aifactory/wolves/db/models/MatchEvent.js` :

```javascript
const mongoose = require('mongoose');

const MatchEventSchema = new mongoose.Schema({
  matchId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
  timestamp: { type: Date, default: Date.now },
  type:      { type: String, enum: ['chat', 'vote', 'elimination', 'phase_change', 'spectator_vote', 'system'], required: true },
  actorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Character', default: null },
  targetId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Character', default: null },
  content:   { type: String, default: '' },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
});

MatchEventSchema.index({ matchId: 1, timestamp: 1 });

module.exports = mongoose.model('MatchEvent', MatchEventSchema);
```

- [ ] **Step 4: Créer WolfMarket.js**

Créer `/Users/aifactory/wolves/db/models/WolfMarket.js` :

```javascript
const mongoose = require('mongoose');

const WolfMarketSchema = new mongoose.Schema({
  matchId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true, index: true },
  key:      { type: String, required: true },
  label:    { type: String, required: true },
  type:     { type: String, enum: ['main', 'identity', 'elimination', 'narrative'], default: 'main' },
  resolved: { type: Boolean, default: false },
  outcome:  { type: String, enum: ['yes', 'no'], default: null },
  totalYes: { type: Number, default: 0 },
  totalNo:  { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

WolfMarketSchema.index({ matchId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('WolfMarket', WolfMarketSchema);
```

- [ ] **Step 5: Créer WolfBet.js**

Créer `/Users/aifactory/wolves/db/models/WolfBet.js` :

```javascript
const mongoose = require('mongoose');

const WolfBetSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  matchId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
  marketKey: { type: String, required: true },
  position:  { type: String, enum: ['yes', 'no'], required: true },
  amount:    { type: Number, required: true },
  odds:      { type: Number, required: true },
  payout:    { type: Number, default: null },
  status:    { type: String, enum: ['active', 'won', 'lost', 'refunded'], default: 'active', index: true },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('WolfBet', WolfBetSchema);
```

- [ ] **Step 6: Simplifier User.js**

Remplacer tout le contenu de `/Users/aifactory/wolves/db/models/User.js` par :

```javascript
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // -- Firebase Auth
  firebaseUid:     { type: String, unique: true, sparse: true },
  email:           { type: String, sparse: true },
  authProvider:    { type: String, enum: ['google', 'email', 'anonymous'], default: 'email' },

  username:            { type: String },
  walletAddress:       { type: String },
  encryptedPrivateKey: { type: String, default: null },

  // -- Balances
  balance:       { type: Number, default: 0 },
  lockedBalance: { type: Number, default: 0 },

  // -- Stats
  totalBets:  { type: Number, default: 0 },
  totalWon:   { type: Number, default: 0 },
  totalLost:  { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
});

UserSchema.virtual('availableBalance').get(function() {
  return Math.max(0, (this.balance || 0) - (this.lockedBalance || 0));
});

module.exports = mongoose.model('User', UserSchema);
```

- [ ] **Step 7: Commit**

```bash
cd /Users/aifactory/wolves && git add db/models/ && git commit -m "feat: create WOLVES Mongoose models (Character, Match, MatchEvent, WolfMarket, WolfBet, User)"
```

---

## Task 7: Réécrire le routeur API minimal

**Files:**
- Modify: `/Users/aifactory/wolves/src/api/router.js`

- [ ] **Step 1: Réécrire router.js avec routes minimales**

Remplacer tout le contenu de `/Users/aifactory/wolves/src/api/router.js` par :

```javascript
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// -- Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wolves', timestamp: new Date().toISOString() });
});

// -- Matches (placeholder pour S4)
router.get('/matches', async (req, res) => {
  try {
    const Match = require('../../db/models/Match');
    const matches = await Match.find().sort({ scheduledAt: -1 }).limit(20).lean();
    res.json(matches);
  } catch (err) {
    logger.error(`GET /matches error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

// -- Characters
router.get('/characters', async (req, res) => {
  try {
    const Character = require('../../db/models/Character');
    const characters = await Character.find().sort({ name: 1 }).lean();
    res.json(characters);
  } catch (err) {
    logger.error(`GET /characters error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

// -- Match events (live chat history for a match)
router.get('/matches/:matchId/events', async (req, res) => {
  try {
    const MatchEvent = require('../../db/models/MatchEvent');
    const events = await MatchEvent.find({ matchId: req.params.matchId })
      .sort({ timestamp: 1 })
      .lean();
    res.json(events);
  } catch (err) {
    logger.error(`GET /matches/:id/events error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/aifactory/wolves && git add src/api/router.js && git commit -m "feat: minimal WOLVES API router (health, matches, characters, events)"
```

---

## Task 8: Installer deps et vérifier le boot

**Files:**
- None (runtime check)

- [ ] **Step 1: Installer les dépendances**

```bash
cd /Users/aifactory/wolves && npm install
```

Expected: no errors. `node_modules/` created.

- [ ] **Step 2: Vérifier que le serveur démarre sans crash**

```bash
cd /Users/aifactory/wolves && timeout 5 node -e "
const app = require('./index.js');
const http = require('http');
const server = http.createServer(app);
server.listen(3099, () => {
  console.log('WOLVES boot OK on 3099');
  fetch('http://localhost:3099/api/health')
    .then(r => r.json())
    .then(j => { console.log('Health:', JSON.stringify(j)); server.close(); process.exit(0); })
    .catch(e => { console.error(e); server.close(); process.exit(1); });
});
"
```

Expected: `WOLVES boot OK on 3099` et `Health: {"status":"ok","service":"wolves",...}`

Note : MongoDB n'est pas obligatoire pour le health check. Si pas de MONGODB_URI, le serveur loggue un warning mais ne crash pas.

- [ ] **Step 3: Commit si nécessaire**

Si des fixes ont été nécessaires, commit :

```bash
cd /Users/aifactory/wolves && git add -A && git commit -m "fix: boot fixes after cleanup"
```

---

## Task 9: Ajouter Socket.io

**Files:**
- Create: `/Users/aifactory/wolves/src/utils/socket.js`

- [ ] **Step 1: Créer src/utils/socket.js**

```javascript
const { Server } = require('socket.io');
const logger = require('./logger');

let io = null;

function attachSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}`);

    socket.on('join_match', (matchId) => {
      socket.join(`match:${matchId}`);
      logger.debug(`${socket.id} joined match:${matchId}`);
    });

    socket.on('leave_match', (matchId) => {
      socket.leave(`match:${matchId}`);
    });

    socket.on('spectator_vote', (data) => {
      logger.debug(`Spectator vote from ${socket.id}:`, data);
    });

    socket.on('disconnect', () => {
      logger.debug(`Socket disconnected: ${socket.id}`);
    });
  });

  logger.info('Socket.io attached');
  return io;
}

function getIO() {
  return io;
}

function emitToMatch(matchId, event, data) {
  if (io) {
    io.to(`match:${matchId}`).emit(event, data);
  }
}

module.exports = { attachSocket, getIO, emitToMatch };
```

- [ ] **Step 2: Vérifier que Socket.io est bien chargé au démarrage**

Le `index.js` (Task 3) appelle déjà `attachSocket(server)` dans le bloc local dev. Vérifier que le boot fonctionne toujours :

```bash
cd /Users/aifactory/wolves && timeout 5 node -e "
const app = require('./index.js');
const http = require('http');
const server = http.createServer(app);
const { attachSocket } = require('./src/utils/socket');
attachSocket(server);
server.listen(3099, () => {
  console.log('WOLVES + Socket.io OK');
  server.close();
  process.exit(0);
});
"
```

Expected: `Socket.io attached` et `WOLVES + Socket.io OK`

- [ ] **Step 3: Commit**

```bash
cd /Users/aifactory/wolves && git add src/utils/socket.js && git commit -m "feat: add Socket.io for live match chat"
```

---

## Task 10: Créer les personnalités test (3 JSON)

**Files:**
- Create: `src/agents/personalities/thesee.json`
- Create: `src/agents/personalities/lyra.json`
- Create: `src/agents/personalities/orion.json`

- [ ] **Step 1: Créer le dossier et thesee.json**

```bash
mkdir -p /Users/aifactory/wolves/src/agents/personalities
```

Créer `/Users/aifactory/wolves/src/agents/personalities/thesee.json` :

```json
{
  "name": "Thesee",
  "archetype": "manipulator",
  "trait": "suspicieux",
  "backstory": "Ancien guerrier exile. Ne fait confiance a personne. Parle peu mais frappe juste.",
  "speechStyle": "phrases courtes, ton sec, pose des questions pieges",
  "llmModel": "haiku"
}
```

- [ ] **Step 2: Créer lyra.json**

Créer `/Users/aifactory/wolves/src/agents/personalities/lyra.json` :

```json
{
  "name": "Lyra",
  "archetype": "emotive",
  "trait": "passionnee",
  "backstory": "Ancienne chanteuse de village. Vit chaque instant avec intensite. S'attache vite et trahit rarement.",
  "speechStyle": "tournures exclamatives, vocabulaire sentimental, phrases parfois hachees",
  "llmModel": "haiku"
}
```

- [ ] **Step 3: Créer orion.json**

Créer `/Users/aifactory/wolves/src/agents/personalities/orion.json` :

```json
{
  "name": "Orion",
  "archetype": "logical",
  "trait": "analytique",
  "backstory": "Ancien cartographe royal. Observe tout, note les incoherences. Ne prend jamais parti sans preuves.",
  "speechStyle": "phrases structurees, utilise 'donc', 'or', 'cependant', ton neutre",
  "llmModel": "haiku"
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/aifactory/wolves && git add src/agents/personalities/ && git commit -m "feat: add 3 test character personalities (Thesee, Lyra, Orion)"
```

---

## Task 11: Créer agentRuntime.js et llmRouter.js

**Files:**
- Create: `/Users/aifactory/wolves/src/agents/llmRouter.js`
- Create: `/Users/aifactory/wolves/src/agents/agentRuntime.js`

Source : porté depuis `/Users/aifactory/Downloads/wolves/agents/runtime/agent.js` (ESM) vers CommonJS.

- [ ] **Step 1: Créer llmRouter.js (Haiku only pour V1)**

Créer `/Users/aifactory/wolves/src/agents/llmRouter.js` :

```javascript
const Anthropic = require('@anthropic-ai/sdk').default;
const config = require('../../config');

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = config.anthropic.apiKey;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  _client = new Anthropic({ apiKey });
  return _client;
}

async function chat({ model, system, messages, maxTokens = 160 }) {
  const client = getClient();
  const t0 = Date.now();
  const response = await client.messages.create({
    model: model || 'claude-haiku-4-5',
    max_tokens: maxTokens,
    system,
    messages,
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();
  return {
    text,
    usage: {
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
    },
    model: model || 'claude-haiku-4-5',
    latency_ms: Date.now() - t0,
  };
}

module.exports = { chat };
```

- [ ] **Step 2: Créer agentRuntime.js**

Créer `/Users/aifactory/wolves/src/agents/agentRuntime.js` :

```javascript
const { chat } = require('./llmRouter');

class Agent {
  constructor(config) {
    if (!config?.name) throw new Error('Agent.name required');
    if (config.role !== 'wolf' && config.role !== 'villager') {
      throw new Error(`Agent.role must be 'wolf' | 'villager', got: ${config.role}`);
    }
    if (!config.backstory) throw new Error('Agent.backstory required');

    this.name = config.name;
    this.role = config.role;
    this.archetype = config.archetype || 'logical';
    this.trait = config.trait || '';
    this.backstory = config.backstory;
    this.speechStyle = config.speechStyle || '';
    this.llmModel = config.llmModel || 'haiku';
  }

  _resolveModel() {
    const map = { haiku: 'claude-haiku-4-5', flash: 'claude-haiku-4-5', llama: 'claude-haiku-4-5' };
    return map[this.llmModel] || 'claude-haiku-4-5';
  }

  buildSystemPrompt() {
    const lines = [
      `Tu es ${this.name}, un personnage du jeu Loup-Garou.`,
      `Ton role secret dans cette partie : ${this.role === 'wolf' ? 'LOUP (a cacher aux villageois)' : 'VILLAGEOIS'}.`,
      '',
      'Personnalite :',
      this.backstory,
      '',
    ];
    if (this.speechStyle) {
      lines.push(`Style d'expression : ${this.speechStyle}`);
      lines.push('');
    }
    lines.push('Contraintes absolues :');
    lines.push('- Tu parles en francais.');
    lines.push('- Une seule intervention par tour, 1 a 3 phrases max.');
    lines.push('- Tu ne reveles JAMAIS ton role explicitement si tu es loup.');
    lines.push('- Tu ne sors jamais du cadre du jeu (pas de meta).');
    lines.push('- Ne commence pas par ton nom (le systeme l\'ajoute).');
    return lines.join('\n');
  }

  buildMessages(history) {
    if (!history || history.length === 0) {
      return [{ role: 'user', content: 'La partie commence. Tu prends la parole en premier. Une ou deux phrases.' }];
    }
    const transcript = history
      .map((t) => `${t.speaker}: ${t.text}`)
      .join('\n');
    return [{
      role: 'user',
      content: `Discussion en cours autour de la table :\n\n${transcript}\n\nA toi de prendre la parole. Une ou deux phrases.`,
    }];
  }

  async speak(history) {
    return chat({
      model: this._resolveModel(),
      system: this.buildSystemPrompt(),
      messages: this.buildMessages(history),
      maxTokens: 160,
    });
  }

  async vote(candidates) {
    const candidateList = candidates.map((c) => `- ${c}`).join('\n');
    const result = await chat({
      model: this._resolveModel(),
      system: this.buildSystemPrompt(),
      messages: [{
        role: 'user',
        content: `C'est le moment du vote. Tu dois eliminer un joueur parmi :\n${candidateList}\n\nReponds UNIQUEMENT avec le nom du joueur que tu veux eliminer. Rien d'autre.`,
      }],
      maxTokens: 30,
    });
    return result;
  }
}

module.exports = { Agent };
```

- [ ] **Step 3: Commit**

```bash
cd /Users/aifactory/wolves && git add src/agents/agentRuntime.js src/agents/llmRouter.js && git commit -m "feat: AgentRuntime + LLM router (Haiku only V1)"
```

---

## Task 12: Script de test — 3 agents x 5 tours

**Files:**
- Create: `/Users/aifactory/wolves/scripts/testAgents.js`

- [ ] **Step 1: Créer scripts/testAgents.js**

```bash
mkdir -p /Users/aifactory/wolves/scripts
```

Créer `/Users/aifactory/wolves/scripts/testAgents.js` :

```javascript
require('dotenv').config();
const { Agent } = require('../src/agents/agentRuntime');
const thesee = require('../src/agents/personalities/thesee.json');
const lyra = require('../src/agents/personalities/lyra.json');
const orion = require('../src/agents/personalities/orion.json');

const TURNS = 5;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY manquant. Copie .env.example -> .env et renseigne la cle.');
    process.exit(1);
  }

  const agents = [
    new Agent({ ...thesee, role: 'wolf' }),
    new Agent({ ...lyra, role: 'villager' }),
    new Agent({ ...orion, role: 'villager' }),
  ];

  const history = [];
  let totalInput = 0;
  let totalOutput = 0;

  console.log('='.repeat(55));
  console.log(` WOLVES S1 -- Test dialog 3 agents x ${TURNS} tours`);
  console.log('='.repeat(55));
  console.log('');

  for (let turn = 0; turn < TURNS; turn++) {
    const agent = agents[turn % agents.length];
    try {
      const { text, usage, latency_ms } = await agent.speak(history);
      totalInput += usage.input_tokens;
      totalOutput += usage.output_tokens;
      history.push({ speaker: agent.name, text });
      console.log(
        `[tour ${turn + 1}] ${agent.name} (${agent.role}, ${latency_ms}ms, ${usage.input_tokens}->${usage.output_tokens} tok) :`
      );
      console.log(`  ${text}`);
      console.log('');
    } catch (err) {
      console.error(`tour ${turn + 1} (${agent.name}) :`, err.message);
      process.exit(2);
    }
  }

  // Test vote
  console.log('-'.repeat(55));
  console.log(' Test vote : Orion vote pour eliminer quelqu\'un');
  console.log('-'.repeat(55));
  const voteResult = await agents[2].vote(['Thesee', 'Lyra']);
  console.log(`  Orion vote : ${voteResult.text}`);
  console.log('');

  const costUsd = (totalInput / 1_000_000) * 1 + (totalOutput / 1_000_000) * 5;
  console.log('='.repeat(55));
  console.log(` Total : ${totalInput} input tok + ${totalOutput} output tok`);
  console.log(` Cout estime : ~$${costUsd.toFixed(4)}`);
  console.log('='.repeat(55));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Vérifier que le script se charge sans erreur de syntaxe**

```bash
cd /Users/aifactory/wolves && node -e "require('./scripts/testAgents.js')" 2>&1 | head -5
```

Expected: error about `ANTHROPIC_API_KEY manquant` (preuve que le code se charge correctement, c'est juste la clé API qui manque).

- [ ] **Step 3: Si ANTHROPIC_API_KEY dispo, lancer le test complet**

```bash
cd /Users/aifactory/wolves && node scripts/testAgents.js
```

Expected: 5 tours de dialogue crédible + 1 vote. Chaque agent parle avec un style distinct.

- [ ] **Step 4: Commit**

```bash
cd /Users/aifactory/wolves && git add scripts/testAgents.js && git commit -m "feat: test script for 3 agents x 5 turns dialogue + vote"
```

---

## Task 13: Créer .comms/ et STATUS.md

**Files:**
- Create: `/Users/aifactory/wolves/.comms/STATUS.md`

- [ ] **Step 1: Créer le dossier .comms/ et STATUS.md**

```bash
mkdir -p /Users/aifactory/wolves/.comms/deliveries
```

Créer `/Users/aifactory/wolves/.comms/STATUS.md` :

```markdown
# WOLVES - Status

## Phase actuelle : S1 - Fondations (fork BETLY)
**Date debut :** 2026-04-18

## Infrastructure
- [x] Fork BETLY vers /Users/aifactory/wolves/
- [x] Nettoyage agents/models BETLY
- [x] 6 models Mongoose WOLVES
- [x] API minimale (/health, /matches, /characters, /events)
- [x] Socket.io integre
- [x] AgentRuntime + llmRouter (Haiku V1)
- [x] 3 personnages test (Thesee, Lyra, Orion)
- [x] Script test 3 agents x 5 tours
- [ ] Test live avec ANTHROPIC_API_KEY

## Blockers
| # | Issue | Severite | Action |
|---|-------|----------|--------|
| P1-1 | ANTHROPIC_API_KEY necessaire pour test:agents | BLOQUE test live | Nel: creer .env avec cle |

## Semaine 1 Roadmap
| Jour | Focus | Statut |
|------|-------|--------|
| J1-2 | Fork + nettoyage + models | DONE |
| J3   | Socket.io | DONE |
| J4-5 | AgentRuntime + test | DONE (en attente API key) |
```

- [ ] **Step 2: Commit**

```bash
cd /Users/aifactory/wolves && git add .comms/ && git commit -m "docs: add STATUS.md tracking S1 progress"
```

---

## Task 14: Nettoyage final et vérification complète

**Files:**
- Various cleanup

- [ ] **Step 1: Supprimer les fichiers BETLY restants qui ne servent plus**

```bash
cd /Users/aifactory/wolves
rm -f src/utils/email.js 2>/dev/null
rm -f src/utils/circuitBreaker.js 2>/dev/null
rm -f src/utils/retry.js 2>/dev/null
rm -f src/middleware/geoblock.js 2>/dev/null
```

Note : garder `src/middleware/firebaseAuth.js` (utilisé en S5), garder `src/wallet/` (utilisé en S6), garder `src/lib/cpmm.js` (utilisé en S6).

- [ ] **Step 2: Vérifier la structure finale**

```bash
find /Users/aifactory/wolves -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -name '.DS_Store' -not -name 'package-lock.json' | sort
```

Expected structure :
```
/Users/aifactory/wolves/.comms/STATUS.md
/Users/aifactory/wolves/.env.example
/Users/aifactory/wolves/.gitignore
/Users/aifactory/wolves/config/index.js
/Users/aifactory/wolves/db/models/Character.js
/Users/aifactory/wolves/db/models/Match.js
/Users/aifactory/wolves/db/models/MatchEvent.js
/Users/aifactory/wolves/db/models/User.js
/Users/aifactory/wolves/db/models/WolfBet.js
/Users/aifactory/wolves/db/models/WolfMarket.js
/Users/aifactory/wolves/index.js
/Users/aifactory/wolves/package.json
/Users/aifactory/wolves/scripts/testAgents.js
/Users/aifactory/wolves/src/agents/agentRuntime.js
/Users/aifactory/wolves/src/agents/llmRouter.js
/Users/aifactory/wolves/src/agents/personalities/lyra.json
/Users/aifactory/wolves/src/agents/personalities/orion.json
/Users/aifactory/wolves/src/agents/personalities/thesee.json
/Users/aifactory/wolves/src/api/router.js
/Users/aifactory/wolves/src/lib/cpmm.js
/Users/aifactory/wolves/src/middleware/firebaseAuth.js
/Users/aifactory/wolves/src/utils/logger.js
/Users/aifactory/wolves/src/utils/socket.js
/Users/aifactory/wolves/src/wallet/custodialWallet.js
/Users/aifactory/wolves/src/wallet/walletBackup.js
/Users/aifactory/wolves/src/wallet/withdrawalProcessor.js
/Users/aifactory/wolves/vercel.json
/Users/aifactory/wolves/web/...
```

- [ ] **Step 3: Boot test final**

```bash
cd /Users/aifactory/wolves && timeout 5 node -e "
const app = require('./index.js');
const http = require('http');
const server = http.createServer(app);
server.listen(3099, () => {
  fetch('http://localhost:3099/api/health')
    .then(r => r.json())
    .then(j => { console.log('WOLVES READY:', JSON.stringify(j)); server.close(); process.exit(0); })
    .catch(e => { console.error(e); server.close(); process.exit(1); });
});
"
```

Expected: `WOLVES READY: {"status":"ok","service":"wolves",...}`

- [ ] **Step 4: Commit final**

```bash
cd /Users/aifactory/wolves && git add -A && git commit -m "chore: final cleanup, WOLVES S1 fork complete"
```

---

## Summary

| Task | Description | Fichiers |
|------|-------------|----------|
| 1 | Copie BETLY + init git | cp + package.json + .gitignore |
| 2 | Supprimer agents/models BETLY | ~30 fichiers supprimés |
| 3 | Nettoyer index.js | index.js |
| 4 | Nettoyer config | config/index.js + .env.example |
| 5 | Nettoyer vercel.json | vercel.json |
| 6 | Créer 6 models Mongoose | 5 nouveaux + 1 modifié |
| 7 | API router minimal | src/api/router.js |
| 8 | Install + boot test | runtime |
| 9 | Socket.io | src/utils/socket.js |
| 10 | 3 personnalités test | 3 JSON |
| 11 | AgentRuntime + llmRouter | 2 fichiers |
| 12 | Script test 3 agents | scripts/testAgents.js |
| 13 | STATUS.md | .comms/ |
| 14 | Nettoyage final | cleanup + boot test |
