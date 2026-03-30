require('dotenv').config();

module.exports = {
  db: { uri: process.env.MONGODB_URI },
  walletEncryptionKey: process.env.WALLET_ENCRYPTION_KEY || null,
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  // ── Polygon Mainnet ──────────────────────────────────────────
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: 137,
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',   // USDC native on Polygon
    usdcBridged: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',   // USDC.e bridged
  },

  // ── Pipeline: Trend Detection ──────────────────────────────────────────
  twitter: {
    bearerToken: process.env.TWITTER_BEARER_TOKEN,
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
  },
  reddit: {
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
  },

  // ── Pipeline: Distribution ─────────────────────────────────────────────
  postiz: {
    apiKey: process.env.POSTIZ_API_KEY,
    apiUrl: process.env.POSTIZ_API_URL || 'https://app.postiz.com/api/v1',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    channelId: process.env.TELEGRAM_CHANNEL_ID,
  },
};
