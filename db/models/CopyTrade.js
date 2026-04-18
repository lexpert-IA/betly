const mongoose = require('mongoose');

const copyTradeSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Source
  whaleAddress: { type: String, required: true },

  // Marché
  marketId:     { type: String, default: null },
  marketTitle:  { type: String, default: '' },
  outcome:      { type: String, enum: ['YES', 'NO'], required: true },
  price:        { type: Number, default: 0 },

  // Montants
  amount:       { type: Number, required: true },
  fee:          { type: Number, default: 0 },

  // Exécution
  status:       { type: String, enum: ['pending', 'executed', 'failed', 'paper', 'cancelled'], default: 'pending' },
  mode:         { type: String, enum: ['auto', 'manual'], default: 'auto' },
  txHash:       { type: String, default: null },
  errorMsg:     { type: String, default: null },

  // Résultat
  pnl:          { type: Number, default: null },
  resolvedAt:   { type: Date,   default: null },

  executedAt:   { type: Date, default: Date.now },
});

copyTradeSchema.index({ userId: 1, executedAt: -1 });
copyTradeSchema.index({ whaleAddress: 1 });

module.exports = mongoose.model('CopyTrade', copyTradeSchema);
