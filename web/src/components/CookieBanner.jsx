import React, { useState, useEffect } from 'react';

const LS_KEY = 'betly_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(LS_KEY);
    if (!consent) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem(LS_KEY, 'all');
    setVisible(false);
  }

  function refuse() {
    localStorage.setItem(LS_KEY, 'essential');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
      background: '#111118',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      padding: '16px 20px',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <span style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
          BETLY utilise des cookies essentiels au fonctionnement et des cookies analytiques anonymisés pour améliorer l'expérience.{' '}
          <a href="/privacy" style={{ color: '#a855f7', textDecoration: 'none' }}>En savoir plus →</a>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={refuse}
          style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: '#64748b',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Refuser les optionnels
        </button>
        <button
          onClick={accept}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
