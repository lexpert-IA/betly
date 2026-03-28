import React, { useState } from 'react';
import ConfidenceBadge from './ConfidenceBadge';
import BetBar from './BetBar';
import { useUserId } from '../hooks/useApi';
import { toast } from './ToastManager';

// ── Category palette (matches betly HTML design) ─────────────────────────────
const CATEGORIES = {
  sport:     { color: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.2)',   label: '⚽ Sport' },
  crypto:    { color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.2)',  label: '₿ Crypto' },
  politique: { color: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.2)',  label: '🏛 Politique' },
  culture:   { color: '#f472b6', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.2)',  label: '🎭 Culture' },
  autre:     { color: '#22d3ee', bg: 'rgba(6,182,212,0.15)',  border: 'rgba(6,182,212,0.2)',   label: '✨ Autre' },
};

// ── Avatar color pool ─────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#7c3aed','#a855f7','#06b6d4','#ec4899','#10b981','#f59e0b','#3b82f6','#ef4444'];
function avatarColor(id) {
  if (!id) return AVATAR_COLORS[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function avatarInitials(id) {
  if (!id) return '?';
  return id.slice(0, 2).toUpperCase();
}

function timeRemaining(resolutionDate) {
  const diff = new Date(resolutionDate) - Date.now();
  if (diff <= 0) return 'Expiré';
  const days  = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins  = Math.floor((diff % 3600000) / 60000);
  if (days  > 0) return `${days}j`;
  if (hours > 0) return `${hours}h`;
  return `${mins}min`;
}

export default function MarketCard({ market, onBetPlaced }) {
  const userId = useUserId();
  const [betSide, setBetSide] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [betting, setBetting] = useState(false);
  const [betResult, setBetResult] = useState(null);

  const cat = CATEGORIES[market.category] || CATEGORIES.autre;

  const handleBet = async () => {
    if (!userId) {
      toast('Crée ton compte pour parier !', 'warning');
      window.location.reload();
      return;
    }
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) return;

    setBetting(true);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/markets/${market._id}/bet?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: betSide, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setBetResult({ success: true, message: `Pari ${betSide} de ${amount} USDC placé !` });
      toast(`Pari ${betSide === 'YES' ? 'OUI' : 'NON'} de ${amount} USDC placé ! 🎯`, 'success');
      if (onBetPlaced) onBetPlaced();
      setTimeout(() => { setBetSide(null); setBetResult(null); setBetAmount(''); }, 2000);
    } catch (err) {
      setBetResult({ success: false, message: err.message });
    } finally {
      setBetting(false);
    }
  };

  return (
    <div
      className="fade-up"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.25s cubic-bezier(.4,0,.2,1)',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.3), 0 0 0 1px rgba(124,58,237,.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Card header: avatar + meta + category */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff',
          background: `linear-gradient(135deg, ${avatarColor(market.creatorId)}, ${avatarColor(market.creatorId + '2')})`,
        }}>
          {avatarInitials(market.creatorId)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 1 }}>
            {market.creatorId === 'system' ? 'BETLY' : `User ${(market.creatorId || '').slice(0, 8)}`}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>⏰ {timeRemaining(market.resolutionDate)}</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          borderRadius: 999, letterSpacing: '0.4px', textTransform: 'uppercase',
          color: cat.color, background: cat.bg, border: `1px solid ${cat.border}`,
          flexShrink: 0,
        }}>
          {cat.label}
        </span>
      </div>

      {/* Question */}
      <a href={`/market/${market._id}`} style={{ textDecoration: 'none' }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: '#f8fafc',
          lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
          margin: 0,
        }}>
          {market.title}
        </h3>
      </a>

      {/* YES/NO bars */}
      <BetBar totalYes={market.totalYes} totalNo={market.totalNo} />

      {/* Tags */}
      {market.tags && market.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {market.tags.map(tag => (
            <a
              key={tag}
              href={`/tag/${tag}`}
              onClick={e => { e.stopPropagation(); }}
              style={{
                padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                color: '#7c6aac', textDecoration: 'none', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#a855f7'; e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7c6aac'; e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; }}
            >
              #{tag}
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: '#64748b' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span>💬 {market.commentsCount || 0}</span>
          <ConfidenceBadge score={market.confidenceScore} />
        </div>
        <span style={{ color: '#64748b' }}>Oracle L{market.oracleLevel}</span>
      </div>

      {/* Bet buttons */}
      {betSide === null && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setBetSide('YES')}
            style={{
              flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(124,58,237,0.15)', color: '#a855f7',
              fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(124,58,237,0.3)'; e.currentTarget.style.boxShadow='0 0 16px rgba(124,58,237,.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(124,58,237,0.15)'; e.currentTarget.style.boxShadow='none'; }}
          >
            🟣 Miser OUI
          </button>
          <button
            onClick={() => setBetSide('NO')}
            style={{
              flex: 1, padding: '9px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(148,163,184,0.1)', color: '#94a3b8',
              fontSize: 13, fontWeight: 700, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(148,163,184,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(148,163,184,0.1)'; }}
          >
            ⚪ Miser NON
          </button>
        </div>
      )}

      {/* Inline bet form */}
      {betSide !== null && (
        <div style={{
          background: `${betSide === 'YES' ? 'rgba(124,58,237,0.08)' : 'rgba(148,163,184,0.06)'}`,
          border: `1px solid ${betSide === 'YES' ? 'rgba(168,85,247,0.3)' : 'rgba(148,163,184,0.15)'}`,
          borderRadius: 12, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: betSide === 'YES' ? '#a855f7' : '#94a3b8' }}>
            Miser {betSide === 'YES' ? 'OUI' : 'NON'}
          </div>
          {betResult ? (
            <div style={{ fontSize: 13, color: betResult.success ? '#a855f7' : '#ef4444', textAlign: 'center', padding: '4px 0' }}>
              {betResult.message}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="number" min="1" step="0.5" placeholder="Montant USDC"
                  value={betAmount} onChange={e => setBetAmount(e.target.value)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#0a0a0f', color: '#f8fafc', fontSize: 13, outline: 'none',
                  }}
                />
                <span style={{ fontSize: 11, color: '#64748b' }}>USDC</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleBet}
                  disabled={betting || !betAmount}
                  style={{
                    flex: 1, padding: '8px', borderRadius: 8, border: 'none',
                    background: betSide === 'YES'
                      ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                      : 'rgba(148,163,184,0.25)',
                    color: '#fff', fontSize: 12, fontWeight: 700,
                    cursor: betting || !betAmount ? 'not-allowed' : 'pointer',
                    opacity: betting || !betAmount ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  {betting ? 'Envoi…' : 'Confirmer'}
                </button>
                <button
                  onClick={() => { setBetSide(null); setBetAmount(''); setBetResult(null); }}
                  style={{
                    padding: '8px 14px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: '#94a3b8',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
