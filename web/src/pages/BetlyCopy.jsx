/**
 * BetlyCopy.jsx — Copy-trading Polymarket natif dans BETLY.
 * Données depuis VITE_POLYFRENCH_API_URL.
 * Aucune dépendance Telegram pour l'interface principale.
 *
 * BETLY Score = composite 0-100 (win rate + ROI + expérience)
 * Signal Force = pulse vert si whale active < 1h
 * Pack Whale = copier les 3 derniers trades d'un coup
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePolyfrenchApi } from '../hooks/usePolyfrenchApi';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { toast } from '../components/ToastManager';

const BASE_PF = import.meta.env.VITE_POLYFRENCH_API_URL || '';

// ── Helpers ──────────────────────────────────────────────────────────────────

function short(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relTime(dateStr) {
  if (!dateStr) return '—';
  const s = (Date.now() - new Date(dateStr)) / 1000;
  if (s < 60)  return 'à l\'instant';
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

function isHot(lastTradeAt) {
  if (!lastTradeAt) return false;
  return Date.now() - new Date(lastTradeAt) < 3600_000;
}

// BETLY Score: composite 0–100
function betlyScore(w) {
  const wr  = Math.min((w.winRate  || 0), 100);
  const roi = Math.min((w.roi      || 0) / 300 * 100, 100);
  const exp = Math.min((w.totalTrades || 0) / 150 * 100, 100);
  return Math.round(wr * 0.45 + roi * 0.35 + exp * 0.20);
}

function scoreColor(s) {
  if (s >= 75) return '#22c55e';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(s) {
  if (s >= 75) return 'Expert';
  if (s >= 50) return 'Actif';
  return 'Débutant';
}

// localStorage helpers for copied wallets
const LS_KEY = 'betly_copied_wallets';

function loadCopied() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveCopied(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 14, radius = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: 'rgba(255,255,255,0.06)',
      animation: 'pulse-sk 1.4s ease-in-out infinite',
    }} />
  );
}

// ── Signal Force dot ─────────────────────────────────────────────────────────

function SignalDot({ active }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: active ? '#22c55e' : '#334155',
      boxShadow: active ? '0 0 6px #22c55e' : 'none',
      animation: active ? 'live-pulse 1.5s ease-in-out infinite' : 'none',
      flexShrink: 0,
    }} />
  );
}

// ── Copy Modal ────────────────────────────────────────────────────────────────

function CopyModal({ wallet, onClose, onConfirm, betlyBalance }) {
  const score   = betlyScore(wallet);
  const already = loadCopied()[wallet.walletAddress];
  const [alloc,    setAlloc]    = useState(already?.allocation || 5);
  const [active,   setActive]   = useState(already?.active !== false);
  const [loading,  setLoading]  = useState(false);

  const maxUsdc  = ((betlyBalance || 0) * alloc) / 100;

  async function confirm() {
    setLoading(true);
    try {
      await onConfirm(wallet.walletAddress, alloc, active);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        zIndex: 801, width: 360, maxWidth: 'calc(100vw - 32px)',
        background: '#111118', border: '1px solid rgba(124,58,237,0.3)',
        borderRadius: 16, padding: 24,
        boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        animation: 'modal-in .2s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
            background: `conic-gradient(${scoreColor(score)} ${score}%, #1e293b ${score}%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#111118', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: scoreColor(score),
            }}>{score}</div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{short(wallet.walletAddress)}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              WR {wallet.winRate?.toFixed(1) || 0}% · ROI {wallet.roi?.toFixed(1) || 0}% · {wallet.totalTrades || 0} trades
            </div>
          </div>
        </div>

        {/* Allocation slider */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Allocation par trade</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>
              {alloc}% · ~{maxUsdc.toFixed(2)} USDC
            </span>
          </div>
          <input
            type="range" min={1} max={50} step={1} value={alloc}
            onChange={e => setAlloc(+e.target.value)}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 4 }}>
            <span>1%</span><span>10%</span><span>25%</span><span>50%</span>
          </div>
        </div>

        {/* Active toggle */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.04)', marginBottom: 16,
        }}>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>Copie automatique active</span>
          <button
            onClick={() => setActive(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: active ? '#7c3aed' : '#1e293b', position: 'relative', transition: 'background .2s',
            }}
          >
            <span style={{
              position: 'absolute', top: 3, left: active ? 20 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left .2s',
            }} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#64748b', cursor: 'pointer', fontSize: 13,
          }}>
            Annuler
          </button>
          <button onClick={confirm} disabled={loading} style={{
            flex: 2, padding: '10px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 700,
            opacity: loading ? 0.7 : 1,
          }}>
            {loading ? 'Enregistrement...' : (already ? 'Mettre à jour' : 'Commencer à copier')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Wallet Row ────────────────────────────────────────────────────────────────

function WalletRow({ wallet, copied, onCopy, isMobile }) {
  const score  = betlyScore(wallet);
  const hot    = isHot(wallet.lastTradeAt);
  const isCopying = copied?.active;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr auto' : '28px 1fr 60px 70px 70px 60px auto',
      gap: isMobile ? 0 : 12,
      alignItems: 'center',
      padding: '12px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      transition: 'background .15s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {isMobile ? (
        // Mobile: compact card
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SignalDot active={hot} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
              {short(wallet.walletAddress)}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
              background: `${scoreColor(score)}20`, color: scoreColor(score),
              border: `1px solid ${scoreColor(score)}40`,
            }}>
              {score} · {scoreLabel(score)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#94a3b8' }}>
            <span>WR {wallet.winRate?.toFixed(1) || 0}%</span>
            <span style={{ color: (wallet.roi || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
              ROI {(wallet.roi || 0) >= 0 ? '+' : ''}{wallet.roi?.toFixed(1) || 0}%
            </span>
            <span>{wallet.totalTrades || 0} trades</span>
          </div>
        </div>
      ) : (
        <>
          {/* Rank */}
          <div style={{ fontSize: 12, color: '#475569', textAlign: 'center' }}>
            {wallet._rank || '—'}
          </div>
          {/* Address + signal */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <SignalDot active={hot} />
            <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#f8fafc' }}>
              {short(wallet.walletAddress)}
            </span>
            {isCopying && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)',
              }}>COPIE</span>
            )}
          </div>
          {/* BETLY Score */}
          <div style={{ textAlign: 'center' }}>
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 999,
              background: `${scoreColor(score)}15`, color: scoreColor(score),
            }}>{score}</span>
          </div>
          {/* Win Rate */}
          <div style={{ fontSize: 12, color: '#f8fafc', textAlign: 'center' }}>
            {wallet.winRate?.toFixed(1) || 0}%
          </div>
          {/* ROI */}
          <div style={{
            fontSize: 12, fontWeight: 700, textAlign: 'center',
            color: (wallet.roi || 0) >= 0 ? '#22c55e' : '#ef4444',
          }}>
            {(wallet.roi || 0) >= 0 ? '+' : ''}{wallet.roi?.toFixed(1) || 0}%
          </div>
          {/* Trades */}
          <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            {wallet.totalTrades || 0}
          </div>
        </>
      )}

      {/* Action */}
      <button
        onClick={() => onCopy(wallet)}
        style={{
          padding: isMobile ? '6px 12px' : '5px 12px',
          borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: isCopying
            ? 'rgba(124,58,237,0.2)'
            : 'rgba(255,255,255,0.06)',
          color: isCopying ? '#a78bfa' : '#94a3b8',
          border: isCopying ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.08)',
          transition: 'all .15s', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.25)'; e.currentTarget.style.color = '#c4b5fd'; }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isCopying ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.06)';
          e.currentTarget.style.color = isCopying ? '#a78bfa' : '#94a3b8';
        }}
      >
        {isCopying ? 'Gérer' : 'Copier'}
      </button>
    </div>
  );
}

// ── Alert Item ────────────────────────────────────────────────────────────────

function AlertItem({ alert }) {
  const copiedWallets = loadCopied();
  const isFollowed    = !!copiedWallets[alert.walletAddress]?.active;
  const side          = alert.side === 'YES' ? 'OUI' : 'NON';
  const sideColor     = alert.side === 'YES' ? '#a78bfa' : '#94a3b8';

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '10px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isFollowed ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12,
      }}>
        {isFollowed ? 'C' : 'W'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.4, marginBottom: 3 }}>
          <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>
            {short(alert.walletAddress)}
          </span>
          {' '}→{' '}
          <span style={{ fontWeight: 700, color: sideColor }}>{side}</span>
          {' '}
          <span style={{ color: '#f8fafc', fontWeight: 600 }}>{alert.amount || '?'} USDC</span>
          {' sur '}
          <span style={{ color: '#94a3b8' }}>{(alert.marketTitle || '').slice(0, 45)}</span>
        </div>
        <span style={{ fontSize: 10, color: '#475569' }}>{relTime(alert.time || alert.createdAt)}</span>
      </div>
      {isFollowed && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 999, flexShrink: 0,
          background: 'rgba(124,58,237,0.15)', color: '#a78bfa',
          border: '1px solid rgba(124,58,237,0.3)', alignSelf: 'center',
        }}>Copié</span>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BetlyCopy() {
  const { user } = useAuth();
  const [tab,       setTab]       = useState('wallets'); // 'wallets' | 'mine' | 'alerts'
  const [copied,    setCopied]    = useState(loadCopied);
  const [copyModal, setCopyModal] = useState(null); // wallet object | null
  const isMobile = window.innerWidth < 768;

  const { data: lbData,    loading: lbLoading    } = usePolyfrenchApi('/api/leaderboard', { params: { limit: 20 } });
  const { data: alertData, loading: alertLoading  } = usePolyfrenchApi('/api/alerts',     { params: { limit: 30 }, interval: 5000 });
  const { data: statsData                          } = usePolyfrenchApi('/api/stats');

  const wallets = (lbData?.leaderboard || []).map((w, i) => ({ ...w, _rank: i + 1 }));
  const alerts  = alertData?.alerts || alertData?.recent || [];

  const copiedWallets = wallets.filter(w => !!copied[w.walletAddress]);
  const totalCopiedPnl = copiedWallets.reduce((s, w) => s + (w.pnl || 0), 0);

  // Global stats
  const globalWr  = statsData?.winRate  || (wallets.length ? (wallets.reduce((s, w) => s + (w.winRate || 0), 0) / wallets.length) : 0);
  const globalPnl = statsData?.pnl      || totalCopiedPnl;
  const globalTrades = statsData?.totalTrades || wallets.reduce((s, w) => s + (w.totalTrades || 0), 0);

  function handleCopyConfirm(address, allocation, active) {
    const next = { ...loadCopied(), [address]: { allocation, active, copiedAt: Date.now() } };
    saveCopied(next);
    setCopied(next);
    toast(active ? `Copie activée sur ${short(address)} · ${allocation}% du solde` : `Wallet ${short(address)} mis en pause`, active ? 'success' : 'info');
  }

  function handleStop(address) {
    const next = { ...loadCopied() };
    delete next[address];
    saveCopied(next);
    setCopied(next);
    toast(`Copie arrêtée sur ${short(address)}`, 'info');
  }

  const TABS = [
    { key: 'wallets', label: 'Top Whales', count: wallets.length },
    { key: 'mine',    label: 'Mes copiés', count: Object.keys(copied).length },
    { key: 'alerts',  label: 'Alertes',    count: alerts.length, pulse: true },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '16px 12px 80px' : '24px 20px 40px' }}>
      <style>{`
        @keyframes pulse-sk { 0%,100% { opacity:.4; } 50% { opacity:.8; } }
        @keyframes live-pulse { 0%,100% { box-shadow:0 0 0 0 rgba(34,197,94,.6); } 50% { box-shadow:0 0 0 5px rgba(34,197,94,0); } }
        @keyframes modal-in { from { opacity:0; transform:translate(-50%,-50%) scale(.95); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
            BETLY Copy
          </h1>
          <p style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Copie les meilleurs traders Polymarket · Polling 5s
          </p>
        </div>
        <div style={{
          display: 'flex', gap: 8, padding: '6px 12px', borderRadius: 10,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
          alignItems: 'center',
        }}>
          <SignalDot active />
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 600 }}>Live</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'PnL whales',    value: `${globalPnl >= 0 ? '+' : ''}${(globalPnl||0).toFixed(2)} USDC`, color: globalPnl >= 0 ? '#22c55e' : '#ef4444' },
          { label: 'Trades détectés', value: globalTrades.toLocaleString(), color: '#a78bfa' },
          { label: 'Win rate moyen', value: `${globalWr.toFixed(1)}%`, color: globalWr >= 55 ? '#22c55e' : '#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* BETLY Score explication — game changer */}
      <div style={{
        background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a78bfa' }}>i</span>
        <span style={{ color: '#94a3b8' }}>
          <b style={{ color: '#a78bfa' }}>BETLY Score</b> — algorithme exclusif 0–100 basé sur win rate, ROI et volume.
          {' '}<b style={{ color: '#22c55e' }}>Vert ≥75</b> · <b style={{ color: '#f59e0b' }}>Jaune ≥50</b> · <b style={{ color: '#ef4444' }}>Rouge &lt;50</b>.
          {' '}Le signal <b style={{ color: '#22c55e' }}>●</b> = actif dans l'heure.
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '9px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
              background: tab === t.key ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: tab === t.key ? '#a78bfa' : '#64748b',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? '2px solid #a78bfa' : '2px solid transparent',
              transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: tab === t.key ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)',
                color: tab === t.key ? '#c4b5fd' : '#475569',
                borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                position: 'relative',
              }}>
                {t.count}
                {t.pulse && t.count > 0 && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2, width: 5, height: 5,
                    borderRadius: '50%', background: '#22c55e',
                    animation: 'live-pulse 1.5s ease-in-out infinite',
                  }} />
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Top Wallets ── */}
      {tab === 'wallets' && (
        <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Column headers — desktop only */}
          {!isMobile && (
            <div style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 60px 70px 70px 60px auto',
              gap: 12, padding: '9px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              <div>#</div>
              <div>Wallet</div>
              <div style={{ textAlign: 'center' }}>Score</div>
              <div style={{ textAlign: 'center' }}>Win Rate</div>
              <div style={{ textAlign: 'center' }}>ROI</div>
              <div style={{ textAlign: 'center' }}>Trades</div>
              <div />
            </div>
          )}

          {lbLoading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(6)].map((_, i) => <Skeleton key={i} h={36} />)}
            </div>
          ) : wallets.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              Aucun wallet disponible · API POLYFRENCH hors ligne ?
            </div>
          ) : (
            wallets.map(w => (
              <WalletRow
                key={w.walletAddress}
                wallet={w}
                copied={copied[w.walletAddress]}
                onCopy={setCopyModal}
                isMobile={isMobile}
              />
            ))
          )}
        </div>
      )}

      {/* ── Tab: Mes copiés ── */}
      {tab === 'mine' && (
        <div>
          {copiedWallets.length === 0 ? (
            <div style={{
              background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '48px 24px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>--</div>
              <div style={{ fontSize: 14, color: '#64748b' }}>Tu ne copies aucun wallet pour l'instant</div>
              <button onClick={() => setTab('wallets')} style={{
                marginTop: 16, padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', fontSize: 13, fontWeight: 700,
              }}>
                Voir les top whales
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {copiedWallets.map(w => {
                const cfg   = copied[w.walletAddress];
                const score = betlyScore(w);
                return (
                  <div key={w.walletAddress} style={{
                    background: '#111118', border: '1px solid rgba(124,58,237,0.2)',
                    borderRadius: 12, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  }}>
                    <SignalDot active={isHot(w.lastTradeAt)} />
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#f8fafc', fontWeight: 700 }}>
                        {short(w.walletAddress)}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        {cfg.allocation}% · Score {score} · WR {w.winRate?.toFixed(1)||0}%
                      </div>
                    </div>
                    <div style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                      background: cfg.active ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                      color: cfg.active ? '#22c55e' : '#64748b',
                      border: `1px solid ${cfg.active ? 'rgba(34,197,94,0.3)' : 'rgba(100,116,139,0.2)'}`,
                    }}>
                      {cfg.active ? 'Actif' : 'Pause'}
                    </div>
                    <div style={{ fontSize: 12, color: (w.pnl||0) >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      {(w.pnl||0) >= 0 ? '+' : ''}{(w.pnl||0).toFixed(2)} USDC
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setCopyModal(w)} style={{
                        padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(124,58,237,0.3)',
                        background: 'rgba(124,58,237,0.1)', color: '#a78bfa', cursor: 'pointer', fontSize: 12,
                      }}>Gérer</button>
                      <button onClick={() => handleStop(w.walletAddress)} style={{
                        padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.2)',
                        background: 'rgba(239,68,68,0.06)', color: '#ef4444', cursor: 'pointer', fontSize: 12,
                      }}>Arrêter</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Alertes ── */}
      {tab === 'alerts' && (
        <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Trades détectés en temps réel</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e' }}>
              <SignalDot active />
              Polling 5s
            </div>
          </div>

          {alertLoading ? (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} h={52} />)}
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>
              Aucune alerte pour l'instant · En attente de trades…
            </div>
          ) : (
            alerts.map((a, i) => <AlertItem key={a._id || i} alert={a} />)
          )}
        </div>
      )}

      {/* Copy Modal */}
      {copyModal && (
        <CopyModal
          wallet={copyModal}
          betlyBalance={user?.balance || 0}
          onClose={() => setCopyModal(null)}
          onConfirm={handleCopyConfirm}
        />
      )}
    </div>
  );
}
