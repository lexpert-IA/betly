/**
 * Distribution Agent — Twitter / X (OAuth 1.0a)
 * Posts new markets directly via Twitter API v2 using OAuth 1.0a signing.
 */

const axios   = require('axios');
const OAuth   = require('oauth-1.0a');
const crypto  = require('crypto');
const config  = require('../../../config');
const logger  = require('../../utils/logger');

const BETLY_URL = process.env.BETLY_BASE_URL || 'https://betly.gg';

// ── OAuth 1.0a signer ───────────────────────────────────────────────────────
function getOAuth() {
  const apiKey    = config.twitter?.apiKey    || process.env.TWITTER_API_KEY;
  const apiSecret = config.twitter?.apiSecret || process.env.TWITTER_API_SECRET;
  if (!apiKey || !apiSecret) return null;

  return OAuth({
    consumer: { key: apiKey, secret: apiSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(baseString, key) {
      return crypto.createHmac('sha1', key).update(baseString).digest('base64');
    },
  });
}

function getAccessToken() {
  const key    = process.env.TWITTER_ACCESS_TOKEN;
  const secret = process.env.TWITTER_ACCESS_SECRET;
  if (!key || !secret) return null;
  return { key, secret };
}

// ── Tweet builder ───────────────────────────────────────────────────────────
function buildTweet(market) {
  const total = (market.totalYes || 0) + (market.totalNo || 0);
  const yesPct = total > 0 ? Math.round((market.totalYes / total) * 100) : 50;

  const catEmoji = {
    sport: '⚽', crypto: '₿', politique: '🏛️', culture: '🎬',
    tech: '🤖', gaming: '🎮', autre: '🔮',
  };
  const emoji = catEmoji[market.category] || '🔮';

  const link = `${BETLY_URL}/market/${market._id}`;
  const tags = (market.tags || []).slice(0, 3).map(t => `#${t}`).join(' ');

  return `${emoji} ${market.title}\n\n📊 ${yesPct}% disent OUI\n🔥 Parie maintenant → ${link}\n\n${tags} #BETLY`.trim();
}

// ── Post tweet via OAuth 1.0a ───────────────────────────────────────────────
async function postTweet(text) {
  const oauth = getOAuth();
  const token = getAccessToken();

  if (!oauth || !token) {
    logger.debug('twitterAgent: missing API keys or access tokens — cannot post');
    return false;
  }

  const url = 'https://api.twitter.com/2/tweets';
  const requestData = { url, method: 'POST' };

  const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

  try {
    const res = await axios.post(url,
      { text },
      {
        headers: {
          ...authHeader,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    return res.data?.data?.id || true;
  } catch (err) {
    const errMsg = err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : err.message;
    logger.warn(`twitterAgent: post error — ${errMsg}`);
    return false;
  }
}

// ── Main: distribute market to Twitter ──────────────────────────────────────
async function distribute(market) {
  const tweet = buildTweet(market);
  const result = await postTweet(tweet);

  if (result) {
    logger.info(`twitterAgent: posted market ${market._id} to Twitter`);
  }

  return !!result;
}

module.exports = { distribute, buildTweet, postTweet };
