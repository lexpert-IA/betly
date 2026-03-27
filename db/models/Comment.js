const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  userId:    { type: String, required: true },
  marketId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Market', required: true },
  content:   { type: String, required: true, maxlength: 500 },
  likes:     { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Comment', CommentSchema);
