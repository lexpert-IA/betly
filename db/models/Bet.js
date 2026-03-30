const mongoose = require('mongoose');

const BetSchema = new mongoose.Schema({
  // ── Idempotency ────────────────────────────────────────────────────────────
  orderId:         { type: String, unique: true, sparse: true, index: true },

  // ── Core fields ───────────────────────────────────────────────────────────
  userId:          { type: String, required: true, index: true },
  marketId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true, index: true },
  side:            { type: String, enum: ['YES','NO'], required: true },

  // ── Order type ────────────────────────────────────────────────────────────
  type:            { type: String, enum: ['market', 'limit'], default: 'market' },
  limitPrice:      Number,   // for limit orders: target price (0-1)
  expiresAt:       Date,     // limit order auto-cancel deadline

  // ── Amounts ───────────────────────────────────────────────────────────────
  requestedAmount: { type: Number, required: true },   // what user asked
  filledAmount:    { type: Number, default: 0 },        // what was actually executed
  amount:          { type: Number, required: true },    // = filledAmount (legacy compat)

  // ── Pricing ───────────────────────────────────────────────────────────────
  odds:            Number,   // price at execution (0-1 probability)
  slippage:        Number,   // actual slippage % vs expected

  // ── Payout ────────────────────────────────────────────────────────────────
  payout:          { type: Number, default: 0 },
  fee:             { type: Number, default: 0 },   // platform fee taken

  // ── Status ────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending','active','won','lost','claimed','refunded','partial'],
    default: 'active',
    index: true,
  },

  // ── Timestamps ────────────────────────────────────────────────────────────
  placedAt:        { type: Date, default: Date.now },
  settledAt:       Date,   // when won/lost
  claimedAt:       Date,
  refundedAt:      Date,
});

module.exports = mongoose.model('Bet', BetSchema);
