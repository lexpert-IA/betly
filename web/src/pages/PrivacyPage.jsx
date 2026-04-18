import React, { useState } from 'react';

const S = {
  page: { maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px', color: '#e2e8f0', lineHeight: 1.7 },
  h1:   { fontSize: 26, fontWeight: 900, color: '#f8fafc', marginBottom: 6 },
  meta: { fontSize: 12, color: '#475569', marginBottom: 40 },
  h2:   { fontSize: 16, fontWeight: 800, color: '#f8fafc', marginTop: 36, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' },
  p:    { fontSize: 14, color: '#94a3b8', marginBottom: 12, lineHeight: 1.75 },
  ul:   { paddingLeft: 20, marginBottom: 12 },
  li:   { fontSize: 14, color: '#94a3b8', marginBottom: 6, lineHeight: 1.6 },
};

export default function PrivacyPage() {
  const [open, setOpen] = useState(null);
  const toggle = (i) => setOpen(o => o === i ? null : i);

  const sections = [
    {
      title: '1. Données collectées',
      content: (
        <>
          <p style={S.p}>BETLY collecte uniquement les données nécessaires au fonctionnement du service :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Données d'identification</strong> — Adresse email (si inscription email), pseudo choisi, photo de profil Google (si connexion Google).</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Données blockchain</strong> — Adresse wallet Polygon publique. Nous ne stockons jamais vos clés privées.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Données d'activité</strong> — Historique complet des paris, transactions, marchés créés, commentaires.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Données de navigation</strong> — Adresse IP (anonymisée après 24h), cookies de session, données d'usage anonymisées.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Vérification d'âge</strong> — Confirmation que vous avez 18 ans ou plus (date et adresse IP de vérification).</li>
          </ul>
        </>
      ),
    },
    {
      title: '2. Utilisation des données',
      content: (
        <>
          <p style={S.p}>Vos données sont utilisées exclusivement pour :</p>
          <ul style={S.ul}>
            <li style={S.li}>Fournir et améliorer le service BETLY.</li>
            <li style={S.li}>Prévenir la fraude, le wash trading et les accès non autorisés.</li>
            <li style={S.li}>Envoyer des communications importantes (résolution de marchés, sécurité du compte).</li>
            <li style={S.li}>Respecter nos obligations légales (géoblocage des juridictions restreintes).</li>
            <li style={S.li}>Calculer et verser les commissions créateurs.</li>
          </ul>
          <p style={S.p}>Nous n'utilisons pas vos données à des fins publicitaires tierces.</p>
        </>
      ),
    },
    {
      title: '3. Partage des données',
      content: (
        <>
          <p style={S.p}><strong style={{ color: '#22c55e' }}>BETLY ne vend jamais vos données personnelles.</strong></p>
          <p style={S.p}>Nous partageons uniquement avec :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Firebase (Google)</strong> — Authentification et stockage sécurisé. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7' }}>Politique Firebase →</a></li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>MongoDB Atlas</strong> — Base de données chiffrée. <a href="https://www.mongodb.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7' }}>Politique MongoDB →</a></li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Autorités légales</strong> — Uniquement si requis par une obligation légale formelle.</li>
          </ul>
        </>
      ),
    },
    {
      title: '4. Cookies',
      content: (
        <>
          <p style={S.p}>BETLY utilise deux types de cookies :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Cookies essentiels</strong> — Nécessaires au fonctionnement (session, authentification, préférences de langue). Ne peuvent pas être refusés.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Cookies analytiques</strong> — Mesure d'audience anonymisée pour améliorer l'expérience. Peuvent être refusés.</li>
          </ul>
          <p style={S.p}>Votre consentement est mémorisé dans votre navigateur. Vous pouvez modifier vos préférences à tout moment en bas de page.</p>
        </>
      ),
    },
    {
      title: '5. Vos droits',
      content: (
        <>
          <p style={S.p}>Conformément aux principes RGPD que nous respectons volontairement, vous disposez des droits suivants :</p>
          <ul style={S.ul}>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Droit d'accès</strong> — Obtenir une copie de toutes vos données.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Droit de suppression</strong> — Demander la suppression de votre compte et de vos données.</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Droit de portabilité</strong> — Recevoir vos données dans un format standard (JSON).</li>
            <li style={S.li}><strong style={{ color: '#f8fafc' }}>Droit de rectification</strong> — Corriger des données inexactes.</li>
          </ul>
          <p style={S.p}>Pour exercer ces droits : <a href="mailto:privacy@betly.gg" style={{ color: '#a855f7' }}>privacy@betly.gg</a>. Réponse sous 30 jours.</p>
        </>
      ),
    },
    {
      title: '6. Sécurité',
      content: (
        <>
          <p style={S.p}><strong style={{ color: '#22c55e' }}>Nous ne stockons jamais vos clés privées.</strong></p>
          <ul style={S.ul}>
            <li style={S.li}>Toutes les communications sont chiffrées via HTTPS/TLS.</li>
            <li style={S.li}>Les mots de passe sont hashés avec bcrypt (jamais stockés en clair).</li>
            <li style={S.li}>L'authentification Firebase utilise des tokens JWT à durée limitée.</li>
            <li style={S.li}>Les bases de données sont chiffrées au repos (AES-256).</li>
          </ul>
        </>
      ),
    },
    {
      title: '7. Rétention des données',
      content: (
        <p style={S.p}>Vos données sont conservées pendant <strong style={{ color: '#f8fafc' }}>3 ans</strong> après votre dernière activité sur la plateforme. Les logs de sécurité sont conservés 12 mois. Sur demande de suppression, vos données sont effacées sous 30 jours (sauf obligation légale de conservation).</p>
      ),
    },
  ];

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 8 }}>
        <span style={{
          display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
          background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.3)', color: '#06b6d4', marginBottom: 12,
        }}>
          Politique de Confidentialité
        </span>
      </div>
      <h1 style={S.h1}>Confidentialité — BETLY Labs Inc.</h1>
      <p style={S.meta}>Dernière mise à jour : 28 mars 2026 · Contact : <a href="mailto:privacy@betly.gg" style={{ color: '#a855f7' }}>privacy@betly.gg</a></p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
            <button
              onClick={() => toggle(i)}
              style={{
                width: '100%', padding: '14px 18px', textAlign: 'left', cursor: 'pointer',
                background: open === i ? 'rgba(6,182,212,0.06)' : 'transparent',
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
        © 2026 BETLY Labs Inc. — République du Panama · <a href="/terms" style={{ color: '#a855f7' }}>CGU</a> · <a href="/responsible-gaming" style={{ color: '#a855f7' }}>Jeu responsable</a> · <a href="/legal" style={{ color: '#a855f7' }}>Mentions légales</a>
      </div>
    </div>
  );
}
