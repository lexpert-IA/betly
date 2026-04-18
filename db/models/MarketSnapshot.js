const mongoose = require('mongoose');

const MarketSnapshotSchema = new mongoose.Schema({
  marketId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true, index: true },
  priceYes:   { type: Number, required: true }, // 0–100 (%)
  priceNo:    { type: Number, required: true },
  volume:     { type: Number, default: 0 },     // cumulative USDC volume
  timestamp:  { type: Date, default: Date.now, index: true },
});

// Keep only last 720 snapshots per market (30 days at 1/hour)
MarketSnapshotSchema.index({ marketId: 1, timestamp: -1 });

module.exports = mongoose.model('MarketSnapshot', MarketSnapshotSchema);
