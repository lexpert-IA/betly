/**
 * Viral Creator Agent — scans Twitter/TikTok for creator events every 6h
 * and auto-creates creator markets + tweets mentions.
 *
 * Requires: TWITTER_BEARER_TOKEN and TWITTER_API_KEY env vars to be active.
 * In dev/no-key mode: runs as a no-op stub.
 */
const logger = require('../utils/logger');

const SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

// FR creators to watch — will be extended from DB (verified creators)
const SEED_CREATORS = [
  { handle: 'Squeezie',     platform: 'youtube',  followers: 18_000_000 },
  { handle: 'AyaNakamura',  platform: 'twitter',  followers: 6_000_000  },
  { handle: 'gotaga',       platform: 'twitter',  followers: 4_000_000  },
  { handle: 'Michou',       platform: 'youtube',  followers: 8_000_000  },
  { handle: 'LeBouseuh',    platform: 'twitter',  followers: 2_000_000  },
];

async function scanCreatorEvents() {
  const BEARER = process.env.TWITTER_BEARER_TOKEN;
  if (!BEARER) {
    logger.debug('viralAgent: no TWITTER_BEARER_TOKEN — skipping scan');
    return [];
  }

  const events = [];
  for (const creator of SEED_CREATORS) {
    try {
      // Search recent tweets mentioning creator
      const query = encodeURIComponent(`@${creator.handle} lang:fr -is:retweet`);
      const res = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=10&tweet.fields=created_at,public_metrics`,
        { headers: { Authorization: `Bearer ${BEARER}` } }
      );
      const data = await res.json();
      const tweets = data?.data || [];

      // Detect high-engagement events (>500 likes or >200 retweets)
      for (const tweet of tweets) {
        const m = tweet.public_metrics || {};
        if ((m.like_count || 0) > 500 || (m.retweet_count || 0) > 200) {
          events.push({ creator, tweet, type: 'high_engagement' });
        }
      }
    } catch (e) {
      logger.warn(`viralAgent: error scanning @${creator.handle}: ${e.message}`);
    }
  }
  return events;
}

async function generateMarketFromEvent(event, Market, User) {
  const { creator } = event;
  const systemUser = await User.findOne({ username: 'system' }).lean();
  const creatorId = systemUser?._id?.toString() || 'system';

  // Generate a relevant market title
  const titles = [
    `@${creator.handle} dépasse ${Math.round(creator.followers / 1_000_000 + 1)}M abonnés avant juillet 2026 ?`,
    `@${creator.handle} annonce une collaboration surprise ce mois-ci ?`,
    `La prochaine vidéo de @${creator.handle} dépasse 5M vues en 48h ?`,
  ];
  const title = titles[Math.floor(Math.random() * titles.length)];

  const resolutionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  const market = new Market({
    creatorId,
    title,
    category: 'culture',
    creatorMarket: true,
    subjectHandle: creator.handle,
    subjectPlatform: creator.platform,
    subjectFollowers: creator.followers,
    status: 'active',
    resolutionDate,
    oracleLevel: 1,
    confidenceScore: 75,
  });

  await market.save();
  logger.info(`viralAgent: auto-created market "${title}" (id: ${market._id})`);
  return market;
}

async function tweetMarket(market, creator) {
  // Stub — tweet from BETLY account mentioning the creator
  const BETLY_BASE = process.env.BETLY_BASE_URL || 'https://betly.gg';
  const link = `${BETLY_BASE}/market/${market._id}`;
  const tweetText = `@${creator.handle} — ta communauté vient de créer un marché sur toi 👀\n${Math.round(Math.random() * 30 + 50)}% pensent OUI.\n→ ${link}\n#BETLY`;

  // POST tweet via Twitter API v2 (requires OAuth 2.0 user context — stub)
  const APP_TOKEN = process.env.TWITTER_APP_ACCESS_TOKEN;
  if (!APP_TOKEN) {
    logger.debug(`viralAgent: tweet stub (no APP_TOKEN): ${tweetText.slice(0, 80)}...`);
    return;
  }

  try {
    await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${APP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: tweetText }),
    });
    logger.info(`viralAgent: tweeted market ${market._id}`);
  } catch (e) {
    logger.warn(`viralAgent: tweet failed: ${e.message}`);
  }
}

let _timer = null;

function startViralAgent(Market, User) {
  if (_timer) return;
  const run = async () => {
    try {
      const events = await scanCreatorEvents();
      for (const event of events.slice(0, 3)) { // max 3 auto-markets per scan
        const market = await generateMarketFromEvent(event, Market, User);
        await tweetMarket(market, event.creator);
      }
    } catch (e) {
      logger.error(`viralAgent run error: ${e.message}`);
    }
  };
  run();
  _timer = setInterval(run, SCAN_INTERVAL_MS);
  logger.info('viralAgent: started (6h interval)');
}

function stopViralAgent() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

module.exports = { startViralAgent, stopViralAgent, scanCreatorEvents };
