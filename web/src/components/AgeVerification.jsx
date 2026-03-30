import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

const LS_KEY = 'betly_age_verified';

export default function AgeVerification() {
  const { user, firebaseUser } = useAuth();
  const [visible, setVisible] = useState(false);
  const [checks, setChecks] = useState({ age: false, geo: false, terms: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Show if logged in but haven't verified age yet
    if (!firebaseUser) return;
    const done = localStorage.getItem(LS_KEY);
    if (!done) setVisible(true);
  }, [firebaseUser]);

  const allChecked = checks.age && checks.geo && checks.terms;

  async function confirm() {
    if (!allChecked) return;
    setSaving(true);
    try {
      // Save to backend
      await apiFetch('/api/auth/age-verify', { method: 'POST' });
    } catch {}
    localStorage.setItem(LS_KEY, '1');
    setVisible(false);
    setSaving(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 18, padding: 32, maxWidth: 440, width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/betly-logo.png" alt="BETLY" style={{ height: 40 }} />
          <div style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginTop: 12, marginBottom: 6 }}>
            Avant de continuer
          </div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
            Veuillez confirmer les points suivants pour accéder à BETLY.
          </div>
        </div>

        {/* Checkboxes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {[
            {
              key: 'age',
              text: 'J\'ai 18 ans ou plus',
              sub: 'BETLY est strictement réservé aux majeurs.',
            },
            {
              key: 'geo',
              text: 'Je ne réside pas dans une juridiction restreinte',
              sub: 'US, FR, DE, GB, AU, BE, IT, NL, PL, RU, SG, Ontario, Québec.',
            },
            {
              key: 'terms',
              text: 'J\'accepte les CGU et la politique de confidentialité',
              sub: <span>En savoir plus : <a href="/terms" target="_blank" style={{ color: '#a855f7' }}>CGU</a> · <a href="/privacy" target="_blank" style={{ color: '#a855f7' }}>Confidentialité</a></span>,
            },
          ].map(({ key, text, sub }) => (
            <label
              key={key}
              style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'flex-start' }}
              onClick={() => setChecks(c => ({ ...c, [key]: !c[key] }))}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                border: checks[key] ? '2px solid #a855f7' : '2px solid rgba(255,255,255,0.2)',
                background: checks[key] ? 'rgba(168,85,247,0.2)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .15s',
              }}>
                {checks[key] && <span style={{ color: '#a855f7', fontSize: 13, lineHeight: 1 }}>✓</span>}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>{text}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{sub}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={confirm}
          disabled={!allChecked || saving}
          style={{
            width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: allChecked
              ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
              : 'rgba(255,255,255,0.06)',
            color: allChecked ? '#fff' : '#334155',
            fontSize: 14, fontWeight: 700, transition: 'all .2s',
          }}
        >
          {saving ? 'Enregistrement…' : 'Continuer sur BETLY →'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#334155', marginTop: 14 }}>
          Les marchés de prédiction comportent des risques financiers. 18+ uniquement.
        </div>
      </div>
    </div>
  );
}
