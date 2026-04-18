import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';

// Debounce hook
function useDebounce(value, delay) {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function AuthModal({ onClose }) {
  const [view, setView]         = useState('main');   // 'main' | 'email'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isNew, setIsNew]       = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState('');
  async function handleGoogle() {
    setLoading('google');
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error('[BETLY] Google auth error:', e.code, e.message);
      setError(friendlyError(e.code));
    } finally {
      setLoading('');
    }
  }

  async function handleEmail(e) {
    e.preventDefault();
    if (!email || !password) return;
    setLoading('email');
    setError('');
    try {
      if (isNew) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading('');
    }
  }

  async function handleAnon() {
    setLoading('anon');
    setError('');
    try {
      await signInAnonymously(auth);
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setLoading('');
    }
  }

  return (
    <>
      {/* Backdrop — clickable to dismiss */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          cursor: 'pointer',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        pointerEvents: 'none',
      }}>
        <div style={{
          background: '#111118',
          border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 20,
          padding: '36px 36px 28px',
          maxWidth: 400, width: '100%',
          boxShadow: '0 0 80px rgba(124,58,237,0.2)',
          animation: 'modal-in .3s ease',
          position: 'relative',
          pointerEvents: 'auto',
        }}>
          <style>{`
            @keyframes modal-in { from { opacity: 0; transform: scale(.95) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
          `}</style>

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, width: 30, height: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b', cursor: 'pointer', fontSize: 14,
              transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#64748b'; }}
          >
            ✕
          </button>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ marginBottom: 10 }}>
              <img src="/betly-logo.png" alt="BETLY" style={{ height: 36 }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#f8fafc', margin: '0 0 4px' }}>
              Rejoins la communauté
            </p>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Paris prédictifs · Crypto · Gratuit
            </p>
          </div>

          {view === 'main' ? (
            <>
              {/* Google — primary */}
              <button
                onClick={handleGoogle}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 12,
                  background: loading === 'google' ? 'rgba(255,255,255,0.08)' : '#fff',
                  color: '#1a1a2e', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 15,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 2px 16px rgba(0,0,0,.3)',
                  transition: 'all .2s', marginBottom: 12,
                  opacity: loading && loading !== 'google' ? 0.5 : 1,
                }}
              >
                {loading === 'google' ? (
                  <span style={{ color: '#666' }}>Connexion...</span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 48 48">
                      <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8.9 20-20 0-1.3-.1-2.7-.4-4z"/>
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.4 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.4 35.5 26.9 36 24 36c-5.2 0-9.6-3.3-11.2-8l-6.5 5C9.8 39.6 16.4 44 24 44z"/>
                      <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.3 4.1-4.2 5.5l6.2 5.2C40.8 35.4 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
                    </svg>
                    Continuer avec Google
                  </>
                )}
              </button>

              {/* Email */}
              <button
                onClick={() => { setView('email'); setError(''); }}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8', cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600, fontSize: 14,
                  transition: 'all .2s', marginBottom: 20,
                }}
                onMouseEnter={e => { if (!loading) { e.currentTarget.style.borderColor='rgba(124,58,237,0.4)'; e.currentTarget.style.color='#c4b5fd'; }}}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; e.currentTarget.style.color='#94a3b8'; }}
              >
                Continuer avec email
              </button>

              {error && (
                <div style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              {/* Browse without account */}
              <div style={{ textAlign: 'center' }}>
                <button
                  onClick={onClose}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#334155',
                    transition: 'color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                  onMouseLeave={e => e.currentTarget.style.color = '#334155'}
                >
                  Parcourir sans compte →
                </button>
              </div>
            </>
          ) : (
            /* Email form */
            <form onSubmit={handleEmail}>
              <div style={{ marginBottom: 12 }}>
                <input
                  type="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  style={inputStyle}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <input
                  type="password"
                  placeholder={isNew ? 'Crée un mot de passe (6+ car.)' : 'Mot de passe'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={inputStyle}
                />
              </div>

              {/* Toggle sign up / sign in */}
              <div style={{ textAlign: 'right', marginBottom: 16 }}>
                <button
                  type="button"
                  onClick={() => { setIsNew(v => !v); setError(''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748b' }}
                >
                  {isNew ? 'Déjà un compte ? Se connecter' : 'Nouveau ? Créer un compte'}
                </button>
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!!loading}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: '#fff', fontWeight: 700, fontSize: 15,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  marginBottom: 12,
                }}
              >
                {loading === 'email' ? 'Connexion...' : (isNew ? 'Créer mon compte' : 'Se connecter')}
              </button>

              <button
                type="button"
                onClick={() => { setView('main'); setError(''); }}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b', cursor: 'pointer', fontSize: 13,
                }}
              >
                Retour
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#f8fafc', fontSize: 14, outline: 'none',
  boxSizing: 'border-box', transition: 'border-color .2s',
};

function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'Aucun compte avec cet email.',
    'auth/wrong-password':       'Mot de passe incorrect.',
    'auth/email-already-in-use': 'Cet email est déjà utilisé.',
    'auth/weak-password':        'Mot de passe trop court (6 car. min).',
    'auth/invalid-email':        'Email invalide.',
    'auth/popup-closed-by-user': 'Popup fermée. Réessaie.',
    'auth/popup-blocked':        'Popup bloquée par ton navigateur. Autorise les popups.',
    'auth/network-request-failed': 'Erreur réseau. Vérifie ta connexion.',
    'auth/too-many-requests':    'Trop de tentatives. Réessaie plus tard.',
    'auth/invalid-credential':    'Email ou mot de passe incorrect.',
    'auth/unauthorized-domain':   'Domaine non autorisé — ajoute-le dans Firebase Console → Authentication → Authorized domains.',
  };
  return map[code] || `Erreur ${code || 'inconnue'}. Réessaie.`;
}
