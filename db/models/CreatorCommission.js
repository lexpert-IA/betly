const mongoose = require('mongoose');

const CreatorCommissionSchema = new mongoose.Schema({
  creatorId:  { type: String, required: true, index: true },
  marketId:   { type: String, required: true },
  betId:      { type: String, required: true, unique: true },
  bettorId:   String,
  amount:     { type: Number, required: true },   // original bet amount
  commission: { type: Number, required: true },   // earned commission
  tier:       { type: String, enum: ['starter','creator','pro'], default: 'starter' },
  refCode:    String,
  paid:       { type: Boolean, default: false },
  paidAt:     Date,
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('CreatorCommission', CreatorCommissionSchema);
