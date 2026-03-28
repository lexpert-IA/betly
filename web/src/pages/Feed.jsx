import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApi, useUserId } from '../hooks/useApi';
import MarketCard from '../components/MarketCard';

const CATEGORIES = ['tous', 'sport', 'crypto', 'politique', 'culture', 'autre'];
const SORTS = [
  { key: 'trending', label: '🔥 Trending' },
  { key: 'nouveau',  label: '✨ Nouveau'  },
  { key: 'ferme',    label: '⏰ Bientôt' },
];

// ── Cursor glow ───────────────────────────────────────────────────────────────
function CursorGlow() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const move = (e) => {
      el.style.left = e.clientX + 'px';
      el.style.top  = e.clientY + 'px';
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  return (
    <div ref={ref} style={{
      position: 'fixed', width: 400, height: 400, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
      pointerEvents: 'none', zIndex: 0,
      transform: 'translate(-50%, -50%)',
      transition: 'opacity .3s',
    }} />
  );
}

// ── Hero banner ───────────────────────────────────────────────────────────────
function HeroBanner() {
  const [stats, setStats] = useState({ markets: 0, users: 0 });

  useEffect(() => {
    // Animate counters
    const targets = { markets: 42, users: 318 };
    let frame = 0;
    const total = 60;
    const timer = setInterval(() => {
      frame++;
      const pct = frame / total;
      const ease = 1 - Math.pow(1 - pct, 3);
      setStats({
        markets: Math.round(targets.markets * ease),
        users:   Math.round(targets.users * ease),
      });
      if (frame >= total) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: 20, marginBottom: 32,
      padding: '48px 32px', textAlign: 'center',
    }}>
      {/* Background layers */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse 80% 60% at 50% 20%, rgba(124,58,237,.18) 0%, transparent 70%),
          radial-gradient(ellipse 60% 40% at 80% 80%, rgba(6,182,212,.10) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 20% 70%, rgba(168,85,247,.08) 0%, transparent 50%)
        `,
        animation: 'hero-shift 8s ease-in-out infinite alternate',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,.02) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }} />
      {/* Border */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.07)',
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
          color: '#a855f7', padding: '5px 16px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          ✨ Social Betting · Predictions
        </div>

        <h1 style={{
          fontSize: 'clamp(3rem, 10vw, 6rem)',
          fontWeight: 900, letterSpacing: '-3px', lineHeight: .9,
          background: 'linear-gradient(135deg, #ffffff 0%, #a855f7 45%, #06b6d4 85%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', marginBottom: 16,
        }}>
          BETLY
        </h1>

        <p style={{
          fontSize: 16, fontWeight: 600, color: '#f8fafc', marginBottom: 8,
        }}>
          Parie sur l'avenir. Gagne des USDC.
        </p>
        <p style={{
          fontSize: 14, color: '#94a3b8', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.6,
        }}>
          Marchés de prédiction vérifiables — sport, crypto, politique, culture.
          Oracle IA + vote communautaire.
        </p>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
          {[
            { num: stats.markets, label: 'marchés actifs' },
            { num: stats.users,   label: 'parieurs' },
            { num: '100%',        label: 'on-chain' },
          ].map(({ num, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 28, fontWeight: 800, letterSpacing: '-1px',
                background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {typeof num === 'number' ? num.toLocaleString('fr-FR') : num}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="/create"
            style={{
              padding: '12px 28px', borderRadius: 12, textDecoration: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              boxShadow: '0 0 28px rgba(124,58,237,.4)',
              transition: 'all .25s',
              display: 'inline-block',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 40px rgba(124,58,237,.6)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 0 28px rgba(124,58,237,.4)'; }}
          >
            🎯 Créer un marché
          </a>
          <a
            href="/leaderboard"
            style={{
              padding: '12px 28px', borderRadius: 12, textDecoration: 'none',
              background: 'rgba(255,255,255,0.05)', color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.1)', fontSize: 14, fontWeight: 600,
              backdropFilter: 'blur(10px)',
              transition: 'all .25s', display: 'inline-block',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor='rgba(124,58,237,.3)'; e.currentTarget.style.transform='translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.transform='translateY(0)'; }}
          >
            🏆 Classement
          </a>
        </div>
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

// ── Feed personnalisé hook ─────────────────────────────────────────────────────
function usePersonalizedFeed(userId) {
  const { data, loading, error } = useApi(
    userId ? '/api/markets/personalized' : null,
    { params: userId ? { userId } : {} }
  );
  return { markets: data?.markets || [], reason: data?.reason, loading, error };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Feed() {
  const [feedTab, setFeedTab]   = useState('global');  // 'global' | 'pour-toi'
  const [category, setCategory] = useState('tous');
  const [sort, setSort]         = useState('trending');
  const [refreshKey, setRefreshKey] = useState(0);
  const userId = useUserId();

  const globalFeed = useApi('/api/markets', { params: { category, sort } });
  const persoFeed  = usePersonalizedFeed(userId);

  const { data, loading, error } = feedTab === 'pour-toi' ? persoFeed : globalFeed;
  const markets = (feedTab === 'pour-toi' ? persoFeed.markets : data?.markets) || [];
  const persoReason = persoFeed.reason;

  const handleBetPlaced = useCallback(() => setRefreshKey(k => k + 1), []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', position: 'relative', zIndex: 1 }}>
      <CursorGlow />
      <HeroBanner />

      {/* Gradient divider */}
      <div style={{
        height: 2, maxWidth: 600, margin: '0 auto 32px',
        background: 'linear-gradient(90deg, transparent, #7c3aed, #a855f7, #06b6d4, transparent)',
        borderRadius: 999, opacity: .4,
      }} />

      {/* ── Feed tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 20 }}>
        {[
          { key: 'global',   label: '🌐 Global' },
          { key: 'pour-toi', label: '✨ Pour toi' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFeedTab(key)}
            style={{
              padding: '7px 18px', borderRadius: 10, cursor: 'pointer', transition: 'all .2s',
              border: feedTab === key ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
              background: feedTab === key ? 'rgba(168,85,247,0.15)' : 'transparent',
              color: feedTab === key ? '#a855f7' : '#64748b',
              fontSize: 13, fontWeight: feedTab === key ? 700 : 500,
            }}
          >
            {label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto' }}>
          <a href="/create" style={{ color: '#a855f7', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
            Créer →
          </a>
        </span>
      </div>

      {/* "Pour toi" context hint */}
      {feedTab === 'pour-toi' && persoReason === 'trending_fallback' && !persoFeed.loading && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          color: '#a78bfa', fontSize: 12,
        }}>
          💡 Paris et suis des créateurs pour personnaliser ce feed — affichage trending pour l'instant
        </div>
      )}
      {feedTab === 'pour-toi' && persoReason === 'padded_with_trending' && !persoFeed.loading && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
          color: '#a78bfa', fontSize: 12,
        }}>
          ✨ Marchés de tes créateurs suivis + les plus tendances
        </div>
      )}

      {/* Global feed filters — hidden on "Pour toi" */}
      {feedTab === 'global' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '5px 14px', borderRadius: 999, cursor: 'pointer', transition: 'all .2s',
                  border: category === cat ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
                  background: category === cat ? 'rgba(168,85,247,0.15)' : 'transparent',
                  color: category === cat ? '#a855f7' : '#94a3b8',
                  fontSize: 12, fontWeight: 500,
                }}
              >
                {cat === 'tous' ? 'Tous' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {SORTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                style={{
                  padding: '5px 11px', borderRadius: 7, cursor: 'pointer', transition: 'all .15s',
                  border: '1px solid rgba(255,255,255,0.07)',
                  background: sort === key ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: sort === key ? '#f8fafc' : '#64748b',
                  fontSize: 12,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#f87171', fontSize: 13,
        }}>
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : markets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>Aucun marché</div>
          <div style={{ fontSize: 13 }}>
            Sois le premier à{' '}
            <a href="/create" style={{ color: '#a855f7', textDecoration: 'none' }}>créer un marché</a>.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {markets.map(market => (
            <MarketCard key={market._id} market={market} onBetPlaced={handleBetPlaced} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        marginTop: 48, paddingTop: 24,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <span style={{ fontSize: 16, fontWeight: 900, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
          BETLY
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          {[['/', 'Feed'], ['/leaderboard', 'Classement'], ['/account', 'Compte']].map(([href, label]) => (
            <a key={href} href={href} style={{ color: '#64748b', fontSize: 12, textDecoration: 'none', transition: 'color .2s' }}
              onMouseEnter={e => e.currentTarget.style.color='#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.color='#64748b'}
            >
              {label}
            </a>
          ))}
        </div>
        <span style={{ color: '#64748b', fontSize: 11 }}>BETLY © 2026</span>
      </div>
    </div>
  );
}
