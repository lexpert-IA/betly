import React from 'react';
import { Shield, Phone, Globe, Clock, TrendingDown, UserX } from 'lucide-react';

const S = {
  page: { maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px', color: '#e2e8f0', lineHeight: 1.7 },
  p:    { fontSize: 14, color: '#94a3b8', marginBottom: 12, lineHeight: 1.75 },
  li:   { fontSize: 14, color: '#94a3b8', marginBottom: 8, lineHeight: 1.6 },
};

export default function ResponsibleGamingPage() {
  return (
    <div style={S.page}>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', marginBottom: 12,
        }}>
          Jeu Responsable
        </span>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>Jeu responsable</h1>
      <p style={{ fontSize: 12, color: '#475569', marginBottom: 32 }}>BETLY Labs Inc. · République du Panama</p>

      <p style={S.p}>BETLY encourage un jeu responsable et transparent. Nous mettons à disposition des outils de protection et des ressources pour vous aider à garder le contrôle.</p>

      {/* Outils */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 32, marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        Nos outils de protection
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { Icon: TrendingDown, color: '#a855f7', title: 'Limite de dépôt', desc: 'Fixez une limite journalière ou mensuelle dans vos paramètres.' },
          { Icon: Shield,       color: '#06b6d4', title: 'Limite de mise',  desc: 'Plafonnez votre mise maximale par marché.' },
          { Icon: Clock,        color: '#f59e0b', title: 'Historique complet', desc: 'Consultez l\'intégralité de vos transactions dans votre compte.' },
          { Icon: UserX,        color: '#ef4444', title: 'Auto-exclusion',  desc: 'Suspendez votre compte temporairement ou définitivement.' },
        ].map(({ Icon, color, title, desc }) => (
          <div key={title} style={{
            background: `${color}10`, border: `1px solid ${color}25`,
            borderRadius: 12, padding: '16px 18px',
          }}>
            <Icon size={20} strokeWidth={1.5} color={color} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* Signaux d'alerte */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        Signaux d'alerte
      </h2>
      <p style={S.p}>Vous pourriez avoir un problème si vous :</p>
      <ul style={{ paddingLeft: 20, marginBottom: 20 }}>
        {[
          'Pariez plus que ce que vous pouvez vous permettre de perdre',
          'Essayez de "récupérer" des pertes en misant plus',
          'Consacrez un temps excessif à la plateforme',
          'Négligez vos responsabilités à cause du jeu',
          'Ressentez de l\'anxiété ou de l\'irritabilité si vous ne pariez pas',
        ].map(s => <li key={s} style={S.li}>{s}</li>)}
      </ul>

      {/* Ressources */}
      <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 32, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        Besoin d'aide ?
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {[
          { Icon: Phone,  color: '#22c55e', title: 'Joueurs Info Service',    info: '09 74 75 13 13',              sub: 'France · Appel non surtaxé · 24h/24' },
          { Icon: Globe,  color: '#06b6d4', title: 'Gambling Therapy',        info: 'gamblingtherapy.org',         sub: 'International · Gratuit · Anonyme' },
          { Icon: Globe,  color: '#a855f7', title: 'Gamblers Anonymous',      info: 'gamblersanonymous.org',       sub: 'Groupes de soutien mondiaux' },
        ].map(({ Icon, color, title, info, sub }) => (
          <div key={title} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '14px 18px',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: `${color}15`, border: `1px solid ${color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} strokeWidth={1.5} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>{title}</div>
              <div style={{ fontSize: 13, color, fontWeight: 600 }}>{info}</div>
              <div style={{ fontSize: 11, color: '#475569' }}>{sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* BETLY policy */}
      <div style={{ padding: '16px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>Engagement BETLY</div>
        <p style={{ ...S.p, marginBottom: 0 }}>
          BETLY se réserve le droit de suspendre ou restreindre tout compte présentant des signes de comportement problématique, indépendamment de la demande de l'utilisateur. La protection de nos utilisateurs prime sur tout impératif commercial.
        </p>
      </div>

      <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#475569', textAlign: 'center' }}>
        Pour auto-exclusion ou limite d'urgence : <a href="mailto:support@betly.gg" style={{ color: '#a855f7' }}>support@betly.gg</a> · Réponse sous 4h
      </div>
    </div>
  );
}
