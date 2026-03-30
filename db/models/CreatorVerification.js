const mongoose = require('mongoose');

const CreatorVerificationSchema = new mongoose.Schema({
  userId:          { type: String, required: true, index: true },
  handle:          { type: String, required: true },
  platform:        { type: String, enum: ['twitter','tiktok','youtube','instagram'], required: true },
  // Account metrics at time of request
  followerCount:   { type: Number, default: 0 },
  accountAgeDays:  { type: Number, default: 0 },
  postCount:       { type: Number, default: 0 },
  engagementRate:  { type: Number, default: 0 },   // percentage
  verifiedOnPlatform: { type: Boolean, default: false }, // blue checkmark
  // AI legitimacy analysis
  legitimacyScore: { type: Number, default: 0 },   // 0-100
  redFlags:        { type: [String], default: [] },
  aiRecommendation:{ type: String, enum: ['auto_approve','manual_review','reject'], default: 'manual_review' },
  // Tier classification
  tier:            { type: String, enum: ['A','B','C'], default: 'C' },
  // A = platform-verified, B = >50k non-verified, C = 5k-50k non-verified
  videoUrl:        String,   // for tier C verification video
  // Review
  status:          { type: String, enum: ['pending','approved','rejected','suspended'], default: 'pending', index: true },
  reviewedBy:      String,   // admin userId
  reviewedAt:      Date,
  rejectionReason: String,
  // Monitoring
  lastCheckedAt:   Date,
  followerHistory: [{ date: Date, count: Number }],
  createdAt:       { type: Date, default: Date.now },
});

module.exports = mongoose.model('CreatorVerification', CreatorVerificationSchema);
