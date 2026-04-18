const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  type: {
    type: String,
    enum: [
      // ── Legacy (keep for existing docs) ────────────────────────────────────
      'market_resolved', 'bet_won', 'bet_lost', 'new_follower', 'new_comment', 'vote_open',

      // ── Paris ─────────────────────────────────────────────────────────────
      'bet_placed',              // "Ta mise de $10 sur OUI est confirmée"
      'bet_partial',             // "Mise partiellement exécutée : $8.50/$10"
      'bet_limit_filled',        // "Ton ordre limit OUI à 0.44 est exécuté"
      'bet_refunded',            // "Ta mise a été remboursée"
      'market_expiring',         // "⏰ [marché] expire dans 2h"
      'market_resolved_won',     // "🎉 Tu as gagné +$18.50"
      'market_resolved_lost',    // "😔 Tu as perdu $10"

      // ── Wallet ────────────────────────────────────────────────────────────
      'deposit_detected',        // "Dépôt de $50 USDC détecté"
      'deposit_confirmed',       // "✅ $50 USDC crédités"
      'withdrawal_processing',   // "Retrait de $30 en cours"
      'withdrawal_completed',    // "✅ $30 USDC envoyés"

      // ── Social ────────────────────────────────────────────────────────────
      'market_first_bet',        // "Première mise sur ton marché"
      'profile_followed',        // "[pseudo] te suit maintenant"
      'comment_on_market',       // "[pseudo] a commenté ton marché"
      'trade_copied',            // "[pseudo] a copié ton trade"
      'whale_alert',             // "🐋 Grosse mise de $500"

      // ── Modération ────────────────────────────────────────────────────────
      'market_approved',         // "✅ Ton marché a été approuvé"
      'market_rejected',         // "❌ Ton marché a été refusé"
      'market_flagged',          // "⚠️ Ton marché est sous surveillance"
      'account_warning',         // "⚠️ Avertissement"

      // ── Communauté ────────────────────────────────────────────────────────
      'vote_result',             // "Résultat du vote : OUI gagne"
      'level_up',                // "🎯 Tu es passé niveau Expert !"
      'streak_milestone',        // "🔥 7 jours de streak !"
    ],
    required: true,
  },
  message:   { type: String, required: true },
  marketId:  { type: String, default: null },
  fromUser:  { type: String, default: null },
  amount:    { type: Number, default: null },
  read:      { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Notification', NotificationSchema);
