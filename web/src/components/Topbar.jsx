import React from 'react';
import { useApi, useUserId } from '../hooks/useApi';

const LINKS = [
  { label: '🎯 Marchés',     path: '/'            },
  { label: '📈 BETLY Copy',  path: '/copy'         },
  { label: '🏆 Leaderboard', path: '/leaderboard'  },
  { label: '👤 Mon compte',  path: '/account'      },
];

export default function Topbar() {
  const userId = useUserId();
  const { data: accountData } = useApi('/api/account', {});
  const currentPath = window.location.pathname;

  const balance = accountData?.user?.balance ?? null;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        height: '52px',
        background: '#111118',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: '24px',
      }}
    >
      {/* Logo */}
      <a
        href="/"
        style={{
          textDecoration: 'none',
          fontSize: '18px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.5px',
          flexShrink: 0,
        }}
      >
        BETLY
      </a>

      {/* Nav */}
      <nav style={{ display: 'flex', gap: '2px', flex: 1 }}>
        {LINKS.map(({ label, path }) => {
          const isActive = path === '/'
            ? currentPath === '/'
            : currentPath.startsWith(path);
          return (
            <a
              key={path}
              href={path}
              style={{
                textDecoration: 'none',
                padding: '6px 11px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#a78bfa' : '#9090a0',
                background: isActive ? 'rgba(167,139,250,0.1)' : 'transparent',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </a>
          );
        })}
      </nav>

      {/* Balance */}
      {userId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 12px',
            background: 'rgba(167,139,250,0.08)',
            border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: '8px',
            fontSize: '13px',
            flexShrink: 0,
          }}
        >
          <span style={{ color: '#9090a0' }}>Balance</span>
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>
            {balance !== null ? `${balance.toFixed(2)} USDC` : '—'}
          </span>
        </div>
      )}
    </header>
  );
}
