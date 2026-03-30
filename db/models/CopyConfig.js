const mongoose = require('mongoose');

const followedWalletSchema = new mongoose.Schema({
  address:    { type: String, required: true },
  allocation: { type: Number, default: 5 },   // % du solde par trade
  active:     { type: Boolean, default: true },
  copiedAt:   { type: Date, default: Date.now },
  nickname:   { type: String, default: '' },
}, { _id: false });

const copyConfigSchema = new mongoose.Schema({
  userId:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  // Activation
  copyEnabled:      { type: Boolean, default: false },
  mode:             { type: String, enum: ['auto', 'manual'], default: 'auto' },
  paperMode:        { type: Boolean, default: false },

  // Risk management
  maxPerTrade:      { type: Number, default: 10 },   // USDC max par trade
  dailyLossLimit:   { type: Number, default: 50 },   // stop-loss journalier USDC
  dailyLoss:        { type: Number, default: 0 },
  dailyLossResetAt: { type: Date,   default: null },

  // Wallets suivis
  followedWallets:  { type: [followedWalletSchema], default: [] },

  // Stats
  totalCopied:      { type: Number, default: 0 },
  totalPnl:         { type: Number, default: 0 },
  paperPnl:         { type: Number, default: 0 },

  createdAt:        { type: Date, default: Date.now },
  updatedAt:        { type: Date, default: Date.now },
});

module.exports = mongoose.model('CopyConfig', copyConfigSchema);
