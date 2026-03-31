import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useApi, useUserId } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import ConfidenceBadge from '../components/ConfidenceBadge';
import AiAnalysis from '../components/AiAnalysis';
import CopyTradeButton from '../components/CopyTradeButton';
import { toast } from '../components/ToastManager';
import ReportButton from '../components/ReportButton';
import BetShareCard from '../components/BetShareCard';
import ShareModal from '../components/ShareModal';
import { apiFetch } from '../lib/api';
import { fireWin } from '../utils/confetti';
import { usePlaceBet } from '../hooks/usePlaceBet';
import { useClaimWinnings } from '../hooks/useClaimWinnings';
import { useMarketOnChain } from '../hooks/useMarketOnChain';
import { useAccount } from 'wagmi';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BetlyLoaderFullPage } from '../components/BetlyLoader';

// ── Share Button ──────────────────────────────────────────────────────────────
function ShareButton({ market, yes, volume }) {
  const [open, setOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function close(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => { setCopied(false); setOpen(false); }, 1500);
  }

  function shareOnX() {
    const url   = window.location.href;
    const title = market?.title || '';
    const text  = `Je parie OUI sur "${title.slice(0, 60)}" à ${yes}%\nRejoins BETLY → ${url}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          padding: '5px 12px', borderRadius: 8,
          background: open ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
          color: open ? '#a855f7' : '#64748b',
          fontSize: 12, cursor: 'pointer', transition: 'all .2s',
          display: 'flex', alignItems: 'center', gap: 5,
        }}
      >
        Partager
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: 6, minWidth: 180,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <button
            onClick={copyLink}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 7,
              background: copied ? 'rgba(34,197,94,0.15)' : 'transparent',
              border: 'none', color: copied ? '#22c55e' : '#e2e8f0',
              fontSize: 13, cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s',
            }}
            onMouseEnter={e => { if (!copied) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
            onMouseLeave={e => { if (!copied) e.currentTarget.style.background = 'transparent'; }}
          >
            {copied ? '✓ Copié !' : 'Copier le lien'}
          </button>
          <button
            onClick={shareOnX}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 7,
              background: 'transparent', border: 'none', color: '#e2e8f0',
              fontSize: 13, cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 8, transition: 'background .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            𝕏 Partager sur X
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_STYLE = {
  sport:     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', emoji: '' },
  crypto:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  emoji: ''  },
  politique: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', emoji: '' },
  culture:   { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', emoji: '' },
  autre:     { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  emoji: '' },
};

function timeLeft(deadline) {
  if (!deadline) return '—';
  const d = new Date(deadline) - Date.now();
  if (d <= 0) return 'Terminé';
  const days = Math.floor(d / 86400000);
  const hrs  = Math.floor((d % 86400000) / 3600000);
  if (days > 0) return `${days}j ${hrs}h`;
  const mins = Math.floor((d % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function avatarColor(str = '') {
  const palette = ['#7c3aed','#0891b2','#059669','#b45309','#be185d','#1d4ed8','#c2410c','#6d28d9'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

// ── SVG Probability Chart ─────────────────────────────────────────────────────
function ProbChart({ yesPct, compact = false }) {
  const W = 600, H = compact ? 50 : 80, pts = 40;
  // Seeded deterministic path trending toward yesPct
  const seed = Math.round(yesPct * 100);
  const points = Array.from({ length: pts }, (_, i) => {
    const base = 50 + (yesPct - 50) * (i / (pts - 1));
    const noise = (((seed * (i + 7) * 2654435761) >>> 0) % 200 - 100) / 100 * 8 * (1 - i / pts);
    return Math.max(5, Math.min(95, base + noise));
  });

  const toX = i => (i / (pts - 1)) * W;
  const toY = v => H - (v / 100) * H;

  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  const area = d + ` L${W},${H} L0,${H} Z`;

  const lastY = toY(points[pts - 1]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: compact ? 50 : 80, display: 'block' }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#chartGrad)" />
        <path d={d} fill="none" stroke="#a855f7" strokeWidth="2" />
        {/* Current dot */}
        <circle cx={W} cy={lastY} r="4" fill="#a855f7" />
      </svg>
      {/* Y-axis labels */}
      <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: compact ? 50 : 80, pointerEvents: 'none' }}>
        {[100, 50, 0].map(v => (
          <span key={v} style={{ fontSize: 9, color: '#6060a0', lineHeight: 1 }}>{v}%</span>
        ))}
      </div>
    </div>
  );
}

// ── Real Price Chart (Recharts) ───────────────────────────────────────────────
const TIMEFRAMES = [
  { label: '24h', hours: 24 },
  { label: '7j',  hours: 168 },
  { label: 'Tout', hours: 0 },
];

function PriceChartReal({ marketId, yesPct }) {
  const [snapshots, setSnapshots] = useState([]);
  const [tf, setTf]               = useState('24h');
  const [loaded, setLoaded]       = useState(false);
  const base = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    if (!marketId || marketId.startsWith('mock-')) { setLoaded(true); return; }
    const hours = TIMEFRAMES.find(t => t.label === tf)?.hours || 24;
    fetch(`${base}/api/markets/${marketId}/snapshots?hours=${hours}`)
      .then(r => r.json())
      .then(d => { setSnapshots(d.snapshots || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [marketId, tf]);

  const hasData = loaded && snapshots.length >= 2;

  function formatTime(ts) {
    const d = new Date(ts);
    return tf === '24h'
      ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          Probabilité OUI · {hasData ? 'historique réel' : 'estimée'}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {TIMEFRAMES.map(t => (
            <button
              key={t.label}
              onClick={() => setTf(t.label)}
              style={{
                padding: '2px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10,
                background: tf === t.label ? 'rgba(168,85,247,0.2)' : 'transparent',
                color: tf === t.label ? '#a855f7' : '#475569',
                fontWeight: tf === t.label ? 700 : 400,
              }}
            >
              {t.label}
            </button>
          ))}
          <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7', marginLeft: 6 }}>{yesPct}%</span>
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={snapshots} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
            <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 9, fill: '#475569' }} interval="preserveStartEnd" />
            <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#475569' }} />
            <Tooltip
              formatter={(v) => [`${v.toFixed(1)}%`, 'OUI']}
              labelFormatter={formatTime}
              contentStyle={{ background: '#111118', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
            />
            <Line type="monotone" dataKey="priceYes" stroke="#a855f7" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ProbChart yesPct={yesPct} />
      )}
    </div>
  );
}

// ── YES/NO Big Bars ───────────────────────────────────────────────────────────
function BigBars({ yes, no, yesVol, noVol }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* YES */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
          <span style={{ fontWeight: 700, color: '#a855f7' }}>OUI {yes}%</span>
          <span style={{ color: '#6060a0', fontSize: 11 }}>{yesVol?.toFixed(0) || 0} USDC</span>
        </div>
        <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${yes}%`,
            background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
            borderRadius: 999,
            transition: 'width .6s ease',
          }} />
        </div>
      </div>
      {/* NO */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
          <span style={{ fontWeight: 700, color: '#94a3b8' }}>NON {no}%</span>
          <span style={{ color: '#6060a0', fontSize: 11 }}>{noVol?.toFixed(0) || 0} USDC</span>
        </div>
        <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${no}%`,
            background: 'rgba(148,163,184,0.35)',
            borderRadius: 999,
            transition: 'width .6s ease',
          }} />
        </div>
      </div>
    </div>
  );
}

// ── Bet Form ──────────────────────────────────────────────────────────────────
function BetForm({ marketId, userId, onBetPlaced, market }) {
  const { refreshUser, openAuth } = useAuth();
  const [side, setSide]       = useState('YES');
  const [amount, setAmount]   = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState(null);
  const [quote, setQuote]     = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [needConfirm, setNeedConfirm]   = useState(false);
  const [showOnChainConfirm, setShowOnChainConfirm] = useState(false);
  const [shareBet, setShareBet]         = useState(null);
  const quoteTimer = useRef(null);

  // On-chain hook (always called, React rules)
  const onChain = market?.onChainId != null;
  const { placeBet: placeBetOnChain, status: onChainStatus } = usePlaceBet();
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const { setShowAuthFlow } = useDynamicContext();

  const PRESETS = [1, 2, 5, 10];
  const base = import.meta.env.VITE_API_URL || '';

  // Debounced quote fetch — only for off-chain markets
  useEffect(() => {
    if (onChain) return; // skip API quote for on-chain
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setQuote(null); return; }
    setQuoteLoading(true);
    clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${base}/api/markets/${marketId}/quote?side=${side}&amount=${amt}`);
        const d = await r.json();
        setQuote(r.ok ? d : null);
      } catch { setQuote(null); }
      finally { setQuoteLoading(false); }
    }, 300);
    return () => clearTimeout(quoteTimer.current);
  }, [amount, side, marketId, onChain]);

  async function place() {
    const amt = parseFloat(amount);
    console.log('[BET DEBUG]', {
      amt, side, onChain,
      onChainId: market?.onChainId,
      walletConnected, walletAddress,
      userId,
      hasPlaceBetFn: !!placeBetOnChain,
      onChainStatus,
    });
    if (!amt || amt <= 0) { setMsg({ type: 'err', text: 'Montant invalide' }); return; }

    // ── ON-CHAIN BET ──────────────────────────────────────────────
    if (onChain && placeBetOnChain) {
      console.log('[BET DEBUG] on-chain path — walletConnected:', walletConnected, 'walletAddress:', walletAddress);
      if (!walletConnected) { setMsg({ type: 'err', text: 'Connecte ton wallet MetaMask pour parier on-chain' }); setShowAuthFlow(true); return; }
      // Show confirmation dialog before executing
      if (!showOnChainConfirm) { setShowOnChainConfirm(true); return; }
      setShowOnChainConfirm(false);
      setLoading(true); setMsg(null);
      try {
        console.log('[BET DEBUG] calling placeBetOnChain —', { marketId: market.onChainId, side, amt });
        const txHash = await placeBetOnChain(market.onChainId, side, amt);
        const sideLabel = side === 'YES' ? 'Oui' : 'Non';
        // Record on-chain bet in DB so positions page can show it
        try {
          await apiFetch(`/api/markets/${marketId}/bet-onchain`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ side, amount: amt, txHash, walletAddress }),
          });
        } catch (dbErr) {
          console.warn('[BET] DB record failed (bet is still on-chain):', dbErr.message);
        }
        setMsg({ type: 'ok', text: `Pari on-chain placé : $${amt} sur ${sideLabel}`, link: '/positions', txHash });
        toast(`$${amt} sur ${sideLabel} — tx confirmée !`, 'success', 5000);
        fireWin();
        setAmount('');
        refreshUser?.();
        onBetPlaced?.();
      } catch (e) {
        setMsg({ type: 'err', text: e.shortMessage || e.message || 'Transaction échouée' });
      } finally {
        setLoading(false);
      }
      return;
    }

    // ── OFF-CHAIN BET (fallback for markets without onChainId) ──
    if (!userId) { setMsg({ type: 'err', text: 'Connecte-toi pour parier' }); openAuth(); return; }

    if (quote?.warning === 'high' && !needConfirm) {
      setNeedConfirm(true);
      setMsg({ type: 'warn', text: 'Slippage > 15% ! Clique à nouveau pour confirmer malgré tout.' });
      return;
    }

    setLoading(true); setMsg(null); setNeedConfirm(false);

    const orderId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const res = await apiFetch(`/api/markets/${marketId}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side, amount: amt, orderId }),
      });
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || json.message || `Erreur ${res.status}`);

      const potential = quote?.potentialPayout || json.bet?.potentialPayout || 0;
      const gain = potential > 0 ? potential - amt : 0;
      const isHighGain = potential > 0 && potential / amt >= 2;
      const sideLabel = side === 'YES' ? 'Oui' : 'Non';

      if (json.isPartial) {
        setMsg({ type: 'ok', text: `Mise partielle : $${json.filledAmount} sur $${amt}`, link: '/positions' });
        toast(`Mise partielle : $${json.filledAmount}/${amt} sur ${sideLabel}`, 'success', 4000);
      } else {
        const gainTxt = gain > 0 ? ` — gain potentiel +$${gain.toFixed(2)}` : '';
        setMsg({ type: 'ok', text: `Pari placé : $${amt} sur ${sideLabel}${gainTxt}`, link: '/positions' });
        toast(`$${amt} sur ${sideLabel} placé !`, 'success', 4000);
        if (isHighGain) fireWin();
      }
      setAmount(''); setQuote(null);
      refreshUser?.();
      onBetPlaced?.();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }

  const amt = parseFloat(amount) || 0;
  const warn = quote?.warning;
  const isApproving = onChainStatus === 'approving';
  const isBetting   = onChainStatus === 'betting' || loading;

  // Button label
  let btnLabel = 'Entrer un montant';
  if (isBetting || isApproving) btnLabel = isApproving ? 'Approbation USDC...' : 'Transaction en cours...';
  else if (needConfirm) btnLabel = 'Confirmer malgré le slippage';
  else if (amt > 0) btnLabel = onChain
    ? `Parier $${amt.toFixed(2)} sur ${side === 'YES' ? 'Oui' : 'Non'} (on-chain)`
    : `Parier $${amt.toFixed(2)} sur ${side === 'YES' ? 'Oui' : 'Non'}`;

  return (
    <>
    {shareBet && (
      <ShareModal
        variant="placed"
        bet={shareBet}
        market={market}
        onClose={() => setShareBet(null)}
      />
    )}

    {/* ── On-chain confirmation dialog ── */}
    {showOnChainConfirm && (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }} onClick={() => setShowOnChainConfirm(false)}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#111118', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: '28px 24px', maxWidth: 380, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,.6)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 20, textAlign: 'center' }}>
            Confirmer ton pari
          </div>

          {/* Side indicator — big and unmissable */}
          <div style={{
            padding: '16px 20px', borderRadius: 12, marginBottom: 16, textAlign: 'center',
            background: side === 'YES' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `2px solid ${side === 'YES' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>Tu paries sur</div>
            <div style={{
              fontSize: 28, fontWeight: 900,
              color: side === 'YES' ? '#22c55e' : '#ef4444',
            }}>
              {side === 'YES' ? 'OUI' : 'NON'}
            </div>
          </div>

          {/* Market title */}
          <div style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 16,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Marché</div>
            <div style={{ fontSize: 13, color: '#e2e2e8', fontWeight: 600 }}>{market?.title}</div>
          </div>

          {/* Amount */}
          <div style={{
            padding: '12px 14px', borderRadius: 10, marginBottom: 20,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>Montant</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>${parseFloat(amount).toFixed(2)} USDC</span>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setShowOnChainConfirm(false)}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}
            >
              Annuler
            </button>
            <button
              onClick={place}
              style={{
                flex: 1, padding: '13px 0', borderRadius: 10, border: 'none',
                background: side === 'YES'
                  ? 'linear-gradient(135deg,#15803d,#22c55e)'
                  : 'linear-gradient(135deg,#b91c1c,#ef4444)',
                color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 14,
              }}
            >
              Confirmer
            </button>
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#64748b', textAlign: 'center' }}>
            USDC sera prélevé de ton wallet via le smart contract
          </div>
        </div>
      </div>
    )}

    <div style={{ background: '#0f0f1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
      {/* On-chain badge */}
      {onChain && (
        <div style={{
          padding: '6px 14px', fontSize: 11, fontWeight: 700,
          background: 'rgba(34,197,94,0.06)', color: '#22c55e',
          borderBottom: '1px solid rgba(34,197,94,0.15)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          On-chain — USDC prélevé depuis ton wallet
        </div>
      )}

      {/* Side tabs — large, unmissable */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {['YES', 'NO'].map(s => {
          const active = side === s;
          const isYes = s === 'YES';
          const activeColor = isYes ? '#22c55e' : '#ef4444';
          return (
            <button key={s} onClick={() => { setSide(s); setNeedConfirm(false); setShowOnChainConfirm(false); }} style={{
              flex: 1, padding: '16px 0', cursor: 'pointer',
              fontWeight: 800, fontSize: 16, letterSpacing: '0.03em',
              border: 'none', transition: 'all .15s',
              borderBottom: active ? `3px solid ${activeColor}` : '3px solid transparent',
              background: active ? (isYes ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)') : 'transparent',
              color: active ? activeColor : '#4a4a5a',
              textTransform: 'uppercase',
            }}>
              {active && (isYes ? '\u2713 ' : '\u2717 ')}
              {isYes ? 'Oui' : 'Non'}
              {quote ? ` ${(quote.currentOdds * 100).toFixed(0)}¢` : ''}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '18px 18px 20px' }}>
        {/* Amount input — clean, large */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 500 }}>Montant</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10, overflow: 'hidden', transition: 'border-color .15s',
          }}>
            <span style={{
              padding: '0 12px', fontSize: 14, color: '#64748b', fontWeight: 600,
              borderRight: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', height: 44,
            }}>$</span>
            <input
              type="number" min="0.01" step="0.01" value={amount}
              onChange={e => { setAmount(e.target.value); setNeedConfirm(false); }}
              placeholder="0.00"
              style={{
                flex: 1, padding: '12px 14px', border: 'none', background: 'transparent',
                color: '#f8fafc', fontSize: 18, fontWeight: 700, outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <span style={{ padding: '0 14px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>USDC</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {PRESETS.map(p => {
              const selected = amount === String(p);
              return (
                <button key={p} onClick={() => { setAmount(String(p)); setNeedConfirm(false); }} style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  border: selected ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                  background: selected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                  color: selected ? '#a855f7' : '#94a3b8',
                }}>
                  ${p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quote / breakdown */}
        {amt > 0 && !onChain && (
          <div style={{ marginBottom: 14 }}>
            {quoteLoading ? (
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                Calcul du prix...
              </div>
            ) : quote ? (
              <>
                {warn && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 8, marginBottom: 8, fontSize: 12, fontWeight: 600,
                    background: warn === 'high' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${warn === 'high' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    color: warn === 'high' ? '#ef4444' : '#f59e0b',
                  }}>
                    {warn === 'high'
                      ? `Slippage ${quote.slippage?.toFixed(1)}% — prix volatile`
                      : `Slippage ${quote.slippage?.toFixed(1)}%`}
                  </div>
                )}
                <div style={{
                  padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Prix moyen</span>
                    <span style={{ color: '#e2e2e8', fontWeight: 600 }}>{(quote.currentOdds * 100).toFixed(1)}¢</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                    <span>Gain potentiel</span>
                    <span style={{ color: '#22c55e', fontWeight: 700 }}>
                      ${quote.potentialPayout?.toFixed(2)} <span style={{ fontSize: 11, color: '#64748b', fontWeight: 400 }}>({((quote.potentialPayout / amt - 1) * 100).toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>Gain net</span>
                    <span style={{ fontWeight: 800, color: '#22c55e', fontSize: 15 }}>+${quote.netProfit?.toFixed(2)}</span>
                  </div>
                </div>
              </>
            ) : (
              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(124,58,237,0.06)',
                fontSize: 12, color: '#a78bfa', textAlign: 'center',
              }}>
                Gain estimé : ~${(amt * 1.85).toFixed(2)} USDC
              </div>
            )}
          </div>
        )}

        {/* On-chain: simple payout estimate */}
        {amt > 0 && onChain && (
          <div style={{
            marginBottom: 14, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
            fontSize: 12, color: '#22c55e',
          }}>
            Pari on-chain — ${amt.toFixed(2)} USDC seront prélevés de ton wallet via le smart contract.
            <br /><span style={{ color: '#64748b' }}>Fee: 2% • Payout proportionnel au pool total.</span>
          </div>
        )}

        {/* Place bet button */}
        <button
          onClick={place} disabled={isBetting || isApproving}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 10, border: 'none',
            background: (isBetting || isApproving) ? 'rgba(255,255,255,0.05)'
              : needConfirm ? 'linear-gradient(135deg,#b91c1c,#ef4444)'
              : side === 'YES' ? 'linear-gradient(135deg,#15803d,#22c55e)' : 'linear-gradient(135deg,#b91c1c,#ef4444)',
            color: (isBetting || isApproving) ? '#64748b' : '#fff',
            cursor: (isBetting || isApproving) ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 15,
            transition: 'all .15s',
          }}
        >
          {btnLabel}
        </button>

        {msg && (
          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: msg.type === 'ok' ? 'rgba(34,197,94,0.08)' : msg.type === 'warn' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${msg.type === 'ok' ? 'rgba(34,197,94,0.2)' : msg.type === 'warn' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: msg.type === 'ok' ? '#22c55e' : msg.type === 'warn' ? '#f59e0b' : '#ef4444',
          }}>
            {msg.text}
            {msg.txHash && (
              <a href={`https://www.oklink.com/amoy/tx/${msg.txHash}`} target="_blank" rel="noopener noreferrer" style={{
                display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700,
                color: '#60a5fa', textDecoration: 'none',
              }}>
                Voir la transaction →
              </a>
            )}
            {msg.link && (
              <a href={msg.link} style={{
                display: 'block', marginTop: 6, fontSize: 11, fontWeight: 700,
                color: '#a855f7', textDecoration: 'none',
              }}>
                Voir mes positions →
              </a>
            )}
          </div>
        )}


      </div>
    </div>
    </>
  );
}

// ── Comments Section ──────────────────────────────────────────────────────────
function Comments({ marketId, userId }) {
  const { openAuth } = useAuth();
  const { data, loading, refetch } = useApi(`/api/markets/${marketId}/comments`);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const comments = data?.comments || [];

  async function postComment() {
    if (!text.trim()) return;
    if (!userId) { toast('Connecte-toi pour commenter !', 'warning'); openAuth(); return; }
    setPosting(true);
    try {
      await apiFetch(`/api/markets/${marketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text.trim() }),
      });
      setText('');
      refetch();
    } finally {
      setPosting(false);
    }
  }

  async function likeComment(commentId) {
    const base = import.meta.env.VITE_API_URL || '';
    await fetch(`${base}/api/comments/${commentId}/like`, { method: 'POST' });
    refetch();
  }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 16 }}>
        Commentaires <span style={{ color: '#64748b', fontWeight: 400, fontSize: 12 }}>({comments.length})</span>
      </div>

      {/* Post */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: userId ? avatarColor(userId) : '#2a2a3a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: '#fff',
        }}>
          {userId ? userId.slice(0, 2).toUpperCase() : '?'}
        </div>
        <div style={{ flex: 1 }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Ton analyse, ta prédiction..."
            rows={2}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#f8fafc', fontSize: 13, resize: 'none',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button
            onClick={postComment}
            disabled={posting || !text.trim()}
            style={{
              marginTop: 6, padding: '6px 14px', borderRadius: 7,
              background: text.trim() ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(124,58,237,0.3)',
              color: text.trim() ? '#a855f7' : '#64748b',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {posting ? 'Envoi...' : 'Commenter'}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>Chargement...</div>
      ) : comments.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          Sois le premier à commenter
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {comments.map(c => (
            <div
              key={c._id}
              style={{
                display: 'flex', gap: 10,
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(c.userId || ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {(c.userId || '?').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                    {(c.userId || 'anon').slice(0, 8)}
                  </span>
                  <span style={{ fontSize: 10, color: '#64748b' }}>
                    {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <button
                    onClick={() => likeComment(c._id)}
                    style={{
                      background: 'none', border: 'none',
                      cursor: 'pointer', color: '#64748b', fontSize: 11, padding: 0,
                    }}
                  >
                    ♡ {c.likes || 0}
                  </button>
                  <ReportButton commentId={c._id} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Community Vote ────────────────────────────────────────────────────────────
function CommunityVote({ marketId, userId }) {
  const { openAuth } = useAuth();
  const { data, refetch } = useApi(`/api/markets/${marketId}/votes`);
  const [voting, setVoting] = useState(false);

  const yesCount = data?.yesCount || 0;
  const noCount  = data?.noCount  || 0;
  const total    = yesCount + noCount;
  const yesPct   = total > 0 ? Math.round((yesCount / total) * 100) : 50;
  const userVote = data?.userVote;

  async function vote(side) {
    if (!userId) { toast('Connecte-toi pour voter !', 'warning'); openAuth(); return; }
    setVoting(true);
    try {
      await apiFetch(`/api/markets/${marketId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: side }),
      });
      refetch();
    } finally {
      setVoting(false);
    }
  }

  return (
    <div style={{
      background: '#0f0f1a',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>
        Vote communautaire (L3)
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {['YES', 'NO'].map(s => (
          <button
            key={s}
            onClick={() => vote(s)}
            disabled={voting || !!userVote}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 8, cursor: userVote ? 'default' : 'pointer',
              fontWeight: 600, fontSize: 12, transition: 'all .2s',
              opacity: voting ? 0.6 : 1,
              border: userVote === s
                ? (s === 'YES' ? '1px solid #a855f7' : '1px solid #94a3b8')
                : '1px solid rgba(255,255,255,0.08)',
              background: userVote === s
                ? (s === 'YES' ? 'rgba(168,85,247,0.2)' : 'rgba(148,163,184,0.15)')
                : 'rgba(255,255,255,0.03)',
              color: userVote === s ? (s === 'YES' ? '#a855f7' : '#94a3b8') : '#64748b',
            }}
          >
            {s === 'YES' ? '✓ OUI' : '✗ NON'} {s === 'YES' ? yesCount : noCount}
          </button>
        ))}
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${yesPct}%`,
          background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
          borderRadius: 999, transition: 'width .4s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 4 }}>
        <span>OUI {yesPct}%</span>
        <span>{total} votes</span>
        <span>NON {100 - yesPct}%</span>
      </div>
      {userVote && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#64748b', textAlign: 'center' }}>
          Tu as voté {userVote === 'YES' ? 'OUI ✓' : 'NON ✗'}
        </div>
      )}
    </div>
  );
}

// ── Activity Feed (sidebar) ───────────────────────────────────────────────────
function ActivityFeed({ marketId, compact = false }) {
  const { data, loading } = useApi(`/api/markets/${marketId}/activity`, { interval: 15000, params: { limit: '10' } });
  const items = data?.items || [];

  const inner = (
    <>
      {loading && <div style={{ fontSize: 12, color: '#64748b' }}>Chargement...</div>}
      {!loading && items.length === 0 && (
        <div style={{ fontSize: 12, color: '#64748b' }}>Aucune activité</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: item.type === 'bet'
                ? (item.side === 'YES' ? 'rgba(124,58,237,0.3)' : 'rgba(148,163,184,0.2)')
                : 'rgba(96,165,250,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11,
            }}>
              {item.type === 'bet' ? (item.side === 'YES' ? '✓' : '✗') : 'C'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.type === 'bet' ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.userId}</span>
                    {' '}a parié{' '}
                    <span style={{ color: item.side === 'YES' ? '#a855f7' : '#94a3b8', fontWeight: 600 }}>
                      {item.side === 'YES' ? 'OUI' : 'NON'}
                    </span>
                    {' · '}<span style={{ color: '#a855f7' }}>{item.amount} USDC</span>
                    <CopyTradeButton marketId={marketId} side={item.side} marketTitle={data?.title || data?.market?.title} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{(item.userId || 'anon').slice(0, 8)}</span>
                  {': '}
                  <span style={{ color: '#94a3b8' }}>
                    {item.content?.slice(0, 60)}{item.content?.length > 60 ? '…' : ''}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
                {new Date(item.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  if (compact) return inner;

  return (
    <div style={{
      background: '#0f0f1a',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>
        Activité récente
      </div>
      {inner}
    </div>
  );
}

// ── Accordion wrapper ─────────────────────────────────────────────────────────
function Accordion({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '12px 16px', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: '#f8fafc', fontSize: 12, fontWeight: 700,
          minHeight: 44,
        }}
      >
        <span>{title}</span>
        <span style={{ color: '#64748b', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 16px' }}>{children}</div>}
    </div>
  );
}

// ── Win Popup (big win > 100 USDC) ────────────────────────────────────────────
function WinPopup({ bet, market, onClose }) {
  const gain = bet.payout && bet.amount ? (bet.payout - bet.amount).toFixed(2) : null;
  const tweetText = `Je viens de gagner +$${gain} sur BETLY\n"${market?.title?.slice(0, 60)}"\n→ betly.gg/market/${market?._id}`;

  useEffect(() => {
    fireWin();
    const t = setTimeout(onClose, 15000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400, textAlign: 'center',
          background: '#111118',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 20, overflow: 'hidden',
          boxShadow: '0 0 60px rgba(34,197,94,0.15)',
        }}
      >
        {/* Green header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(16,185,129,0.1) 100%)',
          padding: '28px 24px 20px',
          borderBottom: '1px solid rgba(34,197,94,0.15)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>--</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#22c55e', marginBottom: 4 }}>
            +${gain} USDC
          </div>
          <div style={{ fontSize: 13, color: '#86efac' }}>Pari gagné !</div>
        </div>

        {/* Market title */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Sur le marché</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e2e8', lineHeight: 1.4, marginBottom: 16 }}>
            "{market?.title}"
          </div>
        </div>

        {/* Share CTA */}
        <div style={{ padding: '0 24px 24px' }}>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', padding: '13px 0', borderRadius: 10, marginBottom: 10,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
            }}
          >
            Partager ma victoire
          </a>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 10,
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748b', fontSize: 13, cursor: 'pointer',
            }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main MarketDetail ─────────────────────────────────────────────────────────
// ── My Position + Claim ──────────────────────────────────────────────────────
function MyPosition({ marketId, market, onClaimed }) {
  const userId = useUserId();
  const { isConnected } = useAccount();
  const { claim, status: claimStatus, error: claimError } = useClaimWinnings();
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    apiFetch(`/api/positions?status=all`)
      .then(r => r.json())
      .then(d => {
        const mine = (d.positions || []).filter(p => p.market?._id === marketId);
        setBets(mine.map(p => p.bet));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, marketId]);

  if (loading || bets.length === 0) return null;

  const totalStaked = bets.reduce((s, b) => s + b.amount, 0);
  const isResolved = market?.status === 'resolved';
  const hasOnChain = market?.onChainId != null;
  const wonBets = bets.filter(b => b.status === 'won');
  const canClaim = isResolved && hasOnChain && wonBets.length > 0 && isConnected;

  return (
    <div style={{
      background: '#111118',
      border: '1px solid rgba(168,85,247,0.25)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#a855f7', marginBottom: 12 }}>Ma position</div>
      {bets.map(bet => (
        <div key={bet._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 800,
              background: bet.side === 'YES' ? 'rgba(168,85,247,0.2)' : 'rgba(239,68,68,0.2)',
              color: bet.side === 'YES' ? '#a855f7' : '#ef4444',
            }}>
              {bet.side === 'YES' ? 'OUI' : 'NON'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{bet.amount} USDC</span>
          </div>
          <span style={{
            padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            background: bet.status === 'won' ? 'rgba(168,85,247,0.15)' : bet.status === 'lost' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            color: bet.status === 'won' ? '#a855f7' : bet.status === 'lost' ? '#ef4444' : '#22c55e',
          }}>
            {bet.status === 'won' ? 'Gagné' : bet.status === 'lost' ? 'Perdu' : bet.status === 'claimed' ? 'Encaissé' : 'Actif'}
          </span>
        </div>
      ))}
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
        Total misé : {totalStaked} USDC
      </div>
      {wonBets.length > 0 && wonBets[0].payout > 0 && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginTop: 8 }}>
          Gain : +{(wonBets.reduce((s, b) => s + (b.payout || 0), 0) - wonBets.reduce((s, b) => s + b.amount, 0)).toFixed(2)} USDC
        </div>
      )}
      {canClaim && (
        <button
          onClick={async () => {
            try {
              await claim(market.onChainId);
              for (const b of wonBets) {
                try { await apiFetch(`/api/bets/${b._id}/claim`, { method: 'POST' }); } catch {}
              }
              onClaimed?.();
            } catch {}
          }}
          disabled={claimStatus === 'claiming'}
          style={{
            marginTop: 12, width: '100%', padding: '10px 0', borderRadius: 10,
            border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
            background: claimStatus === 'success' ? 'rgba(34,197,94,0.2)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', opacity: claimStatus === 'claiming' ? 0.6 : 1,
          }}
        >
          {claimStatus === 'claiming' ? 'Encaissement…' : claimStatus === 'success' ? 'Encaissé ✓' : 'Encaisser mes gains'}
        </button>
      )}
      {claimError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{claimError}</div>}
    </div>
  );
}

export default function MarketDetail({ marketId }) {
  const userId = useUserId();
  const isMobile = useIsMobile();
  const [betKey, setBetKey] = useState(0);
  const [betFormOpen, setBetFormOpen] = useState(false);
  const [winPopup, setWinPopup] = useState(null);
  const prevStatus = useRef(null);
  const { data, loading, error, refetch } = useApi(`/api/markets/${marketId}`, { interval: 0 });

  // Refetch when bet placed
  const handleBetPlaced = useCallback(() => {
    setBetKey(k => k + 1);
    refetch();
  }, [refetch]);

  const market = data?.market || data;

  // Detect market just resolved — check if user won > 100 USDC
  useEffect(() => {
    if (!market || !userId) return;
    if (market.status === 'resolved' && prevStatus.current && prevStatus.current !== 'resolved') {
      apiFetch(`/api/positions?status=won`)
        .then(r => r.json())
        .then(d => {
          const wonBet = (d.bets || []).find(b =>
            (b.marketId === marketId || b.marketId?._id === marketId) &&
            b.payout > 100
          );
          if (wonBet) {
            setWinPopup({ ...wonBet, marketTitle: market.title });
            fireWin();
          }
        })
        .catch(() => {});
    }
    prevStatus.current = market.status;
  }, [market?.status]);


  const yes     = market ? Math.round(((market.totalYes || 0) / ((market.totalYes || 0) + (market.totalNo || 0) || 1)) * 100) : 50;
  const no      = 100 - yes;
  const catKey  = market?.category || 'autre';
  const cat     = CATEGORY_STYLE[catKey] || CATEGORY_STYLE.autre;
  const tleft   = timeLeft(market?.resolutionDate || market?.deadline);
  const isEnded = market?.status === 'resolved' || tleft === 'Terminé';

  // Build aiAnalysis object from flat market fields
  const aiAnalysis = market?.confidenceScore > 0 ? {
    decision: market.status === 'active' ? 'approved' : market.status === 'pending' ? 'review' : 'approved',
    confidenceScore: market.confidenceScore,
    category: market.category,
    oracleLevel: market.oracleLevel || 1,
    confidenceExplanation: market.confidenceDetails?.explanation || '',
    verifiability: market.confidenceDetails?.verifiability || 0,
    toxicity: market.confidenceDetails?.toxicity || 0,
    rejectionReason: market.rejectionReason,
  } : null;

  if (loading) {
    return <BetlyLoaderFullPage text="Chargement du marché..." />;
  }

  if (error || !market) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <a href="/" style={{ color: '#a78bfa', fontSize: 13, textDecoration: 'none' }}>← Retour au feed</a>
        <div style={{
          marginTop: 24, padding: 32, textAlign: 'center',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, color: '#f87171', fontSize: 14,
        }}>
          Marché introuvable (ID: {marketId})
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, fontSize: 13 }}>
        <a href="/" style={{ color: '#64748b', textDecoration: 'none' }}>Feed</a>
        <span style={{ color: '#334155' }}>›</span>
        <span
          style={{
            padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            color: cat.color, background: cat.bg,
          }}
        >
          {catKey.charAt(0).toUpperCase() + catKey.slice(1)}
        </span>
        <span style={{ color: '#334155' }}>›</span>
        <span style={{ color: '#94a3b8' }}>Détail</span>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 24, alignItems: 'start' }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header card */}
          <div style={{
            background: '#111118',
            border: `1px solid ${cat.color}33`,
            borderRadius: 16, padding: 24,
          }}>
            {/* Status + time */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                color: cat.color, background: cat.bg,
              }}>
                {catKey.toUpperCase()}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                color: isEnded ? '#64748b' : '#22c55e',
                background: isEnded ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${isEnded ? 'rgba(100,116,139,0.2)' : 'rgba(34,197,94,0.25)'}`,
              }}>
                {isEnded ? 'Terminé' : tleft}
              </span>
              {aiAnalysis && <ConfidenceBadge score={aiAnalysis.confidenceScore} />}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
                {((market.totalYes || 0) + (market.totalNo || 0)).toFixed(0)} USDC
              </span>
            </div>

            {/* Title */}
            <h1 style={{
              fontSize: 22, fontWeight: 800, color: '#f8fafc', lineHeight: 1.3,
              marginBottom: 14,
            }}>
              {market.title}
            </h1>

            {/* Creator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: avatarColor(market.creatorId || ''),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#fff',
              }}>
                {(market.creatorId || '?').slice(0, 2).toUpperCase()}
              </div>
              <a
                href={`/profile/${market.creatorId}`}
                style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = '#a855f7'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                {market.creatorId?.slice(0, 12) || 'Anonyme'}
              </a>
              <span style={{ fontSize: 11, color: '#475569' }}>
                · créé le {new Date(market.createdAt).toLocaleDateString('fr-FR')}
              </span>
              {/* Share + Report */}
              <ShareButton market={market} yes={yes} volume={(market.totalYes || 0) + (market.totalNo || 0)} />
              <ReportButton marketId={marketId} />
            </div>

            {/* Description */}
            {market.description && (
              <p style={{
                fontSize: 14, color: '#94a3b8', lineHeight: 1.6,
                marginBottom: 20, padding: '12px 14px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 8, borderLeft: `3px solid ${cat.color}55`,
              }}>
                {market.description}
              </p>
            )}

            {/* Chart */}
            <div style={{ marginBottom: 16 }}>
              <PriceChartReal marketId={marketId} yesPct={yes} />
            </div>

            {/* Big bars */}
            <BigBars yes={yes} no={no} yesVol={market.totalYes} noVol={market.totalNo} />
          </div>

          {/* AI Analysis */}
          {aiAnalysis && (
            <AiAnalysis analysis={aiAnalysis} />
          )}

          {/* Spacer so content isn't hidden behind sticky form on mobile */}
          {!isEnded && isMobile && <div className="bet-form-spacer" />}

          {/* Comments */}
          <div style={{
            background: '#111118',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: 24,
          }}>
            <Comments marketId={marketId} userId={userId} />
          </div>
        </div>

        {/* ── RIGHT COLUMN (sidebar) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: isMobile ? 'static' : 'sticky', top: 80 }}>

          {/* Bet form — top of sidebar on desktop */}
          {!isEnded && !isMobile && (
            <BetForm marketId={marketId} userId={userId} onBetPlaced={handleBetPlaced} market={market} />
          )}
          {isEnded && (
            <div style={{
              padding: '16px 20px', borderRadius: 12,
              background: market?.outcome
                ? market.outcome === 'YES'
                  ? 'rgba(168,85,247,0.08)' : 'rgba(239,68,68,0.08)'
                : 'rgba(100,116,139,0.08)',
              border: `1px solid ${market?.outcome
                ? market.outcome === 'YES'
                  ? 'rgba(168,85,247,0.25)' : 'rgba(239,68,68,0.25)'
                : 'rgba(100,116,139,0.2)'}`,
              color: market?.outcome
                ? market.outcome === 'YES' ? '#a855f7' : '#ef4444'
                : '#64748b',
              fontSize: 14, textAlign: 'center', fontWeight: 700,
            }}>
              {market?.outcome
                ? `Résultat : ${market.outcome === 'YES' ? 'OUI' : 'NON'}`
                : 'Ce marché est terminé — les paris sont fermés'}
            </div>
          )}

          {/* My position + claim */}
          {userId && <MyPosition marketId={marketId} market={market} onClaimed={refetch} />}

          {/* Stats box */}
          {isMobile ? (
            <Accordion title="Statistiques">
              <StatsRows market={market} />
            </Accordion>
          ) : (
            <div style={{
              background: '#111118',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: 16,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>Statistiques</div>
              <StatsRows market={market} />
            </div>
          )}

          {/* Community vote */}
          {!isEnded && (
            isMobile ? (
              <Accordion title="Vote communautaire">
                <CommunityVote marketId={marketId} userId={userId} />
              </Accordion>
            ) : (
              <CommunityVote marketId={marketId} userId={userId} />
            )
          )}

          {/* Activity feed */}
          {isMobile ? (
            <Accordion title="Activité récente">
              <ActivityFeed marketId={marketId} compact />
            </Accordion>
          ) : (
            <ActivityFeed marketId={marketId} />
          )}
        </div>
      </div>

      {/* Sticky bet form on mobile */}
      {!isEnded && isMobile && (
        <div className="bet-form-sticky">
          <BetForm marketId={marketId} userId={userId} onBetPlaced={handleBetPlaced} market={market} />
        </div>
      )}

      {/* Win popup — big win > 100 USDC */}
      {winPopup && (
        <WinPopup
          bet={winPopup}
          market={market}
          onClose={() => setWinPopup(null)}
        />
      )}
    </div>
  );
}

// ── Stats rows (reused by desktop card + mobile accordion) ────────────────────
function StatsRows({ market }) {
  return (
    <>
      {[
        { label: 'Volume total', value: `${((market.totalYes || 0) + (market.totalNo || 0)).toFixed(2)} USDC` },
        { label: 'Mise OUI',     value: `${(market.totalYes || 0).toFixed(2)} USDC` },
        { label: 'Mise NON',     value: `${(market.totalNo  || 0).toFixed(2)} USDC` },
        { label: 'Oracle Level', value: `L${market.oracleLevel || 1}` },
        { label: 'Statut',       value: market.status || 'active' },
        { label: 'Date limite',  value: (market.resolutionDate || market.deadline) ? new Date(market.resolutionDate || market.deadline).toLocaleDateString('fr-FR') : '—' },
      ].map(({ label, value }) => (
        <div key={label} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{value}</span>
        </div>
      ))}
      {market.status === 'resolved' && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 8,
          background: market.outcome === 'YES' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${market.outcome === 'YES' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Résultat final</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: market.outcome === 'YES' ? '#22c55e' : '#ef4444' }}>
            {market.outcome === 'YES' ? '✓ OUI' : '✗ NON'}
          </div>
        </div>
      )}
    </>
  );
}
