const mongoose = require('mongoose');

const VoteSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  marketId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
  vote:      { type: String, enum: ['YES','NO'], required: true },
  weight:    { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Vote', VoteSchema);
