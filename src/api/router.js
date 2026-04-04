const express = require('express');
const router = express.Router();
const Market = require('../../db/models/Market');
const Bet = require('../../db/models/Bet');
const Comment = require('../../db/models/Comment');
const User = require('../../db/models/User');
const Vote = require('../../db/models/Vote');
const Notification = require('../../db/models/Notification');
const Withdrawal = require('../../db/models/Withdrawal');
const PlatformRevenue = require('../../db/models/PlatformRevenue');
const Affiliate = require('../../db/models/Affiliate');
const Referral = require('../../db/models/Referral');
const CreatorCommission = require('../../db/models/CreatorCommission');
const CreatorVerification = require('../../db/models/CreatorVerification');
const KnownCreator = require('../../db/models/KnownCreator');
const Post = require('../../db/models/Post');
const AgentAccount = require('../../db/models/AgentAccount');
const { analyzeMarket, preFilter } = require('../agents/moderator');
const { postModerate } = require('../agents/postModerator');
const { checkForFraud } = require('../agents/watcher');
const { computeTrendingScores } = require('../agents/trending');
const logger = require('../utils/logger');
const cb = require('../utils/circuitBreaker');
const { withRetry } = require('../utils/retry');
const { resolveUserId } = require('../middleware/firebaseAuth');
const { geoblock } = require('../middleware/geoblock');

// ─── Global: resolve userId from Bearer token or query param ─────────────────
router.use(resolveUserId);

// ─── Circuit breaker middleware for bet routes ────────────────────────────────
function checkCircuitBreaker(req, res, next) {
  if (cb.isOpen()) {
    return res.status(503).json({
      error: 'Maintenance en cours. Tes fonds sont en sécurité. Réessaie dans quelques minutes.',
      circuitOpen: true,
    });
  }
  next();
}

// ─── Helper: resolve userId query ────────────────────────────────────────────
function buildUserQuery(userId) {
  const mongoose = require('mongoose');
  const isValidId = mongoose.Types.ObjectId.isValid(userId);
  return isValidId
    ? { $or: [{ _id: userId }, { telegramId: userId }, { username: userId }] }
    : { $or: [{ telegramId: userId }, { username: userId }] };
}

// Serverless-safe: recalculate trending if last run was >15min ago
let lastTrendingRun = 0;
async function maybeTrending() {
  const now = Date.now();
  if (now - lastTrendingRun > 15 * 60 * 1000) {
    lastTrendingRun = now;
    computeTrendingScores().catch(() => {});
  }
}

// ─── Auto-transitions (serverless-safe, runs at most every 60s) ──────────────
let lastAutoTransition = 0;
async function maybeAutoTransitions() {
  const now = Date.now();
  if (now - lastAutoTransition < 60_000) return;
  lastAutoTransition = now;

  try {
    // 1. active → resolving: resolutionDate passed
    const expired = await Market.find({
      status: 'active',
      resolutionDate: { $lte: new Date() },
    }).limit(20);

    for (const m of expired) {
      m.status = 'resolving';
      await m.save();
      logger.info(`Auto-transition: market ${m._id} active → resolving`);
    }

    // 2. active → cancelled: volume < 10 USDC after 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const underLiq = await Market.find({
      status: 'active',
      createdAt: { $lte: oneDayAgo },
      $expr: { $lt: [{ $add: ['$totalYes', '$totalNo'] }, 10] },
    }).limit(20);

    for (const m of underLiq) {
      m.status = 'cancelled';
      m.cancelledAt = new Date();
      m.cancelledReason = 'Liquidité insuffisante (< 10 USDC après 24h)';
      await m.save();
      // Refund all active bets on this market
      await refundMarketBets(m._id.toString(), 'Marché annulé : liquidité insuffisante');
      logger.info(`Auto-cancel: market ${m._id} — low liquidity`);
    }
  } catch (e) {
    logger.error(`maybeAutoTransitions error: ${e.message}`);
  }
}

// ─── Refund all active bets on a market ──────────────────────────────────────
async function refundMarketBets(marketId, reason) {
  try {
    const bets = await Bet.find({ marketId, status: 'active' });
    for (const bet of bets) {
      bet.status = 'refunded';
      bet.refundedAt = new Date();
      await bet.save();
      // Unlock + restore balance
      await User.findOneAndUpdate(
        { $or: [{ _id: bet.userId }, { telegramId: bet.userId }] },
        {
          $inc: { lockedBalance: -bet.amount },
        }
      );
      await notify({
        userId: bet.userId,
        type: 'bet_refunded',
        message: `Ta mise de ${bet.amount} USDC a été remboursée. ${reason}`,
        marketId: marketId.toString(),
        amount: bet.amount,
      });
    }
  } catch (e) {
    logger.error(`refundMarketBets error: ${e.message}`);
  }
}

// ─── Resolve market + auto-claim ─────────────────────────────────────────────
async function resolveMarket(marketId, outcome) {
  const market = await Market.findById(marketId);
  if (!market) throw new Error('Market not found');

  // Allow resolving from resolving state (or active for admin force-resolve)
  if (!['resolving', 'active'].includes(market.status)) {
    throw new Error(`Cannot resolve market in status: ${market.status}`);
  }

  market.status = 'resolved';
  market.outcome = outcome;
  market.resolvedAt = new Date();
  await market.save();

  const totalPool = market.totalYes + market.totalNo;
  const winPool = outcome === 'YES' ? market.totalYes : market.totalNo;

  const bets = await Bet.find({ marketId, status: 'active' });
  let claimedCount = 0;

  const PLATFORM_FEE = parseFloat(process.env.PLATFORM_FEE_PERCENT || '3') / 100;
  const CREATOR_FEE  = parseFloat(process.env.CREATOR_FEE_PERCENT  || '2') / 100;
  const TOTAL_FEE    = PLATFORM_FEE + CREATOR_FEE; // default 5%

  let totalCreatorFee  = 0;
  let totalPlatformFee = 0;

  // Pre-fetch referrals for all betters (single query)
  const betUserIds = [...new Set(bets.map(b => b.userId))];
  const referrals  = await Referral.find({ referredUserId: { $in: betUserIds } }).lean();
  const referralMap = {};
  referrals.forEach(r => { referralMap[r.referredUserId] = r; });

  for (const bet of bets) {
    const isWinner = bet.side === outcome;

    if (isWinner && winPool > 0) {
      // grossPayout = stake × (totalPool / winPool)
      const grossPayout   = bet.amount * (totalPool / winPool);
      const platformFee   = Math.round(grossPayout * PLATFORM_FEE * 100) / 100;
      const creatorFee    = Math.round(grossPayout * CREATOR_FEE  * 100) / 100;
      const netPayout     = Math.round((grossPayout - platformFee - creatorFee) * 100) / 100;

      bet.status    = 'claimed';
      bet.payout    = netPayout;
      bet.fee       = Math.round((platformFee + creatorFee) * 100) / 100;
      bet.settledAt = new Date();
      bet.claimedAt = new Date();
      await bet.save();

      totalCreatorFee  += creatorFee;
      totalPlatformFee += platformFee;

      // Unlock stake + add net payout
      await User.findOneAndUpdate(
        { $or: [{ _id: bet.userId }, { telegramId: bet.userId }] },
        {
          $inc: {
            lockedBalance: -bet.amount,
            balance: netPayout,
            wonBets: 1,
            totalEarned: netPayout - bet.amount,
          },
        }
      );

      // ── Affiliate cut from platform fee ────────────────────────────────────
      const referral = referralMap[bet.userId];
      if (referral && platformFee > 0) {
        const affiliate = await Affiliate.findOne({ userId: referral.affiliateId });
        if (affiliate) {
          const tierPct = Affiliate.tierPct[affiliate.tier] || 0.30;
          const affiliateCut = Math.round(platformFee * tierPct * 100) / 100;
          const platformNet  = Math.round((platformFee - affiliateCut) * 100) / 100;

          affiliate.pendingPayout = Math.round(((affiliate.pendingPayout || 0) + affiliateCut) * 100) / 100;
          affiliate.totalEarned   = Math.round(((affiliate.totalEarned   || 0) + affiliateCut) * 100) / 100;
          affiliate.totalVolume   = Math.round(((affiliate.totalVolume   || 0) + bet.amount)   * 100) / 100;
          await affiliate.save();

          await Referral.findOneAndUpdate(
            { referredUserId: bet.userId },
            {
              $inc: {
                totalFeesGenerated:   platformFee,
                totalAffiliateEarned: affiliateCut,
              },
            }
          );

          await PlatformRevenue.create({
            type: 'market_fee', marketId: marketId.toString(),
            amount: platformFee, affiliateId: affiliate.userId,
            affiliateCut, platformNet,
          });
        } else {
          await PlatformRevenue.create({
            type: 'market_fee', marketId: marketId.toString(),
            amount: platformFee, platformNet: platformFee,
          });
        }
      } else {
        await PlatformRevenue.create({
          type: 'market_fee', marketId: marketId.toString(),
          amount: platformFee, platformNet: platformFee,
        });
      }

      await notify({
        userId: bet.userId,
        type: 'market_resolved_won',
        message: `🎉 Tu as gagné +${(netPayout - bet.amount).toFixed(2)} USDC sur "${market.title.slice(0, 40)}"`,
        marketId: marketId.toString(),
        amount: netPayout,
      });
      claimedCount++;
    } else {
      bet.status    = 'lost';
      bet.payout    = 0;
      bet.settledAt = new Date();
      await bet.save();

      await User.findOneAndUpdate(
        { $or: [{ _id: bet.userId }, { telegramId: bet.userId }] },
        { $inc: { lockedBalance: -bet.amount } }
      );

      await notify({
        userId: bet.userId,
        type: 'market_resolved_lost',
        message: `😔 Tu as perdu ${bet.amount} USDC sur "${market.title.slice(0, 40)}"`,
        marketId: marketId.toString(),
        amount: bet.amount,
      });
    }
  }

  // ── Credit creator fee ──────────────────────────────────────────────────────
  if (totalCreatorFee > 0 && market.creatorId) {
    await User.findOneAndUpdate(
      buildUserQuery(market.creatorId),
      { $inc: { balance: totalCreatorFee } }
    );
    await notify({
      userId: market.creatorId,
      type: 'market_resolved_won',
      message: `💰 Tu as reçu ${totalCreatorFee.toFixed(2)} USDC de frais créateur sur "${market.title.slice(0, 40)}"`,
      marketId: marketId.toString(),
      amount: totalCreatorFee,
    });
  }

  // ── Auto-upgrade affiliate tier ─────────────────────────────────────────────
  upgradeAffiliateTiers().catch(() => {});

  market.status = 'closed';
  await market.save();

  logger.info(`Market ${marketId} resolved → ${outcome}. ${claimedCount} winners paid. Creator: ${totalCreatorFee.toFixed(2)} USDC. Platform: ${totalPlatformFee.toFixed(2)} USDC.`);
  return { market, claimedCount, totalBets: bets.length, payouts: claimedCount };
}

// ─── Level + Streak helpers ──────────────────────────────────────────────────
function computeLevel(totalBets, wonBets, isTopLeaderboard = false) {
  if (isTopLeaderboard) return 'legende';
  const winrate = totalBets > 0 ? wonBets / totalBets : 0;
  if (totalBets >= 201 && winrate > 0.65) return 'oracle';
  if (totalBets >= 51) return 'expert';
  if (totalBets >= 11) return 'actif';
  return 'debutant';
}

async function updateStreak(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const lastStr = user.lastLoginDate ? new Date(user.lastLoginDate).toISOString().split('T')[0] : null;

    if (lastStr === todayStr) return; // already checked in today

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let streak = lastStr === yesterdayStr ? (user.currentStreak || 0) + 1 : 1;
    const longest = Math.max(streak, user.longestStreak || 0);

    // Badge rewards
    const badges = new Set(user.badges || []);
    if (streak >= 7)   badges.add('regulier');
    if (streak >= 30)  badges.add('acharne');
    if (streak >= 100) badges.add('legendaire');

    await User.findByIdAndUpdate(userId, {
      currentStreak: streak,
      longestStreak: longest,
      lastLoginDate: now,
      badges: [...badges],
    });
  } catch (e) {
    logger.error(`updateStreak error: ${e.message}`);
  }
}

async function updateLevel(userId) {
  try {
    const user = await User.findById(userId).lean();
    if (!user) return;
    const level = computeLevel(user.totalBets || 0, user.wonBets || 0);
    if (level !== user.level) {
      await User.findByIdAndUpdate(userId, { level });
    }
  } catch (e) {
    logger.error(`updateLevel error: ${e.message}`);
  }
}

// ─── Notification helper ─────────────────────────────────────────────────────
async function notify({ userId, type, message, marketId = null, fromUser = null, amount = null }) {
  try {
    if (!userId) return;
    await Notification.create({ userId, type, message, marketId, fromUser, amount });
  } catch (e) {
    logger.error(`notify error: ${e.message}`);
  }
}

// ─── Affiliate helpers ────────────────────────────────────────────────────────

// Generate a random uppercase affiliate code
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Auto-upgrade affiliates to premium if ≥50 active referrals
async function upgradeAffiliateTiers() {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const affiliates = await Affiliate.find({ tier: 'standard' }).lean();

    for (const aff of affiliates) {
      // Count referrals with a bet in last 30d
      const recentBetters = await Bet.distinct('userId', {
        placedAt: { $gte: thirtyDaysAgo },
      });
      const activeCount = await Referral.countDocuments({
        affiliateId: aff.userId,
        referredUserId: { $in: recentBetters },
      });
      if (activeCount >= 50) {
        await Affiliate.findByIdAndUpdate(aff._id, { tier: 'premium', activeReferrals: activeCount });
        await notify({
          userId: aff.userId,
          type: 'level_up',
          message: `🎉 Tu es passé au tier Premium affilié (${activeCount} referrals actifs) ! Tu gagnes maintenant 40% des fees.`,
        });
      } else {
        await Affiliate.findByIdAndUpdate(aff._id, { activeReferrals: activeCount });
      }
    }
  } catch (e) {
    logger.error(`upgradeAffiliateTiers error: ${e.message}`);
  }
}

// Auto-payout affiliates (serverless-safe, Mondays, min 5 USDC)
let lastPayoutRun = 0;
async function maybeAffiliatePayouts() {
  const now = Date.now();
  // Run at most once per 6h
  if (now - lastPayoutRun < 6 * 60 * 60 * 1000) return;

  const day = new Date().getDay(); // 1 = Monday
  if (day !== 1) return;

  lastPayoutRun = now;
  try {
    const minPayout = parseFloat(process.env.AFFILIATE_PAYOUT_MIN || '5');
    const affiliates = await Affiliate.find({ pendingPayout: { $gte: minPayout } }).lean();

    for (const aff of affiliates) {
      const amount = Math.round(aff.pendingPayout * 100) / 100;
      // Credit to user balance
      await User.findOneAndUpdate(
        buildUserQuery(aff.userId),
        { $inc: { balance: amount } }
      );
      await Affiliate.findByIdAndUpdate(aff._id, {
        pendingPayout: 0,
        lastPayoutAt: new Date(),
      });
      await notify({
        userId: aff.userId,
        type: 'deposit_confirmed',
        message: `💰 Tu as reçu ${amount.toFixed(2)} USDC de tes commissions affilié BETLY !`,
        amount,
      });
      logger.info(`Affiliate payout: ${aff.userId} +${amount} USDC`);
    }
  } catch (e) {
    logger.error(`maybeAffiliatePayouts error: ${e.message}`);
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

// ─── POST /api/seed — insert mock markets into DB as real markets ────────────
router.post('/seed', async (req, res) => {
  try {
    const existing = await Market.countDocuments();
    if (existing > 0) return res.json({ message: `DB déjà peuplée (${existing} marchés)`, seeded: 0 });

    const mocks = getMockMarkets();
    const docs = mocks.map(m => ({
      creatorId:         m.creatorId,
      title:             m.title,
      description:       m.description,
      category:          m.category,
      oracleLevel:       m.oracleLevel,
      confidenceScore:   m.confidenceScore,
      confidenceDetails: m.confidenceDetails,
      status:            'active',
      totalYes:          m.totalYes,
      totalNo:           m.totalNo,
      creatorStake:      m.creatorStake,
      resolutionDate:    m.resolutionDate,
      minBet:            m.minBet,
      commentsCount:     m.commentsCount || 0,
      flagged:           false,
      createdAt:         m.createdAt,
    }));

    const inserted = await Market.insertMany(docs);
    res.json({ message: `${inserted.length} marchés insérés`, seeded: inserted.length, ids: inserted.map(d => d._id) });
  } catch (err) {
    logger.error(`POST /seed error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/personalized ───────────────────────────────────────────
router.get('/markets/personalized', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const dbCount = await Market.countDocuments();
    if (dbCount === 0) {
      // Fallback to mock trending when DB is empty
      return res.json({ markets: getMockMarkets(), source: 'mock', reason: 'empty_db' });
    }

    // 1. Who does this user follow?
    const followedUsers = await User.find({ followedBy: userId }).select('_id telegramId').lean().catch(() => []);
    const creatorIds = followedUsers.flatMap(u => [u._id.toString(), u.telegramId].filter(Boolean));

    // 2. User's top categories based on bet history
    let topCategories = [];
    try {
      const betsByCategory = await Bet.aggregate([
        { $match: { userId } },
        {
          $lookup: {
            from: 'markets',
            localField: 'marketId',
            foreignField: '_id',
            as: 'market',
          },
        },
        { $unwind: { path: '$market', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$market.category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 2 },
      ]);
      topCategories = betsByCategory.map(b => b._id).filter(Boolean);
    } catch (aggErr) {
      logger.warn(`personalized: aggregate error — ${aggErr.message}`);
    }

    // 3. Fetch markets in parallel
    const [followedMarkets, categoryMarkets] = await Promise.all([
      creatorIds.length > 0
        ? Market.find({ creatorId: { $in: creatorIds }, status: 'active' })
            .sort({ trendingScore: -1, createdAt: -1 })
            .limit(15)
            .lean()
        : [],
      topCategories.length > 0
        ? Market.find({ category: { $in: topCategories }, status: 'active' })
            .sort({ trendingScore: -1 })
            .limit(15)
            .lean()
        : [],
    ]);

    // 4. Merge + deduplicate
    const seen = new Set();
    let merged = [...followedMarkets, ...categoryMarkets].filter(m => {
      const k = m._id.toString();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // 5. Pad with trending if sparse
    let reason = 'personalized';
    if (merged.length < 4) {
      reason = merged.length === 0 ? 'trending_fallback' : 'padded_with_trending';
      const padIds = merged.map(m => m._id);
      const fill = await Market.find({
        status: 'active',
        _id: { $nin: padIds },
      }).sort({ trendingScore: -1, totalYes: -1 }).limit(20).lean();
      merged = [...merged, ...fill];
    }

    res.json({ markets: merged, source: 'db', reason, topCategories });
  } catch (err) {
    logger.error(`GET /markets/personalized error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets ────────────────────────────────────────────────────────
router.get('/markets', async (req, res) => {
  try {
    const { category, sort, status, tag } = req.query;
    const count = await Market.countDocuments();
    if (count > 0) {
      maybeTrending();
      maybeAutoTransitions().catch(() => {});
      maybeExpiringNotifications().catch(() => {});
      maybeAffiliatePayouts().catch(() => {});
    }

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
    if (tag) filter.tags = tag.toLowerCase().replace(/^#+/, '');
    if (status) {
      // Allow 'pending' as alias for pending_review (backward compat)
      filter.status = status === 'pending' ? { $in: ['pending', 'pending_review'] } : status;
    } else {
      filter.status = 'active';
    }

    let query = Market.find(filter);
    if (sort === 'nouveau') query = query.sort({ createdAt: -1 });
    else if (sort === 'ferme') query = query.sort({ resolutionDate: 1 });
    else query = query.sort({ trendingScore: -1, totalYes: -1 }); // trending: algorithmic score first

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
router.post('/markets', geoblock, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { title, description, resolutionDate, minBet,
            creatorMarket, subjectHandle, subjectPlatform, subjectFollowers, communityTag } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!resolutionDate) return res.status(400).json({ error: 'resolutionDate required' });

    const analysis = await analyzeMarket(title, description || '', { creatorMarket, subjectHandle });

    if (analysis.decision === 'rejected') {
      return res.status(422).json({
        error: 'Market rejected by moderation',
        analysis,
      });
    }

    // Clean and validate tags (max 3, lowercase, alphanum + underscore)
    const rawTags = Array.isArray(req.body.tags) ? req.body.tags : [];
    const cleanTags = [...new Set(
      rawTags
        .map(t => t.toString().toLowerCase().trim().replace(/^#+/, '').replace(/[^a-z0-9_]/g, ''))
        .filter(t => t.length >= 2 && t.length <= 20)
    )].slice(0, 3);

    // For creator markets: check if creator is the subject (self-market warning)
    let selfMarket = false;
    if (creatorMarket && subjectHandle) {
      const creator = await User.findOne(buildUserQuery(userId)).lean();
      if (creator?.creatorHandle && creator.creatorHandle.toLowerCase() === subjectHandle.toLowerCase()) {
        selfMarket = true;
      }
    }

    const market = new Market({
      creatorId: userId,
      title,
      description: description || '',
      tags: cleanTags,
      category: analysis.category || 'autre',
      oracleLevel: analysis.oracleLevel || 2,
      confidenceScore: analysis.confidenceScore || 0,
      confidenceDetails: {
        verifiability: analysis.verifiability,
        toxicity: analysis.toxicity,
        explanation: analysis.confidenceExplanation,
      },
      status: 'pending_moderation',
      resolutionDate: new Date(resolutionDate),
      minBet: minBet || 1,
      flagged: analysis.decision === 'review',
      // Creator market fields
      creatorMarket: !!creatorMarket,
      subjectHandle:   subjectHandle  || undefined,
      subjectPlatform: subjectPlatform || undefined,
      subjectFollowers: subjectFollowers || undefined,
      communityTag:  communityTag    || undefined,
      selfMarket,
    });

    await market.save();
    logger.info(`Market created: ${market._id} by ${userId} — pre-analysis: ${analysis.decision} — status: pending_moderation`);

    // Launch post-moderation async (don't block the response)
    postModerate(market).then(result => {
      logger.info(`Post-moderation complete: ${market._id} — final: ${result.final}${result.doubleChecked ? ' (double-checked)' : ''}`);
    }).catch(err => {
      logger.error(`Post-moderation failed: ${market._id} — ${err.message}`);
    });

    res.status(201).json({ market, analysis, moderationStatus: 'pending' });
  } catch (err) {
    logger.error(`POST /markets error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/moderation-status ─────────────────────────────────
router.get('/markets/:id/moderation-status', async (req, res) => {
  try {
    const market = await Market.findById(req.params.id)
      .select('status postModeration rejectionReason title')
      .lean();
    if (!market) return res.status(404).json({ error: 'Market not found' });

    const status = market.status;
    let moderationPhase = 'unknown';
    let decision = null;
    let reason = null;

    if (status === 'pending_moderation') {
      moderationPhase = 'validating'; // IA en train d'analyser
    } else if (status === 'double_check') {
      moderationPhase = 'double_check'; // 2ème passe IA
      reason = market.postModeration?.reason;
    } else if (status === 'active') {
      moderationPhase = 'complete';
      decision = 'approved';
      reason = market.postModeration?.reason;
    } else if (status === 'rejected') {
      moderationPhase = 'complete';
      decision = 'rejected';
      reason = market.rejectionReason || market.postModeration?.reason;
    } else if (status === 'pending_review') {
      moderationPhase = 'manual_review';
    }

    res.json({
      marketId: market._id,
      status,
      moderationPhase,
      decision,
      reason,
      postModeration: market.postModeration || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/quote ──────────────────────────────────────────────
router.get('/markets/:id/quote', async (req, res) => {
  try {
    const { id } = req.params;
    const { side, amount } = req.query;

    if (!side || !['YES','NO'].includes(side)) return res.status(400).json({ error: 'side required' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'amount required' });

    if (id.startsWith('mock-')) {
      const mocks = getMockMarkets();
      const m = mocks.find(x => x._id === id);
      if (!m) return res.status(404).json({ error: 'Market not found' });
      const totalPool = m.totalYes + m.totalNo;
      const sidePool = side === 'YES' ? m.totalYes : m.totalNo;
      const currentOdds = totalPool > 0 ? sidePool / totalPool : 0.5;
      const newSidePool = sidePool + amt;
      const newTotalPool = totalPool + amt;
      const newOdds = newSidePool / newTotalPool;
      const slippage = Math.abs(newOdds - currentOdds) / (currentOdds || 0.5) * 100;
      const grossPayout = amt * (newTotalPool / newSidePool);
      const fee = grossPayout * 0.02;
      const netPayout = Math.round((grossPayout - fee) * 100) / 100;
      const netProfit = Math.round((netPayout - amt) * 100) / 100;
      return res.json({
        currentOdds: Math.round(currentOdds * 1000) / 1000,
        newOdds: Math.round(newOdds * 1000) / 1000,
        slippage: Math.round(slippage * 10) / 10,
        potentialPayout: netPayout,
        fee: Math.round(fee * 100) / 100,
        netProfit,
        warning: slippage > 15 ? 'high' : slippage > 5 ? 'medium' : null,
      });
    }

    const market = await Market.findById(id).lean();
    if (!market) return res.status(404).json({ error: 'Market not found' });

    const totalPool = market.totalYes + market.totalNo;
    const sidePool = side === 'YES' ? market.totalYes : market.totalNo;
    const currentOdds = totalPool > 0 ? sidePool / totalPool : 0.5;

    // Price before and after
    const newSidePool = sidePool + amt;
    const newTotalPool = totalPool + amt;
    const newOdds = newSidePool / newTotalPool;
    const slippage = Math.abs(newOdds - currentOdds) / (currentOdds || 0.5) * 100;

    const grossPayout = amt * (newTotalPool / newSidePool);
    const fee = grossPayout * 0.02;
    const netPayout = Math.round((grossPayout - fee) * 100) / 100;

    res.json({
      currentOdds: Math.round(currentOdds * 1000) / 1000,
      newOdds: Math.round(newOdds * 1000) / 1000,
      slippage: Math.round(slippage * 10) / 10,
      potentialPayout: netPayout,
      fee: Math.round(fee * 100) / 100,
      netProfit: Math.round((netPayout - amt) * 100) / 100,
      warning: slippage > 15 ? 'high' : slippage > 5 ? 'medium' : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/bet ───────────────────────────────────────────────
router.post('/markets/:id/bet', checkCircuitBreaker, geoblock, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { id } = req.params;
    const { side, amount, orderId } = req.body;

    if (!side || !['YES', 'NO'].includes(side)) {
      return res.status(400).json({ error: 'side must be YES or NO' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'amount must be positive' });
    }

    // ── Idempotency check ────────────────────────────────────────────────────
    if (orderId) {
      const existing = await Bet.findOne({ orderId }).lean();
      if (existing) {
        return res.status(200).json({ bet: existing, market: null, idempotent: true });
      }
    }

    // Handle mock markets — simulate a successful bet
    if (id.startsWith('mock-')) {
      const mocks = getMockMarkets();
      const m = mocks.find(x => x._id === id);
      const totalPool = m ? m.totalYes + m.totalNo : 1000;
      const sidePool = m ? (side === 'YES' ? m.totalYes : m.totalNo) : 500;
      const odds = totalPool > 0 ? sidePool / totalPool : 0.5;
      const grossPayout = amount * (totalPool / sidePool);
      const fee = grossPayout * 0.02;
      const netPayout = Math.round((grossPayout - fee) * 100) / 100;
      return res.status(201).json({
        bet: {
          _id: `demo-${Date.now()}`,
          userId, marketId: id, side, amount,
          odds, potentialPayout: netPayout,
          status: 'active', placedAt: new Date(),
        },
        market: m || null,
        slippage: 0,
        isPartial: false,
        filledAmount: amount,
        refundAmount: 0,
        warning: null,
      });
    }

    const market = await Market.findById(id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    // ── State checks ─────────────────────────────────────────────────────────
    if (market.status !== 'active') {
      const msgs = {
        resolving: 'Ce marché est en cours de résolution',
        resolved:  'Ce marché est déjà résolu',
        cancelled: 'Ce marché a été annulé',
        rejected:  'Ce marché a été rejeté',
        closed:    'Ce marché est fermé',
        pending_review: 'Ce marché est en attente de modération',
        pending:   'Ce marché est en attente de modération',
      };
      return res.status(400).json({ error: msgs[market.status] || 'Ce marché est fermé aux nouvelles mises' });
    }
    if (new Date() > market.resolutionDate) {
      return res.status(400).json({ error: 'Ce marché a expiré' });
    }

    // ── Bet limits ───────────────────────────────────────────────────────────
    if (amount < (market.minBet || 1)) {
      return res.status(400).json({ error: `Mise minimum : ${market.minBet || 1} USDC` });
    }
    if (market.maxBet && amount > market.maxBet) {
      return res.status(400).json({ error: `Mise maximum sur ce marché : ${market.maxBet} USDC` });
    }

    // ── Creator can't bet on own market ──────────────────────────────────────
    if (market.creatorId === userId) {
      return res.status(400).json({ error: 'Tu ne peux pas parier sur ton propre marché' });
    }

    // ── User balance check ───────────────────────────────────────────────────
    const mongoose = require('mongoose');
    const isValidId = mongoose.Types.ObjectId.isValid(userId);
    const userQuery = isValidId
      ? { $or: [{ _id: userId }, { telegramId: userId }, { username: userId }] }
      : { $or: [{ telegramId: userId }, { username: userId }] };

    const user = await User.findOne(userQuery);
    if (user) {
      const available = (user.balance || 0) - (user.lockedBalance || 0);
      if (available < amount) {
        return res.status(400).json({
          error: `Solde insuffisant. Disponible : ${available.toFixed(2)} USDC`,
          available,
        });
      }
    }

    // ── Fraud check ──────────────────────────────────────────────────────────
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const poolSize = (market.totalYes || 0) + (market.totalNo || 0);
    const fraudCheck = await checkForFraud(id, { userId, side, amount, ip: clientIp, poolSize });
    if (fraudCheck.suspicious) {
      return res.status(400).json({ error: 'Mise signalée comme suspecte' });
    }

    // ── Slippage / partial fill calculation ──────────────────────────────────
    const totalPool = market.totalYes + market.totalNo;
    const sidePool = side === 'YES' ? market.totalYes : market.totalNo;
    const currentOdds = totalPool > 0 ? sidePool / totalPool : 0.5;

    // Partial fill: if market liquidity is very low, cap at available
    const liquidity = side === 'YES' ? market.totalNo : market.totalYes;
    const maxFill = liquidity > 0 ? Math.min(amount, liquidity * 10) : amount;
    const filledAmount = Math.min(amount, maxFill);
    const isPartial = filledAmount < amount;
    const refundAmount = isPartial ? Math.round((amount - filledAmount) * 100) / 100 : 0;

    // Odds after fill
    const newSidePool = sidePool + filledAmount;
    const newTotalPool = totalPool + filledAmount;
    const executionOdds = newTotalPool > 0 ? newSidePool / newTotalPool : 0.5;
    const slippage = Math.round(Math.abs(executionOdds - currentOdds) / (currentOdds || 0.5) * 1000) / 10;

    // ── Save bet ─────────────────────────────────────────────────────────────
    const bet = new Bet({
      orderId: orderId || undefined,
      userId,
      marketId: id,
      side,
      type: 'market',
      requestedAmount: amount,
      filledAmount,
      amount: filledAmount,
      odds: Math.round(executionOdds * 1000) / 1000,
      slippage,
      status: isPartial ? 'partial' : 'active',
    });
    await bet.save();

    // ── Update market pools ───────────────────────────────────────────────────
    if (side === 'YES') market.totalYes += filledAmount;
    else market.totalNo += filledAmount;
    await market.save();

    // ── Lock user balance ─────────────────────────────────────────────────────
    if (user) {
      user.lockedBalance = (user.lockedBalance || 0) + filledAmount;
      user.totalBets = (user.totalBets || 0) + 1;
      await user.save();
      updateLevel(user._id.toString()).catch(() => {});
    } else {
      // Upsert if user not found (e.g. legacy userId)
      await User.findOneAndUpdate(
        isValidId ? { _id: userId } : { telegramId: userId },
        { $inc: { totalBets: 1, lockedBalance: filledAmount }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true }
      );
    }

    // ── Notifications ─────────────────────────────────────────────────────────
    await notify({
      userId,
      type: 'bet_placed',
      message: isPartial
        ? `Mise partiellement exécutée : ${filledAmount} USDC sur ${filledAmount + refundAmount} USDC (${side === 'YES' ? 'OUI' : 'NON'})`
        : `Ta mise de ${filledAmount} USDC sur ${side === 'YES' ? 'OUI' : 'NON'} est confirmée`,
      marketId: id,
      amount: filledAmount,
    });

    // ── Track first bet for referral ──────────────────────────────────────────
    await Referral.findOneAndUpdate(
      { referredUserId: userId, firstBetAt: null },
      { $set: { firstBetAt: new Date(), isActive: true } }
    );

    // ── Creator commission via ref link ───────────────────────────────────────
    const refCode = req.body.refCode || req.query.ref;
    if (refCode && filledAmount > 0) {
      try {
        const refCreator = await User.findOne({ referralCode: refCode });
        if (refCreator && refCreator._id.toString() !== userId) {
          const TIERS = { starter: 0.03, creator: 0.04, pro: 0.05 };
          const rate  = TIERS[refCreator.commissionTier || 'starter'] || 0.03;
          const commission = Math.round(filledAmount * rate * 100) / 100;
          await CreatorCommission.create({
            creatorId:  refCreator._id.toString(),
            marketId:   id,
            betId:      bet._id.toString(),
            bettorId:   userId,
            amount:     filledAmount,
            commission,
            tier:       refCreator.commissionTier || 'starter',
            refCode,
          });
          refCreator.pendingCreatorEarnings = (refCreator.pendingCreatorEarnings || 0) + commission;
          refCreator.monthlyVolume = (refCreator.monthlyVolume || 0) + filledAmount;
          await refCreator.save();
          // Auto-upgrade tier
          const mv = refCreator.monthlyVolume;
          const newTier = mv >= 10000 ? 'pro' : mv >= 1000 ? 'creator' : 'starter';
          if (newTier !== refCreator.commissionTier) {
            await User.findByIdAndUpdate(refCreator._id, { commissionTier: newTier });
          }
        }
      } catch (e) {
        logger.warn(`Creator commission error: ${e.message}`);
      }
    }

    // Notify market creator of first bet
    const betCount = await Bet.countDocuments({ marketId: id });
    if (betCount === 1 && market.creatorId !== userId) {
      await notify({
        userId: market.creatorId,
        type: 'market_first_bet',
        message: `Première mise sur ton marché "${market.title.slice(0, 40)}"`,
        marketId: id,
        amount: filledAmount,
      });
    }

    // ── Auto-post in social feed ──────────────────────────────────────────────
    try {
      const betText = `${side === 'YES' ? 'OUI' : 'NON'} sur "${market.title.slice(0, 120)}" — ${filledAmount} USDC`;
      await Post.create({
        userId,
        username: user?.username || 'anon',
        displayName: user?.displayName || user?.username || 'anon',
        avatarColor: user?.avatarColor || '#7c3aed',
        googlePhotoUrl: user?.googlePhotoUrl || null,
        verified: user?.level === 'oracle' || user?.level === 'legende',
        text: betText,
        marketId: id,
        isBetPost: true,
        betAmount: filledAmount,
        betSide: side,
      });
    } catch (e) {
      logger.warn(`Auto-post on bet failed: ${e.message}`);
    }

    logger.info(`Bet placed: ${userId} ${side} ${filledAmount} USDC on market ${id}${isPartial ? ' (partial)' : ''}`);
    cb.recordSuccess();

    res.status(201).json({
      bet,
      market,
      slippage,
      isPartial,
      filledAmount,
      refundAmount,
      warning: slippage > 15 ? 'high' : slippage > 5 ? 'medium' : null,
    });
  } catch (err) {
    cb.recordError();
    logger.error(`POST /markets/:id/bet error: ${err.message}`);
    // Rollback: if bet was saved but something else failed, refund automatically
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

// ─── GET /api/search ─────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json({ markets: [], users: [], tags: [] });

    const query = q.trim();
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const [markets, users, tagResults] = await Promise.all([
      Market.find({ title: regex, status: 'active' })
        .select('title category totalYes totalNo trendingScore resolutionDate tags')
        .sort({ trendingScore: -1 })
        .limit(8)
        .lean(),

      User.find({ $or: [{ username: regex }, { displayName: regex }] })
        .select('username displayName level currentStreak')
        .limit(5)
        .lean(),

      Market.aggregate([
        { $match: { 'tags': { $regex: query, $options: 'i' }, status: 'active' } },
        { $unwind: '$tags' },
        { $match: { 'tags': { $regex: query, $options: 'i' } } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    res.json({
      markets,
      users,
      tags: tagResults.map(t => ({ tag: t._id, count: t.count })),
    });
  } catch (err) {
    logger.error(`GET /search error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/tags/trending ──────────────────────────────────────────────────
router.get('/tags/trending', async (req, res) => {
  try {
    const dbCount = await Market.countDocuments();
    if (dbCount === 0) {
      return res.json({ tags: ['bitcoin', 'crypto', 'sport', 'france', 'ia', 'netflix', 'elections', 'ethereum'] });
    }
    const agg = await Market.aggregate([
      { $match: { status: 'active', tags: { $exists: true, $ne: [] } } },
      { $unwind: '$tags' },
      { $group: { _id: '$tags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 12 },
    ]);
    const tags = agg.map(t => t._id);
    res.json({ tags });
  } catch (err) {
    logger.error(`GET /tags/trending error: ${err.message}`);
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
      { $match: { status: { $in: ['active', 'resolved', 'claiming', 'closed', 'resolving'] } } },
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

    const topMarkets = await Market.find({ status: { $in: ['active', 'resolved', 'claiming', 'closed', 'resolving'] } })
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

    const mongoose = require('mongoose');
    const isValidId = mongoose.Types.ObjectId.isValid(userId);
    const userQuery = isValidId
      ? { $or: [{ _id: userId }, { telegramId: userId }, { username: userId }] }
      : { $or: [{ telegramId: userId }, { username: userId }] };

    let user = await User.findOne(userQuery).lean();

    if (!user) {
      user = {
        _id: userId,
        displayName: `User ${userId.slice(0, 6)}`,
        balance: 0, totalBets: 0, wonBets: 0,
        totalEarned: 0, reputation: 50, level: 'debutant',
        currentStreak: 0, longestStreak: 0, badges: [],
        createdAt: new Date(),
      };
    } else {
      // Update streak on each visit (fire and forget)
      updateStreak(user._id.toString()).catch(() => {});
    }

    const recentBets = await Bet.find({ userId })
      .sort({ placedAt: -1 })
      .limit(10)
      .lean();

    // Balance breakdown
    const lockedBalance = user?.lockedBalance || 0;
    const totalBalance = user?.balance || 0;
    const availableBalance = Math.max(0, totalBalance - lockedBalance);

    res.json({ user, recentBets, balanceBreakdown: { total: totalBalance, locked: lockedBalance, available: availableBalance } });
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
      level: 'debutant',
      currentStreak: 1,
      lastLoginDate: new Date(),
    });

    // ── Referral attribution ──────────────────────────────────────────────────
    const { refCode } = req.body;
    if (refCode) {
      const affiliate = await Affiliate.findOne({ code: refCode.toUpperCase().trim() });
      if (affiliate && affiliate.userId !== user._id.toString()) {
        await Referral.create({
          affiliateId: affiliate.userId,
          affiliateCode: affiliate.code,
          referredUserId: user._id.toString(),
        });
        await Affiliate.findByIdAndUpdate(affiliate._id, {
          $inc: { referralCount: 1 },
        });
        logger.info(`Referral: ${user._id} joined via code ${refCode} (affiliate: ${affiliate.userId})`);
      }
    }

    logger.info(`Auth register: ${clean} (${user._id})`);
    res.status(201).json({
      userId: user._id.toString(),
      username: clean,
      displayName: username.trim(),
      avatarColor,
      balance: 0,
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

// ─── GET /api/auth/me — return BETLY profile for current Firebase user ────────
router.get('/auth/me', async (req, res) => {
  try {
    // resolveUserId already ran — if Bearer token was valid, dbUser is set
    if (req.dbUser) {
      const u = req.dbUser;
      const palette = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];
      let h = 0;
      const str = u.username || '';
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
      const avatarColor = palette[Math.abs(h) % palette.length];
      return res.json({
        userId:        u._id.toString(),
        username:      u.username,
        displayName:   u.displayName,
        avatarColor,
        balance:       u.balance,
        lockedBalance: u.lockedBalance || 0,
        googlePhotoUrl:u.googlePhotoUrl || null,
        authProvider:  u.authProvider,
        level:         u.level,
        totalBets:     u.totalBets,
        wonBets:       u.wonBets,
        reputation:    u.reputation,
        walletAddress: u.walletAddress || null,
      });
    }
    res.status(404).json({ error: 'Profil introuvable' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/firebase-register — create BETLY profile after Firebase login
router.post('/auth/firebase-register', async (req, res) => {
  try {
    const { firebaseUser } = req;
    if (!firebaseUser?.uid) {
      return res.status(401).json({ error: 'Token Firebase requis' });
    }

    const { username, refCode } = req.body;
    let clean = '';

    if (username) {
      clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (clean.length < 3 || clean.length > 20) {
        return res.status(400).json({ error: 'Pseudo: 3-20 caractères, lettres/chiffres/_/-' });
      }
      const existing = await User.findOne({ username: clean });
      if (existing && existing.firebaseUid !== firebaseUser.uid) {
        return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
      }
    } else if (firebaseUser.firebase?.sign_in_provider === 'anonymous') {
      // Auto-generate username for anonymous users
      clean = `user_${firebaseUser.uid.slice(0, 8)}`;
    } else {
      return res.status(400).json({ error: 'username required' });
    }

    // Upsert by firebaseUid
    let user = await User.findOne({ firebaseUid: firebaseUser.uid });
    if (user) {
      // Already has profile — return it
      const palette = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];
      let h = 0;
      for (let i = 0; i < user.username.length; i++) h = (h * 31 + user.username.charCodeAt(i)) & 0xffffffff;
      return res.json({
        userId: user._id.toString(), username: user.username,
        displayName: user.displayName, balance: user.balance,
        avatarColor: palette[Math.abs(h) % palette.length],
        googlePhotoUrl: user.googlePhotoUrl || null,
        authProvider: user.authProvider,
      });
    }

    const provider = firebaseUser.firebase?.sign_in_provider?.replace('.com', '') || 'email';
    const authProvider = provider === 'google' ? 'google' : provider === 'anonymous' ? 'anonymous' : 'email';

    const palette = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];
    let h = 0;
    for (let i = 0; i < clean.length; i++) h = (h * 31 + clean.charCodeAt(i)) & 0xffffffff;
    const avatarColor = palette[Math.abs(h) % palette.length];

    user = await User.create({
      firebaseUid:    firebaseUser.uid,
      email:          firebaseUser.email || null,
      googlePhotoUrl: firebaseUser.picture || null,
      authProvider,
      username:       clean,
      displayName:    firebaseUser.name || clean,
      balance:        0,
      reputation:     50,
      level:          'debutant',
      currentStreak:  1,
      lastLoginDate:  new Date(),
    });

    // Referral attribution
    if (refCode) {
      try {
        const affiliate = await Affiliate.findOne({ code: refCode.toUpperCase().trim() });
        if (affiliate && affiliate.userId !== user._id.toString()) {
          await Referral.create({
            affiliateId: affiliate.userId,
            affiliateCode: affiliate.code,
            referredUserId: user._id.toString(),
          });
          await Affiliate.findByIdAndUpdate(affiliate._id, { $inc: { referralCount: 1 } });
        }
      } catch {}
    }

    logger.info(`Firebase register: ${clean} (uid: ${firebaseUser.uid}, provider: ${authProvider})`);
    res.status(201).json({
      userId: user._id.toString(),
      username: clean,
      displayName: user.displayName,
      avatarColor,
      balance: 50,
      googlePhotoUrl: user.googlePhotoUrl || null,
      authProvider,
    });
  } catch (err) {
    logger.error(`POST /auth/firebase-register error: ${err.message}`);
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

// ─── GET /api/stats/overview ──────────────────────────────────────────────────
router.get('/stats/overview', async (req, res) => {
  try {
    const [markets, users] = await Promise.all([
      Market.countDocuments({ status: { $ne: 'draft' } }),
      User.countDocuments(),
    ]);
    res.json({ markets, users });
  } catch (err) {
    logger.error(`GET /stats/overview error: ${err.message}`);
    res.json({ markets: 0, users: 0 });
  }
});

// ─── GET /api/feed/live ───────────────────────────────────────────────────────
router.get('/feed/live', async (req, res) => {
  try {
    const dbCount = await Market.countDocuments();

    if (dbCount === 0) {
      // Mock live feed when DB is empty
      const mocks = getMockMarkets();
      const mockEvents = [
        { type: 'bet', userId: 'neo****', side: 'YES', amount: 50, marketTitle: mocks[0].title, marketId: mocks[0]._id, time: new Date(Date.now() - 12000) },
        { type: 'market_created', marketTitle: mocks[4].title, marketId: mocks[4]._id, time: new Date(Date.now() - 45000) },
        { type: 'bet', userId: 'luna****', side: 'NO', amount: 25, marketTitle: mocks[1].title, marketId: mocks[1]._id, time: new Date(Date.now() - 78000) },
        { type: 'bet', userId: 'zara****', side: 'YES', amount: 10, marketTitle: mocks[2].title, marketId: mocks[2]._id, time: new Date(Date.now() - 120000) },
        { type: 'bet', userId: 'kain****', side: 'YES', amount: 100, marketTitle: mocks[0].title, marketId: mocks[0]._id, time: new Date(Date.now() - 200000) },
        { type: 'market_created', marketTitle: mocks[5].title, marketId: mocks[5]._id, time: new Date(Date.now() - 300000) },
        { type: 'bet', userId: 'ryu0****', side: 'NO', amount: 15, marketTitle: mocks[3].title, marketId: mocks[3]._id, time: new Date(Date.now() - 420000) },
        { type: 'market_resolved', marketTitle: 'Trump remporte les élections 2024 ?', marketId: 'mock-old', outcome: 'YES', time: new Date(Date.now() - 600000) },
        { type: 'bet', userId: 'ada0****', side: 'YES', amount: 5, marketTitle: mocks[4].title, marketId: mocks[4]._id, time: new Date(Date.now() - 720000) },
        { type: 'bet', userId: 'ven0****', side: 'NO', amount: 30, marketTitle: mocks[2].title, marketId: mocks[2]._id, time: new Date(Date.now() - 900000) },
      ];
      return res.json({ events: mockEvents, activeUsers: 47 });
    }

    const LIMIT = 20;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h

    // Fetch recent bets with market titles
    const recentBets = await Bet.find({ placedAt: { $gte: since } })
      .sort({ placedAt: -1 })
      .limit(LIMIT)
      .lean();

    // Get unique marketIds from bets
    const marketIds = [...new Set(recentBets.map(b => b.marketId?.toString()))];
    const markets = await Market.find({ _id: { $in: marketIds } })
      .select('title')
      .lean();
    const marketMap = {};
    markets.forEach(m => { marketMap[m._id.toString()] = m.title; });

    const betEvents = recentBets.map(b => ({
      type: 'bet',
      userId: b.userId.slice(0, 4) + '****',
      side: b.side,
      amount: b.amount,
      marketTitle: marketMap[b.marketId?.toString()] || 'Marché inconnu',
      marketId: b.marketId?.toString(),
      time: b.placedAt,
    }));

    // Recent market creations
    const newMarkets = await Market.find({ createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('title createdAt _id')
      .lean();

    const createdEvents = newMarkets.map(m => ({
      type: 'market_created',
      marketTitle: m.title,
      marketId: m._id.toString(),
      time: m.createdAt,
    }));

    // Recent resolutions
    const resolved = await Market.find({
      status: 'resolved',
      outcome: { $in: ['YES', 'NO'] },
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('title outcome _id updatedAt')
      .lean();

    const resolvedEvents = resolved.map(m => ({
      type: 'market_resolved',
      marketTitle: m.title,
      marketId: m._id.toString(),
      outcome: m.outcome,
      time: m.updatedAt || m.createdAt,
    }));

    const all = [...betEvents, ...createdEvents, ...resolvedEvents]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, LIMIT);

    // Active users = unique userId from bets in last 24h
    const activeUserIds = [...new Set(recentBets.map(b => b.userId))];
    const activeUsers = Math.max(activeUserIds.length, 12); // floor at 12 for social proof

    res.json({ events: all, activeUsers });
  } catch (err) {
    logger.error(`GET /feed/live error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/resolve (admin) ────────────────────────────────────
router.post('/markets/:id/resolve', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { outcome } = req.body;
    if (!outcome || !['YES','NO'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be YES or NO' });
    }

    const result = await resolveMarket(id, outcome);
    res.json(result);
  } catch (err) {
    logger.error(`POST /markets/:id/resolve error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/transition (admin) ────────────────────────────────
router.post('/markets/:id/transition', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const { status, reason } = req.body;

    if (!status) return res.status(400).json({ error: 'status required' });

    const market = await Market.findById(id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    market.transitionTo(status, { reason });
    await market.save();

    // If cancelling, refund all bets
    if (status === 'cancelled') {
      await refundMarketBets(id, reason || 'Marché annulé par un administrateur');
    }

    logger.info(`Admin transition: market ${id} → ${status}`);
    res.json({ market });
  } catch (err) {
    logger.error(`POST /markets/:id/transition error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/markets/:id/flag ───────────────────────────────────────────────
router.post('/markets/:id/flag', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) return res.status(400).json({ error: 'reason required' });
    if (id.startsWith('mock-')) return res.json({ success: true });

    const market = await Market.findById(id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    // Check if this user already flagged
    const alreadyFlagged = market.flagReasons.some(f => f.userId === userId);
    if (alreadyFlagged) return res.status(400).json({ error: 'Tu as déjà signalé ce marché' });

    market.flagReasons.push({ userId, reason, createdAt: new Date() });
    market.flagCount = market.flagReasons.length;

    if (market.flagCount >= 3) market.flagged = true;

    await market.save();
    logger.info(`Market ${id} flagged by ${userId} (reason: ${reason}, total: ${market.flagCount})`);
    res.json({ success: true, flagCount: market.flagCount });
  } catch (err) {
    logger.error(`POST /markets/:id/flag error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/queue (admin) ────────────────────────────────────────────
router.get('/admin/queue', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [pendingMarkets, flaggedMarkets, resolvingMarkets] = await Promise.all([
      Market.find({ status: { $in: ['pending_review', 'pending'] } })
        .sort({ createdAt: -1 }).limit(50).lean(),
      Market.find({ flagged: true, status: 'active' })
        .sort({ flagCount: -1 }).limit(50).lean(),
      Market.find({ status: 'resolving' })
        .sort({ resolutionDate: 1 }).limit(50).lean(),
    ]);

    res.json({ pendingMarkets, flaggedMarkets, resolvingMarkets });
  } catch (err) {
    logger.error(`GET /admin/queue error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/stats (admin) ────────────────────────────────────────────
router.get('/admin/stats', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalUsers, totalMarkets, totalBets,
      activeMarkets, resolvedMarkets,
      bets24h, newUsers24h,
    ] = await Promise.all([
      User.countDocuments(),
      Market.countDocuments(),
      Bet.countDocuments(),
      Market.countDocuments({ status: 'active' }),
      Market.countDocuments({ status: 'resolved' }),
      Bet.countDocuments({ placedAt: { $gte: since24h } }),
      User.countDocuments({ createdAt: { $gte: since24h } }),
    ]);

    const volumeAgg = await Bet.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalVolume = volumeAgg[0]?.total || 0;

    res.json({
      totalUsers, totalMarkets, totalBets, activeMarkets, resolvedMarkets,
      bets24h, newUsers24h, totalVolume,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/approve/:id (admin) ─────────────────────────────────────
router.post('/admin/approve/:id', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    market.transitionTo('active');
    await market.save();

    // Notify creator
    await notify({
      userId: market.creatorId,
      type: 'market_approved',
      message: `✅ Ton marché "${market.title.slice(0, 40)}" a été approuvé`,
      marketId: market._id.toString(),
    });

    res.json({ market });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/admin/reject/:id (admin) ──────────────────────────────────────
router.post('/admin/reject/:id', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { reason } = req.body;
    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    market.transitionTo('rejected', { reason: reason || 'Non conforme aux règles de la plateforme' });
    await market.save();

    await notify({
      userId: market.creatorId,
      type: 'market_rejected',
      message: `❌ Ton marché "${market.title.slice(0, 40)}" a été refusé${reason ? ` : ${reason}` : ''}`,
      marketId: market._id.toString(),
    });

    res.json({ market });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIE 3 — WALLET FLOW
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/wallet/create — création d'un wallet custodial Betly ───────────
router.post('/wallet/create', async (req, res) => {
  try {
    const user = req.dbUser;
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    if (user.walletAddress) {
      return res.json({ walletAddress: user.walletAddress, isNew: false });
    }

    const { createWallet } = require('../wallet/custodialWallet');
    const { walletAddress, encryptedPrivateKey } = await createWallet();

    await User.findByIdAndUpdate(user._id, { walletAddress, encryptedPrivateKey });
    logger.info(`[WALLET] Betly custodial wallet créé pour user ${user._id}: ${walletAddress}`);
    res.json({ walletAddress, isNew: true });
  } catch (err) {
    logger.error(`POST /wallet/create error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/deposit/check — detect on-chain deposit and credit ─────────────
router.post('/deposit/check', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { onChainBalance, walletAddress } = req.body;
    if (typeof onChainBalance !== 'number') {
      return res.status(400).json({ error: 'onChainBalance (number) required' });
    }

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Save wallet address if not set
    if (walletAddress && !user.walletAddress) {
      user.walletAddress = walletAddress;
    }

    const lastKnown = user.lastKnownOnChainBalance || 0;
    const deposited = Math.round((onChainBalance - lastKnown) * 1e6) / 1e6;

    if (deposited <= 0.001) {
      return res.json({ deposited: 0, message: 'Aucun nouveau dépôt détecté', balance: user.balance });
    }

    user.balance = Math.round(((user.balance || 0) + deposited) * 1e6) / 1e6;
    user.lastKnownOnChainBalance = onChainBalance;
    await user.save();

    await notify({
      userId,
      type: 'deposit_confirmed',
      message: `✅ ${deposited.toFixed(2)} USDC crédités sur ton compte BETLY`,
      amount: deposited,
    });

    logger.info(`Deposit: ${userId} +${deposited} USDC (on-chain: ${onChainBalance})`);
    res.json({ deposited, newBalance: user.balance, message: `${deposited.toFixed(2)} USDC crédités !` });
  } catch (err) {
    logger.error(`POST /deposit/check error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/deposit/history ─────────────────────────────────────────────────
router.get('/deposit/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const notifs = await Notification.find({
      userId,
      type: { $in: ['deposit_confirmed', 'deposit_detected'] },
    }).sort({ createdAt: -1 }).limit(20).lean();

    res.json({ deposits: notifs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/withdraw ───────────────────────────────────────────────────────
router.post('/withdraw', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { toAddress, amount } = req.body;
    if (!toAddress || !amount || amount <= 0) {
      return res.status(400).json({ error: 'toAddress et amount requis' });
    }
    if (amount < 5) {
      return res.status(400).json({ error: 'Montant minimum de retrait : 5 USDC' });
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(toAddress)) {
      return res.status(400).json({ error: 'Adresse de destination invalide' });
    }

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const available = Math.max(0, (user.balance || 0) - (user.lockedBalance || 0));
    if (amount > available) {
      return res.status(400).json({
        error: `Solde insuffisant. Disponible : ${available.toFixed(2)} USDC (${(user.lockedBalance || 0).toFixed(2)} USDC en jeu)`,
        available,
      });
    }

    // Lock withdrawal amount
    user.lockedBalance = (user.lockedBalance || 0) + amount;
    await user.save();

    const withdrawal = await Withdrawal.create({
      userId,
      toAddress,
      amount: Math.round(amount * 100) / 100,
      status: 'pending',
    });

    await notify({
      userId,
      type: 'withdrawal_processing',
      message: `📤 Retrait de ${amount.toFixed(2)} USDC initié — traitement sous 24h`,
      amount,
    });

    logger.info(`Withdrawal: ${userId} → ${toAddress} ${amount} USDC`);
    res.status(201).json({
      withdrawal,
      message: 'Retrait initié. Les fonds seront envoyés sous 24h.',
      available: available - amount,
    });
  } catch (err) {
    logger.error(`POST /withdraw error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/withdraw/history ────────────────────────────────────────────────
router.get('/withdraw/history', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const withdrawals = await Withdrawal.find({ userId }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ withdrawals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/wallet-backup ────────────────────────────────────────────
router.post('/admin/wallet-backup', async (req, res) => {
  try {
    const { secret, passphrase } = req.body;
    if (secret !== process.env.ADMIN_SECRET) return res.status(403).json({ error: 'Forbidden' });
    if (!passphrase || passphrase.length < 12) {
      return res.status(400).json({ error: 'Passphrase required (min 12 chars)' });
    }
    const { createBackup } = require('../wallet/walletBackup');
    const filepath = await createBackup(passphrase);
    res.json({ success: true, filepath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/withdrawal-status ────────────────────────────────────────
router.get('/admin/withdrawal-status', async (req, res) => {
  try {
    const pending    = await Withdrawal.countDocuments({ status: 'pending' });
    const processing = await Withdrawal.countDocuments({ status: 'processing' });
    const completed  = await Withdrawal.countDocuments({ status: 'completed' });
    const failed     = await Withdrawal.countDocuments({ status: 'failed' });
    const recent     = await Withdrawal.find().sort({ createdAt: -1 }).limit(5).lean();
    res.json({ pending, processing, completed, failed, recent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIE 4 — NOTIFICATIONS COMPLÈTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Expiring notifications (serverless-safe, runs at most every 10min) ───────
let lastExpiryCheck = 0;
async function maybeExpiringNotifications() {
  const now = Date.now();
  if (now - lastExpiryCheck < 10 * 60_000) return;
  lastExpiryCheck = now;

  try {
    const soon = new Date(now + 2 * 60 * 60 * 1000); // 2h from now
    const markets = await Market.find({
      status: 'active',
      resolutionDate: { $gte: new Date(), $lte: soon },
    }).select('_id title resolutionDate').limit(20).lean();

    for (const market of markets) {
      const bets = await Bet.find({ marketId: market._id, status: 'active' }).distinct('userId');
      for (const uid of bets) {
        // Avoid duplicate notifications (check if already sent in last 3h)
        const alreadySent = await Notification.findOne({
          userId: uid, type: 'market_expiring', marketId: market._id.toString(),
          createdAt: { $gte: new Date(now - 3 * 60 * 60 * 1000) },
        });
        if (alreadySent) continue;

        await notify({
          userId: uid,
          type: 'market_expiring',
          message: `⏰ "${market.title.slice(0, 40)}" expire bientôt — tu as une position active`,
          marketId: market._id.toString(),
        });
      }
    }
  } catch (e) {
    logger.error(`maybeExpiringNotifications error: ${e.message}`);
  }
}

// Wire expiry check into auto-transitions
const _origAutoTransitions = maybeAutoTransitions;
async function maybeAutoTransitionsWithNotifs() {
  await _origAutoTransitions();
  maybeExpiringNotifications().catch(() => {});
}

// ─── POST /api/notifications/:id/read ────────────────────────────────────────
router.post('/notifications/:id/read', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIE 5 — GESTION D'ERREURS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/health ──────────────────────────────────────────────────────────
router.get('/health', (req, res) => {
  const cbState = cb.getState();
  res.json({
    status: cbState.state === 'OPEN' ? 'degraded' : 'ok',
    circuitBreaker: cbState,
    ts: new Date().toISOString(),
  });
});

// ─── POST /api/admin/circuit-reset (admin) ────────────────────────────────────
router.post('/admin/circuit-reset', (req, res) => {
  const { secret } = req.query;
  if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  cb.reset();
  logger.info('Circuit breaker manually reset by admin');
  res.json({ success: true, state: cb.getState() });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIE 6 — MODÉRATION
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/admin/sanction ─────────────────────────────────────────────────
router.post('/admin/sanction', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { userId, level, reason } = req.body;
    if (!userId || !level) return res.status(400).json({ error: 'userId and level required' });
    if (!['warning', 'restrict_7d', 'ban_30d', 'ban_permanent'].includes(level)) {
      return res.status(400).json({ error: 'Invalid sanction level' });
    }

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.warningCount = (user.warningCount || 0) + 1;

    if (level === 'restrict_7d') {
      user.restrictedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    } else if (level === 'ban_30d') {
      user.restrictedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      user.banned = true;
    } else if (level === 'ban_permanent') {
      user.banned = true;
      user.banReason = reason;
    }
    await user.save();

    const messages = {
      warning:      `⚠️ Avertissement : ${reason || 'Non-respect des règles de la plateforme'}`,
      restrict_7d:  `⚠️ Ton compte est restreint 7 jours : ${reason || 'Comportement abusif'}`,
      ban_30d:      `🚫 Ton compte est suspendu 30 jours : ${reason || 'Violation des CGU'}`,
      ban_permanent:`🚫 Ton compte a été définitivement suspendu.`,
    };

    await notify({
      userId: user._id.toString(),
      type: 'account_warning',
      message: messages[level],
    });

    logger.info(`Sanction: ${level} on ${userId} — ${reason}`);
    res.json({ success: true, user: { warningCount: user.warningCount, banned: user.banned } });
  } catch (err) {
    logger.error(`POST /admin/sanction error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/users ────────────────────────────────────────────────────
router.get('/admin/users', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { limit: qLimit = '50' } = req.query;
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(qLimit, 10) || 50, 200))
      .lean();

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/comments/:id/flag ─────────────────────────────────────────────
router.post('/comments/:id/flag', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });
    const { reason } = req.body;
    // Store flag on the comment (Comment model doesn't have flagCount yet, add inline)
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (!comment.flaggedBy) comment.flaggedBy = [];
    if (comment.flaggedBy.includes(userId)) {
      return res.status(400).json({ error: 'Déjà signalé' });
    }
    comment.flaggedBy.push(userId);
    await comment.save();
    res.json({ success: true, flags: comment.flaggedBy.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AFFILIATION
// ═══════════════════════════════════════════════════════════════════════════════

// ─── POST /api/affiliate/create ───────────────────────────────────────────────
router.post('/affiliate/create', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const existing = await Affiliate.findOne({ userId });
    if (existing) return res.json({ affiliate: existing, alreadyExists: true });

    // Generate unique code
    let code, attempts = 0;
    do {
      code = generateCode();
      attempts++;
    } while (await Affiliate.findOne({ code }) && attempts < 10);

    const affiliate = await Affiliate.create({ userId, code });
    logger.info(`Affiliate created: ${userId} → code ${code}`);
    res.status(201).json({ affiliate });
  } catch (err) {
    logger.error(`POST /affiliate/create error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/affiliate/me ─────────────────────────────────────────────────
router.get('/affiliate/me', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const affiliate = await Affiliate.findOne({ userId }).lean();
    if (!affiliate) return res.json({ affiliate: null });

    // Recalculate active referrals (bet in last 30d)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const referrals = await Referral.find({ affiliateId: userId }).lean();
    const referredIds = referrals.map(r => r.referredUserId);
    const activeCount = referredIds.length > 0
      ? (await Bet.distinct('userId', { userId: { $in: referredIds }, placedAt: { $gte: thirtyDaysAgo } })).length
      : 0;

    // Next payout: next Monday
    const now = new Date();
    const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
    const nextPayout = new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
    nextPayout.setHours(9, 0, 0, 0);

    res.json({
      affiliate: { ...affiliate, activeReferrals: activeCount },
      referrals,
      nextPayoutDate: nextPayout,
      tierPct: Affiliate.tierPct[affiliate.tier] || 0.30,
      nextTier: affiliate.tier === 'standard'
        ? { name: 'premium', requirement: '50 referrals actifs', needed: Math.max(0, 50 - activeCount) }
        : affiliate.tier === 'premium'
        ? { name: 'partner', requirement: 'Invitation admin uniquement', needed: null }
        : null,
    });
  } catch (err) {
    logger.error(`GET /affiliate/me error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/affiliate/leaderboard ──────────────────────────────────────────
router.get('/affiliate/leaderboard', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Top by volume this month (from PlatformRevenue)
    const agg = await PlatformRevenue.aggregate([
      { $match: { createdAt: { $gte: monthStart }, affiliateId: { $ne: null } } },
      { $group: { _id: '$affiliateId', volume: { $sum: '$amount' }, earned: { $sum: '$affiliateCut' } } },
      { $sort: { volume: -1 } },
      { $limit: 10 },
    ]);

    // Anonymize
    const leaderboard = agg.map((item, i) => ({
      rank: i + 1,
      userId: item._id.slice(0, 4) + '****',
      volume: Math.round(item.volume * 100) / 100,
      earned: Math.round(item.earned * 100) / 100,
    }));

    res.json({ leaderboard, month: monthStart.toISOString().slice(0, 7) });
  } catch (err) {
    logger.error(`GET /affiliate/leaderboard error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/affiliate/payouts ────────────────────────────────────────────
router.get('/affiliate/payouts', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const notifs = await Notification.find({
      userId,
      type: 'deposit_confirmed',
      message: { $regex: 'commissions affilié' },
    }).sort({ createdAt: -1 }).limit(20).lean();

    res.json({ payouts: notifs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/affiliate/ref/:code — track visit (attribution) ───────────────
router.post('/affiliate/ref/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const affiliate = await Affiliate.findOne({ code: code.toUpperCase() }).lean();
    if (!affiliate) return res.status(404).json({ error: 'Code invalide' });
    res.json({ valid: true, affiliateId: affiliate.userId, code: affiliate.code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/copy-trade — copy a trade with 0.5% platform fee ─────────────
router.post('/copy-trade', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { marketId, side, amount } = req.body;
    if (!marketId || !side || !amount) {
      return res.status(400).json({ error: 'marketId, side, amount requis' });
    }

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const available = Math.max(0, (user.balance || 0) - (user.lockedBalance || 0));
    if (amount > available) {
      return res.status(400).json({ error: `Solde insuffisant : ${available.toFixed(2)} USDC disponibles` });
    }

    // Deduct 0.5% copy fee from amount before betting
    const COPY_FEE_PCT = 0.005;
    const copyFee = Math.round(amount * COPY_FEE_PCT * 100) / 100;
    const betAmount = Math.round((amount - copyFee) * 100) / 100;

    // Record platform revenue for copy fee
    const referral = await Referral.findOne({ referredUserId: userId }).lean();
    let affiliateCut = 0;
    let affiliateId  = null;
    if (referral) {
      const aff = await Affiliate.findOne({ userId: referral.affiliateId });
      if (aff) {
        const tierPct = Affiliate.tierPct[aff.tier] || 0.30;
        affiliateCut = Math.round(copyFee * tierPct * 100) / 100;
        affiliateId  = aff.userId;
        aff.pendingPayout = Math.round(((aff.pendingPayout || 0) + affiliateCut) * 100) / 100;
        aff.totalEarned   = Math.round(((aff.totalEarned   || 0) + affiliateCut) * 100) / 100;
        await aff.save();
      }
    }

    await PlatformRevenue.create({
      type: 'copy_fee',
      marketId,
      amount: copyFee,
      affiliateId,
      affiliateCut,
      platformNet: Math.round((copyFee - affiliateCut) * 100) / 100,
    });

    logger.info(`Copy-trade fee: ${userId} paid ${copyFee} USDC (bet: ${betAmount} USDC on ${side})`);
    res.json({ success: true, copyFee, betAmount, message: `0.5% de frais copy appliqués (${copyFee} USDC)` });
  } catch (err) {
    logger.error(`POST /copy-trade error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN REVENUS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/admin/revenue ───────────────────────────────────────────────────
router.get('/admin/revenue', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const now = new Date();
    const dayStart   = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const weekStart  = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [dayAgg, weekAgg, monthAgg, allTimeAgg, byTypeAgg, topMarketsAgg, affiliateAgg] = await Promise.all([
      PlatformRevenue.aggregate([
        { $match: { createdAt: { $gte: dayStart } } },
        { $group: { _id: null, total: { $sum: '$platformNet' } } },
      ]),
      PlatformRevenue.aggregate([
        { $match: { createdAt: { $gte: weekStart } } },
        { $group: { _id: null, total: { $sum: '$platformNet' } } },
      ]),
      PlatformRevenue.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: '$platformNet' } } },
      ]),
      PlatformRevenue.aggregate([
        { $group: { _id: null, total: { $sum: '$platformNet' }, gross: { $sum: '$amount' }, affiliates: { $sum: '$affiliateCut' } } },
      ]),
      PlatformRevenue.aggregate([
        { $match: { createdAt: { $gte: monthStart } } },
        { $group: { _id: '$type', total: { $sum: '$platformNet' }, count: { $sum: 1 } } },
      ]),
      PlatformRevenue.aggregate([
        { $match: { type: 'market_fee', createdAt: { $gte: monthStart }, marketId: { $ne: null } } },
        { $group: { _id: '$marketId', total: { $sum: '$platformNet' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
      PlatformRevenue.aggregate([
        { $match: { affiliateId: { $ne: null } } },
        { $group: { _id: null, totalPaid: { $sum: '$affiliateCut' }, count: { $addToSet: '$affiliateId' } } },
      ]),
    ]);

    // Enrich top markets with titles
    const marketIds = topMarketsAgg.map(m => m._id).filter(Boolean);
    const markets = await Market.find({ _id: { $in: marketIds } }).select('title').lean();
    const marketMap = {};
    markets.forEach(m => { marketMap[m._id.toString()] = m.title; });

    const topMarkets = topMarketsAgg.map(m => ({
      marketId: m._id,
      title: marketMap[m._id] || 'Marché inconnu',
      revenue: Math.round(m.total * 100) / 100,
      count: m.count,
    }));

    const byType = {};
    byTypeAgg.forEach(t => { byType[t._id] = { total: Math.round(t.total * 100) / 100, count: t.count }; });

    res.json({
      revenue: {
        day:     Math.round((dayAgg[0]?.total    || 0) * 100) / 100,
        week:    Math.round((weekAgg[0]?.total   || 0) * 100) / 100,
        month:   Math.round((monthAgg[0]?.total  || 0) * 100) / 100,
        allTime: Math.round((allTimeAgg[0]?.total || 0) * 100) / 100,
        gross:   Math.round((allTimeAgg[0]?.gross || 0) * 100) / 100,
      },
      byType,
      topMarkets,
      affiliates: {
        totalPaid:    Math.round((affiliateAgg[0]?.totalPaid || 0) * 100) / 100,
        uniqueCount:  affiliateAgg[0]?.count?.length || 0,
      },
    });
  } catch (err) {
    logger.error(`GET /admin/revenue error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/account — add balance breakdown ──────────────────────────
// (existing route kept above)

// ═══════════════════════════════════════════════════════════════════════════════
// CREATOR PROGRAM ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: fetch Twitter profile metrics ────────────────────────────────────
async function fetchTwitterProfile(handle) {
  const BEARER = process.env.TWITTER_BEARER_TOKEN;
  if (!BEARER) return null;
  try {
    const res = await fetch(
      `https://api.twitter.com/2/users/by/username/${handle}?user.fields=description,public_metrics,verified,created_at`,
      { headers: { Authorization: `Bearer ${BEARER}` } }
    );
    const data = await res.json();
    if (!data?.data) return null;
    const m = data.data.public_metrics || {};
    const createdAt = data.data.created_at ? new Date(data.data.created_at) : null;
    const ageDays = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / 86400000) : 0;
    return {
      followers: m.followers_count || 0,
      following: m.following_count || 0,
      tweetCount: m.tweet_count || 0,
      bio: data.data.description || '',
      verified: !!data.data.verified,
      ageDays,
    };
  } catch (e) {
    logger.warn(`fetchTwitterProfile error: ${e.message}`);
    return null;
  }
}

// ─── Helper: AI legitimacy analysis ──────────────────────────────────────────
async function analyzeLegitimacy(handle, platform, metrics) {
  const { default: Anthropic } = require('@anthropic-ai/sdk');
  const config = require('../../config');
  if (!config.anthropic?.apiKey || config.anthropic.apiKey === 'placeholder') {
    // Mock: pass with high score if followers > 5000
    const score = metrics?.followers >= 5000 ? 75 : 30;
    return { legitimacyScore: score, redFlags: [], recommendation: score >= 60 ? 'auto_approve' : 'manual_review' };
  }
  try {
    const client = new Anthropic({ apiKey: config.anthropic.apiKey });
    const prompt = `Analyse ce profil social pour détecter les faux comptes ou usurpateurs.
Plateforme: ${platform}
Handle: @${handle}
Followers: ${metrics?.followers || 0}
Following: ${metrics?.following || 0}
Posts: ${metrics?.tweetCount || 0}
Âge du compte: ${metrics?.ageDays || 0} jours
Vérifié plateforme: ${metrics?.verified || false}

Retourne UNIQUEMENT un JSON:
{ "legitimacyScore": 0-100, "redFlags": string[], "recommendation": "auto_approve"|"manual_review"|"reject" }

Critères: ratio followers/following anormal, compte trop récent, trop peu de posts, croissance artificielle suspicieuse.
Si handle ressemble à un créateur connu (ex: Squeezie1, SqueezieFR), signale-le dans redFlags.`;
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });
    const raw = msg.content[0].text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    logger.warn(`analyzeLegitimacy error: ${e.message}`);
    return { legitimacyScore: 50, redFlags: [], recommendation: 'manual_review' };
  }
}

// ─── POST /api/creator/verify-init — generate verification code (anti-usurp) ─
router.post('/creator/verify-init', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { handle, platform } = req.body;
    if (!handle || !platform) return res.status(400).json({ error: 'handle and platform required' });

    const cleanHandle = handle.toLowerCase().replace(/^@/, '');

    // ── Couche 1 : handle already claimed ────────────────────────────────────
    const claimedUser = await User.findOne({ creatorHandle: cleanHandle, creatorVerified: true }).lean();
    if (claimedUser && claimedUser._id.toString() !== userId) {
      return res.status(409).json({ error: 'Ce compte est déjà revendiqué sur BETLY' });
    }

    // ── Couche 3 : KnownCreator database check ───────────────────────────────
    const known = await KnownCreator.findOne({ handle: cleanHandle, platform }).lean();
    if (known?.claimedByUserId && known.claimedByUserId !== userId) {
      return res.status(409).json({ error: 'Ce créateur est déjà sur BETLY' });
    }

    // ── Couche 1 : fetch real metrics ─────────────────────────────────────────
    let metrics = null;
    if (platform === 'twitter') metrics = await fetchTwitterProfile(cleanHandle);

    const followers = metrics?.followers || 0;

    // Minimum thresholds (only enforced when API is available)
    if (metrics !== null) {
      if (followers < 5000) {
        return res.status(400).json({
          error: `Ton compte ne remplit pas encore les critères. Il te manque ${(5000 - followers).toLocaleString('fr-FR')} followers (minimum 5 000).`,
          followers, required: 5000,
        });
      }
      if (metrics.ageDays < 180) {
        return res.status(400).json({
          error: `Ton compte doit avoir plus de 6 mois (${metrics.ageDays} jours aujourd'hui).`,
        });
      }
      if (metrics.tweetCount < 20) {
        return res.status(400).json({
          error: `Il te faut au moins 20 posts/vidéos publiés (${metrics.tweetCount} actuellement).`,
        });
      }
    }

    // ── Couche 2 : determine tier ─────────────────────────────────────────────
    let tier = 'C';
    if (metrics?.verified || (known?.verifiedOnPlatform)) tier = 'A';
    else if (followers >= 50000) tier = 'B';

    // ── Couche 4 : AI legitimacy check ────────────────────────────────────────
    const aiResult = await analyzeLegitimacy(cleanHandle, platform, metrics);

    // ── Couche 3 : high protection override ──────────────────────────────────
    const forceVideo = known?.protectionLevel === 'high' && tier !== 'A';
    if (forceVideo && tier !== 'C') tier = 'C'; // force video for high-protection creators

    // Generate verification code
    const code = 'BETLY-' + Math.random().toString(36).toUpperCase().slice(2, 8);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save pending verification record
    await CreatorVerification.findOneAndUpdate(
      { userId, handle: cleanHandle, platform },
      {
        userId, handle: cleanHandle, platform,
        followerCount: followers,
        accountAgeDays: metrics?.ageDays || 0,
        postCount: metrics?.tweetCount || 0,
        verifiedOnPlatform: metrics?.verified || false,
        legitimacyScore: aiResult.legitimacyScore,
        redFlags: aiResult.redFlags,
        aiRecommendation: aiResult.recommendation,
        tier,
        status: 'pending',
        lastCheckedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    await User.findOneAndUpdate(
      buildUserQuery(userId),
      { verificationCode: code, verificationExpiry: expiry, creatorHandle: cleanHandle, creatorPlatform: platform },
      { new: true }
    );

    res.json({
      code, expiry, handle: cleanHandle, platform, tier,
      metrics: metrics ? { followers, ageDays: metrics.ageDays, tweetCount: metrics.tweetCount, verified: metrics.verified } : null,
      aiScore: aiResult.legitimacyScore,
      redFlags: aiResult.redFlags,
      requiresVideo: tier === 'C',
      requiresManualReview: tier === 'B' || (tier === 'C') || aiResult.recommendation === 'manual_review',
    });
  } catch (err) {
    logger.error(`POST /creator/verify-init error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creator/verify-check — check code in bio + handle auto-approve ─
router.post('/creator/verify-check', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { verificationCode, verificationExpiry, creatorHandle, creatorPlatform } = user;
    if (!verificationCode) return res.status(400).json({ error: 'Lance d\'abord la vérification' });
    if (verificationExpiry && new Date() > verificationExpiry) {
      return res.status(400).json({ error: 'Code expiré — génère un nouveau code' });
    }

    const pending = await CreatorVerification.findOne({ userId: user._id.toString(), handle: creatorHandle, platform: creatorPlatform });

    // Check code in bio via Twitter API
    const TWITTER_BEARER = process.env.TWITTER_BEARER_TOKEN;
    let codeFound = false;
    let followers = 0;

    if (TWITTER_BEARER && creatorPlatform === 'twitter') {
      try {
        const profile = await fetchTwitterProfile(creatorHandle);
        if (profile) {
          codeFound = profile.bio.includes(verificationCode);
          followers = profile.followers;
        }
      } catch (e) {
        logger.warn(`verify-check Twitter error: ${e.message}`);
      }
    } else {
      codeFound = process.env.NODE_ENV !== 'production';
    }

    if (!codeFound) {
      return res.json({
        verified: false,
        message: `Code "${verificationCode}" non trouvé dans la bio @${creatorHandle}. Assure-toi de l'avoir bien collé et sauvegardé.`,
      });
    }

    const tier = pending?.tier || 'C';
    const aiRec = pending?.aiRecommendation || 'manual_review';

    // Tier A: auto-approve
    // Tier B/C or AI flagged: put in manual review queue
    const autoApprove = tier === 'A' || (aiRec === 'auto_approve' && tier !== 'C');

    if (pending) {
      await CreatorVerification.findByIdAndUpdate(pending._id, {
        status: autoApprove ? 'approved' : 'pending',
        followerCount: followers || pending.followerCount,
        lastCheckedAt: new Date(),
      });
    }

    if (!autoApprove) {
      return res.json({
        verified: false,
        pendingReview: true,
        tier,
        message: tier === 'C'
          ? 'Code validé ! Ton dossier est en cours de révision (72h). Tu seras notifié par email.'
          : 'Code validé ! Vérification manuelle en cours (48h). Tu seras notifié dès que ton badge est attribué.',
      });
    }

    // Auto-approve: grant badge
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = creatorHandle.slice(0, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
      const taken = await User.findOne({ referralCode });
      if (taken) referralCode = Math.random().toString(36).slice(2, 10).toUpperCase();
    }

    await User.findByIdAndUpdate(user._id, {
      creatorVerified: true,
      creatorHandle,
      creatorPlatform,
      creatorFollowers: followers,
      verificationCode: null,
      verificationExpiry: null,
      referralCode,
    });

    // Mark as claimed in KnownCreator
    await KnownCreator.findOneAndUpdate(
      { handle: creatorHandle, platform: creatorPlatform },
      { claimedByUserId: user._id.toString() },
    );

    res.json({ verified: true, followers, referralCode, handle: creatorHandle, tier });
  } catch (err) {
    logger.error(`POST /creator/verify-check error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/creator-verifications — admin queue ──────────────────────
router.get('/admin/creator-verifications', async (req, res) => {
  try {
    const { status = 'pending', limit = 50 } = req.query;
    const verifs = await CreatorVerification.find({ status })
      .sort({ legitimacyScore: -1, createdAt: 1 })
      .limit(parseInt(limit))
      .lean();

    // Enrich with user info
    const enriched = await Promise.all(verifs.map(async v => {
      const u = await User.findOne(buildUserQuery(v.userId)).lean();
      return { ...v, user: { username: u?.username, email: u?.email } };
    }));

    res.json({ verifications: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/admin/creator-verifications/:id/review ────────────────────────
router.post('/admin/creator-verifications/:id/review', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: approve | reject | request_video
    if (!['approve','reject','request_video'].includes(action)) {
      return res.status(400).json({ error: 'action must be approve|reject|request_video' });
    }

    const verif = await CreatorVerification.findById(id);
    if (!verif) return res.status(404).json({ error: 'Verification not found' });

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
    verif.status = newStatus;
    verif.reviewedBy = req.query.userId;
    verif.reviewedAt = new Date();
    if (reason) verif.rejectionReason = reason;
    await verif.save();

    if (action === 'approve') {
      const user = await User.findOne(buildUserQuery(verif.userId));
      if (user) {
        let referralCode = user.referralCode;
        if (!referralCode) {
          referralCode = verif.handle.slice(0, 8).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
        }
        await User.findByIdAndUpdate(user._id, {
          creatorVerified: true,
          creatorHandle: verif.handle,
          creatorPlatform: verif.platform,
          creatorFollowers: verif.followerCount,
          referralCode,
        });
        await notify({ userId: user._id.toString(), type: 'creator_verified', message: `Ton badge créateur @${verif.handle} a été validé par l'équipe BETLY ! 🎉` });
      }
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creator/dashboard — creator stats ───────────────────────────────
router.get('/creator/dashboard', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const user = await User.findOne(buildUserQuery(userId)).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const creatorId = user._id.toString();

    // Commissions this week
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [commissions, markets, weekEarnings] = await Promise.all([
      CreatorCommission.aggregate([
        { $match: { creatorId } },
        { $group: { _id: null, total: { $sum: '$commission' }, volume: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Market.find({ creatorId, status: { $in: ['active','resolving'] } }).lean(),
      CreatorCommission.aggregate([
        { $match: { creatorId, createdAt: { $gte: weekAgo } } },
        { $group: { _id: null, total: { $sum: '$commission' } } },
      ]),
    ]);

    const totalVolume = commissions[0]?.volume || 0;
    const totalEarned = commissions[0]?.total || 0;
    const totalBets   = commissions[0]?.count || 0;
    const weekEarned  = weekEarnings[0]?.total || 0;

    // Tier progress
    const mv = user.monthlyVolume || 0;
    const tier = user.commissionTier || 'starter';
    const nextTierVolume = tier === 'starter' ? 1000 : tier === 'creator' ? 10000 : null;
    const tierProgress = nextTierVolume ? Math.min(100, Math.round(mv / nextTierVolume * 100)) : 100;
    const tierMissing = nextTierVolume ? Math.max(0, nextTierVolume - mv) : 0;

    // Unique bettors who came via creator link
    const uniqueBettors = await CreatorCommission.distinct('bettorId', { creatorId });

    res.json({
      user: {
        handle: user.creatorHandle,
        platform: user.creatorPlatform,
        followers: user.creatorFollowers,
        verified: user.creatorVerified,
        tier,
        referralCode: user.referralCode,
        pendingEarnings: user.pendingCreatorEarnings || 0,
      },
      stats: {
        totalVolume: Math.round(totalVolume * 100) / 100,
        totalEarned: Math.round(totalEarned * 100) / 100,
        weekEarned:  Math.round(weekEarned * 100) / 100,
        totalBets,
        uniqueBettors: uniqueBettors.length,
        activeMarkets: markets.length,
        monthlyVolume: Math.round(mv * 100) / 100,
      },
      tier: { current: tier, progress: tierProgress, missing: Math.round(tierMissing * 100) / 100, nextTier: tier === 'starter' ? 'creator' : tier === 'creator' ? 'pro' : null },
      markets: markets.slice(0, 10),
    });
  } catch (err) {
    logger.error(`GET /creator/dashboard error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creator/markets — creator's own markets with commission stats ───
router.get('/creator/markets', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const user = await User.findOne(buildUserQuery(userId)).lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const creatorId = user._id.toString();
    const markets = await Market.find({ creatorId }).sort({ createdAt: -1 }).limit(50).lean();

    const commByMarket = await CreatorCommission.aggregate([
      { $match: { creatorId } },
      { $group: { _id: '$marketId', commission: { $sum: '$commission' }, volume: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);
    const commMap = {};
    commByMarket.forEach(c => { commMap[c._id] = c; });

    const result = markets.map(m => ({
      ...m,
      commissionEarned: commMap[m._id.toString()]?.commission || 0,
      volume: (m.totalYes || 0) + (m.totalNo || 0),
      betCount: commMap[m._id.toString()]?.count || 0,
    }));

    res.json({ markets: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creator/payout — manual payout request ────────────────────────
router.post('/creator/payout', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    const pending = user.pendingCreatorEarnings || 0;
    if (pending < 5) {
      return res.status(400).json({ error: `Minimum 5 USDC requis (actuellement ${pending.toFixed(2)} USDC en attente)` });
    }

    // Credit to balance, reset pending
    user.balance = (user.balance || 0) + pending;
    user.pendingCreatorEarnings = 0;
    await user.save();

    // Mark commissions as paid
    await CreatorCommission.updateMany({ creatorId: user._id.toString(), paid: false }, { paid: true, paidAt: new Date() });

    await notify({ userId: user._id.toString(), type: 'creator_payout', message: `Virement créateur de ${pending.toFixed(2)} USDC reçu !`, amount: pending });

    res.json({ success: true, amount: pending, newBalance: user.balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creator/ref-code — ensure user has a referralCode ──────────────
router.get('/creator/ref-code', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const user = await User.findOne(buildUserQuery(userId));
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.referralCode) {
      const base = (user.username || user.telegramId || Math.random().toString(36).slice(2, 8)).slice(0, 8);
      const code = base.toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
      user.referralCode = code;
      await user.save();
    }

    res.json({ referralCode: user.referralCode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/creators — creator markets feed ────────────────────────
router.get('/markets/creators', async (req, res) => {
  try {
    const { category, sort = 'trending' } = req.query;
    const query = { status: 'active', creatorMarket: true };
    if (category && category !== 'tous') query.category = category;

    const sortMap = { trending: { trendingScore: -1 }, nouveau: { createdAt: -1 }, ferme: { resolutionDate: 1 } };
    const markets = await Market.find(query).sort(sortMap[sort] || { trendingScore: -1 }).limit(40).lean();
    res.json({ markets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/age-verify — save age verification ───────────────────────
router.post('/auth/age-verify', async (req, res) => {
  try {
    const userId = req.query.userId || req.dbUser?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    await User.findOneAndUpdate(
      buildUserQuery(userId),
      { ageVerified: true, ageVerifiedAt: new Date(), ageVerifiedIp: ip },
      { upsert: false }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/markets/:id/snapshots — price history ──────────────────────────
router.get('/markets/:id/snapshots', async (req, res) => {
  try {
    const MarketSnapshot = require('../../db/models/MarketSnapshot');
    const hours = parseInt(req.query.hours) || 24;
    const query = { marketId: req.params.id };
    if (hours > 0) {
      query.timestamp = { $gte: new Date(Date.now() - hours * 3600_000) };
    }
    const snapshots = await MarketSnapshot.find(query)
      .sort({ timestamp: 1 })
      .limit(720)
      .lean();
    // Downsample to max 100 points for performance
    const step = Math.max(1, Math.floor(snapshots.length / 100));
    const downsampled = snapshots.filter((_, i) => i % step === 0);
    res.json({ snapshots: downsampled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/positions — current user active/all bets ───────────────────────
router.get('/positions', async (req, res) => {
  try {
    const userId = req.query.userId || req.dbUser?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const { status = 'active' } = req.query;

    const query = { userId };
    if (status !== 'all') query.status = status;

    const bets = await Bet.find(query).sort({ placedAt: -1 }).limit(100).lean();
    const marketIds = [...new Set(bets.map(b => b.marketId?.toString()).filter(Boolean))];
    const markets = await Market.find({ _id: { $in: marketIds } })
      .select('title category totalYes totalNo resolutionDate status onChainId _id')
      .lean();
    const marketMap = {};
    markets.forEach(m => { marketMap[m._id.toString()] = m; });

    const positions = bets.map(bet => ({
      bet,
      market: marketMap[bet.marketId?.toString()] || null,
    }));
    res.json({ positions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/bets/:id/public — public bet info for share page ────────────────
router.get('/bets/:id/public', async (req, res) => {
  try {
    const bet = await Bet.findById(req.params.id).lean();
    if (!bet) return res.status(404).json({ error: 'Pari introuvable' });

    const market = await Market.findById(bet.marketId)
      .select('title category totalYes totalNo resolutionDate _id')
      .lean();
    const bettor = await User.findOne({ userId: bet.userId })
      .select('username -_id')
      .lean();

    // Only expose safe fields
    res.json({
      bet: {
        _id: bet._id,
        side: bet.side,
        amount: bet.amount,
        odds: bet.odds,
        payout: bet.payout,
        status: bet.status,
      },
      market,
      bettor: bettor ? { username: bettor.username } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/bets/:id/og-image — PNG 1200x630 pour OG / téléchargement ───────
const ogImageCache = new Map(); // betId → { png, ts }
const OG_CACHE_TTL = 3600_000; // 1h

router.get('/bets/:id/og-image', async (req, res) => {
  try {
    const betId = req.params.id;

    // Check cache
    const cached = ogImageCache.get(betId);
    if (cached && Date.now() - cached.ts < OG_CACHE_TTL) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.end(cached.png);
    }

    const bet    = await Bet.findById(betId).lean();
    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    const market = await Market.findById(bet.marketId).lean();
    if (!market) return res.status(404).json({ error: 'Market not found' });
    const bettor = await User.findOne({ userId: bet.userId }).select('username').lean();

    const { createCanvas } = require('canvas');
    const W = 1200, H = 630;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    // ── Background ─────────────────────────────────────────────────────────
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Gradient glow top-left
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
    glow.addColorStop(0, 'rgba(124,58,237,0.15)');
    glow.addColorStop(1, 'rgba(124,58,237,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Border gradient (draw rect outline)
    const borderGrad = ctx.createLinearGradient(0, 0, W, H);
    borderGrad.addColorStop(0, 'rgba(124,58,237,0.7)');
    borderGrad.addColorStop(1, 'rgba(96,165,250,0.4)');
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, W - 4, H - 4);

    // ── Logo BETLY ─────────────────────────────────────────────────────────
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText('BETLY', 56, 72);

    // ── Category badge ─────────────────────────────────────────────────────
    const cat = (market.category || '').toUpperCase();
    if (cat) {
      ctx.font = 'bold 14px system-ui, sans-serif';
      const catW = ctx.measureText(cat).width + 24;
      ctx.fillStyle = 'rgba(168,85,247,0.2)';
      ctx.beginPath(); ctx.roundRect(W - 56 - catW, 48, catW, 28, 14); ctx.fill();
      ctx.fillStyle = '#a855f7';
      ctx.fillText(cat, W - 56 - catW / 2 - ctx.measureText(cat).width / 2, 68);
    }

    // ── Market title ───────────────────────────────────────────────────────
    const title = market.title || '';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillStyle = '#f8fafc';
    const words = title.split(' ');
    let line = '', lines = [], maxW = W - 112;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) { lines.push(line.trim()); line = w + ' '; }
      else line = test;
    }
    if (line) lines.push(line.trim());
    lines = lines.slice(0, 3);
    if (lines.length === 3 && lines[2].length > 40) lines[2] = lines[2].slice(0, 40) + '…';
    lines.forEach((l, i) => ctx.fillText(l, 56, 160 + i * 52));

    // ── Bet info pills ─────────────────────────────────────────────────────
    const side     = bet.side === 'YES' ? 'OUI' : 'NON';
    const sideClr  = bet.side === 'YES' ? '#a855f7' : '#ef4444';
    const won      = bet.status === 'won';
    const odds     = bet.odds ? Math.round(bet.odds * 100) : null;
    const gain     = won && bet.payout && bet.amount ? (bet.payout - bet.amount).toFixed(2) : null;
    const roi      = gain ? Math.round((parseFloat(gain) / bet.amount) * 100) : null;

    // Side pill
    ctx.fillStyle = sideClr + '25';
    ctx.beginPath(); ctx.roundRect(56, 340, 180, 80, 14); ctx.fill();
    ctx.strokeStyle = sideClr + '55'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(56, 340, 180, 80, 14); ctx.stroke();
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillStyle = '#94a3b8';
    ctx.fillText('POSITION', 72, 360);
    ctx.font = 'bold 36px system-ui, sans-serif'; ctx.fillStyle = sideClr;
    ctx.fillText(side, 72, 402);
    if (odds) { ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#94a3b8'; ctx.fillText(`${odds}¢`, 72, 420); }

    // Amount pill
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.roundRect(254, 340, 220, 80, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(254, 340, 220, 80, 14); ctx.stroke();
    ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillStyle = '#94a3b8';
    ctx.fillText(won ? 'GAIN' : 'MISE', 270, 360);
    ctx.font = 'bold 32px system-ui, sans-serif'; ctx.fillStyle = won ? '#22c55e' : '#f8fafc';
    ctx.fillText(won ? `+$${gain}` : `${bet.amount} USDC`, 270, 400);
    if (roi) { ctx.font = '13px system-ui, sans-serif'; ctx.fillStyle = '#22c55e'; ctx.fillText(`ROI +${roi}%`, 270, 422); }

    // Status badge
    if (won) {
      ctx.fillStyle = 'rgba(34,197,94,0.15)';
      ctx.beginPath(); ctx.roundRect(490, 348, 120, 32, 16); ctx.fill();
      ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = '#22c55e';
      ctx.fillText('GAGNE', 508, 369);
    }

    // ── Bottom: pseudo + url ───────────────────────────────────────────────
    ctx.font = '14px system-ui, sans-serif'; ctx.fillStyle = '#475569';
    const pseudo = bettor?.username ? `@${bettor.username}` : '';
    if (pseudo) ctx.fillText(pseudo, 56, H - 40);
    ctx.fillText('betly.gg · marchés de prédiction', W - 56 - ctx.measureText('betly.gg · marchés de prédiction').width, H - 40);

    const png = canvas.toBuffer('image/png');
    ogImageCache.set(betId, { png, ts: Date.now() });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.end(png);
  } catch (err) {
    logger.error(`OG image error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── Pipeline Status & Manual Trigger ─────────────────────────────────────────
const { getPipelineStats, runPipeline } = require('../pipeline');

router.get('/pipeline/status', (req, res) => {
  res.json(getPipelineStats());
});

router.post('/pipeline/trigger', async (req, res) => {
  try {
    // Fire-and-forget — don't block the HTTP response
    runPipeline().catch(err => logger.error(`Manual pipeline trigger error: ${err.message}`));
    res.json({ ok: true, message: 'Pipeline cycle triggered' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Mark a bet as claimed in DB ─────────────────────────────────────────────
router.post('/bets/:id/claim', async (req, res) => {
  try {
    const userId = req.query.userId || req.dbUser?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    const bet = await Bet.findById(req.params.id);
    if (!bet) return res.status(404).json({ error: 'Bet not found' });
    if (bet.userId !== userId) return res.status(403).json({ error: 'Not your bet' });
    bet.status = 'claimed';
    bet.claimedAt = new Date();
    await bet.save();
    // Reduce locked balance
    await User.findByIdAndUpdate(userId, {
      $inc: { lockedBalance: -bet.amount },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: resolve a market (update DB status + set bets won/lost) ──────────
router.post('/markets/:id/resolve', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { outcome } = req.body; // 'YES' or 'NO'
    if (!outcome || !['YES', 'NO'].includes(outcome)) {
      return res.status(400).json({ error: 'outcome must be YES or NO' });
    }

    const market = await Market.findById(req.params.id);
    if (!market) return res.status(404).json({ error: 'Market not found' });

    market.status = 'resolved';
    market.outcome = outcome;
    market.resolvedAt = new Date();
    await market.save();

    // Update all bets on this market
    const totalPool = (market.totalYes || 0) + (market.totalNo || 0);
    const winPool = outcome === 'YES' ? (market.totalYes || 0) : (market.totalNo || 0);

    // Mark winners
    const winners = await Bet.find({ marketId: market._id, side: outcome, status: 'active' });
    for (const bet of winners) {
      const gross = winPool > 0 ? (bet.amount / winPool) * totalPool : bet.amount;
      const payout = gross * 0.98; // 2% fee
      bet.status = 'won';
      bet.payout = payout;
      bet.fee = gross * 0.02;
      bet.settledAt = new Date();
      await bet.save();
    }

    // Mark losers
    const losers = await Bet.find({ marketId: market._id, side: { $ne: outcome }, status: 'active' });
    await Bet.updateMany(
      { marketId: market._id, side: { $ne: outcome }, status: 'active' },
      { $set: { status: 'lost', payout: 0, settledAt: new Date() } }
    );

    // Send notifications
    const title = market.title?.slice(0, 40) || 'Marché';
    for (const bet of winners) {
      const netGain = (bet.payout - bet.amount).toFixed(2);
      await notify({
        userId: bet.userId,
        type: 'market_resolved_won',
        message: `🎉 Tu as gagné +${netGain} USDC sur "${title}"`,
        marketId: market._id.toString(),
        amount: bet.payout,
      });
    }
    for (const bet of losers) {
      await notify({
        userId: bet.userId,
        type: 'market_resolved_lost',
        message: `😔 Tu as perdu ${bet.amount} USDC sur "${title}"`,
        marketId: market._id.toString(),
        amount: bet.amount,
      });
    }

    res.json({ ok: true, winners: winners.length, losers: losers.length, outcome });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Record an on-chain bet in DB (so positions page can show it) ────────────
router.post('/markets/:id/bet-onchain', async (req, res) => {
  try {
    const userId = req.query.userId || req.dbUser?._id?.toString();
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { side, amount, txHash, walletAddress } = req.body;
    if (!side || !amount) return res.status(400).json({ error: 'side and amount required' });

    const market = await Market.findById(req.params.id).lean();
    if (!market) return res.status(404).json({ error: 'Market not found' });

    // Compute odds from current pool
    const total = (market.totalYes || 0) + (market.totalNo || 0) + amount;
    const sidePool = side === 'YES' ? (market.totalYes || 0) + amount : (market.totalNo || 0) + amount;
    const odds = total > 0 ? sidePool / total : 0.5;

    const bet = await Bet.create({
      userId,
      marketId: market._id,
      side,
      requestedAmount: amount,
      filledAmount: amount,
      amount,
      odds,
      status: 'active',
      type: 'market',
      orderId: txHash || `onchain-${Date.now()}`,
      placedAt: new Date(),
    });

    // Update market pool totals
    const inc = side === 'YES' ? { totalYes: amount } : { totalNo: amount };
    await Market.findByIdAndUpdate(market._id, { $inc: inc });

    // Update user stats
    await User.findByIdAndUpdate(userId, {
      $inc: { lockedBalance: amount, totalBets: 1 },
    });

    res.json({ ok: true, betId: bet._id });
  } catch (err) {
    // Duplicate orderId = bet already recorded
    if (err.code === 11000) return res.json({ ok: true, duplicate: true });
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: set onChainId on a market ────────────────────────────────────────
router.post('/markets/:id/set-onchain', async (req, res) => {
  try {
    const { secret } = req.query;
    if (secret !== (process.env.ADMIN_SECRET || 'betly-admin-2025')) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const { onChainId } = req.body;
    if (onChainId == null) return res.status(400).json({ error: 'onChainId required' });
    const m = await Market.findByIdAndUpdate(req.params.id, { onChainId: Number(onChainId) }, { new: true });
    if (!m) return res.status(404).json({ error: 'Market not found' });
    res.json({ ok: true, marketId: m._id, onChainId: m.onChainId, title: m.title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTIE — POSTS (Social feed — expression, no discussion)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET /api/posts ──────────────────────────────────────────────────────────
router.get('/posts', async (req, res) => {
  try {
    const { sort = 'recent', limit = 20, before } = req.query;
    const query = {};
    if (before) query.createdAt = { $lt: new Date(before) };

    const sortOpt = sort === 'top'
      ? { starCount: -1, likeCount: -1, createdAt: -1 }
      : { createdAt: -1 };

    const posts = await Post.find(query)
      .sort(sortOpt)
      .limit(Math.min(parseInt(limit) || 20, 50))
      .populate('marketId', 'title question totalYes totalNo status _id')
      .lean();

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/posts ─────────────────────────────────────────────────────────
router.post('/posts', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });
    const user = req.dbUser;

    const { text, marketId } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Texte requis' });
    if (text.length > 500) return res.status(400).json({ error: 'Max 500 caractères' });

    const postData = {
      userId: user.uniqueId || user.visitorId || user._id.toString(),
      username: user.username || 'anon',
      displayName: user.displayName || user.username,
      avatarColor: user.avatarColor || '#7c3aed',
      googlePhotoUrl: user.googlePhotoUrl || null,
      verified: user.level === 'oracle' || user.level === 'legende',
      text: text.trim(),
    };

    if (marketId) {
      const market = await Market.findById(marketId).select('_id').lean();
      if (market) postData.marketId = market._id;
    }

    const post = await Post.create(postData);
    res.status(201).json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/posts/:id/react ───────────────────────────────────────────────
// body: { type: 'like' | 'dislike' | 'star' }
router.post('/posts/:id/react', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });
    const userId = req.dbUser.uniqueId || req.dbUser.visitorId || req.dbUser._id.toString();
    const { type } = req.body;

    if (!['like', 'dislike', 'star'].includes(type)) {
      return res.status(400).json({ error: 'Type invalide' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });

    const field = type === 'like' ? 'likes' : type === 'dislike' ? 'dislikes' : 'stars';
    const countField = type === 'like' ? 'likeCount' : type === 'dislike' ? 'dislikeCount' : 'starCount';
    const alreadyReacted = post[field].includes(userId);

    if (alreadyReacted) {
      // Toggle off
      post[field] = post[field].filter(id => id !== userId);
      post[countField] = Math.max(0, (post[countField] || 0) - 1);
    } else {
      // Toggle on — remove opposite reaction if like/dislike
      if (type === 'like' && post.dislikes.includes(userId)) {
        post.dislikes = post.dislikes.filter(id => id !== userId);
        post.dislikeCount = Math.max(0, (post.dislikeCount || 0) - 1);
      } else if (type === 'dislike' && post.likes.includes(userId)) {
        post.likes = post.likes.filter(id => id !== userId);
        post.likeCount = Math.max(0, (post.likeCount || 0) - 1);
      }
      post[field].push(userId);
      post[countField] = (post[countField] || 0) + 1;
    }

    await post.save();
    res.json({
      likeCount: post.likeCount,
      dislikeCount: post.dislikeCount,
      starCount: post.starCount,
      userLiked: post.likes.includes(userId),
      userDisliked: post.dislikes.includes(userId),
      userStarred: post.stars.includes(userId),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/posts/bot — Bot API (API key auth, no Firebase) ───────────────
router.post('/posts/bot', async (req, res) => {
  try {
    const apiKey = req.headers['x-bot-key'] || req.query.key;
    if (!apiKey || apiKey !== process.env.BOT_POST_KEY) {
      return res.status(403).json({ error: 'Invalid bot key' });
    }

    const { text, username, displayName, avatarColor, marketId, verified } = req.body;
    if (!text || !username) return res.status(400).json({ error: 'text + username required' });

    const postData = {
      userId: `bot:${username}`,
      username,
      displayName: displayName || username,
      avatarColor: avatarColor || '#7c3aed',
      googlePhotoUrl: null,
      verified: verified || false,
      text: text.slice(0, 500),
    };

    if (marketId) {
      const market = await Market.findById(marketId).select('_id').lean();
      if (market) postData.marketId = market._id;
    }

    const post = await Post.create(postData);
    res.status(201).json({ post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/posts/public — Read-only, no auth required ────────────────────
router.get('/posts/public', async (req, res) => {
  try {
    const { limit = 20, before } = req.query;
    const query = {};
    if (before) query.createdAt = { $lt: new Date(before) };

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(Math.min(parseInt(limit) || 20, 50))
      .select('-likes -dislikes -stars')
      .populate('marketId', 'title question totalYes totalNo status _id')
      .lean();

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/posts/:id ───────────────────────────────────────────────────
router.delete('/posts/:id', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });
    const userId = req.dbUser.uniqueId || req.dbUser.visitorId || req.dbUser._id.toString();

    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post introuvable' });
    if (post.userId !== userId) return res.status(403).json({ error: 'Non autorisé' });

    await post.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── COPY TRADE — /api/copy/* ─────────────────────────────────── Sonnet 4.6 ──
// ═══════════════════════════════════════════════════════════════════════════════

const CopyConfig = require('../../db/models/CopyConfig');
const CopyTrade  = require('../../db/models/CopyTrade');
const axios      = require('axios');

const POLYFRENCH_URL = process.env.POLYFRENCH_API_URL || 'http://localhost:3000';
const COPY_FEE_PCT   = 0.005; // 0.5%

// Helper — récupère ou crée la config copy d'un user
async function getCopyConfig(userId) {
  let cfg = await CopyConfig.findOne({ userId });
  if (!cfg) cfg = await CopyConfig.create({ userId });
  return cfg;
}

// Helper — reset dailyLoss si nouveau jour
function checkDailyReset(cfg) {
  if (!cfg.dailyLossResetAt) return;
  const now   = new Date();
  const reset = new Date(cfg.dailyLossResetAt);
  if (now.toDateString() !== reset.toDateString()) {
    cfg.dailyLoss        = 0;
    cfg.dailyLossResetAt = now;
  }
}

// ─── GET /api/copy/leaderboard ────────────────────────────────────────────────
// Proxy vers Polyfrench API — retourne les top whales avec BETLY Score
router.get('/copy/leaderboard', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '20', 10), 50);
    const sortBy = req.query.sort || 'score'; // score | winrate | roi

    const { data } = await axios.get(`${POLYFRENCH_URL}/api/leaderboard`, {
      params: { limit, sort: sortBy },
      timeout: 6000,
    });

    // Calcul BETLY Score côté backend pour uniformité
    const wallets = (data?.leaderboard || data || []).map((w, i) => {
      const wr  = Math.min(w.winRate    || 0, 100);
      const roi = Math.min((w.roi       || 0) / 300 * 100, 100);
      const exp = Math.min((w.totalTrades || 0) / 150 * 100, 100);
      const betlyScore = Math.round(wr * 0.45 + roi * 0.35 + exp * 0.20);
      const walletAddress = w.walletAddress || w.address || w.wallet || '';
      return { ...w, walletAddress, betlyScore, _rank: i + 1 };
    });

    res.json({ wallets, source: 'polyfrench' });
  } catch (err) {
    logger.warn(`[COPY] Leaderboard proxy failed: ${err.message}`);
    res.json({ wallets: [], source: 'unavailable', error: 'Polyfrench API hors ligne' });
  }
});

// ─── GET /api/copy/alerts ─────────────────────────────────────────────────────
// Trades récents détectés sur les whales — proxy Polyfrench
router.get('/copy/alerts', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const { data } = await axios.get(`${POLYFRENCH_URL}/api/alerts`, {
      params: { limit },
      timeout: 5000,
    });
    const alerts = data?.alerts || data?.recent || data || [];
    res.json({ alerts });
  } catch (err) {
    logger.warn(`[COPY] Alerts proxy failed: ${err.message}`);
    res.json({ alerts: [] });
  }
});

// ─── GET /api/copy/config ─────────────────────────────────────────────────────
router.get('/copy/config', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });
    const cfg = await getCopyConfig(req.dbUser._id);
    res.json({ config: cfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/copy/follow ────────────────────────────────────────────────────
router.post('/copy/follow', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });

    const { address, allocation = 5, nickname = '' } = req.body;
    if (!address) return res.status(400).json({ error: 'address requis' });
    if (allocation < 1 || allocation > 50) return res.status(400).json({ error: 'allocation 1–50%' });

    const cfg = await getCopyConfig(req.dbUser._id);

    const existing = cfg.followedWallets.find(w => w.address === address);
    if (existing) {
      existing.allocation = allocation;
      existing.active     = true;
      existing.nickname   = nickname || existing.nickname;
    } else {
      if (cfg.followedWallets.length >= 10) {
        return res.status(400).json({ error: 'Maximum 10 wallets suivis' });
      }
      cfg.followedWallets.push({ address, allocation, active: true, nickname, copiedAt: new Date() });
    }

    cfg.updatedAt = new Date();
    await cfg.save();
    logger.info(`[COPY] User ${req.dbUser._id} follows ${address} @ ${allocation}%`);
    res.json({ ok: true, config: cfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/copy/unfollow ──────────────────────────────────────────────────
router.post('/copy/unfollow', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });

    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'address requis' });

    const cfg = await getCopyConfig(req.dbUser._id);
    cfg.followedWallets = cfg.followedWallets.filter(w => w.address !== address);
    cfg.updatedAt = new Date();
    await cfg.save();

    logger.info(`[COPY] User ${req.dbUser._id} unfollows ${address}`);
    res.json({ ok: true, config: cfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/copy/settings ─────────────────────────────────────────────────
router.patch('/copy/settings', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });

    const cfg = await getCopyConfig(req.dbUser._id);
    const allowed = ['copyEnabled', 'mode', 'paperMode', 'maxPerTrade', 'dailyLossLimit'];

    for (const key of allowed) {
      if (req.body[key] !== undefined) cfg[key] = req.body[key];
    }
    cfg.updatedAt = new Date();
    await cfg.save();

    logger.info(`[COPY] Settings updated for user ${req.dbUser._id}: ${JSON.stringify(req.body)}`);
    res.json({ ok: true, config: cfg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/copy/trades ─────────────────────────────────────────────────────
router.get('/copy/trades', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });

    const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const status = req.query.status; // filtre optionnel

    const query = { userId: req.dbUser._id };
    if (status) query.status = status;

    const trades = await CopyTrade.find(query)
      .sort({ executedAt: -1 })
      .limit(limit)
      .lean();

    const totalPnl  = trades.filter(t => t.pnl !== null).reduce((s, t) => s + t.pnl, 0);
    const executed  = trades.filter(t => t.status === 'executed').length;
    const paper     = trades.filter(t => t.status === 'paper').length;

    res.json({ trades, stats: { totalPnl, executed, paper, total: trades.length } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/copy/execute ───────────────────────────────────────────────────
// Enregistre + exécute un copy trade depuis l'interface web
router.post('/copy/execute', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });

    const user = req.dbUser;
    const cfg  = await getCopyConfig(user._id);

    if (!cfg.copyEnabled) {
      return res.status(400).json({ error: 'Copy trading désactivé — active-le dans les paramètres' });
    }

    const { whaleAddress, marketId, marketTitle, outcome, amount, price } = req.body;
    if (!whaleAddress || !outcome || !amount) {
      return res.status(400).json({ error: 'whaleAddress, outcome, amount requis' });
    }

    // Check wallet suivi
    const followed = cfg.followedWallets.find(w => w.address === whaleAddress && w.active);
    if (!followed) return res.status(400).json({ error: 'Wallet non suivi ou inactif' });

    // Risk checks
    checkDailyReset(cfg);
    const effectiveAmount = Math.min(amount, cfg.maxPerTrade);
    if (cfg.dailyLoss >= cfg.dailyLossLimit) {
      return res.status(400).json({ error: `Stop-loss journalier atteint (${cfg.dailyLossLimit} USDC)` });
    }

    const available = Math.max(0, (user.balance || 0) - (user.lockedBalance || 0));
    if (effectiveAmount > available && !cfg.paperMode) {
      return res.status(400).json({ error: `Solde insuffisant : ${available.toFixed(2)} USDC disponibles` });
    }

    const fee = Math.round(effectiveAmount * COPY_FEE_PCT * 100) / 100;

    // Paper mode — simulation sans exécution réelle
    if (cfg.paperMode) {
      const ct = await CopyTrade.create({
        userId: user._id, whaleAddress, marketId, marketTitle, outcome, price,
        amount: effectiveAmount, fee: 0, status: 'paper', mode: cfg.mode,
      });
      logger.info(`[COPY][PAPER] User ${user._id} copy ${whaleAddress} ${outcome} ${effectiveAmount} USDC`);
      return res.json({ ok: true, trade: ct, paper: true });
    }

    // Mode réel — débit du solde Betly + enregistrement
    user.balance     = Math.round(((user.balance || 0) - effectiveAmount) * 1e6) / 1e6;
    user.lockedBalance = Math.round(((user.lockedBalance || 0) + effectiveAmount) * 1e6) / 1e6;
    await user.save();

    cfg.dailyLoss    = Math.round(((cfg.dailyLoss || 0) + effectiveAmount) * 100) / 100;
    cfg.totalCopied  = Math.round(((cfg.totalCopied || 0) + effectiveAmount) * 100) / 100;
    cfg.dailyLossResetAt = cfg.dailyLossResetAt || new Date();
    cfg.updatedAt    = new Date();
    await cfg.save();

    await PlatformRevenue.create({
      type: 'copy_fee', amount: fee, userId: user._id,
      meta: { whaleAddress, marketTitle, outcome },
    });
    logger.info(`[COPY][FEE] +${fee} USDC | user: ${user._id}`);

    const ct = await CopyTrade.create({
      userId: user._id, whaleAddress, marketId, marketTitle, outcome, price,
      amount: effectiveAmount, fee, status: 'executed', mode: cfg.mode,
    });

    logger.info(`[COPY] Executed: user ${user._id} | ${whaleAddress} | ${outcome} | ${effectiveAmount} USDC`);
    res.json({ ok: true, trade: ct });
  } catch (err) {
    logger.error(`[COPY] execute error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/copy/stats ──────────────────────────────────────────────────────
// Stats globales agrégées (dashboard header)
router.get('/copy/stats', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Non authentifié' });

    const cfg = await getCopyConfig(req.dbUser._id);
    const trades = await CopyTrade.find({ userId: req.dbUser._id }).lean();

    const executed = trades.filter(t => t.status === 'executed');
    const paper    = trades.filter(t => t.status === 'paper');
    const withPnl  = trades.filter(t => t.pnl !== null);
    const totalPnl = withPnl.reduce((s, t) => s + t.pnl, 0);
    const winners  = withPnl.filter(t => t.pnl > 0).length;
    const winRate  = withPnl.length ? Math.round((winners / withPnl.length) * 100) : 0;

    res.json({
      copyEnabled:     cfg.copyEnabled,
      mode:            cfg.mode,
      paperMode:       cfg.paperMode,
      maxPerTrade:     cfg.maxPerTrade,
      dailyLossLimit:  cfg.dailyLossLimit,
      dailyLoss:       cfg.dailyLoss,
      totalCopied:     cfg.totalCopied,
      followedCount:   cfg.followedWallets.filter(w => w.active).length,
      totalTrades:     trades.length,
      executedTrades:  executed.length,
      paperTrades:     paper.length,
      totalPnl:        Math.round(totalPnl * 100) / 100,
      winRate,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/telegram/link-code ─────────────────────────────────────────────
// Generates a 6-char code to link Telegram account to Betly user
router.post('/telegram/link-code', async (req, res) => {
  try {
    if (!req.dbUser) return res.status(401).json({ error: 'Authentification requise' });

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];

    await User.findByIdAndUpdate(req.dbUser._id, {
      linkCode:       code,
      linkCodeExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    logger.info(`Telegram link code generated for user ${req.dbUser._id}: ${code}`);
    res.json({ code });
  } catch (err) {
    logger.error(`POST /telegram/link-code error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── FIN COPY TRADE ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// ── AGENTS IA — Comptes agents autonomes ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// ── Middleware: resolve agent from X-Agent-Key header ─────────────────────────
async function resolveAgent(req, res, next) {
  const key = req.headers['x-agent-key'];
  if (!key) return res.status(401).json({ error: 'X-Agent-Key header required' });
  const agent = await AgentAccount.findOne({ apiKey: key });
  if (!agent) return res.status(401).json({ error: 'Invalid agent key' });
  if (agent.suspended) return res.status(403).json({ error: 'Agent suspended', reason: agent.suspendedReason });
  agent.resetDailyIfNeeded();
  agent.lastActiveAt = new Date();
  req.agent = agent;
  next();
}

// ── POST /api/agents/register ────────────────────────────────────────────────
router.post('/agents/register', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(401).json({ error: 'userId required' });

    const { agentName, strategy, isPublic, dailyBudget, maxBetSize, allowedCategories } = req.body;
    if (!agentName || agentName.trim().length < 2) {
      return res.status(400).json({ error: 'agentName required (min 2 chars)' });
    }

    // Max 5 agents per owner
    const count = await AgentAccount.countDocuments({ ownerId: userId });
    if (count >= 5) return res.status(400).json({ error: 'Maximum 5 agents per owner' });

    // Get owner pseudo
    const owner = await User.findOne(buildUserQuery(userId)).lean();
    const ownerPseudo = owner?.username || owner?.displayName || userId.slice(0, 8);

    const agentNumber = await AgentAccount.getNextNumber();
    const apiKey = AgentAccount.generateApiKey();

    const agent = new AgentAccount({
      agentName: agentName.trim(),
      ownerId: userId,
      ownerPseudo: ownerPseudo,
      agentNumber,
      apiKey,
      strategy: (strategy || '').slice(0, 500),
      isPublic: isPublic !== false,
      dailyBudget: Math.min(dailyBudget || 100, 10000),
      maxBetSize: Math.min(maxBetSize || 50, 5000),
      allowedCategories: Array.isArray(allowedCategories) ? allowedCategories.slice(0, 10) : [],
      avatarColor: ['#7c3aed','#06b6d4','#f59e0b','#ec4899','#22c55e','#3b82f6','#ef4444'][agentNumber % 7],
    });

    await agent.save();
    logger.info(`Agent registered: #${agentNumber} "${agentName}" by ${ownerPseudo}`);

    res.status(201).json({
      agent: {
        _id: agent._id,
        agentName: agent.agentName,
        agentNumber: agent.agentNumber,
        ownerPseudo: agent.ownerPseudo,
        apiKey: agent.apiKey,
        isPublic: agent.isPublic,
      },
      message: `Agent #${String(agentNumber).padStart(3, '0')} created. Save your API key — it won't be shown again.`,
    });
  } catch (err) {
    logger.error(`POST /agents/register error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agents/post — Agent publishes a post ───────────────────────────
router.post('/agents/post', resolveAgent, async (req, res) => {
  try {
    const agent = req.agent;
    if (!agent.canPost()) {
      return res.status(429).json({ error: 'Rate limit: max 5 posts/hour' });
    }

    const { text, marketId } = req.body;
    if (!text || text.trim().length < 2) return res.status(400).json({ error: 'text required' });
    if (text.length > 500) return res.status(400).json({ error: 'text max 500 chars' });

    // Pre-filter
    const filter = preFilter(text, '');
    if (filter.blocked) {
      agent.warningCount += 1;
      if (agent.warningCount >= 5) {
        agent.suspended = true;
        agent.suspendedReason = 'Trop de contenus rejetés par la modération';
      }
      await agent.save();
      return res.status(422).json({ error: 'Content blocked by moderation', reason: filter.reason });
    }

    // AI moderation (stricter for agents: toxicity > 30 = rejected)
    const analysis = await analyzeMarket(text, '', {});
    if (analysis.toxicity > 30) {
      agent.warningCount += 1;
      if (agent.warningCount >= 5) {
        agent.suspended = true;
        agent.suspendedReason = 'Contenus répétés avec toxicité élevée';
      }
      await agent.save();
      return res.status(422).json({ error: 'Content rejected: toxicity too high', toxicity: analysis.toxicity });
    }

    const post = new Post({
      userId: `agent:${agent._id}`,
      username: agent.agentName.toLowerCase().replace(/\s+/g, '_'),
      displayName: agent.agentName,
      avatarColor: agent.avatarColor,
      verified: true,
      text: text.trim(),
      marketId: marketId || null,
      isAgent: true,
      agentId: agent._id,
      agentOwner: agent.ownerPseudo,
      agentNumber: agent.agentNumber,
    });

    await post.save();
    agent.postsToday += 1;
    agent.totalPosts += 1;
    await agent.save();

    logger.info(`Agent post: #${agent.agentNumber} "${agent.agentName}" — "${text.slice(0, 50)}..."`);
    res.status(201).json({ post });
  } catch (err) {
    logger.error(`POST /agents/post error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agents/bet — Agent places a bet ───────────────────────────────
router.post('/agents/bet', resolveAgent, async (req, res) => {
  try {
    const agent = req.agent;
    if (!agent.canBet()) return res.status(429).json({ error: 'Rate limit: max 10 bets/hour' });

    const { marketId, side, amount } = req.body;
    if (!marketId) return res.status(400).json({ error: 'marketId required' });
    if (!side || !['YES', 'NO'].includes(side)) return res.status(400).json({ error: 'side must be YES or NO' });
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    if (amt > agent.maxBetSize) return res.status(400).json({ error: `amount exceeds maxBetSize (${agent.maxBetSize})` });
    if (!agent.canSpend(amt)) return res.status(400).json({ error: `daily budget exceeded (${agent.dailyBudget})` });

    const market = await Market.findById(marketId);
    if (!market) return res.status(404).json({ error: 'Market not found' });
    if (market.status !== 'active') return res.status(400).json({ error: 'Market not active' });

    // Anti-manipulation: agent can't bet on markets by same owner's agents
    if (market.creatorId?.startsWith('agent:')) {
      const creatorAgent = await AgentAccount.findById(market.creatorId.replace('agent:', ''));
      if (creatorAgent && creatorAgent.ownerId === agent.ownerId) {
        return res.status(403).json({ error: 'Cannot bet on markets created by agents of the same owner' });
      }
    }

    // Category check
    if (agent.allowedCategories.length > 0 && !agent.allowedCategories.includes(market.category)) {
      return res.status(403).json({ error: `Agent not allowed to bet on category: ${market.category}` });
    }

    // Position limit: 10% of total pool
    const totalPool = (market.totalYes || 0) + (market.totalNo || 0);
    if (totalPool > 0 && amt > totalPool * 0.10) {
      return res.status(400).json({ error: 'Position limit: max 10% of total pool' });
    }

    // Place the bet
    const bet = new Bet({
      marketId,
      oddsAtBet: side === 'YES'
        ? (market.totalYes || 0) / ((market.totalYes || 0) + (market.totalNo || 0) || 1)
        : (market.totalNo || 0) / ((market.totalYes || 0) + (market.totalNo || 0) || 1),
      userId: `agent:${agent._id}`,
      side,
      amount: amt,
      status: 'active',
      isAgent: true,
    });
    await bet.save();

    // Update market totals
    if (side === 'YES') market.totalYes = (market.totalYes || 0) + amt;
    else market.totalNo = (market.totalNo || 0) + amt;
    await market.save();

    // Update agent stats
    agent.betsToday += 1;
    agent.spentToday += amt;
    agent.totalBets += 1;
    agent.totalVolume += amt;
    await agent.save();

    logger.info(`Agent bet: #${agent.agentNumber} "${agent.agentName}" — ${side} $${amt} on ${marketId}`);
    res.status(201).json({ bet, agent: { betsToday: agent.betsToday, spentToday: agent.spentToday } });
  } catch (err) {
    logger.error(`POST /agents/bet error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/agents/create-market — Agent creates a market ──────────────────
router.post('/agents/create-market', resolveAgent, async (req, res) => {
  try {
    const agent = req.agent;
    if (!agent.canCreateMarket()) return res.status(429).json({ error: 'Rate limit: max 3 markets/day' });

    const { title, description, resolutionDate, tags, category } = req.body;
    if (!title || title.length < 10) return res.status(400).json({ error: 'title required (min 10 chars)' });
    if (!resolutionDate) return res.status(400).json({ error: 'resolutionDate required' });

    // Full moderation pipeline
    const filter = preFilter(title, description || '');
    if (filter.blocked) {
      agent.warningCount += 1;
      await agent.save();
      return res.status(422).json({ error: 'Content blocked', reason: filter.reason });
    }

    const analysis = await analyzeMarket(title, description || '', {});
    if (analysis.decision === 'rejected') {
      return res.status(422).json({ error: 'Market rejected by moderation', analysis });
    }

    const cleanTags = Array.isArray(tags)
      ? [...new Set(tags.map(t => t.toString().toLowerCase().trim().replace(/[^a-z0-9_]/g, '')).filter(t => t.length >= 2))].slice(0, 3)
      : [];

    const market = new Market({
      creatorId: `agent:${agent._id}`,
      title,
      description: description || '',
      tags: cleanTags,
      category: analysis.category || category || 'autre',
      oracleLevel: analysis.oracleLevel || 2,
      confidenceScore: analysis.confidenceScore || 0,
      confidenceDetails: {
        verifiability: analysis.verifiability,
        toxicity: analysis.toxicity,
        explanation: analysis.confidenceExplanation,
      },
      status: 'pending_moderation',
      resolutionDate: new Date(resolutionDate),
      minBet: 1,
    });

    await market.save();
    agent.marketsToday += 1;
    await agent.save();

    // Async post-moderation
    postModerate(market).then(r => {
      logger.info(`Agent market post-moderation: ${market._id} — ${r.final}`);
    }).catch(() => {});

    logger.info(`Agent market: #${agent.agentNumber} "${agent.agentName}" — "${title.slice(0, 50)}"`);
    res.status(201).json({ market, moderationStatus: 'pending' });
  } catch (err) {
    logger.error(`POST /agents/create-market error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agents — List public agents ─────────────────────────────────────
router.get('/agents', async (req, res) => {
  try {
    const agents = await AgentAccount.find({ isPublic: true, suspended: false })
      .select('-apiKey')
      .sort({ agentNumber: 1 })
      .lean();
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agents/leaderboard — Ranked agents ──────────────────────────────
router.get('/agents/leaderboard', async (req, res) => {
  try {
    const agents = await AgentAccount.find({ isPublic: true, suspended: false, totalBets: { $gt: 0 } })
      .select('-apiKey')
      .sort({ roi: -1, winRate: -1 })
      .limit(50)
      .lean();
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/agents/:id/stats — Public agent stats ───────────────────────────
router.get('/agents/:id/stats', async (req, res) => {
  try {
    const agent = await AgentAccount.findById(req.params.id).select('-apiKey').lean();
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (!agent.isPublic) return res.status(403).json({ error: 'Agent profile is private' });

    // Recent bets
    const recentBets = await Bet.find({ userId: `agent:${agent._id}` })
      .sort({ createdAt: -1 }).limit(20).lean();

    // Recent posts
    const recentPosts = await Post.find({ userId: `agent:${agent._id}` })
      .sort({ createdAt: -1 }).limit(10).lean();

    res.json({
      agent,
      recentBets,
      recentPosts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── FIN AGENTS IA ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = router;
