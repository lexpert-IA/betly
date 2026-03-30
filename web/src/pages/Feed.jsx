import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApi, useUserId } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import MarketCard from '../components/MarketCard';
import {
  Flame, Star, Clock, Globe, Trophy, TrendingUp,
  Plus, Inbox, Lightbulb, ChevronRight,
} from 'lucide-react';

const CATEGORIES = ['tous', 'créateurs', 'sport', 'crypto', 'politique', 'culture', 'autre'];
const SORTS = [
  { key: 'trending', label: 'Trending',  Icon: Flame },
  { key: 'nouveau',  label: 'Nouveau',   Icon: Star  },
  { key: 'ferme',    label: 'Bientôt',   Icon: Clock },
];

// ── Live activity bar (compact, inline) ──────────────────────────────────────
function LiveActivityBar() {
  const [data, setData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const base = import.meta.env.VITE_API_URL || '';

  useEffect(() => {
    const load = () => {
      fetch(`${base}/api/feed/live`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  const events = data?.events || [];
  const activeUsers = data?.activeUsers || 0;

  // Cycle through events
  useEffect(() => {
    if (events.length <= 1) return;
    const t = setInterval(() => setCurrentIdx(i => (i + 1) % events.length), 4000);
    return () => clearInterval(t);
  }, [events.length]);

  if (!data || events.length === 0) return null;

  const ev = events[currentIdx % events.length];
  let text = '';
  let color = '#94a3b8';
  if (ev?.type === 'bet') {
    color = ev.side === 'YES' ? '#22c55e' : '#ef4444';
    text = `${ev.userId} a misé ${ev.amount} USDC ${ev.side} sur "${(ev.marketTitle || '').slice(0, 50)}"`;
  } else if (ev?.type === 'market_created') {
    color = '#06b6d4';
    text = `Nouveau marché : "${(ev.marketTitle || '').slice(0, 55)}"`;
  } else if (ev?.type === 'market_resolved') {
    color = '#f59e0b';
    text = `Résolu : "${(ev.marketTitle || '').slice(0, 45)}" → ${ev.outcome}`;
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderRadius: 10, marginBottom: 16,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* Live dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#22c55e',
          boxShadow: '0 0 6px rgba(34,197,94,0.6)',
          animation: 'live-dot 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.03em' }}>
          {activeUsers > 0 ? `${activeUsers} en ligne` : 'LIVE'}
        </span>
      </div>

      {/* Separator */}
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

      {/* Event text — fades between events */}
      <div key={currentIdx} style={{
        fontSize: 12, color: '#94a3b8', flex: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        animation: 'fade-up 0.35s ease both',
      }}>
        <span style={{ color, fontWeight: 600 }}>·</span>{' '}{text}
      </div>

      <style>{`
        @keyframes live-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

// ── Trending Strip (compact horizontal band) ────────────────────────────────
function TrendingStrip() {
  const [markets, setMarkets] = useState([]);
  const base = import.meta.env.VITE_API_URL || '';
  const isM = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    fetch(`${base}/api/markets?sort=trending&limit=6`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const list = d?.markets || d || [];
        if (list.length > 0) setMarkets(list.slice(0, 6));
      })
      .catch(() => {});
  }, []);

  if (markets.length === 0) return null;

  return (
    <div style={{ marginBottom: isM ? 14 : 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Flame size={14} color="#a855f7" strokeWidth={2.5} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7', letterSpacing: '0.02em' }}>
          Trending
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      </div>

      {/* Horizontal scroll strip */}
      <div className="scroll-row no-scrollbar" style={{ gap: isM ? 8 : 10 }}>
        {markets.map(m => {
          const yesP = m.tYes && m.tNo ? Math.round((m.tYes / (m.tYes + m.tNo)) * 100) : 50;
          const volume = ((m.tYes || 0) + (m.tNo || 0)) / 1e6;
          const deadline = m.deadline || m.closesAt;
          const timeLeft = deadline ? (() => {
            const diff = new Date(deadline) - new Date();
            if (diff <= 0) return 'Fini';
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            return d > 0 ? `${d}j` : `${h}h`;
          })() : '';

          return (
            <a
              key={m._id || m.id}
              href={`/market/${m._id || m.id}`}
              style={{
                textDecoration: 'none', color: 'inherit',
                minWidth: isM ? 220 : 260, maxWidth: isM ? 240 : 280,
                padding: isM ? '12px 14px' : '14px 18px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                transition: 'all .2s',
                display: 'flex', flexDirection: 'column', gap: 8,
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(168,85,247,0.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
            >
              {/* Question */}
              <div style={{
                fontSize: isM ? 12 : 13, fontWeight: 700, color: '#f8fafc',
                lineHeight: 1.3,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                minHeight: isM ? 32 : 34,
              }}>
                {m.question || m.title}
              </div>

              {/* Odds bar mini */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', minWidth: 32 }}>
                  {yesP}%
                </span>
                <div style={{
                  flex: 1, height: 4, borderRadius: 99,
                  background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                  display: 'flex',
                }}>
                  <div style={{
                    width: `${yesP}%`, background: '#22c55e',
                    borderRadius: 99, transition: 'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444', minWidth: 32, textAlign: 'right' }}>
                  {100 - yesP}%
                </span>
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: '#64748b' }}>
                  {volume > 0 ? `${volume.toFixed(1)} USDC` : 'Nouveau'}
                </span>
                {timeLeft && (
                  <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={9} strokeWidth={1.5} /> {timeLeft}
                  </span>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ height: 11, width: '50%', borderRadius: 4, marginBottom: 5 }} />
          <div className="skeleton" style={{ height: 9, width: '30%', borderRadius: 4 }} />
        </div>
      </div>
      {[90, 70].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 14 : 11, width: `${w}%`, borderRadius: 4 }} />
      ))}
      <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
    </div>
  );
}

// ── Feed personnalisé hook ───────────────────────────────────────────────────
function usePersonalizedFeed(userId) {
  const { data, loading, error } = useApi(
    userId ? '/api/markets/personalized' : null,
    { params: userId ? { userId } : {} }
  );
  return { markets: data?.markets || [], reason: data?.reason, loading, error };
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function Feed() {
  const [feedTab, setFeedTab]   = useState('global');
  const [category, setCategory] = useState('tous');
  const [sort, setSort]         = useState('trending');
  const [refreshKey, setRefreshKey] = useState(0);
  const userId  = useUserId();
  const { user, openAuth } = useAuth();
  const isMobile = useIsMobile();

  const isCreatorFeed = category === 'créateurs';
  const globalFeed = useApi(
    isCreatorFeed ? '/api/markets/creators' : '/api/markets',
    { params: isCreatorFeed ? { sort } : { category, sort } }
  );
  const persoFeed  = usePersonalizedFeed(userId);

  const { data, loading, error } = feedTab === 'pour-toi' ? persoFeed : globalFeed;
  const markets = (feedTab === 'pour-toi' ? persoFeed.markets : data?.markets) || [];
  const persoReason = persoFeed.reason;

  const handleBetPlaced = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      <TrendingStrip />

      {/* ── Feed tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
        {[
          { key: 'global',   label: 'Global',   Icon: Globe },
          { key: 'pour-toi', label: 'Pour toi', Icon: Star  },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setFeedTab(key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 18px', borderRadius: 10, cursor: 'pointer', transition: 'all .2s',
              border: feedTab === key ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
              background: feedTab === key ? 'rgba(168,85,247,0.15)' : 'transparent',
              color: feedTab === key ? '#a855f7' : '#64748b',
              fontSize: 13, fontWeight: feedTab === key ? 700 : 500,
            }}
          >
            <Icon size={13} strokeWidth={1.5} />
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <a href="/create" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: '#a855f7', fontSize: 13, fontWeight: 500, textDecoration: 'none',
          }}>
            Créer <ChevronRight size={13} strokeWidth={1.5} />
          </a>
        </span>
      </div>

      {/* "Pour toi" hints */}
      {feedTab === 'pour-toi' && persoReason === 'trending_fallback' && !persoFeed.loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          color: '#a78bfa', fontSize: 12,
        }}>
          <Lightbulb size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          Paris et suis des créateurs pour personnaliser ce feed
        </div>
      )}
      {feedTab === 'pour-toi' && persoReason === 'padded_with_trending' && !persoFeed.loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          color: '#a78bfa', fontSize: 12,
        }}>
          <TrendingUp size={13} strokeWidth={1.5} style={{ flexShrink: 0 }} />
          Marchés de tes créateurs suivis + trending
        </div>
      )}

      {/* Global feed filters — single row */}
      {feedTab === 'global' && (
        <div style={{ marginBottom: 16, position: 'relative' }}>
          {isMobile && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, background: 'linear-gradient(to right, transparent, #0a0a0f)', zIndex: 2, pointerEvents: 'none' }} />}
          <div className="scroll-row no-scrollbar" style={{ alignItems: 'center' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '6px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all .15s',
                  border: category === cat ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                  background: category === cat ? 'rgba(168,85,247,0.15)' : 'transparent',
                  color: category === cat ? '#a855f7' : '#94a3b8',
                  fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                  minHeight: 32,
                }}
              >
                {cat === 'tous' ? 'Tous' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
            {SORTS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px', borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: sort === key ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: sort === key ? '#f8fafc' : '#64748b',
                  fontSize: 12, whiteSpace: 'nowrap', minHeight: 32,
                }}
              >
                <Icon size={12} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Live activity bar — compact, inline ── */}
      <LiveActivityBar />

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: 13,
        }}>
          Erreur: {error}
        </div>
      )}

      {/* FAB — mobile only */}
      {isMobile && (
        <button
          className="fab"
          onClick={() => window.location.href = '/create'}
          title="Créer un marché"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={22} strokeWidth={2} color="#fff" />
        </button>
      )}

      {/* ── Market grid ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, margin: '0 auto' }}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <Inbox size={36} strokeWidth={1} color="#334155" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>Aucun marché</div>
          <div style={{ fontSize: 13 }}>
            Sois le premier à{' '}
            <a href="/create" style={{ color: '#a855f7', textDecoration: 'none' }}>créer un marché</a>.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, margin: '0 auto' }}>
          {markets.map(market => (
            <MarketCard key={market._id} market={market} onBetPlaced={handleBetPlaced} />
          ))}
        </div>
      )}

      {/* CTA for non-logged users — clean, not a blur overlay */}
      {!user && markets.length > 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 20px', marginTop: 24,
          background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
            Prêt à parier ?
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
            Crée un compte gratuit pour placer tes premiers paris.
          </div>
          <button
            onClick={openAuth}
            style={{
              padding: '12px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              boxShadow: '0 0 24px rgba(124,58,237,0.4)',
            }}
          >
            Rejoindre BETLY
          </button>
        </div>
      )}
    </div>
  );
}
