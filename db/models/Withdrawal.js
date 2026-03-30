const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  userId:      { type: String, required: true, index: true },
  toAddress:   { type: String, required: true },
  amount:      { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  txHash:      String,
  failReason:  String,
  retries:     { type: Number, default: 0 },
  createdAt:   { type: Date, default: Date.now },
  processedAt: Date,
});

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
