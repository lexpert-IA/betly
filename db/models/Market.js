const mongoose = require('mongoose');

const MarketSchema = new mongoose.Schema({
  creatorId:      { type: String, required: true },
  title:          { type: String, required: true },
  description:    String,
  category:       { type: String, enum: ['sport','crypto','politique','culture','autre'], default: 'autre' },
  oracleLevel:    { type: Number, enum: [1,2,3], default: 2 },
  confidenceScore:{ type: Number, default: 0 },
  confidenceDetails: {
    verifiability: Number,
    toxicity:      Number,
    explanation:   String,
  },
  status:         { type: String, enum: ['pending','active','resolving','resolved','frozen'], default: 'pending' },
  outcome:        { type: String, enum: ['YES','NO', null], default: null },
  totalYes:       { type: Number, default: 0 },
  totalNo:        { type: Number, default: 0 },
  creatorStake:   { type: Number, default: 5 },
  stakeReturned:  { type: Boolean, default: false },
  resolutionDate: { type: Date, required: true },
  minBet:         { type: Number, default: 1 },
  commentsCount:  { type: Number, default: 0 },
  flagged:        { type: Boolean, default: false },
  rejectionReason:String,
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('Market', MarketSchema);
