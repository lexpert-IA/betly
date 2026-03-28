import React from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { computeAvatarColor } from '../hooks/useAuth';
import CopyTradeButton from '../components/CopyTradeButton';

// ── Level config ──────────────────────────────────────────────────────────────
const LEVELS = {
  debutant: { emoji: '🌱', label: 'Débutant',  color: '#22c55e', desc: '0–10 paris' },
  actif:    { emoji: '⚡', label: 'Actif',      color: '#60a5fa', desc: '11–50 paris' },
  expert:   { emoji: '🎯', label: 'Expert',     color: '#a855f7', desc: '51–200 paris' },
  oracle:   { emoji: '🔮', label: 'Oracle',     color: '#f59e0b', desc: '201+ paris · WR >65%' },
  legende:  { emoji: '👑', label: 'Légende',    color: '#fbbf24', desc: 'Top 10 classement' },
};

const BADGE_CONFIG = {
  regulier:   { emoji: '🔥', label: 'Régulier',   desc: '7 jours consécutifs' },
  acharne:    { emoji: '💪', label: 'Acharné',    desc: '30 jours consécutifs' },
  legendaire: { emoji: '⚡', label: 'Légendaire', desc: '100 jours consécutifs' },
};

function LevelBadge({ level, totalBets, winRate, style = {} }) {
  const cfg = LEVELS[level] || LEVELS.debutant;
  return (
    <span
      title={`${cfg.label} · ${cfg.desc}${winRate ? ` · ${winRate}% win rate` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
        background: `${cfg.color}18`, border: `1px solid ${cfg.color}44`,
        color: cfg.color, cursor: 'help', ...style,
      }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function StreakBadge({ streak }) {
  if (!streak || streak < 1) return null;
  const color = streak >= 30 ? '#f59e0b' : streak >= 7 ? '#f97316' : '#ef4444';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: `${color}15`, border: `1px solid ${color}40`,
      color,
    }}>
      🔥 {streak} jour{streak > 1 ? 's' : ''}
    </span>
  );
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '18px 16px', textAlign: 'center',
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
  const level = user?.level || 'debutant';
  const streak = user?.currentStreak || 0;
  const badges = user?.badges || [];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

      {/* Profile header */}
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 28, marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        {/* Avatar + level ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: '#fff',
            boxShadow: `0 0 28px ${avatarColor}66`,
            border: `3px solid ${(LEVELS[level] || LEVELS.debutant).color}44`,
          }}>
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          {/* Level emoji overlay */}
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            width: 24, height: 24, borderRadius: '50%',
            background: '#111118', border: `2px solid ${(LEVELS[level] || LEVELS.debutant).color}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
          }}>
            {(LEVELS[level] || LEVELS.debutant).emoji}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {displayName}
            </h1>
            <LevelBadge level={level} totalBets={user?.totalBets} winRate={winRate} />
            {streak > 0 && <StreakBadge streak={streak} />}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {badges.map(b => {
                const cfg = BADGE_CONFIG[b];
                if (!cfg) return null;
                return (
                  <span key={b} title={cfg.desc} style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.25)', cursor: 'help',
                  }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Réputation: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{user?.reputation || 50}/100</span>
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Depuis: <span style={{ color: '#94a3b8' }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
            </span>
            {user?.longestStreak > 0 && (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Record streak: <span style={{ color: '#f97316', fontWeight: 600 }}>🔥 {user.longestStreak}j</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`/profile/${session?.userId}`}
              style={{
                padding: '6px 14px', borderRadius: 7, textDecoration: 'none',
                background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                color: '#a855f7', fontSize: 12, fontWeight: 600,
              }}
            >
              👤 Profil public
            </a>
            <button
              onClick={logout}
              style={{
                padding: '6px 14px', borderRadius: 7,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              🚪 Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Level progression bar */}
      {user && (
        <div style={{
          background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Progression</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{user.totalBets || 0} paris au total</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {Object.entries(LEVELS).map(([key, cfg]) => {
              const isCurrent = key === level;
              return (
                <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 6, borderRadius: 999, marginBottom: 4,
                    background: isCurrent
                      ? `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`
                      : Object.keys(LEVELS).indexOf(key) < Object.keys(LEVELS).indexOf(level)
                        ? `${cfg.color}55`
                        : 'rgba(255,255,255,0.06)',
                    boxShadow: isCurrent ? `0 0 8px ${cfg.color}66` : 'none',
                  }} />
                  <span style={{ fontSize: 9, color: isCurrent ? cfg.color : '#475569' }}>
                    {cfg.emoji}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: (LEVELS[level] || LEVELS.debutant).color }}>
              {(LEVELS[level] || LEVELS.debutant).emoji} {(LEVELS[level] || LEVELS.debutant).label} — {(LEVELS[level] || LEVELS.debutant).desc}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13 }}>
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6060a0', fontSize: 13 }}>Chargement...</div>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>
            <StatBox label="Balance" value={`${(user?.balance || 0).toFixed(2)}`} color="#a78bfa" sub="USDC" />
            <StatBox label="Total Paris" value={user?.totalBets || 0} color="#60a5fa" />
            <StatBox label="Gagnés" value={user?.wonBets || 0} color="#22c55e" />
            <StatBox label="Win Rate" value={winRate ? `${winRate}%` : '—'} color={winRate && parseFloat(winRate) >= 50 ? '#22c55e' : '#ef4444'} />
            <StatBox label="Gains" value={`${(user?.totalEarned || 0).toFixed(2)}`} color="#22c55e" sub="USDC" />
            <StatBox label="Streak" value={streak > 0 ? `🔥 ${streak}j` : '—'} color="#f97316" />
          </div>

          {/* Recent bets */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e2e8', marginBottom: 12 }}>Paris récents</h2>
            {recentBets.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 32, color: '#6060a0', fontSize: 13,
                background: '#111118', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
              }}>
                Aucun pari encore.{' '}
                <a href="/" style={{ color: '#a78bfa', textDecoration: 'none' }}>Voir les marchés →</a>
              </div>
            ) : (
              <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                {recentBets.map((bet, i) => (
                  <div
                    key={bet._id || i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', cursor: bet.marketId ? 'pointer' : 'default',
                      borderBottom: i < recentBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      fontSize: 13, transition: 'background .15s',
                    }}
                    onClick={() => bet.marketId && (window.location.href = `/market/${bet.marketId}`)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#e2e2e8', fontWeight: 600 }}>{bet.amount} USDC</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#64748b',
                        background: bet.status === 'won' ? 'rgba(34,197,94,0.1)' : bet.status === 'lost' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                      }}>
                        {bet.status === 'won' ? '✓ Gagné' : bet.status === 'lost' ? '✗ Perdu' : '⏳ En cours'}
                      </span>
                      {bet.marketId && bet.status === 'active' && (
                        <CopyTradeButton marketId={bet.marketId} side={bet.side} />
                      )}
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
