/**
 * resolver.js — Oracle multi-niveaux pour résoudre les marchés BETLY.
 *
 * Niveaux :
 *   L1 — crypto/sport : API CoinGecko (données en temps réel)
 *   L2 — IA           : Claude Haiku analyse le titre + date de résolution
 *   L3 — communauté   : vote majoritaire (≥3 votes, seuil 60 %)
 *
 * Flow : tente L(oracleLevel) → cascade L3 → sinon status 'resolving'
 */

const axios    = require('axios');
const { default: Anthropic } = require('@anthropic-ai/sdk');
const Market   = require('../../db/models/Market');
const Bet      = require('../../db/models/Bet');
const Vote     = require('../../db/models/Vote');
const User     = require('../../db/models/User');
const config   = require('../../config');
const logger   = require('../utils/logger');

const anthropic = new Anthropic({ apiKey: config.anthropic.apiKey });

// ── Level 1 : CoinGecko ──────────────────────────────────────────────────────

async function resolveLevel1(market) {
  const title = market.title.toLowerCase();

  try {
    // BTC price target
    if (title.match(/bitcoin|btc/)) {
      const res = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
        { timeout: 6000 }
      );
      const btcPrice = res.data.bitcoin.usd;

      // Extract target e.g. "150 000$", "150k", "150000"
      const m = title.match(/(\d[\d\s]*)\s*(?:000)?\s*[$€]/i)
             || title.match(/(\d+)\s*k\b/i);
      if (m) {
        let target = parseFloat(m[1].replace(/\s/g, ''));
        if (title.match(/\d+\s*000/)) {
          // number like "150 000" — already full
        } else if (title.match(/\d+k/i)) {
          target *= 1000;
        }
        logger.info(`resolver L1: BTC $${btcPrice} vs target $${target}`);
        return btcPrice >= target ? 'YES' : 'NO';
      }
    }

    // ETH/BTC ratio
    if (title.match(/eth.*btc|ethereum.*bitcoin/) && title.match(/0\.\d+/)) {
      const res = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd',
        { timeout: 6000 }
      );
      const ratio = res.data.ethereum.usd / res.data.bitcoin.usd;
      const m = title.match(/(0\.\d+)/);
      if (m) {
        const target = parseFloat(m[1]);
        logger.info(`resolver L1: ETH/BTC ${ratio.toFixed(4)} vs target ${target}`);
        return ratio >= target ? 'YES' : 'NO';
      }
    }

    // ETH price target
    if (title.match(/\bethéreum\b|\beth\b/) && !title.match(/btc|bitcoin/)) {
      const res = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        { timeout: 6000 }
      );
      const ethPrice = res.data.ethereum.usd;
      const m = title.match(/(\d[\d\s]*)\s*[$€]/i);
      if (m) {
        const target = parseFloat(m[1].replace(/\s/g, ''));
        logger.info(`resolver L1: ETH $${ethPrice} vs target $${target}`);
        return ethPrice >= target ? 'YES' : 'NO';
      }
    }
  } catch (err) {
    logger.warn(`resolver L1: API error — ${err.message}`);
  }

  return null;
}

// ── Level 2 : Claude AI ──────────────────────────────────────────────────────

async function resolveLevel2(market) {
  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'placeholder') {
    return null;
  }

  try {
    const resDate = new Date(market.resolutionDate).toLocaleDateString('fr-FR');
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 64,
      system: `Tu es un oracle de résolution pour la plateforme de paris BETLY.
Un marché dont la date de résolution est passée te demande sa résolution.
Réponds UNIQUEMENT avec ce JSON : {"outcome":"YES"} ou {"outcome":"NO"} ou {"outcome":null} si incertain.`,
      messages: [{
        role: 'user',
        content: `Titre : ${market.title}\nDescription : ${market.description || ''}\nDate résolution : ${resDate}`,
      }],
    });

    const raw = msg.content[0].text.trim()
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(raw);
    logger.info(`resolver L2: Claude → ${result.outcome} for ${market._id}`);
    return result.outcome || null;
  } catch (err) {
    logger.warn(`resolver L2: Claude error — ${err.message}`);
    return null;
  }
}

// ── Level 3 : Community vote ─────────────────────────────────────────────────

async function resolveLevel3(market) {
  const votes = await Vote.find({ marketId: market._id }).lean();
  if (votes.length < 3) {
    logger.info(`resolver L3: not enough votes (${votes.length}) for ${market._id}`);
    return null;
  }

  const yesW = votes.filter(v => v.vote === 'YES').reduce((s, v) => s + (v.weight || 1), 0);
  const noW  = votes.filter(v => v.vote === 'NO').reduce((s, v)  => s + (v.weight || 1), 0);
  const total = yesW + noW;

  const yesPct = total > 0 ? yesW / total : 0;
  const noPct  = total > 0 ? noW  / total : 0;

  logger.info(`resolver L3: YES ${Math.round(yesPct * 100)}% — NO ${Math.round(noPct * 100)}% (${votes.length} votes)`);

  if (yesPct >= 0.6) return 'YES';
  if (noPct  >= 0.6) return 'NO';
  return null;
}

// ── Payout distribution ──────────────────────────────────────────────────────

async function distributePayout(market, outcome) {
  const pool = (market.totalYes || 0) + (market.totalNo || 0);
  if (pool === 0) return;

  const CREATOR_FEE = 0.02;  // 2% retourné au créateur
  const WINNER_POOL = pool * (1 - CREATOR_FEE - 0.03); // 95% aux gagnants

  const bets    = await Bet.find({ marketId: market._id, status: 'active' }).lean();
  const winners = bets.filter(b => b.side === outcome);
  const losers  = bets.filter(b => b.side !== outcome);
  const winningTotal = winners.reduce((s, b) => s + b.amount, 0);

  for (const bet of losers) {
    await Bet.findByIdAndUpdate(bet._id, { status: 'lost', payout: 0 });
  }

  for (const bet of winners) {
    const share  = winningTotal > 0 ? bet.amount / winningTotal : 0;
    const payout = Math.round(WINNER_POOL * share * 100) / 100;
    await Bet.findByIdAndUpdate(bet._id, { status: 'won', payout });
    await User.findOneAndUpdate(
      { telegramId: bet.userId },
      { $inc: { wonBets: 1, totalEarned: payout, balance: payout } },
      { upsert: true }
    );
  }

  if (market.creatorId && market.creatorId !== 'system') {
    const creatorFee = Math.round(pool * CREATOR_FEE * 100) / 100;
    await User.findOneAndUpdate(
      { telegramId: market.creatorId },
      { $inc: { totalEarned: creatorFee, balance: creatorFee } },
      { upsert: true }
    );
    await Market.findByIdAndUpdate(market._id, { stakeReturned: true });
  }

  logger.info(`resolver: payout — pool ${pool} USDC — ${winners.length} gagnant(s) / ${losers.length} perdant(s)`);
}

// ── Core ─────────────────────────────────────────────────────────────────────

async function resolveMarket(market) {
  logger.info(`resolver: résolution de ${market._id} (L${market.oracleLevel})`);

  let outcome = null;

  if (market.oracleLevel === 1) {
    outcome = await resolveLevel1(market);
    if (!outcome) outcome = await resolveLevel2(market);
  } else if (market.oracleLevel === 2) {
    outcome = await resolveLevel2(market);
    if (!outcome) outcome = await resolveLevel3(market);
  } else {
    outcome = await resolveLevel3(market);
  }

  // Dernier recours : vote communauté
  if (!outcome) outcome = await resolveLevel3(market);

  if (!outcome) {
    logger.warn(`resolver: pas de résultat pour ${market._id} → resolving`);
    await Market.findByIdAndUpdate(market._id, { status: 'resolving' });
    return null;
  }

  await Market.findByIdAndUpdate(market._id, { status: 'resolved', outcome });
  await distributePayout(market, outcome);
  logger.info(`resolver: ✅ ${market._id} → ${outcome}`);
  return outcome;
}

// ── Scheduler ────────────────────────────────────────────────────────────────

async function runResolutionCycle() {
  try {
    const now     = new Date();
    const markets = await Market.find({
      status:         { $in: ['active', 'resolving'] },
      resolutionDate: { $lte: now },
    }).lean();

    if (markets.length > 0) {
      logger.info(`resolver: ${markets.length} marché(s) à résoudre`);
      for (const market of markets) {
        try { await resolveMarket(market); }
        catch (err) { logger.error(`resolver: erreur ${market._id} — ${err.message}`); }
      }
    }
  } catch (err) {
    logger.error(`resolver: cycle error — ${err.message}`);
  }
}

function startResolver() {
  runResolutionCycle();
  setInterval(runResolutionCycle, 30 * 60 * 1000);
  logger.info('resolver: démarré (cycle 30 min)');
}

module.exports = { resolveMarket, startResolver, runResolutionCycle };
