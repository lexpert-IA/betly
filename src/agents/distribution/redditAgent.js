/**
 * Distribution Agent — Reddit
 * Posts new markets to relevant subreddits using Reddit API (OAuth2).
 */

const axios  = require('axios');
const config = require('../../../config');
const logger = require('../../utils/logger');

const BETLY_URL = process.env.BETLY_BASE_URL || 'https://betly.gg';

// Category → target subreddits
const SUBREDDIT_MAP = {
  sport:     ['paris_sportifs'],
  crypto:    ['CryptoFR', 'CryptoCurrency'],
  politique: ['france'],
  culture:   ['france', 'popculture'],
  tech:      ['france', 'technologie'],
  gaming:    ['jeuxvideo', 'gaming'],
  autre:     ['france'],
};

let _accessToken = null;
let _tokenExpiry = 0;

async function getRedditToken() {
  if (_accessToken && Date.now() < _tokenExpiry) return _accessToken;

  const clientId = config.reddit?.clientId;
  const clientSecret = config.reddit?.clientSecret;
  const username = config.reddit?.username;
  const password = config.reddit?.password;

  if (!clientId || !clientSecret) {
    return null;
  }

  try {
    const res = await axios.post(
      'https://www.reddit.com/api/v1/access_token',
      `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      {
        auth: { username: clientId, password: clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BETLY-Bot/1.0' },
        timeout: 10000,
      }
    );

    _accessToken = res.data.access_token;
    _tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000;
    return _accessToken;
  } catch (err) {
    logger.warn(`redditAgent: token error — ${err.message}`);
    return null;
  }
}

function buildPost(market) {
  const link = `${BETLY_URL}/market/${market._id}`;
  const body = `**${market.title}**\n\n${market.description || ''}\n\n📊 Venez parier sur BETLY : ${link}\n\n---\n*Marché auto-généré par BETLY — plateforme de paris communautaires*`;

  return {
    title: `[BETLY] ${market.title}`,
    text: body,
  };
}

async function distribute(market) {
  const token = await getRedditToken();
  if (!token) {
    logger.debug('redditAgent: no Reddit credentials — skipping');
    return false;
  }

  const subs = SUBREDDIT_MAP[market.category] || SUBREDDIT_MAP.autre;
  const targetSub = subs[0]; // Post to primary sub only
  const post = buildPost(market);

  try {
    await axios.post(
      'https://oauth.reddit.com/api/submit',
      `sr=${targetSub}&kind=self&title=${encodeURIComponent(post.title)}&text=${encodeURIComponent(post.text)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'BETLY-Bot/1.0',
        },
        timeout: 10000,
      }
    );

    logger.info(`redditAgent: posted to r/${targetSub} — market ${market._id}`);
    return true;
  } catch (err) {
    logger.warn(`redditAgent: post error on r/${targetSub} — ${err.message}`);
    return false;
  }
}

module.exports = { distribute, buildPost };
