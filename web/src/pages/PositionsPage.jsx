import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useClaimWinnings } from '../hooks/useClaimWinnings';
import { useAccount } from 'wagmi';
import { apiFetch } from '../lib/api';
import { toast } from '../components/ToastManager';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function potentialPayout(bet, market) {
  if (!market || bet.status !== 'active') return null;
  const total = (market.totalYes || 0) + (market.totalNo || 0);
  if (total === 0) return null;
  const winPool = bet.side === 'YES' ? (market.totalYes || 0) : (market.totalNo || 0);
  if (winPool === 0) return null;
  return (bet.amount / winPool) * total * 0.98;
}

function currentValue(bet, market) {
  if (!market || bet.status !== 'active') return null;
  const total = (market.totalYes || 0) + (market.totalNo || 0);
  if (total === 0) return null;
  const myPool = bet.side === 'YES' ? (market.totalYes || 0) : (market.totalNo || 0);
  const otherPool = total - myPool;
  if (myPool === 0) return null;
  // Shares = amount, value = (amount/myPool) * total * 0.98
  return (bet.amount / myPool) * total * 0.98;
}

// ── Claim Button ─────────────────────────────────────────────────────────────
function ClaimButton({ onChainId, betId, payout, onClaimed }) {
  const { claim, status, error } = useClaimWinnings();
  const { isConnected } = useAccount();

  if (!isConnected) return (
    <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 10 }}>
      Connecte ton wallet pour encaisser
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      <button
        onClick={async (e) => {
          e.stopPropagation();
          try {
            await claim(onChainId);
            try { await apiFetch(`/api/bets/${betId}/claim`, { method: 'POST' }); } catch {}
            toast('Gains encaissés !', 'success', 4000);
            onClaimed?.();
          } catch (err) {
            toast(err.shortMessage || 'Erreur claim', 'error');
          }
        }}
        disabled={status === 'claiming' || status === 'success'}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
          cursor: status === 'success' ? 'default' : 'pointer',
          fontWeight: 700, fontSize: 13, letterSpacing: 0.3,
          background: status === 'success'
            ? 'rgba(34,197,94,0.15)'
            : 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: status === 'success' ? '#22c55e' : '#fff',
          opacity: status === 'claiming' ? 0.6 : 1,
          transition: 'all .2s',
        }}
      >
        {status === 'claiming' ? 'Transaction en cours…'
          : status === 'success' ? '✓ Encaissé'
          : `Encaisser ${payout ? payout.toFixed(2) + ' USDC' : 'mes gains'}`}
      </button>
      {error && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{error}</div>}
    </div>
  );
}

// ── Position Card ────────────────────────────────────────────────────────────
function PositionCard({ bet, market, onClaimed }) {
  const side = bet.side === 'YES' ? 'Oui' : 'Non';
  const sideColor = bet.side === 'YES' ? '#a855f7' : '#ef4444';
  const isWon = bet.status === 'won';
  const isLost = bet.status === 'lost';
  const isClaimed = bet.status === 'claimed';
  const isResolved = market?.status === 'resolved';
  const canClaim = (isWon || (bet.status === 'active' && isResolved)) && market?.onChainId != null;

  const payout = bet.payout || potentialPayout(bet, market);
  const profit = payout ? payout - bet.amount : 0;
  const cv = currentValue(bet, market);

  // Status config
  let statusBg, statusColor, statusLabel;
  if (isClaimed) { statusBg = 'rgba(6,182,212,0.1)'; statusColor = '#06b6d4'; statusLabel = 'Encaissé'; }
  else if (isWon) { statusBg = 'rgba(34,197,94,0.1)'; statusColor = '#22c55e'; statusLabel = 'Gagné'; }
  else if (isLost) { statusBg = 'rgba(239,68,68,0.1)'; statusColor = '#ef4444'; statusLabel = 'Perdu'; }
  else { statusBg = 'rgba(34,197,94,0.06)'; statusColor = '#22c55e'; statusLabel = 'Actif'; }

  return (
    <div
      style={{
        background: '#111118',
        border: `1px solid ${canClaim ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 14, padding: '16px 18px',
        transition: 'border-color .15s',
      }}
      onMouseEnter={e => { if (!canClaim) e.currentTarget.style.borderColor = 'rgba(168,85,247,0.25)'; }}
      onMouseLeave={e => { if (!canClaim) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
    >
      {/* Top row: title + status */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={market?._id ? `/market/${market._id}` : '#'}
            style={{ textDecoration: 'none', color: '#e2e8f0', fontSize: 14, fontWeight: 600, lineHeight: 1.4, display: 'block' }}
            onMouseEnter={e => e.currentTarget.style.color = '#a855f7'}
            onMouseLeave={e => e.currentTarget.style.color = '#e2e8f0'}
          >
            {market?.title || '—'}
          </a>
          {market?.resolutionDate && (
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
              Échéance : {fmtDate(market.resolutionDate)}
            </div>
          )}
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: statusBg, color: statusColor, flexShrink: 0,
          border: `1px solid ${statusColor}30`,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* Outcome badge for resolved */}
      {isResolved && market?.outcome && (
        <div style={{
          display: 'inline-block', marginBottom: 10,
          padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
          background: market.outcome === 'YES' ? 'rgba(168,85,247,0.12)' : 'rgba(239,68,68,0.12)',
          color: market.outcome === 'YES' ? '#a855f7' : '#ef4444',
        }}>
          Résultat : {market.outcome === 'YES' ? 'Oui' : 'Non'}
        </div>
      )}

      {/* Stats grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
        gap: 12, marginBottom: canClaim ? 0 : 0,
      }}>
        {/* Side */}
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Position</div>
          <div style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            fontSize: 12, fontWeight: 800,
            background: `${sideColor}18`, color: sideColor,
          }}>
            {side}
          </div>
        </div>

        {/* Mise */}
        <div>
          <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Mise</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>${bet.amount}</div>
        </div>

        {/* Cote */}
        {bet.odds != null && (
          <div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Cote</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8' }}>{Math.round(bet.odds * 100)}¢</div>
          </div>
        )}

        {/* Current value / Payout */}
        {isWon && profit !== 0 && (
          <div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Gain net</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>+${profit.toFixed(2)}</div>
          </div>
        )}
        {isLost && (
          <div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Perte</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>-${bet.amount.toFixed(2)}</div>
          </div>
        )}
        {bet.status === 'active' && cv != null && (
          <div>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 3 }}>Valeur</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: cv >= bet.amount ? '#22c55e' : '#ef4444' }}>
              ${cv.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Claim CTA */}
      {canClaim && (
        <ClaimButton
          onChainId={market.onChainId}
          betId={bet._id}
          payout={bet.payout}
          onClaimed={onClaimed}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PositionsPage() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');

  function fetchPositions(silent = false) {
    if (!user) return;
    if (!silent) setLoading(true);
    apiFetch(`/api/positions?status=${filter}`)
      .then(r => r.json())
      .then(d => setPositions(d.positions || []))
      .catch(() => setPositions([]))
      .finally(() => { if (!silent) setLoading(false); });
  }

  // Initial fetch + auto-refresh every 30s
  useEffect(() => {
    fetchPositions();
    const interval = setInterval(() => fetchPositions(true), 30000);
    return () => clearInterval(interval);
  }, [user, filter]);

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '80px 16px', color: '#64748b' }}>
      Connecte-toi pour voir tes positions
    </div>
  );

  // Compute summary
  const activeBets = positions.filter(p => p.bet.status === 'active');
  const wonBets = positions.filter(p => p.bet.status === 'won' || p.bet.status === 'claimed');
  const lostBets = positions.filter(p => p.bet.status === 'lost');

  const totalInvested = activeBets.reduce((s, p) => s + p.bet.amount, 0);
  const totalWon = wonBets.reduce((s, p) => s + (p.bet.payout || 0), 0);
  const totalLost = lostBets.reduce((s, p) => s + p.bet.amount, 0);
  const netPnl = totalWon - wonBets.reduce((s, p) => s + p.bet.amount, 0) - totalLost;

  const FILTERS = [
    { key: 'active', label: 'Actifs', count: null },
    { key: 'won', label: 'Gagnés', count: null },
    { key: 'lost', label: 'Perdus', count: null },
    { key: 'all', label: 'Tout', count: null },
  ];

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 16px 80px' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#f8fafc', margin: 0, letterSpacing: -0.5 }}>
          Portfolio
        </h1>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(96,165,250,0.06))',
          border: '1px solid rgba(168,85,247,0.15)', borderRadius: 12, padding: '14px 14px',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>En jeu</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>${totalInvested.toFixed(2)}</div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 14px',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>P&L Total</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: netPnl >= 0 ? '#22c55e' : '#ef4444' }}>
            {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)}
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '14px 14px',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Positions</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{positions.length}</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 16,
        background: 'rgba(255,255,255,0.03)', borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.06)', padding: 3,
      }}>
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              background: filter === key ? 'rgba(168,85,247,0.15)' : 'transparent',
              color: filter === key ? '#a855f7' : '#64748b',
              fontWeight: filter === key ? 700 : 500, fontSize: 12,
              transition: 'all .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Positions list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 100, borderRadius: 14, background: 'rgba(255,255,255,0.03)',
              animation: 'pulse 1.5s infinite',
            }} />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: '#111118', borderRadius: 14,
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }}>
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 6 }}>
            {filter === 'active' ? 'Aucune position active' : 'Rien ici'}
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginBottom: 20 }}>
            {filter === 'active' ? 'Place ton premier pari pour commencer' : 'Aucun pari dans cette catégorie'}
          </div>
          <a
            href="/"
            style={{
              display: 'inline-block', padding: '8px 20px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}
          >
            Explorer les marchés
          </a>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {positions.map(({ bet, market }) => (
            <PositionCard
              key={bet._id}
              bet={bet}
              market={market}
              onClaimed={fetchPositions}
            />
          ))}
        </div>
      )}
    </div>
  );
}
