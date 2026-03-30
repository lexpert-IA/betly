const mongoose = require('mongoose');

const PlatformRevenueSchema = new mongoose.Schema({
  type:         { type: String, enum: ['market_fee', 'copy_fee', 'penalty'], required: true },
  marketId:     { type: String, default: null },
  tradeId:      { type: String, default: null },
  amount:       { type: Number, required: true },        // total platform cut (e.g. 3%)
  creatorCut:   { type: Number, default: 0 },            // amount credited to creator (2%)
  affiliateId:  { type: String, default: null },
  affiliateCut: { type: Number, default: 0 },            // amount given to affiliate
  platformNet:  { type: Number, required: true },        // amount net to platform after affiliate
  createdAt:    { type: Date, default: Date.now },
});

PlatformRevenueSchema.index({ createdAt: -1 });
PlatformRevenueSchema.index({ type: 1, createdAt: -1 });

module.exports = mongoose.model('PlatformRevenue', PlatformRevenueSchema);
