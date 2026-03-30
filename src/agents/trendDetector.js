/**
 * Module 1 — Trend Detector
 * Scans Twitter/X, Google Trends, Reddit every 15 minutes.
 * Scores each trend (0-100) and forwards high-score trends to the pipeline.
 *
 * Score = (velocity × 0.35) + (volume × 0.30) + (sentiment × 0.20) + (freshness × 0.15)
 */

const axios   = require('axios');
const config  = require('../../config');
const logger  = require('../utils/logger');

// ── Minimum score to forward to NATHAN ──────────────────────────────────────
const MIN_TREND_SCORE = 55;

// ── Source weights for multi-source confirmation ────────────────────────────
const SOURCE_BONUS = { twitter: 0, reddit: 5, google: 5 }; // bonus if seen on 2+ sources

// ── Categories we care about ────────────────────────────────────────────────
const BETLY_CATEGORIES = ['sport', 'crypto', 'politique', 'culture', 'tech', 'gaming'];

const CATEGORY_KEYWORDS = {
  sport:     ['foot', 'nba', 'tennis', 'ligue', 'match', 'coupe', 'transfert', 'psg', 'om', 'barca', 'real madrid', 'premier league', 'ufc', 'boxe', 'f1', 'moto gp'],
  crypto:    ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'token', 'defi', 'nft', 'solana', 'sol', 'airdrop', 'binance', 'memecoin', 'halving'],
  politique: ['macron', 'élection', 'vote', 'assemblée', 'trump', 'président', 'sénat', 'loi', 'gouvernement', 'réforme'],
  culture:   ['film', 'série', 'oscar', 'grammy', 'album', 'concert', 'netflix', 'disney', 'youtube', 'twitch', 'musique'],
  tech:      ['ia', 'ai', 'openai', 'chatgpt', 'claude', 'apple', 'iphone', 'google', 'meta', 'spacex', 'tesla'],
  gaming:    ['jeu', 'game', 'ps5', 'xbox', 'nintendo', 'esport', 'fortnite', 'league of legends', 'valorant', 'gta'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Source: Twitter / X API v2
// ─────────────────────────────────────────────────────────────────────────────
async function fetchTwitterTrends() {
  const bearer = config.twitter?.bearerToken;
  if (!bearer) {
    logger.debug('trendDetector: no TWITTER_BEARER_TOKEN — skipping Twitter');
    return [];
  }

  const trends = [];
  try {
    // Search high-engagement French tweets in BETLY categories
    for (const cat of BETLY_CATEGORIES) {
      const keywords = CATEGORY_KEYWORDS[cat].slice(0, 3).join(' OR ');
      const query = encodeURIComponent(`(${keywords}) lang:fr -is:retweet`);
      const res = await axios.get(
        `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,public_metrics&sort_order=relevancy`,
        { headers: { Authorization: `Bearer ${bearer}` }, timeout: 8000 }
      );
      const tweets = res.data?.data || [];

      // Aggregate into trend signals
      const engagement = tweets.reduce((acc, t) => {
        const m = t.public_metrics || {};
        return acc + (m.like_count || 0) + (m.retweet_count || 0) * 2 + (m.reply_count || 0);
      }, 0);

      if (engagement > 100) {
        // Extract the dominant topic from top tweet
        const topTweet = tweets.sort((a, b) =>
          ((b.public_metrics?.like_count || 0) + (b.public_metrics?.retweet_count || 0) * 2) -
          ((a.public_metrics?.like_count || 0) + (a.public_metrics?.retweet_count || 0) * 2)
        )[0];

        trends.push({
          source: 'twitter',
          category: cat,
          topic: topTweet?.text?.slice(0, 200) || keywords,
          engagement,
          tweetCount: tweets.length,
          velocity: tweets.length / 20, // ratio of max results = saturation
          topTweetId: topTweet?.id,
          detectedAt: new Date(),
        });
      }
    }
  } catch (err) {
    logger.warn(`trendDetector: Twitter error — ${err.message}`);
  }
  return trends;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: Reddit (public JSON API — no auth required)
// ─────────────────────────────────────────────────────────────────────────────
const REDDIT_SUBS = {
  sport:     ['soccer', 'nba', 'tennis', 'formula1', 'ligue1'],
  crypto:    ['CryptoCurrency', 'Bitcoin', 'ethereum', 'solana'],
  politique: ['france', 'europe', 'geopolitics'],
  culture:   ['movies', 'television', 'Music', 'popculture'],
  tech:      ['technology', 'artificial', 'MachineLearning'],
  gaming:    ['gaming', 'Games', 'esports'],
};

async function fetchRedditTrends() {
  const trends = [];
  try {
    for (const [cat, subs] of Object.entries(REDDIT_SUBS)) {
      const sub = subs[Math.floor(Math.random() * subs.length)]; // rotate subs
      const res = await axios.get(
        `https://www.reddit.com/r/${sub}/hot.json?limit=10`,
        { headers: { 'User-Agent': 'BETLY-TrendBot/1.0' }, timeout: 8000 }
      );
      const posts = res.data?.data?.children || [];

      for (const p of posts) {
        const d = p.data;
        const score = d.score || 0;
        const comments = d.num_comments || 0;
        const ageHours = (Date.now() / 1000 - d.created_utc) / 3600;

        // Only care about hot posts (high score, recent, many comments)
        if (score > 500 && comments > 50 && ageHours < 12) {
          trends.push({
            source: 'reddit',
            category: cat,
            topic: d.title,
            engagement: score + comments * 3,
            velocity: Math.min(score / Math.max(ageHours, 0.5), 1000) / 1000, // normalized
            subreddit: d.subreddit,
            permalink: d.permalink,
            detectedAt: new Date(),
          });
        }
      }
    }
  } catch (err) {
    logger.warn(`trendDetector: Reddit error — ${err.message}`);
  }
  return trends;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source: Google Trends (via unofficial daily trends endpoint)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchGoogleTrends() {
  const trends = [];
  try {
    const res = await axios.get(
      'https://trends.google.com/trends/trendingsearches/daily/rss?geo=FR',
      { timeout: 8000, responseType: 'text' }
    );
    // Simple XML parsing — extract <title> tags from RSS items
    const titles = [...res.data.matchAll(/<title><!\[CDATA\[(.+?)\]\]><\/title>/g)]
      .map(m => m[1])
      .filter(t => t !== 'Daily Search Trends');

    for (const title of titles.slice(0, 15)) {
      const cat = detectCategory(title.toLowerCase());
      trends.push({
        source: 'google',
        category: cat,
        topic: title,
        engagement: 500, // Google doesn't give exact numbers in RSS
        velocity: 0.6,   // trending = inherently high velocity
        detectedAt: new Date(),
      });
    }
  } catch (err) {
    logger.warn(`trendDetector: Google Trends error — ${err.message}`);
  }
  return trends;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────
function detectCategory(text) {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'autre';
}

function scoreTrend(trend) {
  // velocity: 0-1 normalized → 0-100
  const velocityScore = Math.min((trend.velocity || 0) * 100, 100);

  // volume: engagement normalized (log scale, cap at 10000)
  const volumeScore = Math.min((Math.log10(Math.max(trend.engagement || 1, 1)) / 4) * 100, 100);

  // freshness: how recent (decays over hours)
  const ageMs = Date.now() - new Date(trend.detectedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const freshnessScore = Math.max(100 - ageHours * 5, 0); // loses 5pts per hour

  // sentiment: neutral baseline (Claude will analyze sentiment later in NATHAN)
  const sentimentScore = 60;

  const raw = (velocityScore * 0.35) + (volumeScore * 0.30) + (sentimentScore * 0.20) + (freshnessScore * 0.15);
  return Math.round(Math.min(raw, 100));
}

function deduplicateTrends(allTrends) {
  const seen = new Map(); // topic_lower → trend with highest score

  for (const trend of allTrends) {
    trend.score = scoreTrend(trend);
    const key = trend.topic.toLowerCase().slice(0, 60);

    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.sources = existing.sources || [existing.source];
      if (!existing.sources.includes(trend.source)) {
        existing.sources.push(trend.source);
        // Multi-source bonus
        existing.score = Math.min(existing.score + 8, 100);
      }
      if (trend.score > existing.score) {
        existing.score = trend.score;
        existing.topic = trend.topic;
      }
    } else {
      trend.sources = [trend.source];
      seen.set(key, trend);
    }
  }

  return [...seen.values()]
    .filter(t => t.score >= MIN_TREND_SCORE)
    .sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: detect trends from all sources
// ─────────────────────────────────────────────────────────────────────────────
async function detectTrends() {
  logger.info('trendDetector: scanning all sources...');

  const [twitter, reddit, google] = await Promise.allSettled([
    fetchTwitterTrends(),
    fetchRedditTrends(),
    fetchGoogleTrends(),
  ]);

  const allTrends = [
    ...(twitter.status === 'fulfilled' ? twitter.value : []),
    ...(reddit.status === 'fulfilled'  ? reddit.value  : []),
    ...(google.status === 'fulfilled'  ? google.value  : []),
  ];

  logger.info(`trendDetector: raw signals — Twitter:${twitter.status === 'fulfilled' ? twitter.value.length : 0} Reddit:${reddit.status === 'fulfilled' ? reddit.value.length : 0} Google:${google.status === 'fulfilled' ? google.value.length : 0}`);

  const qualified = deduplicateTrends(allTrends);
  logger.info(`trendDetector: ${qualified.length} trends above threshold (≥${MIN_TREND_SCORE})`);

  return qualified;
}

module.exports = { detectTrends, scoreTrend, MIN_TREND_SCORE };
