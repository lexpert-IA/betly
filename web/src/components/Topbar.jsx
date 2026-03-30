import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import NotificationBell from './NotificationBell';
import SearchModal from './SearchModal';
import WalletButton from './WalletButton';
import { toast } from './ToastManager';

const LINKS = [
  { label: 'Marchés',     path: '/'            },
  { label: 'BETLY Copy',  path: '/copy'         },
  { label: 'Leaderboard', path: '/leaderboard'  },
];

export default function Topbar({ walletDisabled = false }) {
  const { user, logout, openAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const currentPath = window.location.pathname;
  const isMobile = useIsMobile();
  const [searchOpen, setSearchOpen] = useState(false);

  // Global Ctrl+K shortcut
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

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  function handleLogout() {
    logout();
    setMenuOpen(false);
    window.location.href = '/';
  }

  function handleNewNotif(count) {
    toast(`${count} nouvelle${count > 1 ? 's' : ''} notification${count > 1 ? 's' : ''}`, 'notif');
  }

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      height: 52,
      background: 'rgba(10,10,15,0.92)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 16,
    }}>
      {/* Logo */}
      <a href="/" style={{
        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0,
      }}>
        <img src="/betly-logo.png" alt="BETLY" style={{ height: isMobile ? 28 : 32 }} />
      </a>

      {/* Nav — hidden on mobile (uses BottomNav instead) */}
      {!isMobile && (
        <nav style={{ display: 'flex', gap: 2, flex: 1 }}>
          {LINKS.map(({ label, path }) => {
            const isActive = path === '/' ? currentPath === '/' : currentPath.startsWith(path);
            return (
              <a key={path} href={path} style={{
                textDecoration: 'none', padding: '6px 11px', borderRadius: 6,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#a78bfa' : '#9090a0',
                background: isActive ? 'rgba(167,139,250,0.1)' : 'transparent',
                transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
                {label}
              </a>
            );
          })}
        </nav>
      )}
      {isMobile && <div style={{ flex: 1 }} />}

      {/* Search button */}
      <button
        onClick={() => setSearchOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#64748b', cursor: 'pointer', fontSize: 12,
          transition: 'all .2s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; e.currentTarget.style.color = '#a855f7'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#64748b'; }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        {!isMobile && (
          <>
            <span>Rechercher</span>
            <kbd style={{ padding: '1px 5px', borderRadius: 3, fontSize: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', marginLeft: 2 }}>⌘K</kbd>
          </>
        )}
      </button>

      {/* Search modal */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Wallet button — only when Dynamic SDK is available */}
        {!isMobile && !walletDisabled && <WalletButton />}

        {user ? (
          <>
            {/* En jeu pill — desktop only */}
            {!isMobile && (user.lockedBalance || 0) > 0 && (
              <a href="/positions" style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '4px 10px', borderRadius: 7,
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  fontSize: 11, color: '#f59e0b', fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  {(user.lockedBalance || 0).toFixed(2)} USDC en jeu
                </div>
              </a>
            )}

            {/* Notification bell */}
            <NotificationBell onNewNotif={handleNewNotif} />

            {/* Avatar + menu */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: isMobile ? 0 : 8,
                  padding: isMobile ? '4px' : '4px 10px 4px 4px',
                  background: menuOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${menuOpen ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                  minWidth: 36, minHeight: 36,
                }}
              >
                {user.googlePhotoUrl ? (
                  <img src={user.googlePhotoUrl} alt="" style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: user.avatarColor || '#7c3aed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff',
                  }}>
                    {(user.username || '?').slice(0, 1).toUpperCase()}
                  </div>
                )}
                {!isMobile && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                      {user.username}
                    </span>
                    <span style={{ fontSize: 9, color: '#64748b', marginLeft: 2 }}>
                      {menuOpen ? '▲' : '▼'}
                    </span>
                  </>
                )}
              </button>

              {/* Dropdown */}
              {menuOpen && (
                <div style={{
                  position: 'absolute', top: 42, right: 0,
                  width: 200,
                  background: '#111118',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  boxShadow: '0 12px 40px rgba(0,0,0,.5)',
                  zIndex: 200,
                  overflow: 'hidden',
                  animation: 'notif-drop .15s ease',
                }}>
                  {/* User info */}
                  <div style={{
                    padding: '14px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {user.googlePhotoUrl ? (
                        <img src={user.googlePhotoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: user.avatarColor || '#7c3aed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 15, fontWeight: 800, color: '#fff',
                        }}>
                          {(user.username || '?').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                          {user.username}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {(user.lockedBalance || 0) > 0 ? `${(user.lockedBalance || 0).toFixed(2)} USDC en jeu` : 'Aucun pari actif'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  {[
                    { label: 'Mon profil',      action: () => { window.location.href = `/profile/${user.userId}`; setMenuOpen(false); } },
                    { label: 'Mon compte',      action: () => { window.location.href = '/account'; setMenuOpen(false); } },
                    { label: 'Mes positions',   action: () => { window.location.href = '/positions'; setMenuOpen(false); } },
                    { label: 'Créer un marché', action: () => { window.location.href = '/create'; setMenuOpen(false); } },
                  ].map(({ label, action }) => (
                    <button
                      key={label}
                      onClick={action}
                      style={{
                        width: '100%', textAlign: 'left', padding: '10px 16px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: '#94a3b8',
                        transition: 'all .1s',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#f8fafc'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
                    >
                      {label}
                    </button>
                  ))}

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', textAlign: 'left', padding: '10px 16px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: '#ef4444',
                      transition: 'all .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={openAuth}
            style={{
              padding: '7px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
            }}
          >
            Se connecter
          </button>
        )}
      </div>
    </header>
  );
}
