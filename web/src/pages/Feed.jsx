import React, { useState, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import MarketCard from '../components/MarketCard';

const CATEGORIES = ['tous', 'sport', 'crypto', 'politique', 'culture', 'autre'];
const SORTS = [
  { key: 'trending', label: 'Trending' },
  { key: 'nouveau', label: 'Nouveau' },
  { key: 'ferme', label: 'Bientôt fermé' },
];

function SkeletonCard() {
  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {[40, 100, 60, 24, 40].map((w, i) => (
        <div
          key={i}
          style={{
            height: i === 1 ? '32px' : '12px',
            width: `${w}%`,
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.05)',
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.5}50%{opacity:1} }`}</style>
    </div>
  );
}

export default function Feed() {
  const [category, setCategory] = useState('tous');
  const [sort, setSort] = useState('trending');
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, loading, error } = useApi('/api/markets', {
    params: { category, sort },
  });

  const handleBetPlaced = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const markets = data?.markets || [];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e2e8', marginBottom: '4px' }}>
          Marchés en direct
        </h1>
        <p style={{ fontSize: '13px', color: '#6060a0' }}>
          Pariez sur des événements vérifiables, gagnez des USDC.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        {/* Category pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                border: category === cat ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)',
                background: category === cat ? 'rgba(167,139,250,0.15)' : 'transparent',
                color: category === cat ? '#a78bfa' : '#9090a0',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {cat === 'tous' ? 'Tous' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        {/* Sort buttons */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.07)',
                background: sort === key ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: sort === key ? '#e2e2e8' : '#6060a0',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          Erreur: {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '16px',
          }}
        >
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : markets.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6060a0',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '4px' }}>Aucun marché</div>
          <div style={{ fontSize: '13px' }}>
            Sois le premier à{' '}
            <a href="/create" style={{ color: '#a78bfa', textDecoration: 'none' }}>
              créer un marché
            </a>
            .
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '16px',
          }}
        >
          {markets.map(market => (
            <MarketCard
              key={market._id}
              market={market}
              onBetPlaced={handleBetPlaced}
            />
          ))}
        </div>
      )}
    </div>
  );
}
