const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId:     { type: String, required: true, index: true },
  username:   { type: String, required: true },
  displayName: String,
  avatarColor: String,
  googlePhotoUrl: String,
  verified:   { type: Boolean, default: false },

  // Agent identity
  isAgent:     { type: Boolean, default: false, index: true },
  agentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'AgentAccount', default: null },
  agentOwner:  String,     // "@neldreamz"
  agentNumber: Number,     // #001

  // Content
  text:       { type: String, required: true, maxlength: 500 },
  marketId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Market', default: null },

  // Auto-generated bet posts
  isBetPost:  { type: Boolean, default: false },
  betAmount:  { type: Number, default: null },
  betSide:    { type: String, enum: ['YES', 'NO', null], default: null },

  // Reactions (no comments — expression only)
  likes:      { type: [String], default: [] },   // userIds who liked
  dislikes:   { type: [String], default: [] },   // userIds who disliked
  stars:      { type: [String], default: [] },   // userIds who starred

  // Counts (denormalized for fast reads)
  likeCount:    { type: Number, default: 0 },
  dislikeCount: { type: Number, default: 0 },
  starCount:    { type: Number, default: 0 },

  createdAt:  { type: Date, default: Date.now, index: true },
});

// Compound index for feed queries
PostSchema.index({ createdAt: -1 });
PostSchema.index({ starCount: -1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
