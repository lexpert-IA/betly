import React, { useState } from 'react';
import { useApi, useUserId } from '../hooks/useApi';
import { apiFetch } from '../lib/api';
import ShareButton from '../components/ShareButton';
import WolvesLoader from '../components/BetlyLoader';

function StatBox({ label, value, color }) {
  return (
    <div className="wolves-card" style={{
      padding: '14px 16px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color || 'var(--text-primary)', marginBottom: 3 }}>
        {value}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
    </div>
  );
}

function statusColor(s) {
  if (s === 'resolved') return 'var(--green)';
  if (s === 'active')   return 'var(--blue)';
  if (s === 'resolving') return 'var(--yellow)';
  return 'var(--text-muted)';
}

export default function Profile({ profileId }) {
  const viewerId = useUserId();
  const { data, loading, error, refetch } = useApi(`/api/users/${profileId}`);

  const [following, setFollowing] = useState(null);
  const [followLoading, setFollowLoading] = useState(false);

  const user           = data?.user;
  const marketsCreated = data?.marketsCreated || [];
  const recentBets     = data?.recentBets     || [];
  const totalVolume    = data?.totalVolume     ?? 0;
  const isTopCreator   = data?.isTopCreator    ?? false;

  const isFollowing = following !== null ? following : (data?.isFollowing ?? false);
  const canFollow = viewerId && viewerId !== profileId;

  const winRate = user && user.totalBets > 0
    ? ((user.wonBets / user.totalBets) * 100).toFixed(1)
    : '—';

  async function handleFollow() {
    if (!canFollow || followLoading) return;
    setFollowLoading(true);
    try {
      const res = await apiFetch(`/api/users/${profileId}/follow`, { method: 'POST' });
      const json = await res.json();
      setFollowing(json.following);
    } catch (e) {
      // ignore
    } finally {
      setFollowLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <a href="/leaderboard" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' }}>
        ← Classement
      </a>

      {loading && (
        <WolvesLoader size={100} text="Chargement du profil..." />
      )}

      {error && (
        <div style={{
          marginTop: '20px', padding: '12px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.1)', color: 'var(--red)', fontSize: '13px',
        }}>
          Erreur: {error}
        </div>
      )}

      {!loading && user && (
        <>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            marginTop: '20px', marginBottom: '24px', gap: 12,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {user.displayName || user.username || `User ${profileId.slice(0, 8)}`}
                </h1>
                {isTopCreator && (
                  <span style={{
                    fontSize: '11px', padding: '2px 8px', borderRadius: 4,
                    background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)',
                    fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)',
                  }}>
                    TOP CRÉATEUR
                  </span>
                )}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4, fontFamily: 'monospace' }}>
                ID {profileId}
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                Réputation : <span style={{ color: 'var(--yellow)', fontWeight: 600 }}>{user.reputation || 50}/100</span>
                {' · '}
                {(user.followedBy || []).length} follower{(user.followedBy || []).length !== 1 ? 's' : ''}
              </p>
            </div>

            {canFollow && (
              <button
                onClick={handleFollow}
                disabled={followLoading}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: isFollowing ? '1px solid rgba(255,255,255,0.15)' : '1px solid #a78bfa',
                  background: isFollowing ? 'rgba(255,255,255,0.05)' : 'rgba(167,139,250,0.15)',
                  color: isFollowing ? 'var(--text-secondary)' : 'var(--accent)',
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {followLoading ? '…' : isFollowing ? 'Suivi ✓' : '+ Suivre'}
              </button>
            )}
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
            gap: '10px', marginBottom: '28px',
          }}>
            <StatBox label="Marchés créés" value={marketsCreated.length} color="#60a5fa" />
            <StatBox label="Volume généré" value={`${totalVolume.toLocaleString('fr-FR')} USDC`} color="#a78bfa" />
            <StatBox label="Paris placés"  value={user.totalBets || 0} color="#9090a0" />
            <StatBox label="Paris gagnés"  value={user.wonBets || 0}   color="#22c55e" />
            <StatBox
              label="Win rate"
              value={winRate !== '—' ? `${winRate}%` : '—'}
              color={parseFloat(winRate) >= 50 ? 'var(--green)' : 'var(--red)'}
            />
            <StatBox label="Gains totaux"  value={`${(user.totalEarned || 0).toFixed(2)}`} color="#22c55e" />
          </div>

          {/* Markets created */}
          {marketsCreated.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Marchés créés
              </h2>
              <div className="wolves-card" style={{ overflow: 'hidden' }}>
                {marketsCreated.map((m, i) => {
                  const vol = (m.totalYes || 0) + (m.totalNo || 0);
                  return (
                    <a key={m._id || i} href={`/market/${m._id}`} style={{ textDecoration: 'none' }}>
                      <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px',
                        borderBottom: i < marketsCreated.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                        fontSize: '13px', gap: 12,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{
                          color: 'var(--text-primary)', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        }}>
                          {m.title}
                        </span>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                            {vol.toLocaleString('fr-FR')} USDC
                          </span>
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '2px 7px',
                            borderRadius: 4, color: statusColor(m.status),
                            background: `${statusColor(m.status)}20`,
                          }}>
                            {m.status === 'resolved' ? (m.outcome || 'RÉS.') : m.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent bets */}
          {recentBets.length > 0 && (
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Paris récents
              </h2>
              <div className="wolves-card" style={{ overflow: 'hidden' }}>
                {recentBets.map((bet, i) => (
                  <div key={bet._id || i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '11px 16px',
                    borderBottom: i < recentBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    fontSize: '13px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 7px', borderRadius: 4,
                        background: bet.side === 'YES' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        color: bet.side === 'YES' ? 'var(--green)' : 'var(--red)',
                        fontWeight: 700, fontSize: '11px',
                      }}>
                        {bet.side}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {new Date(bet.placedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{bet.amount} USDC</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: '11px', fontWeight: 600,
                        color: bet.status === 'won' ? 'var(--green)' : bet.status === 'lost' ? 'var(--red)' : 'var(--text-secondary)',
                        background: bet.status === 'won'
                          ? 'rgba(34,197,94,0.1)'
                          : bet.status === 'lost'
                          ? 'rgba(239,68,68,0.1)'
                          : 'rgba(255,255,255,0.05)',
                      }}>
                        {bet.status === 'won' ? 'Gagné' : bet.status === 'lost' ? 'Perdu' : 'En cours'}
                      </span>
                      {bet.status === 'won' && bet.marketId && (
                        <ShareButton
                          variant="won"
                          bet={{ _id: bet._id, side: bet.side, amount: bet.amount, payout: bet.payout, odds: bet.odds }}
                          market={{ _id: bet.marketId, title: bet.marketTitle || '' }}
                          size="sm"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
