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
