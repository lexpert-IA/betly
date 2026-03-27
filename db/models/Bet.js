const mongoose = require('mongoose');

const BetSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  marketId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
  side:      { type: String, enum: ['YES','NO'], required: true },
  amount:    { type: Number, required: true },
  odds:      Number,
  status:    { type: String, enum: ['active','won','lost'], default: 'active' },
  payout:    { type: Number, default: 0 },
  placedAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('Bet', BetSchema);
