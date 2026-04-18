const mongoose = require('mongoose');

const KnownCreatorSchema = new mongoose.Schema({
  handle:             { type: String, required: true },
  platform:           { type: String, enum: ['twitter','tiktok','youtube','instagram'], required: true },
  followerCount:      { type: Number, default: 0 },
  verifiedOnPlatform: { type: Boolean, default: false },
  claimedByUserId:    { type: String, default: null },  // null = unclaimed
  protectionLevel:    { type: String, enum: ['low','medium','high'], default: 'low' },
  // high = require video verification regardless of follower count
  // medium = always require manual review
  // low = standard flow
  lastUpdated:        { type: Date, default: Date.now },
  createdAt:          { type: Date, default: Date.now },
});

KnownCreatorSchema.index({ handle: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('KnownCreator', KnownCreatorSchema);
