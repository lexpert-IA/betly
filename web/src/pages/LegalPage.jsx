import React from 'react';

const S = {
  page: { maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px', color: '#e2e8f0', lineHeight: 1.7 },
  h2:   { fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 32, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  p:    { fontSize: 14, color: '#94a3b8', marginBottom: 12, lineHeight: 1.75 },
  row:  { display: 'flex', gap: 8, marginBottom: 8, fontSize: 14 },
  lbl:  { color: '#64748b', minWidth: 140, flexShrink: 0 },
  val:  { color: '#f8fafc', fontWeight: 600 },
};

export default function LegalPage() {
  return (
    <div style={S.page}>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.3)', color: '#94a3b8', marginBottom: 12,
        }}>
          Mentions Légales
        </span>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: '#f8fafc', marginBottom: 24 }}>Mentions légales</h1>

      {/* Identité */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '20px 24px', marginBottom: 24 }}>
        {[
          { label: 'Entité',          value: 'BETLY Labs Inc.' },
          { label: 'Type',            value: 'Société anonyme' },
          { label: 'Juridiction',     value: 'République du Panama' },
          { label: 'Contact légal',   value: 'legal@betly.gg' },
          { label: 'Contact privacy', value: 'privacy@betly.gg' },
          { label: 'Contact support', value: 'support@betly.gg' },
        ].map(({ label, value }) => (
          <div key={label} style={S.row}>
            <span style={S.lbl}>{label}</span>
            <span style={S.val}>{value}</span>
          </div>
        ))}
      </div>

      <h2 style={S.h2}>Nature de la plateforme</h2>
      <p style={S.p}>BETLY est une plateforme de <strong style={{ color: '#f8fafc' }}>marchés de prédiction</strong> basée sur la technologie blockchain (réseau Polygon). BETLY n'est pas un casino, un opérateur de jeux d'argent au sens traditionnel, ni un prestataire de services d'investissement.</p>
      <p style={S.p}><strong style={{ color: '#f8fafc' }}>BETLY n'est pas régulé en tant qu'opérateur de jeux d'argent</strong> dans les juridictions restreintes listées dans nos CGU. Les utilisateurs sont seuls responsables du respect des lois locales applicables dans leur pays de résidence.</p>

      <h2 style={S.h2}>Avertissement financier</h2>
      <p style={S.p}>Les marchés de prédiction comportent des risques financiers. Vous pouvez perdre l'intégralité des fonds engagés. BETLY ne constitue pas un conseil financier ou d'investissement. Les performances passées ne préjugent pas des résultats futurs.</p>

      <h2 style={S.h2}>Hébergement technique</h2>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
        {[
          { label: 'Frontend',   value: 'Vercel Inc. · San Francisco, CA' },
          { label: 'Backend',    value: 'Railway Corp. · San Francisco, CA' },
          { label: 'Base de données', value: 'MongoDB Atlas · AWS' },
          { label: 'Auth',       value: 'Google Firebase · Google LLC' },
          { label: 'Réseau',     value: 'Polygon (MATIC) · Décentralisé' },
        ].map(({ label, value }) => (
          <div key={label} style={S.row}>
            <span style={S.lbl}>{label}</span>
            <span style={{ ...S.val, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>

      <h2 style={S.h2}>Propriété intellectuelle</h2>
      <p style={S.p}>L'ensemble du contenu, logo, design et code source de BETLY est protégé par les droits de propriété intellectuelle de BETLY Labs Inc. Toute reproduction non autorisée est interdite.</p>

      <h2 style={S.h2}>Droit applicable</h2>
      <p style={S.p}>Ces mentions légales et l'ensemble de l'activité de BETLY sont régis par les lois de la République du Panama. Tout litige sera soumis à la compétence exclusive des tribunaux panaméens.</p>

      <div style={{ marginTop: 40, padding: '14px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#475569', textAlign: 'center' }}>
        © 2026 BETLY Labs Inc. · <a href="/terms" style={{ color: '#a855f7' }}>CGU</a> · <a href="/privacy" style={{ color: '#a855f7' }}>Confidentialité</a> · <a href="/responsible-gaming" style={{ color: '#a855f7' }}>Jeu responsable</a>
      </div>
    </div>
  );
}
