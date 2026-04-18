const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// -- Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wolves', timestamp: new Date().toISOString() });
});

// -- Matches (placeholder pour S4)
router.get('/matches', async (req, res) => {
  try {
    const Match = require('../../db/models/Match');
    const matches = await Match.find().sort({ scheduledAt: -1 }).limit(20).lean();
    res.json(matches);
  } catch (err) {
    logger.error(`GET /matches error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

// -- Characters
router.get('/characters', async (req, res) => {
  try {
    const Character = require('../../db/models/Character');
    const characters = await Character.find().sort({ name: 1 }).lean();
    res.json(characters);
  } catch (err) {
    logger.error(`GET /characters error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

// -- Match events (live chat history for a match)
router.get('/matches/:matchId/events', async (req, res) => {
  try {
    const MatchEvent = require('../../db/models/MatchEvent');
    const events = await MatchEvent.find({ matchId: req.params.matchId })
      .sort({ timestamp: 1 })
      .lean();
    res.json(events);
  } catch (err) {
    logger.error(`GET /matches/:id/events error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
