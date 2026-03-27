import React, { useState } from 'react';
import ConfidenceBadge from './ConfidenceBadge';
import BetBar from './BetBar';
import { useUserId } from '../hooks/useApi';

const CATEGORY_COLORS = {
  sport:     { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  crypto:    { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  politique: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  culture:   { color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  autre:     { color: '#9090a0', bg: 'rgba(144,144,160,0.1)' },
};

function timeRemaining(resolutionDate) {
  const now = new Date();
  const end = new Date(resolutionDate);
  const diff = end - now;
  if (diff <= 0) return 'Expiré';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

export default function MarketCard({ market, onBetPlaced }) {
  const userId = useUserId();
  const [betModal, setBetModal] = useState(null); // 'YES' | 'NO' | null
  const [betAmount, setBetAmount] = useState('');
  const [betting, setBetting] = useState(false);
  const [betResult, setBetResult] = useState(null);

  const cat = CATEGORY_COLORS[market.category] || CATEGORY_COLORS.autre;

  const handleBet = async () => {
    if (!userId) {
      alert('Connecte-toi pour parier (ajoute ?userId=TON_ID dans l\'URL)');
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
        body: JSON.stringify({ side: betModal, amount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setBetResult({ success: true, message: `Pari ${betModal} de ${amount} USDC placé !` });
      if (onBetPlaced) onBetPlaced();
      setTimeout(() => {
        setBetModal(null);
        setBetResult(null);
        setBetAmount('');
      }, 2000);
    } catch (err) {
      setBetResult({ success: false, message: err.message });
    } finally {
      setBetting(false);
    }
  };

  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'border-color 0.15s',
        cursor: 'default',
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}
    >
      {/* Header: category + confidence + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            color: cat.color,
            background: cat.bg,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          {market.category}
        </span>
        <ConfidenceBadge score={market.confidenceScore} />
        <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#6060a0' }}>
          ⏳ {timeRemaining(market.resolutionDate)}
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#e2e2e8',
          lineHeight: '1.4',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {market.title}
      </h3>

      {/* Bet bar */}
      <BetBar totalYes={market.totalYes} totalNo={market.totalNo} />

      {/* Footer: comments + oracle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#6060a0' }}>
        <span>💬 {market.commentsCount} commentaires</span>
        <span>Oracle L{market.oracleLevel}</span>
      </div>

      {/* Bet buttons */}
      {betModal === null && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setBetModal('YES')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '7px',
              border: 'none',
              background: 'rgba(34,197,94,0.15)',
              color: '#22c55e',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.15)'}
          >
            Miser OUI
          </button>
          <button
            onClick={() => setBetModal('NO')}
            style={{
              flex: 1,
              padding: '8px',
              borderRadius: '7px',
              border: 'none',
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.25)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
          >
            Miser NON
          </button>
        </div>
      )}

      {/* Inline bet modal */}
      {betModal !== null && (
        <div
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${betModal === 'YES' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ fontSize: '13px', fontWeight: 600, color: betModal === 'YES' ? '#22c55e' : '#ef4444' }}>
            Miser {betModal === 'YES' ? 'OUI' : 'NON'}
          </div>

          {betResult ? (
            <div style={{ fontSize: '13px', color: betResult.success ? '#22c55e' : '#ef4444', textAlign: 'center', padding: '4px 0' }}>
              {betResult.message}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  placeholder="Montant USDC"
                  value={betAmount}
                  onChange={e => setBetAmount(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#0a0a0f',
                    color: '#e2e2e8',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '12px', color: '#9090a0' }}>USDC</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={handleBet}
                  disabled={betting || !betAmount}
                  style={{
                    flex: 1,
                    padding: '7px',
                    borderRadius: '6px',
                    border: 'none',
                    background: betModal === 'YES' ? '#22c55e' : '#ef4444',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: betting || !betAmount ? 'not-allowed' : 'pointer',
                    opacity: betting || !betAmount ? 0.6 : 1,
                  }}
                >
                  {betting ? 'Envoi...' : 'Confirmer'}
                </button>
                <button
                  onClick={() => { setBetModal(null); setBetAmount(''); setBetResult(null); }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent',
                    color: '#9090a0',
                    fontSize: '12px',
                    cursor: 'pointer',
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
