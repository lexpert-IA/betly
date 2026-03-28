const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  telegramId:    { type: String, unique: true, sparse: true },
  username:      String,
  displayName:   String,
  walletAddress: String,
  balance:       { type: Number, default: 0 },
  totalBets:     { type: Number, default: 0 },
  wonBets:       { type: Number, default: 0 },
  totalEarned:   { type: Number, default: 0 },
  reputation:    { type: Number, default: 50 },
  followedBy:    [String],
  level:         { type: String, default: 'debutant' }, // debutant, actif, expert, oracle, legende
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  lastLoginDate: { type: Date, default: null },
  badges:        { type: [String], default: [] }, // regulier, acharne, legendaire
  createdAt:     { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
