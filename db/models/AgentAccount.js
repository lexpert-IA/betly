const mongoose = require('mongoose');
const crypto   = require('crypto');

const AgentAccountSchema = new mongoose.Schema({
  // ── Identity ───────────────────────────────────────────────────────────────
  agentName:    { type: String, required: true, trim: true, maxlength: 30 },
  ownerId:      { type: String, required: true, index: true },    // userId of the human owner
  ownerPseudo:  { type: String, required: true, trim: true },
  agentNumber:  { type: Number },                   // #001, #002, etc.

  // ── Auth ───────────────────────────────────────────────────────────────────
  apiKey:       { type: String, required: true },
  walletAddress: String,                                           // Polygon wallet

  // ── Profile ────────────────────────────────────────────────────────────────
  strategy:     { type: String, default: '', maxlength: 500 },    // public description
  avatarColor:  { type: String, default: '#7c3aed' },
  isPublic:     { type: Boolean, default: true },
  badge:        { type: String, default: null },                   // e.g. "Agent #001 — Fondateur"
  tags:         { type: [String], default: [] },                   // e.g. ['crypto', 'sport']

  // ── Stats (denormalized for fast reads) ────────────────────────────────────
  totalBets:    { type: Number, default: 0 },
  totalWins:    { type: Number, default: 0 },
  winRate:      { type: Number, default: 0 },                     // 0-100
  roi:          { type: Number, default: 0 },                     // percentage
  pnl:          { type: Number, default: 0 },                     // absolute USDC
  totalVolume:  { type: Number, default: 0 },
  totalPosts:   { type: Number, default: 0 },
  copiers:      { type: Number, default: 0 },                     // active copiers count

  // ── Limits (set by owner) ──────────────────────────────────────────────────
  dailyBudget:     { type: Number, default: 100 },                // max USDC/day
  maxBetSize:      { type: Number, default: 50 },                 // max USDC per bet
  allowedCategories: { type: [String], default: [] },             // empty = all

  // ── Rate limiting tracking ─────────────────────────────────────────────────
  postsToday:      { type: Number, default: 0 },
  betsToday:       { type: Number, default: 0 },
  marketsToday:    { type: Number, default: 0 },
  spentToday:      { type: Number, default: 0 },
  lastResetDate:   { type: String, default: '' },                 // YYYY-MM-DD

  // ── Moderation ─────────────────────────────────────────────────────────────
  suspended:       { type: Boolean, default: false },
  suspendedReason: String,
  warningCount:    { type: Number, default: 0 },                  // content warnings

  // ── Timestamps ─────────────────────────────────────────────────────────────
  createdAt:    { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
});

// ── Indexes ──────────────────────────────────────────────────────────────────
AgentAccountSchema.index({ apiKey: 1 });
AgentAccountSchema.index({ ownerId: 1 });
AgentAccountSchema.index({ isPublic: 1, totalBets: -1 });
AgentAccountSchema.index({ winRate: -1 });
AgentAccountSchema.index({ agentNumber: 1 });

// ── Static: generate unique API key ──────────────────────────────────────────
AgentAccountSchema.statics.generateApiKey = function() {
  return `betly_agent_${crypto.randomBytes(32).toString('hex')}`;
};

// ── Static: get next agent number ────────────────────────────────────────────
AgentAccountSchema.statics.getNextNumber = async function() {
  const last = await this.findOne().sort({ agentNumber: -1 }).select('agentNumber').lean();
  return (last?.agentNumber || 0) + 1;
};

// ── Instance: reset daily counters if new day ────────────────────────────────
AgentAccountSchema.methods.resetDailyIfNeeded = function() {
  const today = new Date().toISOString().split('T')[0];
  if (this.lastResetDate !== today) {
    this.postsToday = 0;
    this.betsToday = 0;
    this.marketsToday = 0;
    this.spentToday = 0;
    this.lastResetDate = today;
  }
};

// ── Instance: check rate limits ──────────────────────────────────────────────
AgentAccountSchema.methods.canPost = function() {
  this.resetDailyIfNeeded();
  return this.postsToday < 120; // 5/hour × 24h
};

AgentAccountSchema.methods.canBet = function() {
  this.resetDailyIfNeeded();
  return this.betsToday < 240; // 10/hour × 24h
};

AgentAccountSchema.methods.canCreateMarket = function() {
  this.resetDailyIfNeeded();
  return this.marketsToday < 3;
};

AgentAccountSchema.methods.canSpend = function(amount) {
  this.resetDailyIfNeeded();
  return (this.spentToday + amount) <= this.dailyBudget;
};

// ── Display name format ──────────────────────────────────────────────────────
AgentAccountSchema.methods.displayLabel = function() {
  const name = this.agentName || (this.walletAddress ? `${this.walletAddress.slice(0,4)}...${this.walletAddress.slice(-2)}` : 'Agent');
  return `${name} · par @${this.ownerPseudo}`;
};

module.exports = mongoose.model('AgentAccount', AgentAccountSchema);
