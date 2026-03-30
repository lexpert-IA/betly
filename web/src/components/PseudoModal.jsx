import React, { useState, useEffect, useRef } from 'react';
import { useAuth, computeAvatarColor } from '../hooks/useAuth';
import { auth } from '../lib/firebase';

const BASE = import.meta.env.VITE_API_URL || '';

function useDebounce(value, delay) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function PseudoModal() {
  const { login } = useAuth();
  const [username,  setUsername]  = useState('');
  const [available, setAvailable] = useState(null);
  const [checking,  setChecking]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const inputRef = useRef(null);

  const debounced = useDebounce(username, 400);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Check availability
  useEffect(() => {
    if (debounced.length < 3) { setAvailable(null); return; }
    setChecking(true);
    fetch(`${BASE}/api/auth/check?username=${encodeURIComponent(debounced)}`)
      .then(r => r.json())
      .then(d => { setAvailable(d.available); setError(d.available ? '' : 'Ce pseudo est déjà pris'); })
      .catch(() => setAvailable(null))
      .finally(() => setChecking(false));
  }, [debounced]);

  const clean     = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const isValid   = clean.length >= 3 && clean.length <= 20 && available === true;
  const avatarClr = clean.length >= 1 ? computeAvatarColor(clean) : '#2a2a3a';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      const fbUser = auth.currentUser;
      if (!fbUser) throw new Error('Session expirée. Reconnecte-toi.');

      const token = await fbUser.getIdToken();
      const res   = await fetch(`${BASE}/api/auth/firebase-register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: clean,
          refCode: localStorage.getItem('betly_ref') || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      login(data);
    } catch (e) {
      setError(e.message || 'Impossible de se connecter au serveur');
    } finally {
      setLoading(false);
    }
  }

  const statusColor = available === true ? '#22c55e' : available === false ? '#ef4444' : '#64748b';

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{
          background: '#111118', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 20, padding: '40px 36px', maxWidth: 420, width: '100%',
          boxShadow: '0 0 80px rgba(124,58,237,0.2)', animation: 'modal-in .25s ease',
        }}>
          <style>{`@keyframes modal-in { from { opacity:0; transform:scale(.95) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }`}</style>

          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ marginBottom: 8 }}>
              <img src="/betly-logo.png" alt="BETLY" style={{ height: 36 }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', margin: '0 0 4px' }}>
              Choisis ton pseudo
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Ton identité sur Betly · impossible à changer plus tard
            </p>
          </div>

          {/* Avatar preview */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%', background: avatarClr,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: '#fff',
              transition: 'background .3s', boxShadow: `0 0 24px ${avatarClr}66`,
            }}>
              {clean.slice(0, 1).toUpperCase() || '?'}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
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
                    width: '100%', padding: '12px 42px 12px 16px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${clean.length >= 3 ? statusColor + '60' : 'rgba(255,255,255,0.1)'}`,
                    color: '#f8fafc', fontSize: 15, fontWeight: 600, outline: 'none',
                    boxSizing: 'border-box', transition: 'border-color .2s',
                  }}
                />
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>
                  {checking ? '⟳' : clean.length >= 3
                    ? (available === true ? '✓' : available === false ? '✗' : '')
                    : ''}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
                <span style={{ color: error ? '#ef4444' : '#64748b' }}>
                  {error || (clean.length >= 3 && available === true ? 'Pseudo disponible ✓' : '3-20 car., lettres/chiffres/_/-')}
                </span>
                <span style={{ color: clean.length > 18 ? '#f59e0b' : '#475569' }}>{clean.length}/20</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isValid || loading}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                background: isValid ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(255,255,255,0.05)',
                color: isValid ? '#fff' : '#475569',
                cursor: isValid ? 'pointer' : 'not-allowed',
                fontWeight: 700, fontSize: 15,
                boxShadow: isValid ? '0 0 24px rgba(124,58,237,.4)' : 'none',
                transition: 'all .2s',
              }}
            >
              {loading ? '⟳ Création...' : 'Rejoindre Betly'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#334155' }}>
            Crée ton compte et commence à parier
          </p>
        </div>
      </div>
    </>
  );
}
