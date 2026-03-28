const express = require('express');
const router = express.Router();
const Market = require('../../db/models/Market');
const Bet = require('../../db/models/Bet');
const Comment = require('../../db/models/Comment');
const User = require('../../db/models/User');
const Vote = require('../../db/models/Vote');
const Notification = require('../../db/models/Notification');
const { analyzeMarket } = require('../agents/moderator');
const { checkForFraud } = require('../agents/watcher');
const logger = require('../utils/logger');

// ─── Notification helper ─────────────────────────────────────────────────────
async function notify({ userId, type, message, marketId = null, fromUser = null, amount = null }) {
  try {
    if (!userId) return;
    await Notification.create({ userId, type, message, marketId, fromUser, amount });
  } catch (e) {
    logger.error(`notify error: ${e.message}`);
  }
}

// ─── Mock markets for empty DB ──────────────────────────────────────────────
function getMockMarkets() {
  const now = new Date();
  const day = (n) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  return [
    {
      _id: 'mock-1',
      creatorId: 'system',
      title: 'Le Bitcoin dépassera 150 000$ avant le 1er juin 2026 ?',
      description: 'Le BTC atteindra-t-il ce niveau record avant la date butoir ?',
      category: 'crypto',
      oracleLevel: 1,
      confidenceScore: 88,
      confidenceDetails: { verifiability: 95, toxicity: 2, explanation: 'Marché vérifiable objectivement via données de marché publiques.' },
      status: 'active',
      outcome: null,
      totalYes: 2840,
      totalNo: 1120,
      creatorStake: 5,
      resolutionDate: day(66),
      minBet: 1,
      commentsCount: 24,
      flagged: false,
      createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      _id: 'mock-2',
      creatorId: 'system',
      title: "L'équipe de France gagnera l'Euro 2026 ?",
      description: "Les Bleus réussiront-ils à remporter le championnat d'Europe ?",
      category: 'sport',
      oracleLevel: 1,
      confidenceScore: 82,
      confidenceDetails: { verifiability: 100, toxicity: 0, explanation: 'Résultat sportif vérifiable avec source officielle UEFA.' },
      status: 'active',
      outcome: null,
      totalYes: 1950,
      totalNo: 2100,
      creatorStake: 5,
      resolutionDate: day(95),
      minBet: 1,
      commentsCount: 41,
      flagged: false,
      createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      _id: 'mock-3',
      creatorId: 'system',
      title: 'ChatGPT-5 sera lancé avant fin 2026 ?',
      description: "OpenAI annoncera et lancera publiquement GPT-5 d'ici le 31 décembre 2026.",
      category: 'autre',
      oracleLevel: 2,
      confidenceScore: 71,
      confidenceDetails: { verifiability: 80, toxicity: 0, explanation: 'Vérifiable via annonce officielle OpenAI, mais incertitude temporelle.' },
      status: 'active',
      outcome: null,
      totalYes: 3100,
      totalNo: 890,
      creatorStake: 5,
      resolutionDate: day(280),
      minBet: 1,
      commentsCount: 18,
      flagged: false,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      _id: 'mock-4',
      creatorId: 'system',
      title: 'Emmanuel Macron finira son mandat présidentiel ?',
      description: "Le président français ira-t-il jusqu'au terme de son mandat en 2027 ?",
      category: 'politique',
      oracleLevel: 2,
      confidenceScore: 65,
      confidenceDetails: { verifiability: 75, toxicity: 5, explanation: 'Marché politique modérément vérifiable, sujet à événements imprévus.' },
      status: 'active',
      outcome: null,
      totalYes: 1200,
      totalNo: 650,
      creatorStake: 5,
      resolutionDate: day(390),
      minBet: 1,
      commentsCount: 57,
      flagged: false,
      createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    },
    {
      _id: 'mock-5',
      creatorId: 'system',
      title: 'Severance saison 3 sera annoncée en 2026 ?',
      description: "Apple TV+ renouvellera officiellement Severance pour une troisième saison avant fin 2026.",
      category: 'culture',
      oracleLevel: 2,
      confidenceScore: 58,
      confidenceDetails: { verifiability: 70, toxicity: 0, explanation: 'Dépend des décisions internes Apple TV+, vérifiable via annonce officielle.' },
      status: 'active',
      outcome: null,
      totalYes: 780,
      totalNo: 420,
      creatorStake: 5,
      resolutionDate: day(275),
      minBet: 1,
      commentsCount: 12,
      flagged: false,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      _id: 'mock-6',
      creatorId: 'system',
      title: "Le ratio ETH/BTC dépassera 0.08 en 2026 ?",
      description: "L'Ethereum surperformera-t-il le Bitcoin au point que le ratio ETH/BTC franchira 0.08 ?",
      category: 'crypto',
      oracleLevel: 1,
      confidenceScore: 79,
      confidenceDetails: { verifiability: 95, toxicity: 0, explanation: 'Marché crypto vérifiable en temps réel via exchanges publics.' },
      status: 'active',
      outcome: null,
      totalYes: 560,
      totalNo: 1340,
      creatorStake: 5,
      resolutionDate: day(280),
      minBet: 1,
      commentsCount: 9,
      flagged: false,
      createdAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
    },
  ];
}

// ─── GET /api/markets ────────────────────────────────────────────────────────
router.get('/markets', async (req, res) => {
  try {
    const { category, sort, status } = req.query;
    const count = await Market.countDocuments();

    if (count === 0) {
      let markets = getMockMarkets();
      if (category && category !== 'tous') {
        markets = markets.filter(m => m.category === category);
      }
      if (status) {
        markets = markets.filter(m => m.status === status);
      }
      if (sort === 'nouveau') {
        markets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } else if (sort === 'ferme') {
        markets.sort((a, b) => new Date(a.resolutionDate) - new Date(b.resolutionDate));
      } else {
        // trending: sort by total volume
        markets.sort((a, b) => (b.totalYes + b.totalNo) - (a.totalYes + a.totalNo));
      }
      return res.json({ markets, source: 'mock' });
    }

    const filter = {};
    if (category && category !== 'tous') filter.category = category;
    if (status) filter.status = status;
    else filter.status = 'active';

    let query = Market.find(filter);
    if (sort === 'nouveau') query = query.sort({ createdAt: -1 });
    else if (sort === 'ferme') query = query.sort({ resolutionDate: 1 });
    else query = query.sort({ totalYes: -1 });

    const markets = await query.limit(50).lean();
    res.json({ markets, source: 'db' });
  } catch (err) {
    logger.error(`GET /markets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/analyze ───────────────────────────────────────────────
router.post('/markets/analyze', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const analysis = await analyzeMarket(title, description || '');
    res.json(analysis);
  } catch (err) {
    logger.error(`POST /markets/analyze error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id ────────────────────────────────────────────────────
router.get('/markets/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Return mock if id starts with 'mock-'
    if (id.startsWith('mock-')) {
      const mocks = getMockMarkets();
      const market = mocks.find(m => m._id === id);
      if (!market) return res.status(404).json({ error: 'Market not found' });
      return res.json(market);
    }

    const market = await Market.findById(id).lean();
    if (!market) return res.status(404).json({ error: 'Market not found' });
    res.json(market);
  } catch (err) {
    logger.error(`GET /markets/:id error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets ───────────────────────────────────────────────────────
router.post('/markets', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { title, description, resolutionDate, minBet } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!resolutionDate) return res.status(400).json({ error: 'resolutionDate required' });

    const analysis = await analyzeMarket(title, description || '');

    if (analysis.decision === 'rejected') {
      return res.status(422).json({
        error: 'Market rejected by moderation',
        analysis,
      });
    }

    const market = new Market({
      creatorId: userId,
      title,
      description: description || '',
      category: analysis.category || 'autre',
      oracleLevel: analysis.oracleLevel || 2,
      confidenceScore: analysis.confidenceScore || 0,
      confidenceDetails: {
        verifiability: analysis.verifiability,
        toxicity: analysis.toxicity,
        explanation: analysis.confidenceExplanation,
      },
      status: analysis.decision === 'review' ? 'pending' : 'active',
      resolutionDate: new Date(resolutionDate),
      minBet: minBet || 1,
      flagged: analysis.decision === 'review',
    });

    await market.save();
    logger.info(`Market created: ${market._id} by ${userId} — decision: ${analysis.decision}`);
    res.status(201).json({ market, analysis });
  } catch (err) {
    logger.error(`POST /markets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/bet ───────────────────────────────────────────────
router.post('/markets/:id/bet', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { id } = req.params;
    const { side, amount } = req.body;

    if (!side || !['YES', 'NO'].includes(side)) {
      return res.status(400).json({ error: 'side must be YES or NO' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }

    // Handle mock markets
    if (id.startsWith('mock-')) {
      return res.json({
        success: true,
        bet: {
          userId,
          marketId: id,
          side,
          amount,
          status: 'active',
          placedAt: new Date(),
        },
        message: 'Pari enregistré (marché demo)',
      });
    }

    const market = await Market.findById(id);
    if (!market) return res.status(404).json({ error: 'Market not found' });
    if (market.status !== 'active') {
      return res.status(400).json({ error: 'Market is not active' });
    }
    if (amount < market.minBet) {
      return res.status(400).json({ error: `Minimum bet is ${market.minBet} USDC` });
    }

    const fraudCheck = await checkForFraud(id, { userId, side, amount });
    if (fraudCheck.suspicious) {
      return res.status(400).json({ error: 'Bet flagged as suspicious' });
    }

    const totalPool = market.totalYes + market.totalNo + amount;
    const sideTotal = (side === 'YES' ? market.totalYes : market.totalNo) + amount;
    const odds = totalPool > 0 ? totalPool / sideTotal : 2;

    const bet = new Bet({
      userId,
      marketId: id,
      side,
      amount,
      odds: Math.round(odds * 100) / 100,
    });
    await bet.save();

    if (side === 'YES') market.totalYes += amount;
    else market.totalNo += amount;
    await market.save();

    // Upsert user stats
    await User.findOneAndUpdate(
      { telegramId: userId },
      { $inc: { totalBets: 1 }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );

    logger.info(`Bet placed: ${userId} ${side} ${amount} USDC on market ${id}`);
    res.status(201).json({ bet, market });
  } catch (err) {
    logger.error(`POST /markets/:id/bet error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/bets ───────────────────────────────────────────────
router.get('/markets/:id/bets', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('mock-')) {
      return res.json({ bets: [] });
    }

    const bets = await Bet.find({ marketId: id })
      .sort({ placedAt: -1 })
      .limit(50)
      .lean();

    // Anonymize: mask userId
    const anonymized = bets.map(b => ({
      ...b,
      userId: b.userId.slice(0, 4) + '****',
    }));

    res.json({ bets: anonymized });
  } catch (err) {
    logger.error(`GET /markets/:id/bets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/comments ──────────────────────────────────────────
router.get('/markets/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('mock-')) {
      return res.json({ comments: [] });
    }

    const comments = await Comment.find({ marketId: id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ comments });
  } catch (err) {
    logger.error(`GET /markets/:id/comments error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/comments ─────────────────────────────────────────
router.post('/markets/:id/comments', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { id } = req.params;
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'content required' });
    }

    if (id.startsWith('mock-')) {
      return res.json({
        comment: { userId, marketId: id, content, likes: 0, createdAt: new Date() },
        message: 'Commentaire enregistré (marché demo)',
      });
    }

    const comment = new Comment({
      userId,
      marketId: id,
      content: content.trim().slice(0, 500),
    });
    await comment.save();

    await Market.findByIdAndUpdate(id, { $inc: { commentsCount: 1 } });

    // Notify market creator (not self)
    const mkt = await Market.findById(id).lean();
    if (mkt && mkt.creatorId && mkt.creatorId !== userId) {
      const commenter = await User.findById(userId).lean();
      const name = commenter?.username || userId.slice(0, 8);
      await notify({
        userId: mkt.creatorId,
        type: 'new_comment',
        message: `${name} a commenté sur ton marché "${mkt.title.slice(0, 40)}"`,
        marketId: id,
        fromUser: userId,
      });
    }

    res.status(201).json({ comment });
  } catch (err) {
    logger.error(`POST /markets/:id/comments error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/vote ──────────────────────────────────────────────
router.post('/markets/:id/vote', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { id } = req.params;
    const { vote } = req.body;

    if (!vote || !['YES', 'NO'].includes(vote)) {
      return res.status(400).json({ error: 'vote must be YES or NO' });
    }

    if (id.startsWith('mock-')) {
      return res.json({ success: true, message: 'Vote enregistré (marché demo)' });
    }

    const market = await Market.findById(id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    // One vote per user per market
    const existing = await Vote.findOne({ userId, marketId: id });
    if (existing) {
      existing.vote = vote;
      await existing.save();
      return res.json({ success: true, updated: true });
    }

    // Weight by user reputation (1-3)
    const user = await User.findOne({ $or: [{ _id: userId }, { telegramId: userId }] }).lean();
    const weight = user ? Math.min(3, Math.max(1, Math.floor((user.reputation || 50) / 34))) : 1;

    await Vote.create({ userId, marketId: id, vote, weight });

    // Tally
    const votes = await Vote.find({ marketId: id }).lean();
    const yesCount = votes.filter(v => v.vote === 'YES').length;
    const noCount  = votes.filter(v => v.vote === 'NO').length;

    logger.info(`Vote: ${userId} → ${vote} on market ${id} (${yesCount}Y / ${noCount}N)`);
    res.status(201).json({ success: true, yesCount, noCount, total: votes.length });
  } catch (err) {
    logger.error(`POST /markets/:id/vote error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/votes ───────────────────────────────────────────────
router.get('/markets/:id/votes', async (req, res) => {
  try {
    const { id } = req.params;

    if (id.startsWith('mock-')) {
      return res.json({ yesCount: 0, noCount: 0, total: 0, userVote: null });
    }

    const { userId } = req.query;
    const votes = await Vote.find({ marketId: id }).lean();
    const yesCount = votes.filter(v => v.vote === 'YES').length;
    const noCount  = votes.filter(v => v.vote === 'NO').length;
    const userVote = userId ? (votes.find(v => v.userId === userId)?.vote || null) : null;

    res.json({ yesCount, noCount, total: votes.length, userVote });
  } catch (err) {
    logger.error(`GET /markets/:id/votes error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/leaderboard ────────────────────────────────────────────────────
router.get('/leaderboard', async (req, res) => {
  try {
    const topBettors = await User.find()
      .sort({ totalEarned: -1 })
      .limit(20)
      .lean();

    const topCreators = await Market.aggregate([
      { $match: { status: { $in: ['active', 'resolved'] } } },
      {
        $group: {
          _id: '$creatorId',
          marketsCreated: { $sum: 1 },
          totalVolume: { $sum: { $add: ['$totalYes', '$totalNo'] } },
        },
      },
      { $sort: { totalVolume: -1 } },
      { $limit: 20 },
    ]);

    const topMarkets = await Market.find({ status: { $in: ['active', 'resolved'] } })
      .sort({ totalYes: -1 })
      .limit(10)
      .select('title totalYes totalNo commentsCount resolutionDate status outcome')
      .lean();

    res.json({ topBettors, topCreators, topMarkets });
  } catch (err) {
    logger.error(`GET /leaderboard error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/account ────────────────────────────────────────────────────────
router.get('/account', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    let user = await User.findOne({ $or: [{ _id: userId }, { telegramId: userId }] }).lean();

    if (!user) {
      user = {
        _id: userId,
        displayName: `User ${userId.slice(0, 6)}`,
        balance: 0,
        totalBets: 0,
        wonBets: 0,
        totalEarned: 0,
        reputation: 50,
        createdAt: new Date(),
      };
    }

    const recentBets = await Bet.find({ userId })
      .sort({ placedAt: -1 })
      .limit(10)
      .lean();

    res.json({ user, recentBets });
  } catch (err) {
    logger.error(`GET /account error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/users/:id ──────────────────────────────────────────────────────
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId: viewerId } = req.query; // who is viewing

    let user = await User.findOne({ telegramId: id }).lean();
    if (!user) {
      user = {
        telegramId: id,
        displayName: `User ${id.slice(0, 6)}`,
        balance: 0, totalBets: 0, wonBets: 0,
        totalEarned: 0, reputation: 50,
        followedBy: [], createdAt: new Date(),
      };
    }

    // Markets created by this user
    const marketsCreated = await Market.find({ creatorId: id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title status totalYes totalNo resolutionDate outcome createdAt')
      .lean();

    const totalVolume = marketsCreated.reduce(
      (s, m) => s + (m.totalYes || 0) + (m.totalNo || 0), 0
    );

    // Recent bets
    const recentBets = await Bet.find({ userId: id })
      .sort({ placedAt: -1 })
      .limit(5)
      .lean();

    const isFollowing = viewerId ? (user.followedBy || []).includes(viewerId) : false;
    const isTopCreator = marketsCreated.length >= 3 && totalVolume >= 100;

    res.json({
      user,
      marketsCreated,
      recentBets,
      totalVolume,
      isFollowing,
      isTopCreator,
    });
  } catch (err) {
    logger.error(`GET /users/:id error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/users/:id/follow ───────────────────────────────────────────────
router.post('/users/:id/follow', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { id } = req.params;
    if (id === userId) return res.status(400).json({ error: 'Cannot follow yourself' });

    const target = await User.findOne({ $or: [{ _id: id }, { telegramId: id }] });
    if (!target) return res.status(404).json({ error: 'User not found' });

    const isFollowing = target.followedBy.includes(userId);
    if (isFollowing) {
      target.followedBy = target.followedBy.filter(f => f !== userId);
    } else {
      target.followedBy.push(userId);
    }
    await target.save();

    // Notify on new follow (not unfollow)
    if (!isFollowing) {
      const follower = await User.findById(userId).lean();
      const name = follower?.username || userId.slice(0, 8);
      await notify({
        userId: id,
        type: 'new_follower',
        message: `${name} te suit maintenant`,
        fromUser: userId,
      });
    }

    res.json({ following: !isFollowing, followers: target.followedBy.length });
  } catch (err) {
    logger.error(`POST /users/:id/follow error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'username required' });
    }
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (clean.length < 3 || clean.length > 20) {
      return res.status(400).json({ error: 'Pseudo: 3-20 caractères, lettres/chiffres/_/-' });
    }

    // Check uniqueness (by username field)
    const existing = await User.findOne({ username: clean });
    if (existing) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }

    // Compute avatar color
    const palette = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];
    let h = 0;
    for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) & 0xffffffff;
    const avatarColor = palette[Math.abs(h) % palette.length];

    const user = await User.create({
      username: clean,
      displayName: username.trim(),
      balance: 100, // starter balance
      reputation: 50,
    });

    logger.info(`Auth register: ${clean} (${user._id})`);
    res.status(201).json({
      userId: user._id.toString(),
      username: clean,
      displayName: username.trim(),
      avatarColor,
      balance: 100,
    });
  } catch (err) {
    logger.error(`POST /auth/register error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/check ──────────────────────────────────────────────────────
router.get('/auth/check', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const existing = await User.findOne({ username: clean });
    res.json({ available: !existing, clean });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/notifications ───────────────────────────────────────────────────
router.get('/notifications', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId, read: false });

    res.json({ notifications, unreadCount });
  } catch (err) {
    logger.error(`GET /notifications error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/notifications/unread-count ─────────────────────────────────────
router.get('/notifications/unread-count', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.json({ count: 0 });
    const count = await Notification.countDocuments({ userId, read: false });
    res.json({ count });
  } catch (err) {
    res.json({ count: 0 });
  }
});

// ─── POST /api/notifications/read-all ────────────────────────────────────────
router.post('/notifications/read-all', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });
    await Notification.updateMany({ userId, read: false }, { $set: { read: true } });
    res.json({ success: true });
  } catch (err) {
    logger.error(`POST /notifications/read-all error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/activity ───────────────────────────────────────────
router.get('/markets/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    if (id.startsWith('mock-')) return res.json({ items: [] });
    const [bets, comments] = await Promise.all([
      Bet.find({ marketId: id }).sort({ placedAt: -1 }).limit(limit).lean(),
      Comment.find({ marketId: id }).sort({ createdAt: -1 }).limit(limit).lean(),
    ]);
    const items = [
      ...bets.map(b => ({
        type: 'bet',
        side: b.side,
        amount: b.amount,
        userId: b.userId.slice(0, 4) + '****',
        date: b.placedAt,
      })),
      ...comments.map(c => ({
        type: 'comment',
        content: c.content,
        userId: c.userId,
        likes: c.likes,
        id: c._id,
        date: c.createdAt,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, limit);
    res.json({ items });
  } catch (err) {
    logger.error(`GET /markets/:id/activity error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
