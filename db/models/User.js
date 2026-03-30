const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  // ── Firebase Auth ─────────────────────────────────────────────────────────
  firebaseUid:     { type: String, unique: true, sparse: true },
  email:           { type: String, sparse: true },
  googlePhotoUrl:  String,
  authProvider:    { type: String, enum: ['google', 'email', 'anonymous', 'telegram'], default: 'email' },

  telegramId:      { type: String, unique: true, sparse: true },
  username:        String,
  displayName:     String,
  walletAddress:       String,
  encryptedPrivateKey: { type: String, default: null }, // AES-256-GCM — jamais exposé

  // ── Balances ──────────────────────────────────────────────────────────────
  balance:         { type: Number, default: 0 },        // total available + locked
  lockedBalance:   { type: Number, default: 0 },        // sum of active bet amounts

  // ── Stats ─────────────────────────────────────────────────────────────────
  totalBets:       { type: Number, default: 0 },
  wonBets:         { type: Number, default: 0 },
  totalEarned:     { type: Number, default: 0 },
  reputation:      { type: Number, default: 50 },

  // ── Social ────────────────────────────────────────────────────────────────
  followedBy:      [String],

  // ── Gamification ──────────────────────────────────────────────────────────
  level:           { type: String, default: 'debutant' }, // debutant, actif, expert, oracle, legende
  currentStreak:   { type: Number, default: 0 },
  longestStreak:   { type: Number, default: 0 },
  lastLoginDate:   { type: Date, default: null },
  badges:          { type: [String], default: [] },        // regulier, acharne, legendaire

  // ── Moderation ────────────────────────────────────────────────────────────
  warningCount:    { type: Number, default: 0 },
  restrictedUntil: { type: Date, default: null },   // can't create markets until this date
  banned:          { type: Boolean, default: false },
  banReason:       String,

  // ── Wallet / on-chain ────────────────────────────────────────────────────
  lastKnownOnChainBalance: { type: Number, default: 0 }, // last read USDC balance on Polygon

  // ── Affiliation / referral ────────────────────────────────────────────────
  referralCode:    { type: String, unique: true, sparse: true },

  // ── Creator program ───────────────────────────────────────────────────────
  commissionTier:          { type: String, enum: ['starter','creator','pro'], default: 'starter' },
  pendingCreatorEarnings:  { type: Number, default: 0 },
  monthlyVolume:           { type: Number, default: 0 },  // reset each 1st of month
  creatorVerified:         { type: Boolean, default: false },
  creatorHandle:           String,
  creatorPlatform:         { type: String, enum: ['twitter','tiktok','youtube','instagram'] },
  creatorFollowers:        { type: Number, default: 0 },
  verificationCode:        String,
  verificationExpiry:      Date,

  // ── Age verification ──────────────────────────────────────────────────────
  ageVerified:             { type: Boolean, default: false },
  ageVerifiedAt:           Date,
  ageVerifiedIp:           String,

  createdAt:       { type: Date, default: Date.now },
});

// Virtual: available balance (what user can spend)
UserSchema.virtual('availableBalance').get(function() {
  return Math.max(0, (this.balance || 0) - (this.lockedBalance || 0));
});

module.exports = mongoose.model('User', UserSchema);
