const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  affiliateId:          { type: String, required: true },   // Affiliate.userId
  affiliateCode:        { type: String, required: true },
  referredUserId:       { type: String, required: true, unique: true },

  joinedAt:             { type: Date, default: Date.now },
  firstBetAt:           { type: Date, default: null },

  totalFeesGenerated:   { type: Number, default: 0 },  // sum of platform fees from this referral
  totalAffiliateEarned: { type: Number, default: 0 },  // sum paid to affiliate from this referral
  isActive:             { type: Boolean, default: false }, // true if bet in last 30d
});

ReferralSchema.index({ affiliateId: 1 });
ReferralSchema.index({ referredUserId: 1 });

module.exports = mongoose.model('Referral', ReferralSchema);
