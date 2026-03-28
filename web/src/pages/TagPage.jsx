import React, { useEffect, useState } from 'react';
import MarketCard from '../components/MarketCard';

const API = import.meta.env.VITE_API_URL || '';

export default function TagPage({ tag }) {
  const [markets, setMarkets] = useState([]);
  const [trendingTags, setTrendingTags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [mRes, tRes] = await Promise.all([
          fetch(`${API}/api/markets?tag=${encodeURIComponent(tag)}`),
          fetch(`${API}/api/tags/trending`),
        ]);
        const mData = await mRes.json();
        const tData = await tRes.json();
        setMarkets(mData.markets || []);
        setTrendingTags(tData.tags || []);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, [tag]);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <a href="/" style={{ color: '#64748b', fontSize: 13, textDecoration: 'none' }}>← Feed</a>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            padding: '6px 18px', borderRadius: 999, fontSize: 20, fontWeight: 800,
            background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
            color: '#a855f7',
          }}>
            #{tag}
          </span>
          <span style={{ fontSize: 13, color: '#64748b' }}>
            {loading ? '…' : `${markets.length} marché${markets.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* Trending tags */}
      {trendingTags.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
            🔥 Tags populaires
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {trendingTags.map(t => (
              <a
                key={t}
                href={`/tag/${t}`}
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 12,
                  background: t === tag ? 'rgba(124,58,237,0.2)' : 'transparent',
                  border: `1px solid ${t === tag ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  color: t === tag ? '#a855f7' : '#94a3b8',
                  textDecoration: 'none', fontWeight: t === tag ? 700 : 400,
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (t !== tag) { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; e.currentTarget.style.color = '#a855f7'; }}}
                onMouseLeave={e => { if (t !== tag) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}}
              >
                #{t}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Markets grid */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: 120, borderRadius: 12, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: '#64748b', fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏷</div>
          <div style={{ color: '#f8fafc', fontWeight: 600, marginBottom: 6 }}>
            Aucun marché avec ce tag
          </div>
          <a href="/create" style={{ color: '#a855f7', textDecoration: 'none', fontSize: 13 }}>
            Crée le premier →
          </a>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {markets.map(m => (
            <MarketCard key={m._id} market={m} />
          ))}
        </div>
      )}
    </div>
  );
}
