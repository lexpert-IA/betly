const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  type:      {
    type: String,
    enum: ['market_resolved', 'new_follower', 'new_comment', 'vote_open', 'bet_won', 'bet_lost'],
    required: true,
  },
  message:   { type: String, required: true },
  marketId:  { type: String, default: null },
  fromUser:  { type: String, default: null }, // who triggered it
  amount:    { type: Number, default: null }, // for win/loss
  read:      { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Notification', NotificationSchema);
