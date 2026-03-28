import React, { useState, useEffect, useRef } from 'react';
import { useAuth, computeAvatarColor } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '';

// Debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function AuthModal() {
  const { login } = useAuth();
  const [username, setUsername]   = useState('');
  const [available, setAvailable] = useState(null); // null | true | false
  const [checking, setChecking]   = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const inputRef = useRef(null);

  const debounced = useDebounce(username, 400);

  // Auto-focus
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Real-time availability check
  useEffect(() => {
    if (debounced.length < 3) { setAvailable(null); return; }
    setChecking(true);
    fetch(`${BASE}/api/auth/check?username=${encodeURIComponent(debounced)}`)
      .then(r => r.json())
      .then(d => { setAvailable(d.available); setError(d.available ? '' : 'Ce pseudo est déjà pris'); })
      .catch(() => setAvailable(null))
      .finally(() => setChecking(false));
  }, [debounced]);

  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const isValid = clean.length >= 3 && clean.length <= 20 && available === true;
  const avatarColor = username.length >= 1 ? computeAvatarColor(clean) : '#2a2a3a';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: clean }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      login(data);
    } catch (e) {
      setError('Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  }

  const statusColor = available === true ? '#22c55e' : available === false ? '#ef4444' : '#64748b';

  return (
    <>
      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}>
        <div style={{
          background: '#111118',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 20,
          padding: '40px 36px',
          maxWidth: 420, width: '100%',
          boxShadow: '0 0 80px rgba(124,58,237,0.2)',
          animation: 'modal-in .25s ease',
        }}>
          <style>{`
            @keyframes modal-in { from { opacity: 0; transform: scale(.95) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          `}</style>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              fontSize: 36, fontWeight: 900,
              background: 'linear-gradient(135deg, #ffffff 0%, #a855f7 45%, #06b6d4 85%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', letterSpacing: '-2px', marginBottom: 8,
            }}>
              BETLY
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>
              Choisis ton pseudo
            </p>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Ton identité sur Betly · impossible à changer plus tard
            </p>
          </div>

          {/* Avatar preview */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: avatarColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, fontWeight: 800, color: '#fff',
              transition: 'background .3s',
              boxShadow: `0 0 24px ${avatarColor}66`,
            }}>
              {clean.slice(0, 1).toUpperCase() || '?'}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Input */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ position: 'relative' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="ton_pseudo"
                  maxLength={20}
                  autoComplete="off"
                  style={{
                    width: '100%', padding: '12px 42px 12px 16px',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${clean.length >= 3 ? statusColor + '60' : 'rgba(255,255,255,0.1)'}`,
                    color: '#f8fafc', fontSize: 15, fontWeight: 600,
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color .2s',
                  }}
                />
                {/* Status indicator */}
                <div style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 14,
                }}>
                  {checking ? '⟳' : clean.length >= 3
                    ? (available === true ? '✓' : available === false ? '✗' : '')
                    : ''}
                </div>
              </div>

              {/* Helper */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 6, fontSize: 11,
              }}>
                <span style={{ color: error ? '#ef4444' : '#64748b' }}>
                  {error || (clean.length >= 3 && available === true ? 'Pseudo disponible ✓' : '3-20 caractères, lettres/chiffres/_/-')}
                </span>
                <span style={{ color: clean.length > 18 ? '#f59e0b' : '#475569' }}>
                  {clean.length}/20
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!isValid || loading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10,
                background: isValid
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'rgba(255,255,255,0.05)',
                color: isValid ? '#fff' : '#475569',
                border: 'none', cursor: isValid ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: 15,
                boxShadow: isValid ? '0 0 24px rgba(124,58,237,.4)' : 'none',
                transition: 'all .2s',
              }}
            >
              {loading ? '⟳ Création...' : '🎯 Rejoindre Betly'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#334155' }}>
            Pas de mot de passe · session locale · 100 USDC offerts pour commencer
          </p>
        </div>
      </div>
    </>
  );
}
