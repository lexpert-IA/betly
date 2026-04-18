import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';

const path = window.location.pathname;

const TabIcon = ({ name, size = 20 }) => {
  const s = { width: size, height: size, strokeWidth: 1.8, stroke: 'currentColor', fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'feed') return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>;
  if (name === 'create') return <svg viewBox="0 0 24 24" {...s}><path d="M12 5v14M5 12h14"/></svg>;
  if (name === 'leaderboard') return <svg viewBox="0 0 24 24" {...s}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>;
  if (name === 'positions') return <svg viewBox="0 0 24 24" {...s}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
  if (name === 'account') return <svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>;
  return null;
};

const TABS = [
  { key: 'feed',        label: 'Marchés',    href: '/',            active: path === '/' },
  { key: 'positions',   label: 'Positions',  href: '/positions',   active: path === '/positions' },
  { key: 'create',      label: 'Créer',      href: '/create',      active: path === '/create' },
  { key: 'account',     label: 'Compte',     href: '/account',     active: path === '/account' },
];

export default function BottomNav() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.userId) return;
    const check = () => {
      apiFetch('/api/notifications/unread-count')
        .then(r => r.json())
        .then(d => setUnreadCount(d.count || 0))
        .catch(() => {});
    };
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, [user?.userId]);

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0, left: 0, right: 0,
      zIndex: 200,
      background: 'rgba(22,22,32,0.95)',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'stretch',
      paddingBottom: 'env(safe-area-inset-bottom)',
      height: 'calc(56px + env(safe-area-inset-bottom))',
    }}>
      {TABS.map(({ key, label, href, active }) => {
        const isAccount = key === 'account';
        const isActive  = active || (isAccount && path.startsWith('/account'));
        const showBadge = isAccount && unreadCount > 0;

        return (
          <a
            key={key}
            href={href}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 2,
              textDecoration: 'none',
              padding: '6px 0',
              position: 'relative',
              minHeight: 44,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {isActive && (
              <div style={{
                position: 'absolute', top: 0, left: '25%', right: '25%',
                height: 2, borderRadius: '0 0 3px 3px',
                background: '#a855f7',
              }} />
            )}

            <span style={{
              fontSize: 20, lineHeight: 1,
              color: isActive ? '#a855f7' : '#64748b',
              position: 'relative',
            }}>
              {isAccount && user
                ? <span style={{
                    display: 'inline-flex', width: 22, height: 22, borderRadius: '50%',
                    background: user.avatarColor || '#7c3aed',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff',
                  }}>
                    {(user.username || '?').slice(0, 1).toUpperCase()}
                  </span>
                : <TabIcon name={key} size={20} />
              }
              {showBadge && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: '#ef4444', color: '#fff',
                  fontSize: 8, fontWeight: 800,
                  minWidth: 14, height: 14, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 2px',
                  border: '1.5px solid #161620',
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </span>
            <span style={{
              fontSize: 10,
              color: isActive ? '#a855f7' : '#64748b',
              fontWeight: isActive ? 700 : 400,
            }}>
              {label}
            </span>
          </a>
        );
      })}
    </nav>
  );
}
