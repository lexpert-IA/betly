import React, { useState } from 'react';

const S = {
  page: { maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px', color: '#e2e8f0', lineHeight: 1.7 },
  h1:   { fontSize: 26, fontWeight: 900, color: '#f8fafc', marginBottom: 6 },
  meta: { fontSize: 12, color: '#475569', marginBottom: 40 },
  h2:   { fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 36, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  p:    { fontSize: 14, color: '#94a3b8', marginBottom: 12, lineHeight: 1.75 },
  ul:   { paddingLeft: 20, marginBottom: 12 },
  li:   { fontSize: 14, color: '#94a3b8', marginBottom: 6, lineHeight: 1.6 },
  warn: { padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 13, marginBottom: 20 },
  info: { padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b', fontSize: 13, marginBottom: 20 },
};

const RESTRICTED = ['États-Unis', 'France', 'Allemagne', 'Royaume-Uni', 'Australie', 'Belgique', 'Italie', 'Pays-Bas', 'Pologne', 'Russie', 'Singapour', 'Ontario (Canada)', 'Québec (Canada)'];

export default function TermsPage() {
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(o => o === i ? null : i);

  const sections = [
    {
      title: '1. Introduction',
      content: (
        <>
          <p style={S.p}>BETLY est une plateforme de marchés de prédiction communautaires opérée par <strong style={{ color: '#f8fafc' }}>BETLY Labs Inc.</strong>, société enregistrée en République du Panama.</p>
          <p style={S.p}>En accédant à BETLY, vous acceptez d'être lié par ces Conditions Générales d'Utilisation (CGU). Veuillez les lire attentivement avant d'utiliser notre service.</p>
          <p style={S.p}>Date de dernière mise à jour : 28 mars 2026.</p>
        </>
      ),
    },
    {
      title: '2. Juridictions restreintes',
      content: (
        <>
          <div style={S.warn}>Si vous résidez dans une juridiction restreinte, vous n'êtes pas autorisé à utiliser les fonctionnalités de trading de BETLY.</div>
          <p style={S.p}>Les utilisateurs résidant dans les pays et régions suivants ne sont pas autorisés à placer des paris ou créer des marchés :</p>
          <ul style={S.ul}>
            {RESTRICTED.map(c => <li key={c} style={S.li}>{c}</li>)}
          </ul>
          <p style={S.p}>L'utilisation d'un VPN ou de tout autre moyen technique pour contourner ces restrictions géographiques est <strong style={{ color: '#f87171' }}>strictement interdite</strong> et constitue une violation de ces CGU. BETLY se réserve le droit de suspendre immédiatement tout compte suspect.</p>
        </>
      ),
    },
    {
      title: '3. Conditions d\'utilisation',
      content: (
        <>
          <p style={S.p}>En utilisant BETLY, vous certifiez :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Avoir au minimum 18 ans.</strong> L'accès est strictement interdit aux mineurs.</li>
            <li style={S.li}>Être titulaire d'un seul compte BETLY. Les comptes multiples sont interdits et entraîneront la suspension de tous les comptes concernés.</li>
            <li style={S.li}>Ne pas manipuler les marchés, notamment par le wash trading, l'injection artificielle de liquidités, ou toute forme de coordination visant à fausser les prix.</li>
            <li style={S.li}>Ne pas créer de marchés dont vous pouvez directement influencer le résultat sans le déclarer explicitement (cf. avertissement "Marché auto" sur votre profil créateur).</li>
            <li style={S.li}>Respecter les lois applicables dans votre juridiction de résidence.</li>
          </ul>
        </>
      ),
    },
    {
      title: '4. Marchés et résolution Oracle',
      content: (
        <>
          <p style={S.p}>BETLY utilise un système Oracle à trois niveaux pour la résolution des marchés :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Oracle L1</strong> — Résolution automatique via sources de données publiques vérifiables (APIs officielles, données on-chain).</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Oracle L2</strong> — Résolution par vote communautaire pondéré par la réputation.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Oracle L3</strong> — Arbitrage manuel par l'équipe BETLY en cas de litige.</li>
          </ul>
          <p style={S.p}><strong style={{ color: '#f8fafc' }}>BETLY n'est pas responsable</strong> des erreurs ou retards dans la résolution des marchés. Les décisions Oracle sont finales sauf recours explicite dans les 48h suivant la résolution.</p>
        </>
      ),
    },
    {
      title: '5. Risques financiers',
      content: (
        <>
          <div style={S.info}>Les marchés de prédiction comportent des risques financiers substantiels.</div>
          <p style={S.p}>Vous pouvez perdre <strong style={{ color: '#f87171' }}>l'intégralité des fonds misés</strong>. Ne pariez jamais plus que ce que vous pouvez vous permettre de perdre.</p>
          <p style={S.p}><strong style={{ color: '#f8fafc' }}>BETLY ne constitue pas un conseil financier, d'investissement ou juridique.</strong> Toutes les informations disponibles sur la plateforme sont fournies à titre informatif uniquement.</p>
          <p style={S.p}>Les performances passées ne préjugent pas des résultats futurs.</p>
        </>
      ),
    },
    {
      title: '6. Frais et commissions',
      content: (
        <>
          <p style={S.p}>BETLY applique la structure de frais suivante, affichée clairement avant chaque transaction :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#a855f7' }}>3% de frais de plateforme</strong> prélevés sur chaque marché résolu.</li>
            <li style={S.li}><strong style={{ color: '#06b6d4' }}>2% de frais créateur</strong> reversés au créateur du marché lors de la résolution.</li>
            <li style={S.li}><strong style={{ color: '#22c55e' }}>3–5% de commission de parrainage</strong> pour les créateurs avec liens d'affiliation actifs.</li>
          </ul>
          <p style={S.p}>Aucuns frais de dépôt ou de retrait ne sont appliqués par BETLY. Des frais de réseau Polygon peuvent s'appliquer.</p>
        </>
      ),
    },
    {
      title: '7. Propriété intellectuelle',
      content: (
        <p style={S.p}>L'ensemble du contenu de BETLY — logo, design, code, textes, algorithmes — appartient à BETLY Labs Inc. ou à ses concédants, sauf mention contraire. Toute reproduction, modification ou distribution non autorisée est interdite.</p>
      ),
    },
    {
      title: '8. Limitation de responsabilité',
      content: (
        <>
          <p style={S.p}>Dans les limites permises par la loi applicable, BETLY et ses dirigeants, employés et agents ne peuvent être tenus responsables :</p>
          <ul style={S.ul}>
            <li style={S.li}>Des pertes financières résultant de l'utilisation de la plateforme.</li>
            <li style={S.li}>Des interruptions de service ou indisponibilités techniques.</li>
            <li style={S.li}>Des erreurs ou inexactitudes dans les données de marché.</li>
            <li style={S.li}>De tout acte ou omission de tiers (oracles, fournisseurs de données).</li>
          </ul>
        </>
      ),
    },
    {
      title: '9. Arbitrage et droit applicable',
      content: (
        <>
          <p style={S.p}>Ces CGU sont régies par les lois de la <strong style={{ color: '#f8fafc' }}>République du Panama</strong>.</p>
          <p style={S.p}>Tout litige découlant de l'utilisation de BETLY sera résolu par arbitrage contraignant au Panama, selon les règles de la Chambre de Commerce de Panama. <strong style={{ color: '#f8fafc' }}>Aucune action collective n'est autorisée.</strong></p>
        </>
      ),
    },
    {
      title: '10. Modifications des CGU',
      content: (
        <p style={S.p}>BETLY se réserve le droit de modifier ces CGU à tout moment. Les modifications seront notifiées par email et/ou notification in-app. La poursuite de l'utilisation de BETLY après notification vaut acceptation des nouvelles conditions.</p>
      ),
    },
  ];

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a855f7', marginBottom: 12,
        }}>
          Conditions Générales d'Utilisation
        </span>
      </div>
      <h1 style={S.h1}>CGU — BETLY Labs Inc.</h1>
      <p style={S.meta}>Dernière mise à jour : 28 mars 2026 · Version 1.0 · Juridiction : Panama · Contact : <a href="mailto:legal@betly.gg" style={{ color: '#a855f7' }}>legal@betly.gg</a></p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map((s, i) => (
          <div key={i} style={{
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <button
              onClick={() => toggle(i)}
              style={{
                width: '100%', padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
                background: open === i ? 'rgba(124,58,237,0.08)' : 'transparent',
                border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{s.title}</span>
              <span style={{ color: '#475569', fontSize: 16 }}>{open === i ? '−' : '+'}</span>
            </button>
            {open === i && (
              <div style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                {s.content}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, padding: '16px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12, color: '#475569', textAlign: 'center' }}>
        © 2026 BETLY Labs Inc. — République du Panama · <a href="/privacy" style={{ color: '#a855f7' }}>Confidentialité</a> · <a href="/responsible-gaming" style={{ color: '#a855f7' }}>Jeu responsable</a> · <a href="/legal" style={{ color: '#a855f7' }}>Mentions légales</a>
      </div>
    </div>
  );
}
