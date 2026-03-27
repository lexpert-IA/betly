import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';

export default function Leaderboard() {
  const [tab, setTab] = useState('bettors');
  const { data, loading, error } = useApi('/api/leaderboard');

  const topBettors = data?.topBettors || [];
  const topCreators = data?.topCreators || [];

  const tabStyle = (active) => ({
    padding: '8px 20px',
    borderRadius: '7px',
    border: active ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.07)',
    background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
    color: active ? '#a78bfa' : '#9090a0',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const rankColor = (i) => {
    if (i === 0) return '#f59e0b';
    if (i === 1) return '#9090a0';
    if (i === 2) return '#b87333';
    return '#6060a0';
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e2e8', marginBottom: '4px' }}>
          Classement
        </h1>
        <p style={{ fontSize: '13px', color: '#6060a0' }}>
          Les meilleurs parieurs et créateurs de la communauté.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button style={tabStyle(tab === 'bettors')} onClick={() => setTab('bettors')}>
          Top parieurs
        </button>
        <button style={tabStyle(tab === 'creators')} onClick={() => setTab('creators')}>
          Top créateurs
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(239,68,68,0.1)',
            color: '#ef4444',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6060a0', fontSize: '13px' }}>
          Chargement...
        </div>
      ) : (
        <div
          style={{
            background: '#111118',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}
        >
          {/* Table header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: tab === 'bettors' ? '40px 1fr 100px 100px 80px' : '40px 1fr 120px 120px',
              padding: '10px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              fontSize: '11px',
              fontWeight: 600,
              color: '#6060a0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}
          >
            <span>#</span>
            <span>Utilisateur</span>
            {tab === 'bettors' ? (
              <>
                <span style={{ textAlign: 'right' }}>Paris</span>
                <span style={{ textAlign: 'right' }}>Gagnés</span>
                <span style={{ textAlign: 'right' }}>Gains</span>
              </>
            ) : (
              <>
                <span style={{ textAlign: 'right' }}>Marchés</span>
                <span style={{ textAlign: 'right' }}>Volume</span>
              </>
            )}
          </div>

          {/* Rows */}
          {tab === 'bettors' && topBettors.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6060a0', fontSize: '13px' }}>
              Aucun parieur encore
            </div>
          )}
          {tab === 'creators' && topCreators.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6060a0', fontSize: '13px' }}>
              Aucun créateur encore
            </div>
          )}

          {tab === 'bettors' &&
            topBettors.map((user, i) => (
              <div
                key={user._id || i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 100px 100px 80px',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'center',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: rankColor(i), fontWeight: 700 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <span style={{ color: '#e2e2e8', fontWeight: 500 }}>
                  {user.displayName || user.telegramId || `User #${i + 1}`}
                </span>
                <span style={{ textAlign: 'right', color: '#9090a0' }}>{user.totalBets || 0}</span>
                <span style={{ textAlign: 'right', color: '#22c55e' }}>{user.wonBets || 0}</span>
                <span style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>
                  {(user.totalEarned || 0).toFixed(1)}
                </span>
              </div>
            ))}

          {tab === 'creators' &&
            topCreators.map((creator, i) => (
              <div
                key={creator._id || i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 120px 120px',
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'center',
                  fontSize: '13px',
                }}
              >
                <span style={{ color: rankColor(i), fontWeight: 700 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <span style={{ color: '#e2e2e8', fontWeight: 500 }}>
                  {creator._id || `Creator #${i + 1}`}
                </span>
                <span style={{ textAlign: 'right', color: '#60a5fa' }}>{creator.marketsCreated || 0}</span>
                <span style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>
                  {(creator.totalVolume || 0).toLocaleString('fr-FR')} USDC
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
