import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import SearchModal from './SearchModal';
import WalletButton from './WalletButton';

// SVG Icons — clean, no emojis
const Icons = {
  home: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  live: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  copy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>
    </svg>
  ),
  leaderboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
    </svg>
  ),
};

const NAV_LINKS = [
  { label: 'Accueil', path: '/', icon: Icons.home },
  { label: 'En Direct', path: '/live', icon: Icons.live, live: true },
  { label: 'Copy Trading', path: '/copy', icon: Icons.copy },
  { label: 'Classement', path: '/leaderboard', icon: Icons.leaderboard },
];

export default function Topbar({ walletDisabled = false }) {
  const { user, logout, openAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const currentPath = window.location.pathname;
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        height: 60,
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 8,
      }}>
        {/* Logo */}
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: 4,
            color: '#fff',
          }}>Wolves</span>
        </a>

        {/* Nav Links — desktop only */}
        {!isMobile && (
          <nav style={{ display: 'flex', gap: 2, marginLeft: 24 }}>
            {NAV_LINKS.map(link => {
              const active = link.path === '/' ? currentPath === '/' : currentPath.startsWith(link.path);
              return (
                <a
                  key={link.path}
                  href={link.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px',
                    borderRadius: 8,
                    fontSize: 14, fontWeight: active ? 600 : 400,
                    color: active ? '#fff' : 'var(--text-secondary)',
                    background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ opacity: active ? 1 : 0.6, display: 'flex' }}>{link.icon}</span>
                  {link.label}
                  {link.live && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: '#22c55e',
                      boxShadow: '0 0 6px #22c55e',
                    }} />
                  )}
                </a>
              );
            })}
          </nav>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search button */}
        {!isMobile && (
          <button
            onClick={() => setSearchOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--text-muted)',
              fontSize: 13, cursor: 'pointer',
              transition: 'border-color 0.15s',
              minWidth: 180,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            {Icons.search}
            Rechercher...
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.4, fontFamily: 'var(--font-mono)' }}>⌘K</span>
          </button>
        )}

        {/* Wallet + Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!walletDisabled && user && <WalletButton />}
          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 14px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {user.googlePhotoUrl ? (
                  <img src={user.googlePhotoUrl} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#1a7f37',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>{(user.username || user.pseudo || '?')[0].toUpperCase()}</span>
                )}
                {!isMobile && <span>{user.username || user.pseudo}</span>}
              </button>
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4,
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-hover)',
                  borderRadius: 12,
                  padding: 4, minWidth: 180,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  zIndex: 200,
                }}>
                  {[
                    { label: 'Mon compte', href: '/account' },
                    { label: 'Mes positions', href: '/positions' },
                    { label: 'Mon profil', href: `/profile/${user.userId || user.pseudo}` },
                  ].map(item => (
                    <a key={item.href} href={item.href} style={{
                      display: 'block', padding: '10px 14px', fontSize: 14,
                      color: 'var(--text-secondary)', textDecoration: 'none',
                      borderRadius: 8, transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >{item.label}</a>
                  ))}
                  <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                  <button onClick={() => { logout(); setMenuOpen(false); window.location.href = '/'; }} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', fontSize: 14,
                    color: 'var(--red)', background: 'transparent',
                    border: 'none', borderRadius: 8,
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >Deconnexion</button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button onClick={openAuth} style={{
                padding: '8px 20px', fontSize: 14, fontWeight: 600,
                background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                borderRadius: 8, color: '#fff', cursor: 'pointer',
              }}>Connexion</button>
              <button onClick={openAuth} style={{
                padding: '8px 20px', fontSize: 14, fontWeight: 600,
                background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                border: 'none',
                borderRadius: 8, color: '#fff', cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 8px rgba(124,58,237,0.3)',
              }}>Inscription</button>
            </>
          )}
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
