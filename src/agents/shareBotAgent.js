/**
 * Share Bot Agent — viral sharing automation
 *
 * Every 30 minutes:
 *   1. Scan tweets mentioning 'betly.gg' → auto-retweet if > 50 likes
 *   2. Check markets with 10+ new bets since last scan → auto-tweet excitement
 *   3. Check big wins (payout > 100 USDC) paid out since last scan → auto-tweet
 *
 * Requires TWITTER_BEARER_TOKEN + TWITTER_APP_ACCESS_TOKEN env vars.
 * Runs as no-op stub when keys are absent.
 */

const OAuth  = require('oauth-1.0a');
const crypto = require('crypto');
const logger = require('../utils/logger');

const SCAN_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const BETLY_BASE = process.env.BETLY_BASE_URL || 'https://betly.gg';

// ── Twitter helpers (OAuth 1.0a for posting, Bearer for reading) ─────────────

function _getOAuth() {
  const apiKey    = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  return OAuth({
    consumer: { key: apiKey, secret: apiSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

function _getToken() {
  const key    = process.env.TWITTER_ACCESS_TOKEN;
  const secret = process.env.TWITTER_ACCESS_SECRET;
  return (key && secret) ? { key, secret } : null;
}

async function twitterGet(path) {
  const BEARER = process.env.TWITTER_BEARER_TOKEN;
  if (!BEARER) return null;
  const res = await fetch(`https://api.twitter.com/2${path}`, {
    headers: { Authorization: `Bearer ${BEARER}` },
  });
  if (!res.ok) return null;
  return res.json();
}

async function twitterPost(endpoint, body) {
  const oauth = _getOAuth();
  const token = _getToken();
  if (!oauth || !token) {
    logger.debug(`shareBotAgent: stub tweet (no OAuth keys) — ${JSON.stringify(body).slice(0, 80)}`);
    return;
  }
  try {
    const url = `https://api.twitter.com/2${endpoint}`;
    const authHeader = oauth.toHeader(oauth.authorize({ url, method: 'POST' }, token));
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.warn(`shareBotAgent: twitter POST ${endpoint} failed: ${err.slice(0, 120)}`);
    }
  } catch (e) {
    logger.warn(`shareBotAgent: twitter error: ${e.message}`);
  }
}

// ── Task 1: scan & retweet betly.gg mentions ──────────────────────────────────

const retweetedIds = new Set(); // in-memory dedup (reset on restart)

async function scanAndRetweet() {
  const query = encodeURIComponent('betly.gg -is:retweet lang:fr');
  const data = await twitterGet(
    `/tweets/search/recent?query=${query}&max_results=20&tweet.fields=public_metrics`
  );
  if (!data?.data) return;

  for (const tweet of data.data) {
    if (retweetedIds.has(tweet.id)) continue;
    const likes = tweet.public_metrics?.like_count || 0;
    if (likes >= 50) {
      await twitterPost(`/tweets`, { quote_tweet_id: tweet.id, text: '🔥 La communauté BETLY est en feu !' });
      retweetedIds.add(tweet.id);
      logger.info(`shareBotAgent: retweeted/quoted tweet ${tweet.id} (${likes} likes)`);
    }
  }
}

// ── Task 2: tweet when a market hits 10+ bets ─────────────────────────────────

const tweetedMarkets = new Set(); // markets already tweeted about

async function tweetActiveMarkets(Market) {
  if (!Market) return;
  try {
    // Markets with 10+ bets that haven't been tweeted yet
    const markets = await Market.find({
      status: 'active',
      betCount: { $gte: 10 },
    }).select('_id title betCount totalYes totalNo').limit(5).lean();

    for (const m of markets) {
      if (tweetedMarkets.has(m._id.toString())) continue;

      const total = (m.totalYes || 0) + (m.totalNo || 0);
      const yesPct = total > 0 ? Math.round((m.totalYes / total) * 100) : 50;
      const link = `${BETLY_BASE}/market/${m._id}`;
      const text =
        `🔥 ${m.betCount} parieurs sur BETLY ont déjà voté !\n` +
        `"${m.title.slice(0, 80)}"\n` +
        `OUI ${yesPct}% · NON ${100 - yesPct}%\n` +
        `→ ${link} #BETLY #PredictionMarket`;

      await twitterPost('/tweets', { text });
      tweetedMarkets.add(m._id.toString());
      logger.info(`shareBotAgent: tweeted market ${m._id} (${m.betCount} bets)`);
    }
  } catch (e) {
    logger.warn(`shareBotAgent: tweetActiveMarkets error: ${e.message}`);
  }
}

// ── Task 3: tweet big wins (payout > 100 USDC) ────────────────────────────────

let lastWinScan = new Date(Date.now() - SCAN_INTERVAL_MS);
const tweetedBets = new Set();

async function tweetBigWins(Bet, Market) {
  if (!Bet || !Market) return;
  try {
    const since = lastWinScan;
    lastWinScan = new Date();

    const wonBets = await Bet.find({
      status: 'won',
      payout: { $gt: 100 },
      resolvedAt: { $gte: since },
    }).populate('userId', 'username displayName').limit(5).lean();

    for (const bet of wonBets) {
      if (tweetedBets.has(bet._id.toString())) continue;

      const market = await Market.findById(bet.marketId).select('title _id').lean();
      if (!market) continue;

      const gain = (bet.payout - bet.amount).toFixed(0);
      const username = bet.userId?.username || bet.userId?.displayName || 'Un parieur';
      const link = `${BETLY_BASE}/market/${market._id}`;
      const text =
        `💰 @${username} vient de gagner +$${gain} USDC sur BETLY !\n` +
        `"${market.title.slice(0, 70)}"\n` +
        `→ ${link} #BETLY`;

      await twitterPost('/tweets', { text });
      tweetedBets.add(bet._id.toString());
      logger.info(`shareBotAgent: tweeted big win bet ${bet._id} (+$${gain})`);
    }
  } catch (e) {
    logger.warn(`shareBotAgent: tweetBigWins error: ${e.message}`);
  }
}

// ── Agent lifecycle ────────────────────────────────────────────────────────────

let _timer = null;

function startShareBotAgent(Market, Bet) {
  if (_timer) return;

  const run = async () => {
    logger.debug('shareBotAgent: running scan');
    await Promise.allSettled([
      scanAndRetweet(),
      tweetActiveMarkets(Market),
      tweetBigWins(Bet, Market),
    ]);
  };

  run();
  _timer = setInterval(run, SCAN_INTERVAL_MS);
  logger.info('shareBotAgent: started (30min interval)');
}

function stopShareBotAgent() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startShareBotAgent, stopShareBotAgent };
