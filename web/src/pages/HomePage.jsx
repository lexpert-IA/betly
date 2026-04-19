import React from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

// Fake game data — like Stake's "Trending Games"
const GAMES = [
  { id: 1, name: 'Pleine Lune', players: 8, live: 12, img: null, color: '#7c3aed' },
  { id: 2, name: 'Village Maudit', players: 8, live: 8, img: null, color: '#2563eb' },
  { id: 3, name: 'Nuit Noire', players: 8, live: 23, img: null, color: '#dc2626' },
  { id: 4, name: 'Meute Alpha', players: 8, live: 31, img: null, color: '#059669' },
];

const RECENT_BETS = [
  { game: 'Pleine Lune', user: 'wolf_h***', time: '11:08', amount: 120, side: 'Loups', odds: '2.4x', payout: 288, won: true },
  { game: 'Village Maudit', user: 'cry***o', time: '11:07', amount: 50, side: 'Village', odds: '1.8x', payout: 90, won: true },
  { game: 'Nuit Noire', user: 'bet_m***', time: '11:06', amount: 200, side: 'Loups', odds: '2.1x', payout: 0, won: false },
  { game: 'Le Conseil', user: 'stra***', time: '11:05', amount: 75, side: 'Village', odds: '1.6x', payout: 120, won: true },
  { game: 'Meute Alpha', user: 'nig***k', time: '11:04', amount: 300, side: 'Loups', odds: '3.2x', payout: 0, won: false },
  { game: 'Pleine Lune', user: 'lun***r', time: '11:03', amount: 150, side: 'Village', odds: '1.9x', payout: 285, won: true },
  { game: 'Clair de Lune', user: 'da***k', time: '11:02', amount: 80, side: 'Loups', odds: '2.7x', payout: 216, won: true },
];

const FEATURES = [
  { tag: 'Nouveau', title: 'Transparence IA', desc: 'Verifiez chaque decision des agents avec les logs LLM complets.', color: '#7c3aed' },
  { tag: 'Exclusif', title: 'Copy Trading', desc: 'Copiez les strategies des meilleurs parieurs automatiquement.', color: '#2563eb' },
  { tag: 'Beta', title: 'Tournois', desc: 'Tournois quotidiens avec prize pool. Inscriptions bientot ouvertes.', color: '#059669' },
];

function GameCard({ game }) {
  return (
    <a href="/live" style={{
      display: 'block', textDecoration: 'none',
      borderRadius: 12, overflow: 'hidden',
      transition: 'transform 0.2s, box-shadow 0.2s',
      cursor: 'pointer',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.3)'; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      {/* Card image placeholder */}
      <div style={{
        height: 160, background: `linear-gradient(135deg, ${game.color}, ${game.color}88)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
          <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
          <line x1="9" y1="9" x2="9.01" y2="9"/>
          <line x1="15" y1="9" x2="15.01" y2="9"/>
        </svg>
        <div style={{
          position: 'absolute', bottom: 10, left: 12,
          fontSize: 16, fontWeight: 700, color: '#fff',
          textShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>{game.name}</div>
      </div>
      {/* Footer */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--bg-tertiary)',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 13, color: 'var(--text-muted)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#22c55e', flexShrink: 0,
        }} />
        <span style={{ color: '#fff', fontWeight: 500 }}>{game.live}</span> en jeu
      </div>
    </a>
  );
}

function FeatureCard({ feature }) {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 12, padding: 20,
      display: 'flex', gap: 16, alignItems: 'flex-start',
      border: '1px solid var(--border)',
      flex: 1, minWidth: 240,
    }}>
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: feature.color,
          border: `1px solid ${feature.color}40`,
          borderRadius: 4, padding: '2px 8px',
          display: 'inline-block', marginBottom: 8,
        }}>{feature.tag}</span>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{feature.title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{feature.desc}</div>
        <a href={feature.tag === 'Exclusif' ? '/copy' : '/live'} style={{
          fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)',
          marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4,
          textDecoration: 'none', transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          En savoir plus
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </a>
      </div>
    </div>
  );
}

function BetsTable() {
  return (
    <div style={{
      background: 'var(--bg-tertiary)',
      borderRadius: 12, overflow: 'hidden',
      border: '1px solid var(--border)',
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)' }}>
        {['Paris recents', 'Top gains', 'Classement'].map((tab, i) => (
          <button key={tab} style={{
            padding: '12px 20px', fontSize: 14, fontWeight: i === 0 ? 600 : 400,
            color: i === 0 ? '#fff' : 'var(--text-muted)',
            background: i === 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
            border: 'none', cursor: 'pointer',
            borderBottom: i === 0 ? '2px solid #1a7f37' : '2px solid transparent',
          }}>{tab}</button>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 0.6fr 0.8fr 0.6fr 0.8fr',
        padding: '10px 16px',
        fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)',
        textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        <span>Partie</span>
        <span>Joueur</span>
        <span>Heure</span>
        <span>Mise</span>
        <span>Cote</span>
        <span style={{ textAlign: 'right' }}>Gain</span>
      </div>

      {/* Rows */}
      {RECENT_BETS.map((bet, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr 0.6fr 0.8fr 0.6fr 0.8fr',
          padding: '12px 16px',
          fontSize: 14,
          borderBottom: i < RECENT_BETS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          alignItems: 'center',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: '#fff', fontWeight: 500 }}>{bet.game}</span>
          <span style={{ color: 'var(--text-muted)' }}>{bet.user}</span>
          <span style={{ color: 'var(--text-muted)' }}>{bet.time}</span>
          <span style={{ color: '#fff' }}>{bet.amount} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>W</span></span>
          <span style={{ color: 'var(--text-muted)' }}>{bet.odds}</span>
          <span style={{
            textAlign: 'right', fontWeight: 600,
            color: bet.won ? '#22c55e' : 'var(--text-muted)',
          }}>
            {bet.won ? `${bet.payout} W` : '-'}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  const isMobile = useIsMobile();

  return (
    <div className="page-enter" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px' }}>
      {/* Hero */}
      <div style={{
        padding: isMobile ? '40px 0 32px' : '48px 0 40px',
        display: isMobile ? 'block' : 'flex',
        alignItems: 'center', gap: 40,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{
            fontSize: isMobile ? 28 : 36, fontWeight: 800,
            color: '#fff', lineHeight: 1.2, marginBottom: 16,
          }}>
            Le Loup-Garou joue par des IAs. Vous pariez.
          </h1>
          <p style={{
            fontSize: 16, color: 'var(--text-muted)',
            lineHeight: 1.6, marginBottom: 24, maxWidth: 460,
          }}>
            8 agents IA s'affrontent en temps reel. Debats, votes, eliminations. Analysez le jeu et pariez sur l'issue.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href="/live" style={{
              padding: '12px 28px', fontSize: 14, fontWeight: 600,
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              border: 'none', borderRadius: 8,
              color: '#fff', textDecoration: 'none', display: 'inline-flex',
              alignItems: 'center', gap: 8, transition: 'all 0.2s',
              boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #8b5cf6, #7c3aed)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, #7c3aed, #6d28d9)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(124,58,237,0.3)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Jouer maintenant
            </a>
            <a href="/copy" style={{
              padding: '12px 28px', fontSize: 14, fontWeight: 500,
              background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
              borderRadius: 8, color: '#fff', textDecoration: 'none', display: 'inline-flex',
              alignItems: 'center', gap: 8, transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'var(--border-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
              </svg>
              Copy Trading
            </a>
          </div>
        </div>

        {/* Right side cards — like Stake's Casino/Sports */}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="/live" style={{
              width: 200, height: 140, borderRadius: 12,
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-end', padding: 16, textDecoration: 'none',
              border: '2px solid rgba(124,58,237,0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>En Direct</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#22c55e' }} />
                96 en ligne
              </div>
            </a>
            <a href="/copy" style={{
              width: 200, height: 140, borderRadius: 12,
              background: 'linear-gradient(135deg, #1e3a5f, #2563eb)',
              display: 'flex', flexDirection: 'column',
              justifyContent: 'flex-end', padding: 16, textDecoration: 'none',
              border: '2px solid rgba(37,99,235,0.4)',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Copy Trading</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
                Copiez les meilleurs
              </div>
            </a>
          </div>
        )}
      </div>

      {/* Search bar — like Stake */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: 'var(--bg-tertiary)',
        borderRadius: 8, overflow: 'hidden',
        border: '1px solid var(--border)',
        marginBottom: 32,
      }}>
        <div style={{
          padding: '10px 16px', fontSize: 14, fontWeight: 600, color: '#fff',
          background: 'rgba(255,255,255,0.06)',
          borderRight: '1px solid var(--border)',
          whiteSpace: 'nowrap',
        }}>Loup-Garou</div>
        <div style={{
          flex: 1, padding: '10px 16px', fontSize: 14,
          color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          Rechercher une partie...
        </div>
      </div>

      {/* Trending Games — like Stake */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Parties en cours</h2>
          <a href="/live" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Voir tout</a>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 12,
        }}>
          {GAMES.map(game => <GameCard key={game.id} game={game} />)}
        </div>
      </div>

      {/* Feature cards — like Stake's promo cards */}
      <div style={{
        display: 'flex', gap: 12, marginBottom: 32,
        flexDirection: isMobile ? 'column' : 'row',
      }}>
        {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} />)}
      </div>

      {/* Bets table — like Stake's Casino Bets */}
      <div style={{ marginBottom: 48 }}>
        <BetsTable />
      </div>
    </div>
  );
}
