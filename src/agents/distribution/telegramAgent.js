/**
 * Distribution Agent — Telegram Bot
 * Sends new market notifications to a Telegram channel/group.
 */

const axios  = require('axios');
const config = require('../../../config');
const logger = require('../../utils/logger');

const BETLY_URL = process.env.BETLY_BASE_URL || 'https://betly.gg';

function buildMessage(market) {
  const catEmoji = {
    sport: '⚽', crypto: '₿', politique: '🏛️', culture: '🎬',
    tech: '🤖', gaming: '🎮', autre: '🔮',
  };
  const emoji = catEmoji[market.category] || '🔮';
  const link = `${BETLY_URL}/market/${market._id}`;

  const daysLeft = market.resolutionDate
    ? Math.ceil((new Date(market.resolutionDate) - Date.now()) / (24 * 60 * 60 * 1000))
    : '?';

  return `${emoji} *Nouveau marché BETLY*\n\n` +
    `*${market.title}*\n\n` +
    `${market.description || ''}\n\n` +
    `⏰ Résolution dans ${daysLeft} jours\n` +
    `📊 Catégorie : ${market.category}\n\n` +
    `👉 [Parier maintenant](${link})`;
}

async function distribute(market) {
  const botToken = config.telegram?.botToken;
  const channelId = config.telegram?.channelId;

  if (!botToken || !channelId) {
    logger.debug('telegramAgent: no TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID — skipping');
    return false;
  }

  try {
    const message = buildMessage(market);

    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendPhoto`,
      {
        chat_id: channelId,
        photo: `${BETLY_URL}/betly-icon.png`,
        caption: message,
        parse_mode: 'Markdown',
      },
      { timeout: 10000 }
    );

    logger.info(`telegramAgent: sent to channel ${channelId} — market ${market._id}`);
    return true;
  } catch (err) {
    logger.warn(`telegramAgent: error — ${err.message}`);
    return false;
  }
}

module.exports = { distribute, buildMessage };
