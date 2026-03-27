import React, { useState } from 'react';
import { useApi } from '../hooks/useApi';

const RANK = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);

const rankColor = (i) => {
  if (i === 0) return '#f59e0b';
  if (i === 1) return '#9090a0';
  if (i === 2) return '#b87333';
  return '#6060a0';
};

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 18px',
        borderRadius: '7px',
        border: active ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,0.07)',
        background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
        color: active ? '#a78bfa' : '#9090a0',
        fontSize: '13px',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

function EmptyRow({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#6060a0', fontSize: '13px' }}>
      {msg}
    </div>
  );
}

export default function Leaderboard() {
  const [tab, setTab] = useState('bettors');
  const { data, loading, error } = useApi('/api/leaderboard');

  const topBettors  = data?.topBettors  || [];
  const topCreators = data?.topCreators || [];
  const topMarkets  = data?.topMarkets  || [];

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e2e8', marginBottom: '4px' }}>
          Classement
        </h1>
        <p style={{ fontSize: '13px', color: '#6060a0' }}>
          Les meilleurs parieurs, créateurs et marchés de la communauté.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <TabBtn active={tab === 'bettors'}  onClick={() => setTab('bettors')}>Top parieurs</TabBtn>
        <TabBtn active={tab === 'creators'} onClick={() => setTab('creators')}>Top créateurs</TabBtn>
        <TabBtn active={tab === 'markets'}  onClick={() => setTab('markets')}>Top marchés</TabBtn>
      </div>

      {error && (
        <div style={{
          padding: '12px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.1)', color: '#ef4444',
          fontSize: '13px', marginBottom: '16px',
        }}>
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6060a0', fontSize: '13px' }}>
          Chargement...
        </div>
      ) : (
        <div style={{
          background: '#111118',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '10px',
          overflow: 'hidden',
        }}>
          {/* ── Top parieurs ──────────────────────────────────────── */}
          {tab === 'bettors' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 90px 90px 80px',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '11px', fontWeight: 600, color: '#6060a0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                <span>#</span>
                <span>Utilisateur</span>
                <span style={{ textAlign: 'right' }}>Paris</span>
                <span style={{ textAlign: 'right' }}>Gagnés</span>
                <span style={{ textAlign: 'right' }}>Gains</span>
              </div>

              {topBettors.length === 0
                ? <EmptyRow msg="Aucun parieur encore" />
                : topBettors.map((user, i) => (
                  <a
                    key={user._id || i}
                    href={`/profile/${user.telegramId}?userId=${user.telegramId}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 90px 90px 80px',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center', fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                      <span style={{ color: '#e2e2e8', fontWeight: 500 }}>
                        {user.displayName || user.telegramId || `User #${i + 1}`}
                      </span>
                      <span style={{ textAlign: 'right', color: '#9090a0' }}>{user.totalBets || 0}</span>
                      <span style={{ textAlign: 'right', color: '#22c55e' }}>{user.wonBets || 0}</span>
                      <span style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>
                        {(user.totalEarned || 0).toFixed(1)}
                      </span>
                    </div>
                  </a>
                ))}
            </>
          )}

          {/* ── Top créateurs ─────────────────────────────────────── */}
          {tab === 'creators' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 110px 110px',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '11px', fontWeight: 600, color: '#6060a0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                <span>#</span>
                <span>Créateur</span>
                <span style={{ textAlign: 'right' }}>Marchés</span>
                <span style={{ textAlign: 'right' }}>Volume</span>
              </div>

              {topCreators.length === 0
                ? <EmptyRow msg="Aucun créateur encore" />
                : topCreators.map((creator, i) => (
                  <a
                    key={creator._id || i}
                    href={`/profile/${creator._id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 110px 110px',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center', fontSize: '13px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#e2e2e8', fontWeight: 500 }}>
                          {creator._id || `Creator #${i + 1}`}
                        </span>
                        {creator.marketsCreated >= 3 && creator.totalVolume >= 100 && (
                          <span style={{
                            fontSize: '10px', padding: '1px 6px', borderRadius: 4,
                            background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                            fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)',
                          }}>
                            TOP
                          </span>
                        )}
                      </div>
                      <span style={{ textAlign: 'right', color: '#60a5fa' }}>
                        {creator.marketsCreated || 0}
                      </span>
                      <span style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>
                        {(creator.totalVolume || 0).toLocaleString('fr-FR')}
                      </span>
                    </div>
                  </a>
                ))}
            </>
          )}

          {/* ── Top marchés ───────────────────────────────────────── */}
          {tab === 'markets' && (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 90px 70px',
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                fontSize: '11px', fontWeight: 600, color: '#6060a0',
                textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>
                <span>#</span>
                <span>Marché</span>
                <span style={{ textAlign: 'right' }}>Volume</span>
                <span style={{ textAlign: 'right' }}>Status</span>
              </div>

              {topMarkets.length === 0
                ? <EmptyRow msg="Aucun marché encore" />
                : topMarkets.map((m, i) => {
                  const vol = (m.totalYes || 0) + (m.totalNo || 0);
                  const isResolved = m.status === 'resolved';
                  return (
                    <a
                      key={m._id || i}
                      href={`/market/${m._id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 90px 70px',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        alignItems: 'center', fontSize: '13px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                        <span style={{
                          color: '#e2e2e8', fontWeight: 500,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          paddingRight: 8,
                        }}>
                          {m.title}
                        </span>
                        <span style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>
                          {vol.toLocaleString('fr-FR')}
                        </span>
                        <span style={{
                          textAlign: 'right',
                          color: isResolved ? '#22c55e' : '#f59e0b',
                          fontSize: '11px', fontWeight: 700,
                        }}>
                          {isResolved ? (m.outcome || 'RES') : 'LIVE'}
                        </span>
                      </div>
                    </a>
                  );
                })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
