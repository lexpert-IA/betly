import React, { useState, useEffect, useCallback } from 'react';
import { useApi, useUserId } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import ConfidenceBadge from '../components/ConfidenceBadge';
import AiAnalysis from '../components/AiAnalysis';
import { toast } from '../components/ToastManager';

// ── Helpers ───────────────────────────────────────────────────────────────────
const CATEGORY_STYLE = {
  sport:     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', emoji: '⚽' },
  crypto:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  emoji: '₿'  },
  politique: { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', emoji: '🏛' },
  culture:   { color: '#f472b6', bg: 'rgba(244,114,182,0.12)', emoji: '🎭' },
  autre:     { color: '#22d3ee', bg: 'rgba(34,211,238,0.12)',  emoji: '💡' },
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
function ProbChart({ yesPct }) {
  const W = 600, H = 80, pts = 40;
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
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 80, display: 'block' }} preserveAspectRatio="none">
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
      <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 80, pointerEvents: 'none' }}>
        {[100, 50, 0].map(v => (
          <span key={v} style={{ fontSize: 9, color: '#6060a0', lineHeight: 1 }}>{v}%</span>
        ))}
      </div>
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
function BetForm({ marketId, userId, onBetPlaced }) {
  const [side, setSide]     = useState('YES');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]       = useState(null);

  const PRESETS = [5, 10, 25, 50];

  async function place() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setMsg({ type: 'err', text: 'Montant invalide' }); return; }
    if (!userId) { toast('Crée ton compte pour parier !', 'warning'); window.location.reload(); return; }
    setLoading(true);
    setMsg(null);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/markets/${marketId}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, side, amount: amt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Erreur');
      setMsg({ type: 'ok', text: `Pari placé — ${amt} USDC sur ${side}` });
      toast(`Pari ${side === 'YES' ? 'OUI' : 'NON'} de ${amt} USDC placé !`, 'success');
      setAmount('');
      onBetPlaced?.();
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: '#0f0f1a',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 14 }}>Placer un pari</div>

      {/* Side buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['YES', 'NO'].map(s => (
          <button
            key={s}
            onClick={() => setSide(s)}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
              fontWeight: 700, fontSize: 14, transition: 'all .2s',
              border: side === s
                ? (s === 'YES' ? '1px solid #a855f7' : '1px solid #94a3b8')
                : '1px solid rgba(255,255,255,0.07)',
              background: side === s
                ? (s === 'YES' ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'rgba(148,163,184,0.2)')
                : 'transparent',
              color: side === s ? '#fff' : '#64748b',
            }}
          >
            {s === 'YES' ? '✓ OUI' : '✗ NON'}
          </button>
        ))}
      </div>

      {/* Amount */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#6060a0', marginBottom: 6 }}>Montant (USDC)</div>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#f8fafc', fontSize: 15, fontWeight: 600,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => setAmount(String(p))}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6, cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                border: '1px solid rgba(255,255,255,0.07)',
                background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
              }}
            >
              ${p}
            </button>
          ))}
        </div>
      </div>

      {/* Potential gain */}
      {amount && parseFloat(amount) > 0 && (
        <div style={{
          padding: '8px 10px', borderRadius: 6,
          background: 'rgba(124,58,237,0.08)',
          border: '1px solid rgba(124,58,237,0.15)',
          fontSize: 12, color: '#a78bfa', marginBottom: 12,
        }}>
          Gain potentiel estimé: ~{(parseFloat(amount) * 1.85).toFixed(2)} USDC
        </div>
      )}

      <button
        onClick={place}
        disabled={loading}
        style={{
          width: '100%', padding: '12px 0', borderRadius: 8,
          background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg,#7c3aed,#a855f7)',
          color: loading ? '#6060a0' : '#fff',
          border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 700, fontSize: 14,
          boxShadow: loading ? 'none' : '0 0 20px rgba(124,58,237,0.35)',
          transition: 'all .2s',
        }}
      >
        {loading ? '⟳ En cours...' : `Parier ${amount ? parseFloat(amount).toFixed(2) : '0'} USDC`}
      </button>

      {msg && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 12,
          background: msg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${msg.type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          color: msg.type === 'ok' ? '#22c55e' : '#ef4444',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Comments Section ──────────────────────────────────────────────────────────
function Comments({ marketId, userId }) {
  const { data, loading, refetch } = useApi(`/api/markets/${marketId}/comments`);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const comments = data?.comments || [];

  async function postComment() {
    if (!text.trim()) return;
    if (!userId) { toast('Crée ton compte pour commenter !', 'warning'); window.location.reload(); return; }
    setPosting(true);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      await fetch(`${base}/api/markets/${marketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, content: text.trim() }),
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
        💬 Commentaires <span style={{ color: '#64748b', fontWeight: 400, fontSize: 12 }}>({comments.length})</span>
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
                <button
                  onClick={() => likeComment(c._id)}
                  style={{
                    marginTop: 6, background: 'none', border: 'none',
                    cursor: 'pointer', color: '#64748b', fontSize: 11, padding: 0,
                  }}
                >
                  ♡ {c.likes || 0}
                </button>
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
  const { data, refetch } = useApi(`/api/markets/${marketId}/votes`);
  const [voting, setVoting] = useState(false);

  const yesCount = data?.yesCount || 0;
  const noCount  = data?.noCount  || 0;
  const total    = yesCount + noCount;
  const yesPct   = total > 0 ? Math.round((yesCount / total) * 100) : 50;
  const userVote = data?.userVote;

  async function vote(side) {
    if (!userId) { toast('Crée ton compte pour voter !', 'warning'); window.location.reload(); return; }
    setVoting(true);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      await fetch(`${base}/api/markets/${marketId}/vote?userId=${encodeURIComponent(userId)}`, {
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
        🗳 Vote communautaire (L3)
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
function ActivityFeed({ marketId }) {
  const { data, loading } = useApi(`/api/markets/${marketId}/activity`, { interval: 15000, params: { limit: '10' } });
  const items = data?.items || [];

  return (
    <div style={{
      background: '#0f0f1a',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>
        ⚡ Activité récente
      </div>
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
              {item.type === 'bet' ? (item.side === 'YES' ? '✓' : '✗') : '💬'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.type === 'bet' ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{item.userId}</span>
                  {' '}a parié{' '}
                  <span style={{ color: item.side === 'YES' ? '#a855f7' : '#94a3b8', fontWeight: 600 }}>
                    {item.side === 'YES' ? 'OUI' : 'NON'}
                  </span>
                  {' · '}<span style={{ color: '#a855f7' }}>{item.amount} USDC</span>
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
    </div>
  );
}

// ── Main MarketDetail ─────────────────────────────────────────────────────────
export default function MarketDetail({ marketId }) {
  const userId = useUserId();
  const [betKey, setBetKey] = useState(0);
  const { data, loading, error, refetch } = useApi(`/api/markets/${marketId}`, { interval: 0 });

  // Refetch when bet placed
  const handleBetPlaced = useCallback(() => {
    setBetKey(k => k + 1);
    refetch();
  }, [refetch]);

  const market = data?.market || data;

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
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <a href="/" style={{ color: '#a78bfa', fontSize: 13, textDecoration: 'none' }}>← Retour au feed</a>
        <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: i === 1 ? 80 : 40, borderRadius: 10, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      </div>
    );
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
          {cat.emoji} {catKey.charAt(0).toUpperCase() + catKey.slice(1)}
        </span>
        <span style={{ color: '#334155' }}>›</span>
        <span style={{ color: '#94a3b8' }}>Détail</span>
      </div>

      {/* Main layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

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
                {cat.emoji} {catKey.toUpperCase()}
              </span>
              <span style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                color: isEnded ? '#64748b' : '#22c55e',
                background: isEnded ? 'rgba(100,116,139,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${isEnded ? 'rgba(100,116,139,0.2)' : 'rgba(34,197,94,0.25)'}`,
              }}>
                {isEnded ? '✓ Terminé' : `⏱ ${tleft}`}
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
              {/* Share */}
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href); }}
                style={{
                  marginLeft: 'auto', padding: '4px 10px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b', fontSize: 11, cursor: 'pointer',
                }}
              >
                📤 Partager
              </button>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Probabilité OUI · historique</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>{yes}%</span>
              </div>
              <ProbChart yesPct={yes} />
            </div>

            {/* Big bars */}
            <BigBars yes={yes} no={no} yesVol={market.totalYes} noVol={market.totalNo} />
          </div>

          {/* AI Analysis */}
          {aiAnalysis && (
            <AiAnalysis analysis={aiAnalysis} />
          )}

          {/* Bet form */}
          {!isEnded && (
            <BetForm marketId={marketId} userId={userId} onBetPlaced={handleBetPlaced} />
          )}
          {isEnded && (
            <div style={{
              padding: '16px 20px', borderRadius: 12,
              background: 'rgba(100,116,139,0.08)',
              border: '1px solid rgba(100,116,139,0.2)',
              color: '#64748b', fontSize: 14, textAlign: 'center',
            }}>
              Ce marché est terminé — les paris sont fermés
            </div>
          )}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>

          {/* Stats box */}
          <div style={{
            background: '#111118',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>📊 Statistiques</div>
            {[
              { label: 'Volume total',   value: `${((market.totalYes || 0) + (market.totalNo || 0)).toFixed(2)} USDC` },
              { label: 'Mise OUI',       value: `${(market.totalYes || 0).toFixed(2)} USDC` },
              { label: 'Mise NON',       value: `${(market.totalNo  || 0).toFixed(2)} USDC` },
              { label: 'Oracle Level',   value: `L${market.oracleLevel || 1}` },
              { label: 'Statut',         value: market.status || 'active' },
              { label: 'Date limite', value: (market.resolutionDate || market.deadline) ? new Date(market.resolutionDate || market.deadline).toLocaleDateString('fr-FR') : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 0',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>{label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{value}</span>
              </div>
            ))}

            {/* Resolved result */}
            {market.status === 'resolved' && (
              <div style={{
                marginTop: 12, padding: '10px 12px', borderRadius: 8,
                background: market.outcome === 'YES' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${market.outcome === 'YES' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Résultat final</div>
                <div style={{
                  fontSize: 18, fontWeight: 800,
                  color: market.outcome === 'YES' ? '#22c55e' : '#ef4444',
                }}>
                  {market.outcome === 'YES' ? '✓ OUI' : '✗ NON'}
                </div>
              </div>
            )}
          </div>

          {/* Community vote */}
          {!isEnded && <CommunityVote marketId={marketId} userId={userId} />}

          {/* Activity feed */}
          <ActivityFeed marketId={marketId} />
        </div>
      </div>
    </div>
  );
}
