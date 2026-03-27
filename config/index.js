require('dotenv').config();

module.exports = {
  db: { uri: process.env.MONGODB_URI },
  anthropic: { apiKey: process.env.ANTHROPIC_API_KEY },
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
};
