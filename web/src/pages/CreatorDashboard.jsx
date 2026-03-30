import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { useIsMobile } from '../hooks/useIsMobile';
import {
  TrendingUp, Users, Trophy, Zap, Copy, ExternalLink,
  BarChart2, CheckCircle, Clock, Share2, Star,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const TIER_INFO = {
  starter: { label: 'Starter',  color: '#64748b', rate: '3%',  next: 'Creator', nextVolume: 1000  },
  creator: { label: 'Creator',  color: '#a855f7', rate: '4%',  next: 'Pro',     nextVolume: 10000 },
  pro:     { label: 'Pro',      color: '#f59e0b', rate: '5%',  next: null,      nextVolume: null  },
};

function StatCard({ label, value, sub, color = '#a78bfa', icon: Icon }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '16px 18px',
    }}>
      {Icon && <Icon size={16} strokeWidth={1.5} color={color} style={{ marginBottom: 8 }} />}
      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function CreatorDashboard() {
  const { user, refreshUser } = useAuth();
  const isMobile = useIsMobile();
  const [data, setData] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiFetch('/api/creator/dashboard').then(r => r.json()),
      apiFetch('/api/creator/markets').then(r => r.json()),
    ]).then(([d, m]) => {
      setData(d);
      setMarkets(m.markets || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>Connecte-toi pour accéder au dashboard créateur.</div>
      </div>
    );
  }

  if (!user?.creatorVerified) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', padding: 24, textAlign: 'center' }}>
        <Zap size={36} color="#a855f7" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
          Deviens créateur vérifié
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24, lineHeight: 1.6 }}>
          Vérifie ton compte social pour débloquer les commissions et le dashboard complet.
        </div>
        <a href="/verify-creator" style={{
          padding: '12px 28px', borderRadius: 10, textDecoration: 'none',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: '#fff', fontSize: 14, fontWeight: 700,
        }}>
          Vérifier mon compte →
        </a>
      </div>
    );
  }

  const BASE = import.meta.env.VITE_BASE_URL || 'https://betly.gg';
  const refLink = data?.user?.referralCode ? `${BASE}/?ref=${data.user.referralCode}` : BASE;
  const tierInfo = TIER_INFO[data?.user?.tier || 'starter'];
  const tweetText = encodeURIComponent(`Je viens de créer un marché sur ma communauté\nDécouvre et mise → ${refLink}\n#BETLY`);

  function copyLink() {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const TABS = [
    { key: 'stats',    label: 'Statistiques', Icon: BarChart2 },
    { key: 'markets',  label: 'Mes Marchés',  Icon: TrendingUp },
    { key: 'link',     label: 'Mon Lien',     Icon: Share2 },
    { key: 'tips',     label: 'Gagner Plus',  Icon: Star },
  ];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: isMobile ? '16px 16px 100px' : '28px 16px' }}>
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.15) 0%, rgba(6,182,212,0.08) 100%)',
        border: '1px solid rgba(124,58,237,0.2)', borderRadius: 16,
        padding: isMobile ? '20px 16px' : '28px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, color: '#f8fafc' }}>
              @{data?.user?.handle || user?.username}
            </span>
            <span style={{
              padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
              background: `${tierInfo.color}20`, border: `1px solid ${tierInfo.color}50`,
              color: tierInfo.color,
            }}>
              {tierInfo.label} · {tierInfo.rate}
            </span>
            <CheckCircle size={16} color="#22c55e" strokeWidth={2} />
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Monétise ta communauté — chaque pari via ton lien te rapporte {tierInfo.rate}.
          </div>
        </div>
        {!isMobile && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#22c55e' }}>
              {(data?.user?.pendingEarnings || 0).toFixed(2)} USDC
            </div>
            <div style={{ fontSize: 11, color: '#475569' }}>en attente de versement</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto' }}>
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
            border: activeTab === key ? '1px solid #a855f7' : '1px solid rgba(255,255,255,0.08)',
            background: activeTab === key ? 'rgba(168,85,247,0.15)' : 'transparent',
            color: activeTab === key ? '#a855f7' : '#64748b',
            fontSize: 13, fontWeight: activeTab === key ? 700 : 400,
          }}>
            <Icon size={13} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 48, textAlign: 'center', color: '#64748b', fontSize: 13 }}>Chargement…</div>
      )}

      {!loading && activeTab === 'stats' && data && (
        <div>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
            <StatCard icon={TrendingUp} label="Volume total"       value={`${(data.stats.totalVolume || 0).toFixed(0)}`}    sub="USDC"  color="#a78bfa" />
            <StatCard icon={Trophy}    label="Gains totaux"        value={`${(data.stats.totalEarned || 0).toFixed(2)}`}    sub="USDC"  color="#22c55e" />
            <StatCard icon={Zap}       label="Cette semaine"       value={`${(data.stats.weekEarned || 0).toFixed(2)}`}     sub="USDC"  color="#f59e0b" />
            <StatCard icon={Users}     label="Parieurs uniques"    value={data.stats.uniqueBettors || 0}                                color="#06b6d4" />
            <StatCard icon={BarChart2} label="Marchés actifs"      value={data.stats.activeMarkets || 0}                               color="#a855f7" />
            <StatCard icon={Clock}     label="Volume ce mois"      value={`${(data.stats.monthlyVolume || 0).toFixed(0)}`}  sub="USDC"  color="#64748b" />
          </div>

          {/* Tier progression */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '18px 20px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                Progression de tier
              </span>
              <span style={{ fontSize: 11, color: tierInfo.color, fontWeight: 700 }}>
                {tierInfo.label} → {tierInfo.next || 'Niveau max !'}
              </span>
            </div>
            {tierInfo.next ? (
              <>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 999,
                    background: `linear-gradient(90deg, ${tierInfo.color}, #a855f7)`,
                    width: `${data.tier.progress}%`, transition: 'width 1s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                  Il te manque <strong style={{ color: '#f8fafc' }}>{data.tier.missing?.toFixed(0)} USDC</strong> de volume ce mois pour passer {tierInfo.next} ({TIER_INFO[data.tier.nextTier]?.rate})
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#f59e0b' }}>Tu es au niveau maximum !</div>
            )}
          </div>

          {/* Pending payout CTA */}
          {(data.user.pendingEarnings || 0) >= 5 && (
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 12, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#22c55e' }}>
                  {(data.user.pendingEarnings).toFixed(2)} USDC disponibles
                </div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Virés chaque lundi — ou demande maintenant</div>
              </div>
              <button
                onClick={async () => {
                  const res = await apiFetch('/api/creator/payout', { method: 'POST' });
                  const d = await res.json();
                  if (d.success) { alert(`✓ ${d.amount.toFixed(2)} USDC virés sur ton solde BETLY !`); refreshUser(); }
                }}
                style={{
                  padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.35)',
                  color: '#22c55e', fontSize: 13, fontWeight: 700,
                }}
              >
                Encaisser maintenant
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'markets' && (
        <div>
          {markets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
              <TrendingUp size={32} strokeWidth={1} color="#334155" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>Aucun marché créé</div>
              <a href="/create" style={{ color: '#a855f7', fontSize: 13 }}>Créer mon premier marché →</a>
            </div>
          ) : (
            <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 0, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase' }}>
                <div>Marché</div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>Volume</div>
                <div style={{ textAlign: 'right', minWidth: 80 }}>Commission</div>
                <div style={{ textAlign: 'right', minWidth: 60 }}>Statut</div>
              </div>
              {markets.map((m, i) => (
                <div key={m._id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  gap: 0, padding: '12px 16px', alignItems: 'center',
                  borderBottom: i < markets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  transition: 'background .15s',
                  cursor: 'pointer',
                }}
                onClick={() => window.location.href = `/market/${m._id}`}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, paddingRight: 12 }}>
                    {m.title.slice(0, 55)}{m.title.length > 55 ? '…' : ''}
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8', minWidth: 80 }}>
                    {(m.volume || 0).toFixed(0)} USDC
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: '#22c55e', fontWeight: 700, minWidth: 80 }}>
                    +{(m.commissionEarned || 0).toFixed(2)} USDC
                  </div>
                  <div style={{ textAlign: 'right', minWidth: 60 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                      color: m.status === 'active' ? '#22c55e' : m.status === 'resolved' ? '#64748b' : '#f59e0b',
                      background: m.status === 'active' ? 'rgba(34,197,94,0.1)' : m.status === 'resolved' ? 'rgba(100,116,139,0.1)' : 'rgba(245,158,11,0.1)',
                    }}>
                      {m.status === 'active' ? 'actif' : m.status === 'resolved' ? 'résolu' : m.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && activeTab === 'link' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Ref link */}
          <div style={{
            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>Ton lien de parrainage</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
              Chaque euro misé via ce lien te rapporte {tierInfo.rate} de commission.
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                flex: 1, minWidth: 0, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                fontSize: 12, color: '#a78bfa', fontFamily: 'monospace',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {refLink}
              </div>
              <button onClick={copyLink} style={{
                padding: '10px 16px', borderRadius: 8, border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)'}`,
                background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(168,85,247,0.12)',
                color: copied ? '#22c55e' : '#a855f7', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
              }}>
                <Copy size={13} strokeWidth={2} /> {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          </div>

          {/* Tweet button */}
          <a
            href={`https://twitter.com/intent/tweet?text=${tweetText}`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 20px', borderRadius: 12, textDecoration: 'none',
              background: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.25)',
              color: '#1d9bf0', fontSize: 14, fontWeight: 700,
            }}
          >
            <Share2 size={18} strokeWidth={1.5} />
            Partager sur X (Twitter)
          </a>

          {/* QR Code */}
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 20,
          }}>
            <button
              onClick={() => setShowQR(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#94a3b8', fontSize: 13, fontWeight: 600, padding: 0,
              }}
            >
              <QrCode size={16} strokeWidth={1.5} />
              {showQR ? 'Masquer' : 'Afficher'} le QR Code
            </button>
            {showQR && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: '#fff', padding: 12, borderRadius: 10 }}>
                  <QRCodeSVG value={refLink} size={160} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === 'tips' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              icon: '',
              title: 'Crée un marché sur toi-même',
              desc: 'Les marchés où tu es le sujet génèrent 3x plus d\'engagement. Ta communauté vote sur ton futur.',
              badge: '+300% engagement',
              badgeColor: '#22c55e',
            },
            {
              icon: '',
              title: 'Partage dans les 2h après un événement',
              desc: 'La hype est au maximum juste après une annonce ou un record. Capture ce momentum.',
              badge: 'timing critique',
              badgeColor: '#f59e0b',
            },
            {
              icon: '',
              title: 'Utilise le format thread Twitter',
              desc: 'Un thread avec le contexte + le lien du marché → 3x plus de clics qu\'un tweet simple.',
              badge: '3x plus de clics',
              badgeColor: '#06b6d4',
            },
          ].map(({ icon, title, desc, badge, badgeColor }) => (
            <div key={title} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 18px',
              display: 'flex', gap: 14, alignItems: 'flex-start',
            }}>
              <div style={{ fontSize: 24, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{title}</span>
                  <span style={{
                    padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                    color: badgeColor, background: `${badgeColor}18`, border: `1px solid ${badgeColor}40`,
                  }}>
                    {badge}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}

          <a href="/create" style={{
            marginTop: 8, padding: '14px', borderRadius: 12, textDecoration: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontSize: 14, fontWeight: 700, textAlign: 'center', display: 'block',
          }}>
            Créer un marché maintenant →
          </a>
        </div>
      )}
    </div>
  );
}
