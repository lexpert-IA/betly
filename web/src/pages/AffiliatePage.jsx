import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import { TrendingUp, Users, Trophy, Zap, Plus, Share2, PlusCircle } from 'lucide-react';

// ── Interactive Earnings Calculator ───────────────────────────────────────────
function EarningsCalc() {
  const [followers, setFollowers] = useState(50000);
  const [engagement, setEngagement] = useState(3);

  const bettors = Math.round(followers * (engagement / 100) * 0.15);
  const avgBet  = 18;
  const volume  = bettors * avgBet;
  const earned  = Math.round(volume * 0.03);

  return (
    <div style={{
      background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
      borderRadius: 16, padding: 28,
    }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 20 }}>
        Calcule tes gains potentiels
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: '#94a3b8' }}>Followers</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#a855f7' }}>
              {followers.toLocaleString('fr-FR')}
            </span>
          </div>
          <input type="range" min={1000} max={5000000} step={1000}
            value={followers} onChange={e => setFollowers(+e.target.value)}
            style={{ width: '100%', accentColor: '#a855f7' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
            <span>1k</span><span>5M</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 13, color: '#94a3b8' }}>Taux d'engagement</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#06b6d4' }}>{engagement}%</span>
          </div>
          <input type="range" min={0.5} max={15} step={0.5}
            value={engagement} onChange={e => setEngagement(+e.target.value)}
            style={{ width: '100%', accentColor: '#06b6d4' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 2 }}>
            <span>0.5%</span><span>15%</span>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 24, padding: 20, borderRadius: 12,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
          Avec {followers.toLocaleString('fr-FR')} followers à {engagement}% d'engagement :
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 16 }}>
          {[
            { label: 'parieurs estimés', val: bettors.toLocaleString('fr-FR') },
            { label: 'mise moyenne', val: `${avgBet} USDC` },
            { label: 'volume généré', val: `${volume.toLocaleString('fr-FR')} USDC` },
          ].map(({ label, val }) => (
            <div key={label}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc' }}>{val}</div>
              <div style={{ fontSize: 10, color: '#475569' }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{
          fontSize: 32, fontWeight: 900,
          background: 'linear-gradient(135deg, #a855f7, #22c55e)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>
          ~{earned.toLocaleString('fr-FR')} USDC
        </div>
        <div style={{ fontSize: 12, color: '#22c55e', marginTop: 2 }}>
          estimés cette semaine (taux Starter 3%)
        </div>
      </div>
    </div>
  );
}

export default function AffiliatePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const VIRAL_EXAMPLES = [
    { subject: 'Squeezie', title: 'Squeezie annonce une collab gaming surprise ce mois-ci ?', volume: '12 400 USDC', yes: 62 },
    { subject: 'Aya Nakamura', title: 'Aya sort un single avant le 15 avril ?', volume: '8 200 USDC', yes: 71 },
    { subject: 'Un streamer FR', title: 'Ce streamer atteint 1M viewers live ce soir ?', volume: '3 600 USDC', yes: 38 },
  ];

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: isMobile ? '0 16px 100px' : '0 16px' }}>

      {/* ── HERO ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: isMobile ? 16 : 24,
        padding: isMobile ? '36px 20px 40px' : '64px 48px',
        textAlign: 'center', marginBottom: isMobile ? 24 : 40, marginTop: 24,
      }}>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(124,58,237,.2) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(6,182,212,.1) 0%, transparent 60%)',
        }} />
        <div style={{ position: 'absolute', inset: 0, borderRadius: 24, border: '1px solid rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
            color: '#a855f7', padding: '5px 14px', borderRadius: 999,
            fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 20,
          }}>
            <Zap size={12} strokeWidth={1.5} />
            Programme Créateur BETLY
          </div>
          <h1 style={{
            fontSize: isMobile ? 26 : 40, fontWeight: 900, lineHeight: 1.1,
            color: '#f8fafc', marginBottom: 16, letterSpacing: '-1px',
          }}>
            Ta communauté te fait confiance.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Monétise ça.
            </span>
          </h1>
          <p style={{ fontSize: isMobile ? 15 : 17, color: '#94a3b8', maxWidth: 540, margin: '0 auto 32px', lineHeight: 1.7 }}>
            Crée des marchés sur ton contenu. Tes followers parient.
            Toi tu touches <strong style={{ color: '#f8fafc' }}>une commission sur chaque euro misé</strong>.
            Sans rien leur vendre.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.href = user ? '/verify-creator' : '/'}
              style={{
                padding: '14px 32px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#fff', fontSize: 15, fontWeight: 800,
                boxShadow: '0 0 32px rgba(124,58,237,.5)',
              }}
            >
              Créer mon premier marché →
            </button>
            <a href="#calculator" style={{
              padding: '14px 28px', borderRadius: 12, textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8fafc', fontSize: 15, fontWeight: 600,
            }}>
              Calculer mes gains
            </a>
          </div>
        </div>
      </div>

      {/* ── COMMENT ÇA MARCHE ── */}
      <div style={{ marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', marginBottom: 16 }}>
          Comment ça marche
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 14 }}>
          {[
            {
              Icon: PlusCircle, color: '#a855f7', bg: 'rgba(168,85,247,0.1)', border: 'rgba(168,85,247,0.22)',
              num: '01', title: 'Crée un marché sur toi',
              desc: 'Une question sur ton prochain contenu, ta prochaine annonce, ton prochain record.',
            },
            {
              Icon: Share2, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', border: 'rgba(6,182,212,0.22)',
              num: '02', title: 'Partage ton lien',
              desc: 'Un tweet, une story, une description YouTube. Ta communauté clique, mise, débat.',
            },
            {
              Icon: TrendingUp, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.22)',
              num: '03', title: 'Encaisse ta commission',
              desc: '3 à 5% de chaque euro misé via ton lien. Versé chaque semaine en USDC.',
            },
          ].map(({ Icon, color, bg, border, num, title, desc }) => (
            <div key={num} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: '20px 22px', display: 'flex', gap: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: bg, border: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={18} strokeWidth={1.5} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.5px', marginBottom: 3 }}>ÉTAPE {num}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CALCULATEUR ── */}
      <div id="calculator" style={{ marginBottom: isMobile ? 32 : 48 }}>
        <EarningsCalc />
      </div>

      {/* ── EXEMPLES VIRAUX ── */}
      <div style={{ marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', marginBottom: 16 }}>
          Exemples de marchés viraux
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {VIRAL_EXAMPLES.map(({ subject, title, volume, yes }) => (
            <div key={title} style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#a855f7', marginBottom: 3 }}>@{subject}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{title}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#22c55e' }}>{volume}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{yes}% OUI · simulé</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── TIERS ── */}
      <div style={{ marginBottom: isMobile ? 32 : 48 }}>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: '#475569', marginBottom: 16 }}>
          Tiers de commission
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {[
            { tier: 'Starter', rate: '3%', condition: 'Dès l\'inscription', color: '#64748b' },
            { tier: 'Creator', rate: '4%', condition: '>1 000 USDC/mois', color: '#a855f7' },
            { tier: 'Pro',     rate: '5%', condition: '>10 000 USDC/mois', color: '#f59e0b', badge: 'Elite' },
          ].map(({ tier, rate, condition, color, badge }) => (
            <div key={tier} style={{
              background: `${color}10`, border: `1px solid ${color}30`,
              borderRadius: 12, padding: isMobile ? '14px 10px' : '20px', textAlign: 'center',
            }}>
              {badge && <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4 }}>{badge}</div>}
              <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 900, color, letterSpacing: '-1px' }}>{rate}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 3 }}>{tier}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>{condition}</div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#475569', marginTop: 10 }}>
          Versement automatique chaque lundi · Minimum 5 USDC
        </div>
      </div>

      {/* ── SOCIAL PROOF ── */}
      <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 40 }}>
        <div style={{ fontSize: 14, color: '#64748b' }}>
          <span style={{
            fontSize: 28, fontWeight: 900,
            background: 'linear-gradient(135deg, #a855f7, #06b6d4)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            14
          </span>
          {' '}créateurs gagnent déjà avec BETLY
        </div>
      </div>

      {/* ── CTA FINAL ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
        border: '1px solid rgba(124,58,237,0.2)', borderRadius: 20,
        padding: isMobile ? '28px 20px' : '40px 48px',
        textAlign: 'center', marginBottom: 40,
      }}>
        <div style={{ fontSize: isMobile ? 20 : 26, fontWeight: 900, color: '#f8fafc', marginBottom: 10 }}>
          Prêt à monétiser ta communauté ?
        </div>
        <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>
          Inscription gratuite · Pas de carte bancaire · Premier marché en 2 minutes
        </div>
        <button
          onClick={() => window.location.href = user ? '/verify-creator' : '/'}
          style={{
            padding: '16px 40px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontSize: 16, fontWeight: 800,
            boxShadow: '0 0 40px rgba(124,58,237,.5)',
          }}
        >
          Créer mon premier marché →
        </button>
      </div>
    </div>
  );
}
