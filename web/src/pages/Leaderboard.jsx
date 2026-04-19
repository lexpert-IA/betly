import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';
import { Bot, Copy } from 'lucide-react';
import WolvesLoader from '../components/BetlyLoader';

const RANK = (i) => i === 0 ? '#1' : i === 1 ? '#2' : i === 2 ? '#3' : String(i + 1);

const rankColor = (i) => {
  if (i === 0) return 'var(--yellow)';
  if (i === 1) return 'var(--text-secondary)';
  if (i === 2) return '#b87333';
  return 'var(--text-muted)';
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
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
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
    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px' }}>
      {msg}
    </div>
  );
}

function RankShareModal({ rank, winRate, earned, onClose }) {
  const [copied, setCopied] = useState(false);
  const rankLabel = `#${rank}`;
  const tweetText = `${rankLabel} sur WOLVES cette semaine\nWin rate : ${winRate}% · +$${earned} gagnés\n→ wolves.world/leaderboard`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(tweetText)}`;

  const copyLink = () => {
    navigator.clipboard.writeText('https://wolves.world/leaderboard').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 380,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-hover)',
          borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Partager mon rang</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>

        {/* Preview card */}
        <div style={{
          margin: '18px 18px 14px',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(96,165,250,0.1) 100%)',
          border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 12, padding: '20px 18px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Classement WOLVES</div>
          <div style={{ fontSize: 36, fontWeight: 900, color: rank <= 3 ? (rank === 1 ? 'var(--yellow)' : rank === 2 ? 'var(--text-secondary)' : '#b87333') : 'var(--accent)', marginBottom: 8 }}>
            {rankLabel}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
            Win rate : <span style={{ color: 'var(--green)', fontWeight: 700 }}>{winRate}%</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>+${earned} gagnés</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 10 }}>wolves.world/leaderboard</div>
        </div>

        {/* Share buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, padding: '0 18px 18px' }}>
          <a
            href={tweetUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 6px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              textDecoration: 'none', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 18 }}>𝕏</span>
            Tweet
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 6px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              textDecoration: 'none', color: 'var(--text-primary)', fontSize: 11, fontWeight: 600,
            }}
          >
            <span style={{ fontSize: 18 }}>WA</span>
            WhatsApp
          </a>
          <button
            onClick={copyLink}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 6px', borderRadius: 10,
              background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
              border: copied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: copied ? 'var(--green)' : 'var(--text-primary)', fontSize: 11, fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 18 }}>{copied ? '✓' : '#'}</span>
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [tab, setTab] = useState('bettors');
  const [rankShareOpen, setRankShareOpen] = useState(false);
  const { data, loading, error } = useApi('/api/leaderboard');
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const topBettors  = data?.topBettors  || [];
  const topCreators = data?.topCreators || [];
  const topMarkets  = data?.topMarkets  || [];

  // Agents leaderboard
  const [agents, setAgents] = useState([]);
  const base = import.meta.env.VITE_API_URL || '';
  useEffect(() => {
    if (tab !== 'agents') return;
    fetch(`${base}/api/agents/leaderboard`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.agents) setAgents(d.agents); })
      .catch(() => {});
  }, [tab]);

  // Find if current user is in top 10
  const myRankIdx = user
    ? topBettors.findIndex(u => u._id === user._id || u.telegramId === user.telegramId)
    : -1;
  const myRankData = myRankIdx >= 0 && myRankIdx < 10 ? topBettors[myRankIdx] : null;
  const myWinRate = myRankData && myRankData.totalBets > 0
    ? Math.round((myRankData.wonBets / myRankData.totalBets) * 100)
    : 0;
  const myEarned = myRankData ? (myRankData.totalEarned || 0).toFixed(0) : '0';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Classement
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          Les meilleurs parieurs, créateurs et marchés de la communauté.
        </p>
      </div>

      {/* Tabs */}
      <div className={isMobile ? 'scroll-row no-scrollbar' : ''} style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
        <TabBtn active={tab === 'bettors'}  onClick={() => setTab('bettors')}>Top parieurs</TabBtn>
        <TabBtn active={tab === 'creators'} onClick={() => setTab('creators')}>Top créateurs</TabBtn>
        <TabBtn active={tab === 'markets'}  onClick={() => setTab('markets')}>Top marchés</TabBtn>
        <TabBtn active={tab === 'agents'}   onClick={() => setTab('agents')}>Agents IA</TabBtn>
      </div>

      {error && (
        <div style={{
          padding: '12px', borderRadius: '8px',
          background: 'rgba(239,68,68,0.1)', color: 'var(--red)',
          fontSize: '13px', marginBottom: '16px',
        }}>
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <WolvesLoader size={100} text="Chargement du classement..." />
      ) : (
        <div className="wolves-card" style={{
          overflow: 'hidden',
        }}>
          {/* ── Top parieurs ──────────────────────────────────────── */}
          {tab === 'bettors' && (
            <>
              {/* "Partager mon rang" banner — only if user is in top 10 */}
              {myRankData && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'rgba(167,139,250,0.07)',
                  borderBottom: '1px solid rgba(167,139,250,0.15)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    Tu es #{myRankIdx + 1} cette semaine !
                  </span>
                  <button
                    onClick={() => setRankShareOpen(true)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 7,
                      border: '1px solid rgba(167,139,250,0.35)',
                      background: 'rgba(167,139,250,0.12)',
                      color: 'var(--accent)', fontSize: 11, fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Partager mon rang
                  </button>
                </div>
              )}

              {!isMobile && (
                <div className="lb-row-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 90px 90px 80px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <span>#</span>
                  <span>Utilisateur</span>
                  <span style={{ textAlign: 'right' }}>Paris</span>
                  <span style={{ textAlign: 'right' }}>Gagnés</span>
                  <span style={{ textAlign: 'right' }}>Gains</span>
                </div>
              )}

              {topBettors.length === 0
                ? <EmptyRow msg="Aucun parieur encore" />
                : topBettors.map((user, i) => (
                  <a
                    key={user._id || i}
                    href={`/profile/${user._id || user.telegramId}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Desktop row */}
                    <div className="lb-row-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 90px 90px 80px',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center', fontSize: '13px',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                        {user.displayName || user.telegramId || `User #${i + 1}`}
                      </span>
                      <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{user.totalBets || 0}</span>
                      <span style={{ textAlign: 'right', color: 'var(--green)' }}>{user.wonBets || 0}</span>
                      <span style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>
                        {(user.totalEarned || 0).toFixed(1)}
                      </span>
                    </div>
                    {/* Mobile card */}
                    <div className="lb-row-card" style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <span style={{ fontSize: 18, color: rankColor(i), fontWeight: 700, minWidth: 28 }}>{RANK(i)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.displayName || user.telegramId || `User #${i + 1}`}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {user.totalBets || 0} paris · {user.wonBets || 0} gagnés
                        </div>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
                        {(user.totalEarned || 0).toFixed(1)} USDC
                      </span>
                    </div>
                  </a>
                ))}
            </>
          )}

          {/* ── Top créateurs ─────────────────────────────────────── */}
          {tab === 'creators' && (
            <>
              {!isMobile && (
                <div className="lb-row-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 110px 110px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <span>#</span>
                  <span>Créateur</span>
                  <span style={{ textAlign: 'right' }}>Marchés</span>
                  <span style={{ textAlign: 'right' }}>Volume</span>
                </div>
              )}

              {topCreators.length === 0
                ? <EmptyRow msg="Aucun créateur encore" />
                : topCreators.map((creator, i) => (
                  <a
                    key={creator._id || i}
                    href={`/profile/${creator._id}`}
                    style={{ textDecoration: 'none' }}
                  >
                    <div className="lb-row-grid" style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 110px 110px',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      alignItems: 'center', fontSize: '13px', cursor: 'pointer',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{creator._id || `Creator #${i + 1}`}</span>
                        {creator.marketsCreated >= 3 && creator.totalVolume >= 100 && (
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>TOP</span>
                        )}
                      </div>
                      <span style={{ textAlign: 'right', color: 'var(--blue)' }}>{creator.marketsCreated || 0}</span>
                      <span style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{(creator.totalVolume || 0).toLocaleString('fr-FR')}</span>
                    </div>
                    <div className="lb-row-card" style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <span style={{ fontSize: 18, color: rankColor(i), fontWeight: 700, minWidth: 28 }}>{RANK(i)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {creator._id || `Creator #${i + 1}`}
                          </span>
                          {creator.marketsCreated >= 3 && creator.totalVolume >= 100 && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.15)', color: 'var(--yellow)', fontWeight: 700, border: '1px solid rgba(245,158,11,0.3)' }}>TOP</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{creator.marketsCreated || 0} marchés</div>
                      </div>
                      <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
                        {(creator.totalVolume || 0).toLocaleString('fr-FR')} USDC
                      </span>
                    </div>
                  </a>
                ))}
            </>
          )}

          {/* ── Top marchés ───────────────────────────────────────── */}
          {tab === 'markets' && (
            <>
              {!isMobile && (
                <div className="lb-row-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 90px 70px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <span>#</span>
                  <span>Marché</span>
                  <span style={{ textAlign: 'right' }}>Volume</span>
                  <span style={{ textAlign: 'right' }}>Status</span>
                </div>
              )}

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
                      <div className="lb-row-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 90px 70px',
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        alignItems: 'center', fontSize: '13px', cursor: 'pointer',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>{m.title}</span>
                        <span style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{vol.toLocaleString('fr-FR')}</span>
                        <span style={{ textAlign: 'right', color: isResolved ? 'var(--green)' : 'var(--yellow)', fontSize: '11px', fontWeight: 700 }}>
                          {isResolved ? (m.outcome || 'RES') : 'LIVE'}
                        </span>
                      </div>
                      <div className="lb-row-card" style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <span style={{ fontSize: 18, color: rankColor(i), fontWeight: 700, minWidth: 28 }}>{RANK(i)}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            <span style={{ color: isResolved ? 'var(--green)' : 'var(--yellow)', fontWeight: 700 }}>{isResolved ? (m.outcome || 'RES') : 'LIVE'}</span>
                            {' · '}{vol.toLocaleString('fr-FR')} USDC
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
            </>
          )}

          {/* ── Agents IA ──────────────────────────────────────────── */}
          {tab === 'agents' && (
            <>
              {!isMobile && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr 80px 80px 90px 80px',
                  padding: '10px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>
                  <span>#</span>
                  <span>Agent</span>
                  <span style={{ textAlign: 'right' }}>Win rate</span>
                  <span style={{ textAlign: 'right' }}>ROI</span>
                  <span style={{ textAlign: 'right' }}>Volume</span>
                  <span style={{ textAlign: 'right' }}>Copieurs</span>
                </div>
              )}

              {agents.length === 0
                ? <EmptyRow msg="Aucun agent classé pour le moment" />
                : agents.map((agent, i) => (
                  <div
                    key={agent._id || i}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: 'pointer', transition: 'background 0.1s',
                    }}
                    onClick={() => window.location.href = `/profile/agent:${agent._id}`}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Desktop row */}
                    {!isMobile && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr 80px 80px 90px 80px',
                        padding: '12px 16px',
                        alignItems: 'center', fontSize: '13px',
                      }}>
                        <span style={{ color: rankColor(i), fontWeight: 700 }}>{RANK(i)}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                            background: `linear-gradient(135deg, ${agent.avatarColor || 'var(--accent)'}, ${(agent.avatarColor || 'var(--accent)')}88)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Bot size={16} color="#fff" strokeWidth={2} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 2,
                                padding: '0px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                                background: 'rgba(124,58,237,0.12)', color: 'var(--accent)',
                              }}>
                                <Bot size={8} strokeWidth={3} /> IA
                              </span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {agent.agentName}
                              </span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                              par @{agent.ownerPseudo}
                              {agent.strategy && <span> · {agent.strategy.length > 40 ? agent.strategy.slice(0, 40) + '…' : agent.strategy}</span>}
                            </div>
                          </div>
                        </div>
                        <span style={{ textAlign: 'right', color: agent.winRate >= 60 ? 'var(--green)' : 'var(--yellow)', fontWeight: 600 }}>
                          {agent.winRate}%
                        </span>
                        <span style={{ textAlign: 'right', color: agent.roi > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {agent.roi > 0 ? '+' : ''}{agent.roi}%
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>
                          ${(agent.totalVolume || 0).toLocaleString()}
                        </span>
                        <span style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>
                          {agent.copiers || 0}
                        </span>
                      </div>
                    )}

                    {/* Mobile card */}
                    {isMobile && (
                      <div style={{
                        padding: '12px 16px',
                        display: 'flex', alignItems: 'center', gap: 12,
                      }}>
                        <span style={{ fontSize: 18, color: rankColor(i), fontWeight: 700, minWidth: 28 }}>{RANK(i)}</span>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: `linear-gradient(135deg, ${agent.avatarColor || 'var(--accent)'}, ${(agent.avatarColor || 'var(--accent)')}88)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Bot size={18} color="#fff" strokeWidth={2} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 2,
                              padding: '0px 5px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                              background: 'rgba(124,58,237,0.12)', color: 'var(--accent)',
                            }}>
                              <Bot size={8} strokeWidth={3} /> IA
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                              {agent.agentName}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>par @{agent.ownerPseudo}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11 }}>
                            <span style={{ color: agent.winRate >= 60 ? 'var(--green)' : 'var(--yellow)', fontWeight: 600 }}>
                              {agent.winRate}% WR
                            </span>
                            <span style={{ color: agent.roi > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                              {agent.roi > 0 ? '+' : ''}{agent.roi}% ROI
                            </span>
                            <span style={{ color: 'var(--accent)' }}>
                              ${(agent.totalVolume || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              {/* CTA */}
              <div style={{
                padding: '16px', textAlign: 'center',
                borderTop: '1px solid rgba(255,255,255,0.04)',
              }}>
                <a href="/agents" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', borderRadius: 10, textDecoration: 'none',
                  background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
                  color: 'var(--accent)', fontSize: 12, fontWeight: 700,
                }}>
                  <Bot size={14} strokeWidth={2} /> Voir tous les agents
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {rankShareOpen && myRankData && (
        <RankShareModal
          rank={myRankIdx + 1}
          winRate={myWinRate}
          earned={myEarned}
          onClose={() => setRankShareOpen(false)}
        />
      )}
    </div>
  );
}
