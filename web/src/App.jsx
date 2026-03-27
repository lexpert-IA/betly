import React from 'react';
import Topbar from './components/Topbar';
import Feed from './pages/Feed';
import CreateMarket from './pages/CreateMarket';
import Leaderboard from './pages/Leaderboard';
import Account from './pages/Account';
import Profile from './pages/Profile';

function getPage() {
  const path = window.location.pathname;
  if (path === '/create') return 'create';
  if (path === '/leaderboard') return 'leaderboard';
  if (path === '/account') return 'account';
  if (path.startsWith('/profile/')) return 'profile';
  if (path.startsWith('/market/')) return 'market';
  return 'feed';
}

function MarketDetail() {
  const marketId = window.location.pathname.split('/market/')[1];
  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 16px' }}>
      <a href="/" style={{ color: '#a78bfa', fontSize: '13px', textDecoration: 'none' }}>← Retour au feed</a>
      <div
        style={{
          marginTop: '24px',
          padding: '40px',
          textAlign: 'center',
          color: '#6060a0',
          fontSize: '14px',
          background: '#111118',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '12px' }}>🚧</div>
        <div style={{ fontWeight: 600, color: '#e2e2e8', marginBottom: '4px' }}>
          Détail du marché
        </div>
        <div>Phase 2 — en cours de développement</div>
        <div style={{ marginTop: '8px', fontSize: '12px', fontFamily: 'monospace', color: '#9090a0' }}>
          ID: {marketId}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const page = getPage();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Topbar />
      <main style={{ paddingBottom: '48px' }}>
        {page === 'feed' && <Feed />}
        {page === 'create' && <CreateMarket />}
        {page === 'leaderboard' && <Leaderboard />}
        {page === 'account' && <Account />}
        {page === 'market' && <MarketDetail />}
        {page === 'profile' && (
          <Profile profileId={window.location.pathname.split('/profile/')[1]} />
        )}
      </main>
    </div>
  );
}
