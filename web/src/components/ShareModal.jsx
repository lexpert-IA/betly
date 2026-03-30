import React, { useState } from 'react';
import BetShareCard from './BetShareCard';

/**
 * ShareModal — modal de partage universelle
 * Props:
 *   variant: 'placed' | 'won' | 'live' | 'challenge'
 *   bet: { _id, betId, side, amount, odds, payout, username }
 *   market: { _id, title, category, totalYes, totalNo, resolutionDate }
 *   onClose: () => void
 */
export default function ShareModal({ variant = 'placed', bet, market, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!market) return null;

  const betId     = bet?._id || bet?.betId;
  const shareUrl  = betId
    ? `${window.location.origin}/share/${betId}`
    : `${window.location.origin}/market/${market._id}`;
  const marketUrl = `${window.location.origin}/market/${market._id}`;

  // ── Textes tweet selon variante ───────────────────────────────────────────
  const tweets = {
    placed: [
      `Je viens de miser ${bet?.amount || '?'} USDC sur ${bet?.side === 'YES' ? 'OUI' : 'NON'} :`,
      `"${(market.title || '').slice(0, 60)}"`,
      '',
      `Tu penses que j'ai tort ? Prends le ${bet?.side === 'YES' ? 'NON' : 'OUI'} →`,
      shareUrl,
      '',
      '#BETLY',
    ].join('\n'),

    won: [
      `J'avais raison.`,
      `"${(market.title || '').slice(0, 60)}"`,
      '',
      bet?.payout && bet?.amount
        ? `+$${(bet.payout - bet.amount).toFixed(2)} encaissés · ROI +${Math.round(((bet.payout - bet.amount) / bet.amount) * 100)}%`
        : 'Pari gagné sur BETLY',
      '',
      shareUrl,
      '#BETLY',
    ].join('\n'),

    live: [
      `${Math.round(((market.totalYes || 0) / Math.max(1, (market.totalYes || 0) + (market.totalNo || 0))) * 100)}% disent OUI sur :`,
      `"${(market.title || '').slice(0, 70)}"`,
      '',
      `Qu'est-ce que tu en penses ?`,
      marketUrl,
      '#BETLY',
    ].join('\n'),

    challenge: [
      `Je mise ${bet?.side === 'YES' ? 'OUI' : 'NON'} sur :`,
      `"${(market.title || '').slice(0, 60)}"`,
      '',
      `Prouve que j'ai tort →`,
      shareUrl,
      '#BETLY',
    ].join('\n'),
  };

  const tweetText = tweets[variant] || tweets.placed;

  function shareOnX() {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(tweetText)}`, '_blank');
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCard() {
    // fallback: open OG image in new tab
    if (betId) {
      window.open(`/api/bets/${betId}/og-image`, '_blank');
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div style={{ maxWidth: 420, width: '100%' }}>
        {/* Card preview */}
        <div style={{ marginBottom: 16 }}>
          <BetShareCard variant={variant} bet={bet} market={market} />
        </div>

        {/* Texte défi sous la carte — variante placed */}
        {variant === 'placed' && bet && (
          <div style={{
            textAlign: 'center', fontSize: 13, color: '#64748b',
            marginBottom: 14, fontStyle: 'italic',
          }}>
            Tu penses que j'ai tort ? Prends le {bet.side === 'YES' ? 'NON' : 'OUI'} →
          </div>
        )}

        {/* Share buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <button
            onClick={shareOnX}
            style={{
              padding: '12px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
              background: '#0a0a0f', color: '#f8fafc',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            𝕏 &nbsp;Partager sur X
          </button>
          <button
            onClick={shareWhatsApp}
            style={{
              padding: '12px 0', borderRadius: 10, border: '1px solid rgba(34,197,94,0.25)',
              background: 'rgba(34,197,94,0.07)', color: '#22c55e',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            WhatsApp
          </button>
          <button
            onClick={copyLink}
            style={{
              padding: '12px 0', borderRadius: 10,
              border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)'}`,
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
              color: copied ? '#22c55e' : '#94a3b8',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {copied ? '✓ Copié !' : 'Copier le lien'}
          </button>
          {betId && (
            <button
              onClick={downloadCard}
              style={{
                padding: '12px 0', borderRadius: 10,
                border: '1px solid rgba(168,85,247,0.25)',
                background: 'rgba(168,85,247,0.06)', color: '#a855f7',
                fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}
            >
              Telecharger la carte
            </button>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '10px 0', borderRadius: 9,
            border: 'none', background: 'transparent', color: '#334155',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
