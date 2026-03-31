import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApi, useUserId } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import MarketCard from '../components/MarketCard';
import SocialFeed from '../components/SocialFeed';
import {
  Flame, Star, Clock, Globe, Trophy, TrendingUp,
  Plus, Inbox, Lightbulb, ChevronRight, ChevronDown,
  BarChart3, Zap,
} from 'lucide-react';

const CATEGORIES = ['tous', 'créateurs', 'sport', 'crypto', 'politique', 'culture', 'autre'];
const SORTS = [
  { key: 'trending', label: 'Trending',  Icon: Flame },
  { key: 'nouveau',  label: 'Nouveau',   Icon: Star  },
  { key: 'ferme',    label: 'Bientôt',   Icon: Clock },
];

// ── Live activity bar ────────────────────────────────────────────────────────
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
      padding: '8px 14px', borderRadius: 10, marginBottom: 12,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
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
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
      <div key={currentIdx} style={{
        fontSize: 12, color: '#94a3b8', flex: 1,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        animation: 'fade-up 0.35s ease both',
      }}>
        <span style={{ color, fontWeight: 600 }}>·</span>{' '}{text}
      </div>
      <style>{`
        @keyframes live-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

// ── Skeleton card ────────────────────────────────────────────────────────────
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

// ── Right sidebar: Markets panel ─────────────────────────────────────────────
function MarketsSidebar({ markets, loading, error, feedTab, category, sort,
  setCategory, setSort, setFeedTab, persoReason, persoLoading, user, openAuth,
  handleBetPlaced }) {

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 0,
      position: 'sticky', top: 68, maxHeight: 'calc(100vh - 84px)',
      overflowY: 'auto', overflowX: 'hidden',
      borderRadius: 16,
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
    }}
      className="no-scrollbar"
    >
      {/* Sidebar header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5,
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)',
        padding: '18px 18px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={18} color="#a855f7" strokeWidth={2.5} />
            <span style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Marchés</span>
          </div>
          <a href="/create" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 999, textDecoration: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontSize: 12, fontWeight: 700,
            boxShadow: '0 2px 12px rgba(124,58,237,0.3)',
            transition: 'all .15s',
          }}>
            <Plus size={14} strokeWidth={2.5} />
            Créer
          </a>
        </div>

        {/* Feed tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[
            { key: 'global',   label: 'Global',   Icon: Globe },
            { key: 'pour-toi', label: 'Pour toi', Icon: Star  },
          ].map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setFeedTab(key)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all .2s',
                border: feedTab === key ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                background: feedTab === key ? 'rgba(168,85,247,0.15)' : 'transparent',
                color: feedTab === key ? '#a855f7' : '#64748b',
                fontSize: 12, fontWeight: feedTab === key ? 700 : 500,
              }}
            >
              <Icon size={12} strokeWidth={1.5} />
              {label}
            </button>
          ))}
        </div>

        {/* Category + sort pills (global only) */}
        {feedTab === 'global' && (
          <div className="scroll-row no-scrollbar" style={{ gap: 6 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '5px 12px', borderRadius: 999, cursor: 'pointer', transition: 'all .15s',
                  border: category === cat ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.06)',
                  background: category === cat ? 'rgba(168,85,247,0.12)' : 'transparent',
                  color: category === cat ? '#a855f7' : '#94a3b8',
                  fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                }}
              >
                {cat === 'tous' ? 'Tous' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.06)', flexShrink: 0, margin: '0 2px' }} />
            {SORTS.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: sort === key ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: sort === key ? '#f8fafc' : '#64748b',
                  fontSize: 11, whiteSpace: 'nowrap',
                }}
              >
                <Icon size={11} strokeWidth={1.5} />
                {label}
              </button>
            ))}
          </div>
        )}

        {/* "Pour toi" hints */}
        {feedTab === 'pour-toi' && persoReason === 'trending_fallback' && !persoLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 8, marginTop: 6,
            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
            color: '#a78bfa', fontSize: 11,
          }}>
            <Lightbulb size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            Paris et suis des créateurs pour personnaliser
          </div>
        )}
      </div>

      {/* Live activity */}
      <div style={{ padding: '14px 16px 0' }}>
        <LiveActivityBar />
      </div>

      {/* Market cards */}
      <div style={{ padding: '10px 16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          [1,2,3].map(i => <SkeletonCard key={i} />)
        ) : error ? (
          <div style={{
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', fontSize: 13,
          }}>
            Erreur: {error}
          </div>
        ) : markets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: '#64748b' }}>
            <Inbox size={32} strokeWidth={1} color="#334155" style={{ marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>Aucun marché</div>
            <div style={{ fontSize: 12 }}>
              <a href="/create" style={{ color: '#a855f7', textDecoration: 'none' }}>Crée le premier</a>
            </div>
          </div>
        ) : (
          markets.map(market => (
            <MarketCard key={market._id} market={market} onBetPlaced={handleBetPlaced} />
          ))
        )}
      </div>

      {/* CTA for non-logged */}
      {!user && markets.length > 0 && (
        <div style={{
          textAlign: 'center', padding: '24px 16px', margin: '0 14px 16px',
          background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
            Prêt à parier ?
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 16 }}>
            Crée un compte gratuit et place tes premiers paris.
          </div>
          <button
            onClick={openAuth}
            style={{
              padding: '10px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              boxShadow: '0 0 20px rgba(124,58,237,0.4)',
            }}
          >
            Rejoindre BETLY
          </button>
        </div>
      )}
    </div>
  );
}

// ── Mobile: Markets horizontal strip ─────────────────────────────────────────
function MobileMarketsStrip({ markets, loading }) {
  if (loading || markets.length === 0) return null;

  return (
    <div style={{ marginBottom: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame size={16} color="#a855f7" strokeWidth={2.5} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>Marchés</span>
        </div>
        <a href="/markets" style={{ fontSize: 13, color: '#7c3aed', textDecoration: 'none', fontWeight: 600 }}>
          Voir tout
        </a>
      </div>
      <div className="scroll-row no-scrollbar" style={{ gap: 10, padding: '0 16px 14px' }}>
        {markets.slice(0, 8).map(m => {
          const yesP = m.tYes && m.tNo ? Math.round((m.tYes / (m.tYes + m.tNo)) * 100) : 50;
          return (
            <a
              key={m._id || m.id}
              href={`/market/${m._id || m.id}`}
              style={{
                textDecoration: 'none', color: 'inherit',
                minWidth: 260, maxWidth: 300,
                padding: '14px 16px',
                borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              <div style={{
                fontSize: 13, fontWeight: 700, color: '#f1f5f9', lineHeight: 1.35,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {m.question || m.title}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, textAlign: 'center',
                  background: 'rgba(34,197,94,0.1)', color: '#22c55e', fontSize: 13, fontWeight: 700,
                }}>OUI {yesP}%</div>
                <div style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, textAlign: 'center',
                  background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: 13, fontWeight: 700,
                }}>NON {100 - yesP}%</div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
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

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Markets horizontal strip */}
        <MobileMarketsStrip markets={markets} loading={loading} />

        {/* Social feed — full width */}
        <SocialFeed isMobile={isMobile} />

        {/* FAB */}
        <button
          className="fab"
          onClick={() => window.location.href = '/create'}
          title="Créer un marché"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Plus size={22} strokeWidth={2} color="#fff" />
        </button>
      </div>
    );
  }

  // ── Desktop layout: 2 columns ──────────────────────────────────────────────
  return (
    <div style={{
      maxWidth: 1280, margin: '0 auto', padding: '20px 24px',
      position: 'relative', zIndex: 1,
      display: 'grid',
      gridTemplateColumns: '1fr 420px',
      gap: 28,
      alignItems: 'start',
    }}>
      {/* ═══ LEFT: Social Feed (main content) ═══ */}
      <div style={{
        borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <SocialFeed isMobile={false} />
      </div>

      {/* ═══ RIGHT: Markets sidebar ═══ */}
      <MarketsSidebar
        markets={markets}
        loading={loading}
        error={error}
        feedTab={feedTab}
        category={category}
        sort={sort}
        setCategory={setCategory}
        setSort={setSort}
        setFeedTab={setFeedTab}
        persoReason={persoReason}
        persoLoading={persoFeed.loading}
        user={user}
        openAuth={openAuth}
        handleBetPlaced={handleBetPlaced}
      />
    </div>
  );
}
