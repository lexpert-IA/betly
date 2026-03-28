import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from './NotificationBell';
import { toast } from './ToastManager';

const LINKS = [
  { label: '🎯 Marchés',     path: '/'            },
  { label: '📈 BETLY Copy',  path: '/copy'         },
  { label: '🏆 Leaderboard', path: '/leaderboard'  },
];

export default function Topbar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const currentPath = window.location.pathname;

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
        textDecoration: 'none', fontSize: 18, fontWeight: 900,
        background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', letterSpacing: '-0.5px', flexShrink: 0,
      }}>
        BETLY
      </a>

      {/* Nav */}
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

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {user ? (
          <>
            {/* Balance pill */}
            <div style={{
              padding: '4px 10px', borderRadius: 7,
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.2)',
              fontSize: 12, color: '#a78bfa', fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {typeof user.balance === 'number' ? `${user.balance.toFixed(2)} USDC` : '—'}
            </div>

            {/* Notification bell */}
            <NotificationBell onNewNotif={handleNewNotif} />

            {/* Avatar + menu */}
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 10px 4px 4px',
                  background: menuOpen ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${menuOpen ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: user.avatarColor || '#7c3aed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 800, color: '#fff',
                }}>
                  {(user.username || '?').slice(0, 1).toUpperCase()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                  {user.username}
                </span>
                <span style={{ fontSize: 9, color: '#64748b', marginLeft: 2 }}>
                  {menuOpen ? '▲' : '▼'}
                </span>
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
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: user.avatarColor || '#7c3aed',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 800, color: '#fff',
                      }}>
                        {(user.username || '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                          {user.username}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {user.balance?.toFixed(2) || '0'} USDC
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  {[
                    { label: '👤 Mon profil', action: () => { window.location.href = `/profile/${user.userId}`; setMenuOpen(false); } },
                    { label: '⚙️ Mon compte', action: () => { window.location.href = '/account'; setMenuOpen(false); } },
                    { label: '🎯 Créer un marché', action: () => { window.location.href = '/create'; setMenuOpen(false); } },
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
                    🚪 Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '7px 16px', borderRadius: 8,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
            }}
          >
            Rejoindre
          </button>
        )}
      </div>
    </header>
  );
}
