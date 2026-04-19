import React from 'react';
import ConfidenceBadge from './ConfidenceBadge';
import BetBar from './BetBar';

// ── Category palette (matches wolves HTML design) ─────────────────────────────
const CATEGORIES = {
  sport:     { color: '#f87171', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.2)',   label: 'Sport' },
  crypto:    { color: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.2)',  label: 'Crypto' },
  politique: { color: '#c084fc', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.2)',  label: 'Politique' },
  culture:   { color: '#f472b6', bg: 'rgba(236,72,153,0.15)', border: 'rgba(236,72,153,0.2)',  label: 'Culture' },
  autre:     { color: 'var(--cyan)', bg: 'rgba(6,182,212,0.15)',  border: 'rgba(6,182,212,0.2)',   label: 'Autre' },
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

function resolveCreatorName(creatorId) {
  if (!creatorId || creatorId === 'system' || creatorId === 'BETLY' || creatorId === 'WOLVES') return 'WOLVES';
  return creatorId;
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

export default function MarketCard({ market }) {
  const cat = CATEGORIES[market.category] || CATEGORIES.autre;
  const yes = Math.round(((market.totalYes || 0) / ((market.totalYes || 0) + (market.totalNo || 0) || 1)) * 100);
  const no = 100 - yes;

  return (
    <div
      className="wolves-card fade-up"
      style={{
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        backdropFilter: 'blur(10px)',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.3), 0 0 0 1px var(--accent-glow)';
      }}
      onMouseLeave={e => {
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
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 1 }}>
            {resolveCreatorName(market.creatorId)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeRemaining(market.resolutionDate)}</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '3px 10px',
          borderRadius: 999, letterSpacing: '0.4px', textTransform: 'uppercase',
          color: cat.color, background: cat.bg, border: `1px solid ${cat.border}`,
          flexShrink: 0,
        }}>
          {cat.label}
        </span>
        {market.polymarketTokenId && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px',
            borderRadius: 999, color: 'var(--cyan)',
            background: 'var(--cyan-dim)', border: '1px solid rgba(34,211,238,0.2)',
          }}>
            PM
          </span>
        )}
      </div>

      {/* Creator market badge */}
      {market.creatorMarket && market.subjectHandle && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <img
            src={`https://unavatar.io/${market.subjectPlatform || 'twitter'}/${market.subjectHandle}`}
            alt={market.subjectHandle}
            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
            @{market.subjectHandle}
          </span>
          {market.selfMarket && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: 'var(--yellow)',
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
              padding: '1px 5px', borderRadius: 999,
            }}>Marché auto</span>
          )}
        </div>
      )}

      {/* Question */}
      <a href={`/market/${market._id}`} style={{ textDecoration: 'none' }}>
        <h3 style={{
          fontSize: 15, fontWeight: 700, color: 'var(--text-primary)',
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
                background: 'var(--accent-dim)', border: '1px solid rgba(124,58,237,0.2)',
                color: '#7c6aac', textDecoration: 'none', transition: 'all .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(124,58,237,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = '#7c6aac'; e.currentTarget.style.background = 'var(--accent-dim)'; }}
            >
              #{tag}
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <span>{market.commentsCount || 0}</span>
          <ConfidenceBadge score={market.confidenceScore} />
        </div>
        <span style={{ color: 'var(--text-muted)' }}>Oracle L{market.oracleLevel}</span>
      </div>

      {/* Bet buttons — link to market page */}
      <div style={{ display: 'flex', gap: 8 }}>
        <a
          href={`/market/${market._id}`}
          className="wolves-btn wolves-btn-yes"
          style={{
            flex: 1, padding: '10px 0', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13,
          }}
        >
          Oui {yes}¢
        </a>
        <a
          href={`/market/${market._id}`}
          className="wolves-btn wolves-btn-no"
          style={{
            flex: 1, padding: '10px 0', textDecoration: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 13,
          }}
        >
          Non {no}¢
        </a>
      </div>
    </div>
  );
}
