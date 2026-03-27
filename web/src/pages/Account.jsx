import React from 'react';
import { useApi, useUserId } from '../hooks/useApi';

function StatBox({ label, value, color }) {
  return (
    <div
      style={{
        background: '#111118',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '10px',
        padding: '16px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '22px', fontWeight: 700, color: color || '#e2e2e8', marginBottom: '4px' }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: '#6060a0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
  );
}

export default function Account() {
  const userId = useUserId();
  const { data, loading, error } = useApi('/api/account');

  const user = data?.user;
  const recentBets = data?.recentBets || [];

  const winRate =
    user && user.totalBets > 0
      ? ((user.wonBets / user.totalBets) * 100).toFixed(1)
      : '—';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e2e8', marginBottom: '4px' }}>
          Mon compte
        </h1>
        {userId ? (
          <p style={{ fontSize: '13px', color: '#6060a0', fontFamily: 'monospace' }}>
            ID: {userId}
          </p>
        ) : (
          <p style={{ fontSize: '13px', color: '#f59e0b' }}>
            Non connecté — ajoute <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: '3px' }}>?userId=TON_ID</code> dans l'URL.
          </p>
        )}
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
        <>
          {/* Stats grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '12px',
              marginBottom: '28px',
            }}
          >
            <StatBox
              label="Balance"
              value={`${(user?.balance || 0).toFixed(2)} USDC`}
              color="#a78bfa"
            />
            <StatBox
              label="Total Paris"
              value={user?.totalBets || 0}
              color="#60a5fa"
            />
            <StatBox
              label="Paris gagnés"
              value={user?.wonBets || 0}
              color="#22c55e"
            />
            <StatBox
              label="Win Rate"
              value={winRate !== '—' ? `${winRate}%` : '—'}
              color={parseFloat(winRate) >= 50 ? '#22c55e' : '#ef4444'}
            />
            <StatBox
              label="Gains totaux"
              value={`${(user?.totalEarned || 0).toFixed(2)} USDC`}
              color="#22c55e"
            />
            <StatBox
              label="Réputation"
              value={`${user?.reputation || 50}/100`}
              color="#f59e0b"
            />
          </div>

          {/* Recent bets */}
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#e2e2e8', marginBottom: '12px' }}>
              Paris récents
            </h2>

            {recentBets.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '32px',
                  color: '#6060a0',
                  fontSize: '13px',
                  background: '#111118',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                Aucun pari encore. <a href="/" style={{ color: '#a78bfa', textDecoration: 'none' }}>Voir les marchés →</a>
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
                {recentBets.map((bet, i) => (
                  <div
                    key={bet._id || i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: i < recentBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      fontSize: '13px',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: bet.side === 'YES' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: bet.side === 'YES' ? '#22c55e' : '#ef4444',
                          fontWeight: 700,
                          fontSize: '11px',
                          marginRight: '8px',
                        }}
                      >
                        {bet.side}
                      </span>
                      <span style={{ color: '#9090a0' }}>
                        {new Date(bet.placedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#e2e2e8', fontWeight: 600 }}>
                        {bet.amount} USDC
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: 600,
                          color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#9090a0',
                          background: bet.status === 'won'
                            ? 'rgba(34,197,94,0.1)'
                            : bet.status === 'lost'
                            ? 'rgba(239,68,68,0.1)'
                            : 'rgba(255,255,255,0.05)',
                        }}
                      >
                        {bet.status === 'won' ? 'Gagné' : bet.status === 'lost' ? 'Perdu' : 'En cours'}
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
