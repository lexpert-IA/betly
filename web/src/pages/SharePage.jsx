import React, { useEffect, useState } from 'react';
import BetShareCard from '../components/BetShareCard';
import BetlyLoader from '../components/BetlyLoader';

const BASE = import.meta.env.VITE_API_URL || '';

function timeLeft(date) {
  if (!date) return null;
  const ms = new Date(date) - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 48 ? `${Math.floor(h / 24)}j` : `${h}h ${m}min`;
}

function OddsBar({ yesPct }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ fontWeight: 700, color: '#a855f7' }}>OUI {yesPct}%</span>
        <span style={{ fontWeight: 700, color: '#94a3b8' }}>NON {100 - yesPct}%</span>
      </div>
      <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${yesPct}%`,
          background: 'linear-gradient(90deg,#7c3aed,#a855f7)',
          borderRadius: 999, transition: 'width .5s',
        }} />
      </div>
    </div>
  );
}

export default function SharePage({ betId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!betId) { setLoading(false); setError('Lien invalide'); return; }
    fetch(`${BASE}/api/bets/${betId}/public`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(() => setError('Impossible de charger ce pari'))
      .finally(() => setLoading(false));
  }, [betId]);

  if (loading) return (
    <BetlyLoader size={100} text="Chargement du pari..." style={{ minHeight: '60vh' }} />
  );

  if (error || !data) return (
    <div style={{ maxWidth: 420, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>--</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Pari introuvable</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>{error}</div>
      <a href="/" style={{ color: '#a855f7', fontSize: 14 }}>← Voir les marchés</a>
    </div>
  );

  const { bet, market, bettor } = data;
  const won       = bet.status === 'won';
  const active    = bet.status === 'active';
  const gain      = bet.payout && bet.amount ? (bet.payout - bet.amount).toFixed(2) : null;
  const roi       = bet.payout && bet.amount ? Math.round(((bet.payout - bet.amount) / bet.amount) * 100) : null;
  const total     = (market.totalYes || 0) + (market.totalNo || 0);
  const yesPct    = total > 0 ? Math.round((market.totalYes / total) * 100) : 50;
  const tl        = timeLeft(market.resolutionDate);
  const username  = bettor?.username || 'Quelqu\'un';
  const variant   = won ? 'won' : 'placed';
  const betOdds   = bet.odds ? Math.round(bet.odds * 100) : null;
  const betWithUsername = { ...bet, username };
  const betCount  = market.betCount || '';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {/* Topbar minimal */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        background: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href="/" style={{ textDecoration: 'none' }}>
          <img src="/betly-logo.png" alt="BETLY" style={{ height: 24 }} />
        </a>
        <a
          href="/"
          style={{
            padding: '7px 16px', borderRadius: 8, textDecoration: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontSize: 13, fontWeight: 700,
          }}
        >
          Rejoindre BETLY
        </a>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px 80px' }}>

        {/* Context line */}
        <p style={{ fontSize: 13, color: '#475569', textAlign: 'center', marginBottom: 20 }}>
          {won
            ? `@${username} a gagné sur ce marché`
            : `@${username} a parié sur ce marché`}
        </p>

        {/* Main card */}
        <div style={{ marginBottom: 20 }}>
          <BetShareCard variant={variant} bet={betWithUsername} market={market} />
        </div>

        {/* Context block — active bet */}
        {active && betOdds && (
          <div style={{
            background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '16px 20px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>Cotes en temps réel</div>
            <OddsBar yesPct={yesPct} />
            {betOdds && (
              <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
                Quand @{username} a parié : {betOdds}¢ — Maintenant : {bet.side === 'YES' ? yesPct : 100 - yesPct}¢
                {yesPct > betOdds && bet.side === 'YES' && (
                  <span style={{ color: '#22c55e', marginLeft: 6 }}>· Il était en avance sur tout le monde</span>
                )}
              </p>
            )}
            {tl && (
              <div style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 12, color: '#f59e0b',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                Expire dans {tl}
              </div>
            )}
          </div>
        )}

        {/* Won context */}
        {won && gain && (
          <div style={{
            background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 12, padding: '14px 18px', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>WIN</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>Ce pari a été gagné</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>@{username} a encaissé +${gain}</div>
            </div>
          </div>
        )}

        {/* CTA box */}
        <div style={{
          background: '#111118', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 16, padding: '24px 20px', marginBottom: 16, textAlign: 'center',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
            Parie toi aussi
          </h2>
          {betCount && (
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Rejoins {betCount} parieurs sur ce marché
            </p>
          )}
          <a
            href={`/market/${market._id}`}
            style={{
              display: 'block', padding: '14px 0', borderRadius: 10, marginBottom: 10,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontWeight: 800, fontSize: 15, textDecoration: 'none',
            }}
          >
            Creer mon compte gratuit →
          </a>
          <a
            href={`/market/${market._id}`}
            style={{ fontSize: 13, color: '#475569', textDecoration: 'none' }}
          >
            Voir le marché sans compte
          </a>
        </div>

        {/* Why BETLY */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 28 }}>
          {[
            { icon: '', title: 'Créé par la communauté', desc: 'Les marchés naissent des idées des parieurs.' },
            { icon: '', title: 'Gains en USDC', desc: 'Cryptomonnaie stable, retrait à tout moment.' },
            { icon: '', title: 'Copy trading', desc: 'Copie les meilleurs parieurs automatiquement.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: '#111118', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '12px 10px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{desc}</div>
            </div>
          ))}
        </div>

        {/* Footer minimal */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#1e293b', lineHeight: 1.6 }}>
          BETLY est une plateforme de marchés de prédiction. Pas un casino. · 18+ · Panama
          <br />
          <a href="/terms" style={{ color: '#334155' }}>CGU</a>
          {' · '}
          <a href="/privacy" style={{ color: '#334155' }}>Confidentialité</a>
          {' · '}
          <a href="/responsible-gaming" style={{ color: '#334155' }}>Jeu responsable</a>
        </div>
      </div>
    </div>
  );
}
