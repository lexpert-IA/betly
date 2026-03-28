import React from 'react';
import Topbar from './components/Topbar';
import Feed from './pages/Feed';
import CreateMarket from './pages/CreateMarket';
import Leaderboard from './pages/Leaderboard';
import Account from './pages/Account';
import Profile from './pages/Profile';
import BetlyCopy from './pages/BetlyCopy';
import MarketDetail from './pages/MarketDetail';

function getPage() {
  const path = window.location.pathname;
  if (path === '/create') return 'create';
  if (path === '/copy') return 'copy';
  if (path === '/leaderboard') return 'leaderboard';
  if (path === '/account') return 'account';
  if (path.startsWith('/profile/')) return 'profile';
  if (path.startsWith('/market/')) return 'market';
  return 'feed';
}


export default function App() {
  const page = getPage();

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      <Topbar />
      <main style={{ paddingBottom: '48px' }}>
        {page === 'feed' && <Feed />}
        {page === 'create' && <CreateMarket />}
        {page === 'copy' && <BetlyCopy />}
        {page === 'leaderboard' && <Leaderboard />}
        {page === 'account' && <Account />}
        {page === 'market' && (
          <MarketDetail marketId={window.location.pathname.split('/market/')[1]} />
        )}
        {page === 'profile' && (
          <Profile profileId={window.location.pathname.split('/profile/')[1]} />
        )}
      </main>
    </div>
  );
}
