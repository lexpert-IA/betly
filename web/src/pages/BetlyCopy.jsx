/**
 * BetlyCopy.jsx — Cockpit Copy Trading Polymarket
 * Données depuis /api/copy/* (Betly backend, Firebase auth)
 * Aucune dépendance localStorage ni Telegram
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { toast } from '../components/ToastManager';

// ── Helpers ───────────────────────────────────────────────────────────────────

function short(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relTime(d) {
  if (!d) return '—';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60)    return 'à l\'instant';
  if (s < 3600)  return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

function isHot(d) {
  return d && Date.now() - new Date(d) < 3_600_000;
}

function scoreColor(s) {
  if (s >= 75) return '#22c55e';
  if (s >= 50) return '#f59e0b';
  return '#ef4444';
}
function scoreLabel(s) {
  if (s >= 75) return 'Expert';
  if (s >= 50) return 'Actif';
  return 'Junior';
}

function pnlColor(v) { return v >= 0 ? '#22c55e' : '#ef4444'; }
function pnlSign(v)  { return v >= 0 ? '+' : ''; }
function fmt(v, d=2) { return (v || 0).toFixed(d); }

// ── useApi hook ───────────────────────────────────────────────────────────────

function useApi(path, interval = 0) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const timerRef = useRef(null);

  const load = useCallback(async (first = false) => {
    if (first) setLoading(true);
    try {
      const res = await apiFetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      if (first) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    load(true);
    if (interval > 0) timerRef.current = setInterval(() => load(false), interval);
    return () => clearInterval(timerRef.current);
  }, [load, interval]);

  return { data, loading, error, refetch: () => load(false) };
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:     '#0a0a0f',
  card:   '#111118',
  border: 'rgba(255,255,255,0.07)',
  purple: '#7c3aed',
  purpleL:'#a855f7',
  text:   '#f8fafc',
  muted:  '#64748b',
  dim:    '#94a3b8',
};

const card = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 14,
};

// ── Atoms ─────────────────────────────────────────────────────────────────────

function Skeleton({ h = 14, w = '100%' }) {
  return <div style={{ height: h, width: w, borderRadius: 6, background: 'rgba(255,255,255,0.06)', animation: 'sk 1.4s ease infinite' }} />;
}

function Dot({ active, size = 7 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: active ? '#22c55e' : '#334155',
      boxShadow: active ? '0 0 6px rgba(34,197,94,.7)' : 'none',
      animation: active ? 'pulse-dot 1.5s ease infinite' : 'none',
    }} />
  );
}

function Badge({ color = C.purpleL, bg, children, style = {} }) {
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      color, background: bg || `${color}18`, border: `1px solid ${color}40`,
      ...style,
    }}>{children}</span>
  );
}

function Toggle({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
      <span style={{ fontSize: 13, color: C.dim }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: value ? C.purple : '#1e293b',
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute', top: 4, left: value ? 22 : 4,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          transition: 'left .2s',
        }} />
      </button>
    </div>
  );
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{ ...card, padding: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: color || C.text }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 44 }) {
  const c = scoreColor(score);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `conic-gradient(${c} ${score}%, #1e293b ${score}%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: size - 14, height: size - 14, borderRadius: '50%',
        background: C.card, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size === 44 ? 11 : 9, fontWeight: 900, color: c,
      }}>{score}</div>
    </div>
  );
}

// ── Copy Modal ────────────────────────────────────────────────────────────────

function CopyModal({ wallet, config, balance, onClose, onSaved }) {
  const existing  = config?.followedWallets?.find(w => w.address === wallet.walletAddress);
  const [alloc,   setAlloc]   = useState(existing?.allocation || 5);
  const [loading, setLoading] = useState(false);
  const score = wallet.betlyScore || 0;
  const maxUsdc = ((balance || 0) * alloc / 100).toFixed(2);

  async function save() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/copy/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: wallet.walletAddress, allocation: alloc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(existing ? `Allocation mise à jour` : `Copie activée sur ${short(wallet.walletAddress)}`, 'success');
      onSaved(data.config);
      onClose();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 801, width: 380, maxWidth: 'calc(100vw - 32px)',
        background: C.card, border: `1px solid rgba(124,58,237,0.35)`,
        borderRadius: 18, padding: 28,
        boxShadow: '0 32px 80px rgba(0,0,0,.8), 0 0 40px rgba(124,58,237,0.1)',
        animation: 'modal-in .2s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 24 }}>
          <ScoreRing score={score} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, fontFamily: 'monospace' }}>
              {short(wallet.walletAddress)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              WR {fmt(wallet.winRate)}%  ·  ROI {pnlSign(wallet.roi)}{fmt(wallet.roi)}%  ·  {wallet.totalTrades || 0} trades
            </div>
          </div>
          <Badge color={scoreColor(score)}>{scoreLabel(score)}</Badge>
        </div>

        {/* Allocation */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: C.dim }}>Allocation par trade</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.purpleL }}>
              {alloc}% · ~{maxUsdc} USDC
            </span>
          </div>
          <input
            type="range" min={1} max={50} step={1} value={alloc}
            onChange={e => setAlloc(+e.target.value)}
            style={{ width: '100%', accentColor: C.purpleL, marginBottom: 6 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155' }}>
            {['1%','10%','25%','50%'].map(l => <span key={l}>{l}</span>)}
          </div>
        </div>

        {/* Info */}
        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.07)', marginBottom: 20, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
          Chaque fois que ce trader ouvre une position, Betly en copie une portion selon ton allocation.
          Une commission de <b style={{ color: C.purpleL }}>0.5%</b> est prélevée.
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 10,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            color: C.muted, cursor: 'pointer', fontSize: 13,
          }}>Annuler</button>
          <button onClick={save} disabled={loading} style={{
            flex: 2, padding: '11px', borderRadius: 10, border: 'none',
            background: loading ? 'rgba(124,58,237,0.4)' : `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
            color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 800,
            boxShadow: loading ? 'none' : '0 0 20px rgba(124,58,237,0.4)',
            transition: 'all .2s',
          }}>
            {loading ? 'Enregistrement…' : (existing ? 'Mettre à jour' : '🚀 Commencer à copier')}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Setup Banner ──────────────────────────────────────────────────────────────

function SetupBanner({ user, config, onActivate }) {
  const hasWallet = !!user?.walletAddress;
  const [loading, setLoading] = useState(false);

  async function activate() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/copy/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyEnabled: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onActivate(data.config);
      toast('Copy trading activé !', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!hasWallet) {
    return (
      <div style={{
        ...card, padding: '20px 24px', textAlign: 'center', marginBottom: 20,
        border: `1px solid rgba(124,58,237,0.25)`,
        background: 'linear-gradient(135deg, rgba(124,58,237,0.06), rgba(168,85,247,0.03))',
      }}>
        <div style={{ fontSize: 26, marginBottom: 10 }}>👛</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>
          Configure ton wallet d'abord
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Pour copier des trades, tu as besoin d'un wallet Polygon avec des USDC.
        </div>
        <a href="/account?tab=deposit" style={{
          display: 'inline-block', padding: '11px 28px', borderRadius: 10,
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
          color: '#fff', fontSize: 13, fontWeight: 800, textDecoration: 'none',
          boxShadow: '0 0 20px rgba(124,58,237,0.4)',
        }}>
          Configurer mon wallet →
        </a>
      </div>
    );
  }

  if (!config?.copyEnabled) {
    return (
      <div style={{
        ...card, padding: '28px', marginBottom: 24,
        border: '1px solid rgba(34,197,94,0.2)',
        background: 'linear-gradient(135deg, rgba(34,197,94,0.04), transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 6 }}>
              Prêt à copier les meilleurs traders ?
            </div>
            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.7 }}>
              Wallet connecté · Balance {(user.balance || 0).toFixed(2)} USDC · Active le copy trading pour commencer.
            </div>
          </div>
          <button
            onClick={activate}
            disabled={loading}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg, #16a34a, #22c55e)',
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 0 20px rgba(34,197,94,0.35)',
              transition: 'all .2s', whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Activation…' : '⚡ Activer le Copy Trading'}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

// ── Tab: Dashboard ────────────────────────────────────────────────────────────

// ── Sparkline SVG ────────────────────────────────────────────────────────────

function Sparkline({ trades, width = 280, height = 48 }) {
  if (!trades || trades.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.muted }}>Pas assez de données</div>;
  }

  // Build cumulative PnL points from oldest to newest
  const sorted = [...trades].filter(t => t.pnl != null).reverse();
  if (sorted.length < 2) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.muted }}>Pas assez de données</div>;
  }

  let cumul = 0;
  const points = sorted.map(t => { cumul += t.pnl; return cumul; });

  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const range = max - min || 1;
  const pad = 4;

  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const color = cumul >= 0 ? '#22c55e' : '#ef4444';
  const zeroY = pad + (1 - (0 - min) / range) * (height - pad * 2);

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <line x1={pad} y1={zeroY} x2={width - pad} y2={zeroY} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={coords.join(' ')} />
      <circle cx={coords[coords.length - 1].split(',')[0]} cy={coords[coords.length - 1].split(',')[1]} r={3} fill={color} />
    </svg>
  );
}

function TabDashboard({ stats, config, trades, onTabChange }) {
  const recent = (trades?.trades || []).slice(0, 5);
  const allTrades = trades?.trades || [];

  // Auto-copy toast: detect new trades since last check
  const lastTradeRef = useRef(null);
  useEffect(() => {
    if (allTrades.length === 0) return;
    const newest = allTrades[0];
    if (lastTradeRef.current && newest._id !== lastTradeRef.current && newest.mode === 'auto') {
      toast(`Auto-copie : ${newest.outcome === 'YES' ? 'OUI' : 'NON'} ${fmt(newest.amount)} USDC sur "${(newest.marketTitle || '').slice(0, 35)}"`, 'success');
    }
    lastTradeRef.current = newest._id;
  }, [allTrades]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <StatBox
          label="PnL total"
          value={`${pnlSign(stats?.totalPnl)}${fmt(stats?.totalPnl)} USDC`}
          color={pnlColor(stats?.totalPnl || 0)}
        />
        <StatBox label="Win Rate" value={`${stats?.winRate || 0}%`} color={stats?.winRate >= 55 ? '#22c55e' : '#f59e0b'} />
        <StatBox label="Trades copiés" value={stats?.executedTrades || 0} sub={stats?.paperMode ? 'mode papier' : 'réels'} />
        <StatBox label="Whales suivies" value={stats?.followedCount || 0} sub="actives" />
      </div>

      {/* PnL Sparkline */}
      {allTrades.some(t => t.pnl != null) && (
        <div style={{ ...card, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
            PnL cumulé
          </div>
          <Sparkline trades={allTrades} width={480} height={56} />
        </div>
      )}

      {/* Mode + état */}
      <div style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Dot active={config?.copyEnabled} size={9} />
        <span style={{ fontSize: 13, fontWeight: 700, color: config?.copyEnabled ? '#22c55e' : C.muted }}>
          {config?.copyEnabled ? 'Copy trading actif' : 'Copy trading en pause'}
        </span>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Badge color={config?.mode === 'auto' ? '#22c55e' : '#f59e0b'}>
            {config?.mode === 'auto' ? '⚡ Auto' : '👆 Manuel'}
          </Badge>
          {config?.paperMode && <Badge color="#60a5fa">📝 Paper mode</Badge>}
          <Badge color={C.purpleL}>Max {config?.maxPerTrade || 10} USDC/trade</Badge>
        </div>
      </div>

      {/* Trades récents */}
      <div style={card}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Trades récents</span>
          <button
            onClick={() => onTabChange('trades')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.purpleL }}
          >
            Voir tout →
          </button>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Aucun trade copié pour l'instant.<br/>
            <button onClick={() => onTabChange('traders')} style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', color: C.purpleL, fontSize: 13 }}>
              Trouver des traders →
            </button>
          </div>
        ) : recent.map((t, i) => (
          <div key={t._id || i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
            borderBottom: i < recent.length - 1 ? `1px solid ${C.border}` : 'none',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
              background: t.status === 'paper' ? 'rgba(96,165,250,0.12)' : 'rgba(124,58,237,0.12)',
            }}>
              {t.status === 'paper' ? '📝' : '✅'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.dim, fontFamily: 'monospace' }}>{short(t.whaleAddress)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{(t.marketTitle || '').slice(0, 40) || '—'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.outcome === 'YES' ? '#22c55e' : '#f59e0b' }}>{t.outcome}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{fmt(t.amount)} USDC</div>
            </div>
            <div style={{ fontSize: 10, color: C.muted, width: 40, textAlign: 'right' }}>{relTime(t.executedAt)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Traders ──────────────────────────────────────────────────────────────

function TabTraders({ config, balance, onConfigUpdate }) {
  const [sort,      setSort]      = useState('score');
  const [modal,     setModal]     = useState(null);
  const { data, loading } = useApi(`/api/copy/leaderboard?sort=${sort}&limit=25`);

  const wallets  = data?.wallets || [];
  const followed = new Set((config?.followedWallets || []).map(w => w.address));

  const SORTS = [
    { key: 'score',   label: '🏆 Score'    },
    { key: 'winrate', label: '🎯 Win Rate'  },
    { key: 'roi',     label: '💰 ROI'       },
  ];

  return (
    <div>
      {/* Sort bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {SORTS.map(s => (
          <button key={s.key} onClick={() => setSort(s.key)} style={{
            padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: sort === s.key ? 700 : 500,
            background: sort === s.key ? `linear-gradient(135deg, ${C.purple}, ${C.purpleL})` : 'rgba(255,255,255,0.05)',
            color: sort === s.key ? '#fff' : C.muted,
            boxShadow: sort === s.key ? '0 0 16px rgba(124,58,237,0.3)' : 'none',
            transition: 'all .15s',
          }}>{s.label}</button>
        ))}
        {data?.source === 'unavailable' && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444', alignSelf: 'center' }}>
            ⚠️ Polyfrench hors ligne
          </span>
        )}
      </div>

      <div style={card}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '32px 1fr 64px 72px 72px 68px auto',
          gap: 8, padding: '10px 18px',
          borderBottom: `1px solid ${C.border}`,
          fontSize: 10, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
        }}>
          <div>#</div><div>Wallet</div>
          <div style={{ textAlign: 'center' }}>Score</div>
          <div style={{ textAlign: 'center' }}>Win Rate</div>
          <div style={{ textAlign: 'center' }}>ROI</div>
          <div style={{ textAlign: 'center' }}>Trades</div>
          <div />
        </div>

        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...Array(8)].map((_, i) => <Skeleton key={i} h={44} />)}
          </div>
        ) : wallets.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Aucun trader disponible
          </div>
        ) : wallets.map((w, i) => {
          const isCopying = followed.has(w.walletAddress);
          const score     = w.betlyScore || 0;
          const hot       = isHot(w.lastTradeAt);
          return (
            <div key={w.walletAddress} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 64px 72px 72px 68px auto',
              gap: 8, padding: '13px 18px', alignItems: 'center',
              borderBottom: i < wallets.length - 1 ? `1px solid ${C.border}` : 'none',
              transition: 'background .15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>{i + 1}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Dot active={hot} />
                <span style={{ fontSize: 12, fontFamily: 'monospace', color: C.text, fontWeight: 600 }}>
                  {short(w.walletAddress)}
                </span>
                {isCopying && <Badge color={C.purpleL}>COPIE</Badge>}
              </div>
              <div style={{ textAlign: 'center' }}>
                <ScoreRing score={score} size={32} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textAlign: 'center' }}>
                {fmt(w.winRate)}%
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: pnlColor(w.roi || 0) }}>
                {pnlSign(w.roi || 0)}{fmt(w.roi)}%
              </div>
              <div style={{ fontSize: 12, color: C.muted, textAlign: 'center' }}>
                {w.totalTrades || 0}
              </div>
              <button
                onClick={() => setModal(w)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, transition: 'all .15s', whiteSpace: 'nowrap',
                  background: isCopying ? `rgba(124,58,237,0.18)` : `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
                  color: isCopying ? C.purpleL : '#fff',
                  boxShadow: isCopying ? 'none' : '0 0 12px rgba(124,58,237,0.3)',
                }}
              >
                {isCopying ? 'Gérer' : 'Copier'}
              </button>
            </div>
          );
        })}
      </div>

      {modal && (
        <CopyModal
          wallet={modal}
          config={config}
          balance={balance}
          onClose={() => setModal(null)}
          onSaved={cfg => { onConfigUpdate(cfg); setModal(null); }}
        />
      )}
    </div>
  );
}

// ── Tab: Mes copies ───────────────────────────────────────────────────────────

function TabMyCopies({ config, balance, onConfigUpdate }) {
  const [modal,    setModal]    = useState(null);
  const [stopping, setStopping] = useState(null);

  const followed = config?.followedWallets || [];

  async function unfollow(address) {
    setStopping(address);
    try {
      const res  = await apiFetch('/api/copy/unfollow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onConfigUpdate(data.config);
      toast('Copie arrêtée', 'info');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setStopping(null);
    }
  }

  if (followed.length === 0) {
    return (
      <div style={{ ...card, padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 16 }}>
          Tu ne copies aucun trader pour l'instant.
        </div>
        <a href="#traders" style={{
          display: 'inline-block', padding: '10px 24px', borderRadius: 10,
          background: `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
          color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 0 16px rgba(124,58,237,0.35)',
        }}>🔍 Trouver des traders</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {followed.map(w => (
        <div key={w.address} style={{
          ...card, padding: '16px 20px',
          border: `1px solid ${w.active ? 'rgba(124,58,237,0.2)' : C.border}`,
          display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <Dot active={w.active} size={9} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: C.text }}>
              {short(w.address)}
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
              {w.allocation}% du solde/trade
              {w.nickname ? ` · ${w.nickname}` : ''}
              {w.copiedAt ? ` · depuis ${relTime(w.copiedAt)}` : ''}
            </div>
          </div>

          <Badge color={w.active ? '#22c55e' : C.muted}>
            {w.active ? 'Actif' : 'Pause'}
          </Badge>

          <div style={{ fontSize: 12, color: C.muted }}>
            ~{((balance || 0) * w.allocation / 100).toFixed(2)} USDC max/trade
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setModal({ walletAddress: w.address, winRate: 0, roi: 0, totalTrades: 0, betlyScore: 0 })}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'rgba(124,58,237,0.1)', border: `1px solid rgba(124,58,237,0.3)`,
                color: C.purpleL,
              }}
            >Gérer</button>
            <button
              onClick={() => unfollow(w.address)}
              disabled={stopping === w.address}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444', opacity: stopping === w.address ? 0.5 : 1,
              }}
            >
              {stopping === w.address ? '…' : 'Arrêter'}
            </button>
          </div>
        </div>
      ))}

      {modal && (
        <CopyModal
          wallet={modal}
          config={config}
          balance={balance}
          onClose={() => setModal(null)}
          onSaved={cfg => { onConfigUpdate(cfg); setModal(null); }}
        />
      )}
    </div>
  );
}

// ── Tab: Trades ───────────────────────────────────────────────────────────────

function TabTrades() {
  const [filter, setFilter] = useState('all');
  const path = filter === 'all' ? '/api/copy/trades?limit=50' : `/api/copy/trades?limit=50&status=${filter}`;
  const { data, loading } = useApi(path);
  const trades = data?.trades || [];
  const stats  = data?.stats  || {};

  const STATUS_COLOR = {
    executed: '#22c55e', paper: '#60a5fa',
    failed: '#ef4444', pending: '#f59e0b', cancelled: C.muted,
  };
  const STATUS_LABEL = {
    executed: 'Exécuté', paper: 'Papier',
    failed: 'Échoué', pending: 'En attente', cancelled: 'Annulé',
  };

  const FILTERS = [
    { key: 'all',      label: 'Tous' },
    { key: 'executed', label: 'Réels' },
    { key: 'paper',    label: 'Papier' },
    { key: 'failed',   label: 'Échoués' },
  ];

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
            background: filter === f.key ? `rgba(124,58,237,0.2)` : 'rgba(255,255,255,0.05)',
            color: filter === f.key ? C.purpleL : C.muted, fontWeight: filter === f.key ? 700 : 400,
            border: filter === f.key ? `1px solid rgba(124,58,237,0.4)` : '1px solid transparent',
          }}>{f.label}</button>
        ))}
        {stats.totalPnl !== undefined && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12 }}>
            <span style={{ color: C.muted }}>{stats.total || 0} trades</span>
            <span style={{ fontWeight: 800, color: pnlColor(stats.totalPnl) }}>
              PnL {pnlSign(stats.totalPnl)}{fmt(stats.totalPnl)} USDC
            </span>
          </div>
        )}
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...Array(6)].map((_, i) => <Skeleton key={i} h={52} />)}
          </div>
        ) : trades.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
            Aucun trade pour ce filtre
          </div>
        ) : trades.map((t, i) => (
          <div key={t._id || i} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px',
            borderBottom: i < trades.length - 1 ? `1px solid ${C.border}` : 'none',
            transition: 'background .15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              background: `${STATUS_COLOR[t.status] || C.muted}15`,
              color: STATUS_COLOR[t.status] || C.muted,
              border: `1px solid ${STATUS_COLOR[t.status] || C.muted}30`,
              flexShrink: 0,
            }}>{STATUS_LABEL[t.status] || t.status}</div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.text, fontFamily: 'monospace' }}>{short(t.whaleAddress)}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.marketTitle || '—'}
              </div>
            </div>

            <div style={{ textAlign: 'center', minWidth: 36 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: t.outcome === 'YES' ? '#22c55e' : '#f59e0b' }}>
                {t.outcome}
              </span>
            </div>

            <div style={{ textAlign: 'right', minWidth: 70 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmt(t.amount)} USDC</div>
              {t.pnl !== null && (
                <div style={{ fontSize: 10, color: pnlColor(t.pnl) }}>{pnlSign(t.pnl)}{fmt(t.pnl)}</div>
              )}
            </div>

            <div style={{ fontSize: 10, color: C.muted, width: 44, textAlign: 'right', flexShrink: 0 }}>
              {relTime(t.executedAt)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Alertes ──────────────────────────────────────────────────────────────

function TabAlerts({ config, trades }) {
  const { data, loading } = useApi('/api/copy/alerts?limit=40', 5000);
  const alerts = data?.alerts || [];
  const followed = new Set((config?.followedWallets || []).map(w => w.address?.toLowerCase()));
  const [filterMine, setFilterMine] = useState(false);
  const [copyAlert, setCopyAlert] = useState(null);
  const [copyAmt, setCopyAmt] = useState('10');
  const [copyLoading, setCopyLoading] = useState(false);

  // Track which alerts were auto-copied
  const copiedKeys = new Set(
    (trades?.trades || [])
      .filter(t => t.mode === 'auto' && t.status === 'executed')
      .map(t => `${t.whaleAddress?.toLowerCase()}-${t.marketId}`)
  );

  const displayed = filterMine
    ? alerts.filter(a => followed.has(a.walletAddress?.toLowerCase()))
    : alerts;

  async function handleCopy() {
    if (!copyAlert) return;
    setCopyLoading(true);
    try {
      const res = await apiFetch('/api/copy/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whaleAddress: copyAlert.walletAddress,
          marketId: copyAlert.marketId || copyAlert.id,
          marketTitle: copyAlert.question || copyAlert.marketTitle || '',
          outcome: copyAlert.outcome || copyAlert.side || 'YES',
          amount: parseFloat(copyAmt),
          price: copyAlert.price || 0,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Erreur');
      toast(`Trade copié ! ${copyAlert.side === 'YES' ? 'OUI' : 'NON'} $${copyAmt}`, 'success');
      setCopyAlert(null);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCopyLoading(false);
    }
  }

  return (
    <div style={card}>
      <div style={{
        padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Trades détectés en temps réel</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setFilterMine(v => !v)}
            style={{
              padding: '3px 10px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${filterMine ? C.purpleL : C.border}`,
              background: filterMine ? 'rgba(124,58,237,0.15)' : 'transparent',
              color: filterMine ? C.purpleL : C.muted, transition: 'all .15s',
            }}
          >
            {filterMine ? '★ Mes whales' : '☆ Mes whales'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#22c55e' }}>
            <Dot active /> Polling 5s
          </div>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => <Skeleton key={i} h={56} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', color: C.muted, fontSize: 13 }}>
          {filterMine ? 'Aucun trade de tes whales pour le moment' : 'En attente de trades… · Polling actif'}
        </div>
      ) : displayed.map((a, i) => {
        const isFollowed = followed.has(a.walletAddress?.toLowerCase());
        const autoCopied = copiedKeys.has(`${a.walletAddress?.toLowerCase()}-${a.marketId || a.id}`);
        return (
          <div key={a._id || a.id || i} style={{
            display: 'flex', gap: 12, padding: '12px 18px', alignItems: 'flex-start',
            borderBottom: i < displayed.length - 1 ? `1px solid ${C.border}` : 'none',
            background: isFollowed ? 'rgba(124,58,237,0.03)' : 'transparent',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: isFollowed ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
            }}>
              {isFollowed ? '🔗' : '🐋'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>
                <span style={{ fontFamily: 'monospace', color: C.dim }}>{short(a.walletAddress)}</span>
                {' → '}
                <span style={{ fontWeight: 800, color: a.side === 'YES' || a.outcome === 'Yes' ? '#22c55e' : '#f59e0b' }}>
                  {a.side === 'YES' || a.outcome === 'Yes' ? 'OUI' : 'NON'}
                </span>
                {' '}
                <span style={{ fontWeight: 700, color: C.text }}>{a.amount || '?'} USDC</span>
                {' sur '}
                <span style={{ color: C.muted }}>{(a.question || a.marketTitle || '').slice(0, 50)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: C.muted }}>{relTime(a.time || a.createdAt || a.detectedAt)}</span>
                {isFollowed && <Badge color={C.purpleL} style={{ fontSize: 9 }}>Suivi</Badge>}
                {autoCopied && <Badge color="#22c55e" style={{ fontSize: 9 }}>Auto-copié</Badge>}
                {isFollowed && !autoCopied && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setCopyAlert(a); setCopyAmt(String(config?.maxPerTrade || 10)); }}
                    className="btn-press"
                    style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                      background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
                      color: '#a855f7', transition: 'all .15s',
                    }}
                  >
                    Copier
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Quick copy modal */}
      {copyAlert && (
        <>
          <div onClick={() => setCopyAlert(null)} style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 801, width: 340, maxWidth: 'calc(100vw - 32px)',
            background: C.card, border: `1px solid rgba(124,58,237,0.35)`,
            borderRadius: 18, padding: 24,
            boxShadow: '0 32px 80px rgba(0,0,0,.8), 0 0 40px rgba(124,58,237,0.1)',
            animation: 'modal-in .2s ease',
          }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text, marginBottom: 6 }}>Copier ce trade</div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, lineHeight: 1.6 }}>
              <span style={{ fontFamily: 'monospace' }}>{short(copyAlert.walletAddress)}</span>
              {' → '}
              <span style={{ fontWeight: 700, color: (copyAlert.side === 'YES' || copyAlert.outcome === 'Yes') ? '#22c55e' : '#f59e0b' }}>
                {(copyAlert.side === 'YES' || copyAlert.outcome === 'Yes') ? 'OUI' : 'NON'}
              </span>
              {' · '}
              {(copyAlert.question || copyAlert.marketTitle || '').slice(0, 45)}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: C.dim }}>Montant</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.purpleL }}>${copyAmt} USDC</span>
              </div>
              <input
                type="range" min="1" max={config?.maxPerTrade || 100} step="1"
                value={copyAmt}
                onChange={e => setCopyAmt(e.target.value)}
                style={{ width: '100%', accentColor: C.purpleL }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[5, 10, 25, 50].map(a => (
                  <button key={a} onClick={() => setCopyAmt(String(a))} style={{
                    flex: 1, padding: '3px 0', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: String(copyAmt) === String(a) ? 'rgba(168,85,247,0.2)' : 'transparent',
                    color: String(copyAmt) === String(a) ? '#a855f7' : '#64748b',
                  }}>
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCopyAlert(null)} style={{
                flex: 1, padding: '10px', borderRadius: 10,
                background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
                color: C.muted, cursor: 'pointer', fontSize: 12,
              }}>Annuler</button>
              <button onClick={handleCopy} disabled={copyLoading} className="btn-press" style={{
                flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                background: copyLoading ? 'rgba(124,58,237,0.4)' : `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
                color: '#fff', cursor: copyLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800,
                boxShadow: copyLoading ? 'none' : '0 0 20px rgba(124,58,237,0.4)',
                transition: 'all .2s',
              }}>
                {copyLoading ? 'Envoi…' : `Confirmer $${copyAmt}`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab: Paramètres ───────────────────────────────────────────────────────────

function TabSettings({ config, onConfigUpdate }) {
  const [form,    setForm]    = useState({
    copyEnabled:    config?.copyEnabled    ?? false,
    mode:           config?.mode           ?? 'auto',
    paperMode:      config?.paperMode      ?? false,
    maxPerTrade:    config?.maxPerTrade    ?? 10,
    dailyLossLimit: config?.dailyLossLimit ?? 50,
  });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res  = await apiFetch('/api/copy/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onConfigUpdate(data.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast('Paramètres sauvegardés', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  const Section = ({ title, children }) => (
    <div style={{ ...card, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section title="Activation">
        <Toggle value={form.copyEnabled} onChange={v => setForm(f => ({ ...f, copyEnabled: v }))} label="Copy trading actif" />
        <Toggle value={form.paperMode} onChange={v => setForm(f => ({ ...f, paperMode: v }))} label="📝 Mode papier (simulation sans argent réel)" />
      </Section>

      <Section title="Mode d'exécution">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[['auto','⚡ Automatique','Copie instantanée sans validation'], ['manual','👆 Manuel','Tu valides chaque trade']].map(([key, label, desc]) => (
            <button key={key} onClick={() => setForm(f => ({ ...f, mode: key }))} style={{
              padding: '14px', borderRadius: 10, cursor: 'pointer',
              background: form.mode === key ? `linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.1))` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${form.mode === key ? 'rgba(124,58,237,0.5)' : C.border}`,
              textAlign: 'left', transition: 'all .15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: form.mode === key ? C.purpleL : C.dim, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{desc}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Risk Management">
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.dim }}>Max par trade</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.purpleL }}>{form.maxPerTrade} USDC</span>
          </div>
          <input type="range" min={1} max={500} step={1} value={form.maxPerTrade}
            onChange={e => setForm(f => ({ ...f, maxPerTrade: +e.target.value }))}
            style={{ width: '100%', accentColor: C.purpleL }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 4 }}>
            <span>1 USDC</span><span>100</span><span>250</span><span>500 USDC</span>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: C.dim }}>Stop-loss journalier</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#ef4444' }}>{form.dailyLossLimit} USDC</span>
          </div>
          <input type="range" min={5} max={1000} step={5} value={form.dailyLossLimit}
            onChange={e => setForm(f => ({ ...f, dailyLossLimit: +e.target.value }))}
            style={{ width: '100%', accentColor: '#ef4444' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#334155', marginTop: 4 }}>
            <span>5 USDC</span><span>100</span><span>500</span><span>1000 USDC</span>
          </div>
        </div>
      </Section>

      <Section title="Telegram">
        <TelegramLink />
      </Section>

      <button onClick={save} disabled={saving} style={{
        width: '100%', padding: '13px', borderRadius: 12, border: 'none',
        background: saved ? 'linear-gradient(135deg, #16a34a, #22c55e)' : saving ? 'rgba(124,58,237,0.4)' : `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
        color: '#fff', fontSize: 14, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer',
        boxShadow: saving || saved ? 'none' : '0 0 24px rgba(124,58,237,0.4)',
        transition: 'all .25s',
      }}>
        {saving ? 'Enregistrement…' : saved ? '✓ Sauvegardé' : 'Sauvegarder les paramètres'}
      </button>
    </div>
  );
}

// ── Telegram Link Widget ─────────────────────────────────────────────────────

function TelegramLink() {
  const { user } = useAuth();
  const [code, setCode]       = useState(null);
  const [loading, setLoading] = useState(false);
  const linked = !!user?.telegramId;

  async function generateCode() {
    setLoading(true);
    try {
      const res = await apiFetch('/api/telegram/link-code', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCode(data.code);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  if (linked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.06)' }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>Telegram lié</div>
          <div style={{ fontSize: 11, color: C.muted }}>ID : {user.telegramId}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)' }}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 10, lineHeight: 1.6 }}>
        Lie ton compte Telegram pour recevoir les alertes et gérer tes copies depuis le bot.
      </div>
      {code ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>Envoie cette commande au bot :</div>
          <div style={{
            padding: '10px 18px', borderRadius: 8, background: 'rgba(124,58,237,0.1)',
            border: '1px solid rgba(124,58,237,0.3)', display: 'inline-block',
            fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: C.purpleL, letterSpacing: '.05em',
          }}>
            /link {code}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 8 }}>Expire dans 10 minutes</div>
        </div>
      ) : (
        <button onClick={generateCode} disabled={loading} className="btn-press" style={{
          width: '100%', padding: '10px', borderRadius: 10, border: 'none',
          background: loading ? 'rgba(124,58,237,0.3)' : `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`,
          color: '#fff', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all .2s',
        }}>
          {loading ? 'Génération…' : '🔗 Générer un code de liaison'}
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function BetlyCopy() {
  const { user } = useAuth();
  const [tab,    setTab]    = useState('dashboard');
  const [config, setConfig] = useState(null);

  const { data: statsData, loading: statsLoading } = useApi('/api/copy/stats',  30000);
  const { data: cfgData,   loading: cfgLoading   } = useApi('/api/copy/config');
  const { data: tradesData                        } = useApi('/api/copy/trades?limit=50', 15000);

  useEffect(() => { if (cfgData?.config) setConfig(cfgData.config); }, [cfgData]);

  const isReady   = !cfgLoading && !statsLoading;
  const hasWallet = !!user?.walletAddress;
  const isMobile  = typeof window !== 'undefined' && window.innerWidth < 640;

  const TABS = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'traders',   label: '🏆 Traders'   },
    { key: 'mine',      label: '🔗 Mes copies', count: (config?.followedWallets || []).length },
    { key: 'trades',    label: '📋 Trades'     },
    { key: 'alerts',    label: '🔔 Alertes'    },
    { key: 'settings',  label: '⚙️ Paramètres'  },
  ];

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: isMobile ? '16px 12px 80px' : '28px 20px 48px' }}>
      <style>{`
        @keyframes sk          { 0%,100%{opacity:.4}50%{opacity:.8} }
        @keyframes pulse-dot   { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.6)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)} }
        @keyframes modal-in    { from{opacity:0;transform:translate(-50%,-50%) scale(.95)}to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/betly-icon.png" alt="BETLY" style={{ width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: 10, flexShrink: 0 }} />
          <div>
            <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: C.text, margin: '0 0 4px' }}>
              BETLY <span style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.purpleL})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Copy</span>
            </h1>
            <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
              Cockpit copy-trading Polymarket · Données en temps réel
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {config?.paperMode && <Badge color="#60a5fa">📝 Paper mode</Badge>}
          <div style={{
            display: 'flex', gap: 6, padding: '6px 12px', borderRadius: 99,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            alignItems: 'center',
          }}>
            <Dot active />
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>Live</span>
          </div>
        </div>
      </div>

      {/* Setup banner */}
      {isReady && (
        <SetupBanner user={user} config={config} onActivate={setConfig} />
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 20, overflowX: 'auto',
        borderBottom: `1px solid ${C.border}`,
        scrollbarWidth: 'none',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 16px', borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
            background: tab === t.key ? 'rgba(124,58,237,0.12)' : 'transparent',
            color: tab === t.key ? C.purpleL : C.muted,
            fontSize: isMobile ? 11 : 13, fontWeight: tab === t.key ? 700 : 400,
            borderBottom: tab === t.key ? `2px solid ${C.purpleL}` : '2px solid transparent',
            marginBottom: -1,
            transition: 'all .15s', whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            {t.label}
            {t.count > 0 && (
              <span style={{
                background: tab === t.key ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)',
                color: tab === t.key ? '#c4b5fd' : '#475569',
                borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 700,
              }}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {!isReady ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[...Array(4)].map((_, i) => <Skeleton key={i} h={80} />)}
        </div>
      ) : (
        <>
          {tab === 'dashboard' && (
            <TabDashboard
              stats={statsData}
              config={config}
              trades={tradesData}
              onTabChange={setTab}
            />
          )}
          {tab === 'traders' && (
            <TabTraders
              config={config}
              balance={user?.balance || 0}
              onConfigUpdate={setConfig}
            />
          )}
          {tab === 'mine' && (
            <TabMyCopies
              config={config}
              balance={user?.balance || 0}
              onConfigUpdate={setConfig}
            />
          )}
          {tab === 'trades'   && <TabTrades />}
          {tab === 'alerts'   && <TabAlerts config={config} trades={tradesData} />}
          {tab === 'settings' && (
            <TabSettings config={config || {}} onConfigUpdate={setConfig} />
          )}
        </>
      )}
    </div>
  );
}
