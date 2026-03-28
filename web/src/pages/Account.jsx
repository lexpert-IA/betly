import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { computeAvatarColor } from '../hooks/useAuth';

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#111118',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '18px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || '#e2e2e8', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6060a0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Account() {
  const { user: session, logout } = useAuth();
  const { data, loading, error } = useApi('/api/account');

  const user = data?.user;
  const recentBets = data?.recentBets || [];

  const winRate = user && user.totalBets > 0
    ? ((user.wonBets / user.totalBets) * 100).toFixed(1)
    : null;

  const avatarColor = session ? (session.avatarColor || computeAvatarColor(session.username || '')) : '#7c3aed';
  const displayName = session?.username || user?.username || user?.displayName || 'Anonyme';

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

      {/* Profile header */}
      <div style={{
        background: '#111118',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 28, marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20,
        flexWrap: 'wrap',
      }}>
        {/* Avatar */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
          background: avatarColor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 900, color: '#fff',
          boxShadow: `0 0 28px ${avatarColor}66`,
        }}>
          {displayName.slice(0, 1).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {displayName}
            </h1>
            {user?.reputation >= 70 && (
              <span style={{
                padding: '2px 8px', borderRadius: 999,
                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                fontSize: 11, fontWeight: 700, border: '1px solid rgba(251,191,36,0.3)',
              }}>
                ⭐ TOP CRÉATEUR
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Réputation: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{user?.reputation || 50}/100</span>
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Membre depuis: <span style={{ color: '#94a3b8' }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <a
              href={`/profile/${session?.userId}`}
              style={{
                padding: '6px 14px', borderRadius: 7, textDecoration: 'none',
                background: 'rgba(124,58,237,0.15)',
                border: '1px solid rgba(124,58,237,0.3)',
                color: '#a855f7', fontSize: 12, fontWeight: 600,
              }}
            >
              👤 Voir mon profil public
            </a>
            <button
              onClick={logout}
              style={{
                padding: '6px 14px', borderRadius: 7,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          padding: 12, borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13,
        }}>
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6060a0', fontSize: 13 }}>
          Chargement...
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 12, marginBottom: 28,
          }}>
            <StatBox label="Balance" value={`${(user?.balance || 0).toFixed(2)}`} color="#a78bfa" sub="USDC" />
            <StatBox label="Total Paris" value={user?.totalBets || 0} color="#60a5fa" />
            <StatBox label="Paris gagnés" value={user?.wonBets || 0} color="#22c55e" />
            <StatBox
              label="Win Rate"
              value={winRate ? `${winRate}%` : '—'}
              color={winRate && parseFloat(winRate) >= 50 ? '#22c55e' : '#ef4444'}
            />
            <StatBox label="Gains totaux" value={`${(user?.totalEarned || 0).toFixed(2)}`} color="#22c55e" sub="USDC" />
            <StatBox label="Réputation" value={`${user?.reputation || 50}`} color="#f59e0b" sub="/ 100" />
          </div>

          {/* Recent bets */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e2e8', marginBottom: 12 }}>
              Paris récents
            </h2>

            {recentBets.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 32, color: '#6060a0', fontSize: 13,
                background: '#111118', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.07)',
              }}>
                Aucun pari encore.{' '}
                <a href="/" style={{ color: '#a78bfa', textDecoration: 'none' }}>Voir les marchés →</a>
              </div>
            ) : (
              <div style={{
                background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, overflow: 'hidden',
              }}>
                {recentBets.map((bet, i) => (
                  <div
                    key={bet._id || i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: i < recentBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      fontSize: 13, cursor: bet.marketId ? 'pointer' : 'default',
                    }}
                    onClick={() => bet.marketId && (window.location.href = `/market/${bet.marketId}`)}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: bet.side === 'YES' ? 'rgba(124,58,237,0.15)' : 'rgba(148,163,184,0.15)',
                        color: bet.side === 'YES' ? '#a855f7' : '#94a3b8',
                        fontWeight: 700, fontSize: 11,
                      }}>
                        {bet.side === 'YES' ? 'OUI' : 'NON'}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>
                        {new Date(bet.placedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ color: '#e2e2e8', fontWeight: 600 }}>{bet.amount} USDC</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#64748b',
                        background: bet.status === 'won' ? 'rgba(34,197,94,0.1)' : bet.status === 'lost' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                      }}>
                        {bet.status === 'won' ? '✓ Gagné' : bet.status === 'lost' ? '✗ Perdu' : '⏳ En cours'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
