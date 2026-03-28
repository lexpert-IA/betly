import React from 'react';
import { useAuth } from '../hooks/useAuth';

const path = window.location.pathname;

const TABS = [
  { key: 'feed',        icon: '🎯', label: 'Marchés',    href: '/',            active: path === '/' },
  { key: 'create',      icon: '＋', label: 'Créer',      href: '/create',      active: path === '/create' },
  { key: 'live',        icon: '⚡', label: 'Live',       href: null,           active: false }, // opens sheet
  { key: 'leaderboard', icon: '🏆', label: 'Classement', href: '/leaderboard', active: path === '/leaderboard' },
  { key: 'account',     icon: '👤', label: 'Compte',     href: '/account',     active: path === '/account' },
];

export default function BottomNav({ onLiveOpen }) {
  const { user } = useAuth();

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 200,
      height: 60,
      background: 'rgba(10,10,20,0.97)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map(({ key, icon, label, href, active }) => {
        const isLive = key === 'live';
        const isAccount = key === 'account';
        const isActive = active || (isAccount && path.startsWith('/account'));

        return (
          <button
            key={key}
            onClick={() => {
              if (isLive) { onLiveOpen?.(); return; }
              window.location.href = href;
            }}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '6px 0',
              position: 'relative',
              transition: 'opacity .15s',
            }}
          >
            {/* Active indicator */}
            {isActive && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: '20%',
                right: '20%',
                height: 2,
                borderRadius: '0 0 3px 3px',
                background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
              }} />
            )}

            {/* Live button special style */}
            {isLive ? (
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                boxShadow: '0 0 16px rgba(124,58,237,0.5)',
                marginTop: -16,
              }}>
                {icon}
              </div>
            ) : (
              <>
                <span style={{ fontSize: 20, lineHeight: 1, filter: isActive ? 'none' : 'grayscale(0.4) opacity(0.6)' }}>
                  {/* Show avatar for account when logged in */}
                  {isAccount && user
                    ? <span style={{
                        display: 'inline-flex', width: 22, height: 22, borderRadius: '50%',
                        background: user.avatarColor || '#7c3aed',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#fff',
                      }}>
                        {(user.username || '?').slice(0, 1).toUpperCase()}
                      </span>
                    : icon
                  }
                </span>
                <span style={{
                  fontSize: 10,
                  color: isActive ? '#a855f7' : '#64748b',
                  fontWeight: isActive ? 700 : 400,
                }}>
                  {label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}
