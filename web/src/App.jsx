import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useIsMobile';
import Topbar from './components/Topbar';
import AuthModal from './components/AuthModal';
import ToastManager from './components/ToastManager';
import LiveFeed, { LiveFeedSheet } from './components/LiveFeed';
import BottomNav from './components/BottomNav';
import Feed from './pages/Feed';
import CreateMarket from './pages/CreateMarket';
import Leaderboard from './pages/Leaderboard';
import Account from './pages/Account';
import Profile from './pages/Profile';
import BetlyCopy from './pages/BetlyCopy';
import MarketDetail from './pages/MarketDetail';
import TagPage from './pages/TagPage';

function getPage() {
  const path = window.location.pathname;
  if (path === '/create') return 'create';
  if (path === '/copy') return 'copy';
  if (path === '/leaderboard') return 'leaderboard';
  if (path === '/account') return 'account';
  if (path.startsWith('/profile/')) return 'profile';
  if (path.startsWith('/market/')) return 'market';
  if (path.startsWith('/tag/')) return 'tag';
  return 'feed';
}

function AppInner() {
  const { user } = useAuth();
  const page = getPage();
  const isMobile = useIsMobile();
  const [liveSheetOpen, setLiveSheetOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {!user && <AuthModal />}

      {/* Topbar — always shown, but simplified on mobile */}
      <Topbar />

      <div style={{
        display: 'flex',
        gap: 0,
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 16px',
        alignItems: 'flex-start',
      }}>
        {/* Main content */}
        <main style={{
          flex: 1,
          minWidth: 0,
          paddingBottom: isMobile ? 76 : 48, // extra space for bottom nav
        }}>
          {page === 'feed'        && <Feed />}
          {page === 'create'      && <CreateMarket />}
          {page === 'copy'        && <BetlyCopy />}
          {page === 'leaderboard' && <Leaderboard />}
          {page === 'account'     && <Account />}
          {page === 'market'      && (
            <MarketDetail marketId={window.location.pathname.split('/market/')[1]} />
          )}
          {page === 'profile'     && (
            <Profile profileId={window.location.pathname.split('/profile/')[1]} />
          )}
          {page === 'tag'         && (
            <TagPage tag={window.location.pathname.split('/tag/')[1]} />
          )}
        </main>

        {/* Live feed sidebar — desktop only (≥1100px) */}
        <div style={{ display: 'none', paddingTop: 24, paddingLeft: 20 }} className="livefeed-wrapper">
          <LiveFeed />
        </div>
      </div>

      {/* Mobile bottom nav */}
      {isMobile && <BottomNav onLiveOpen={() => setLiveSheetOpen(true)} />}

      {/* Mobile live feed sheet */}
      <LiveFeedSheet open={liveSheetOpen} onClose={() => setLiveSheetOpen(false)} />

      <style>{`
        @media (min-width: 1100px) {
          .livefeed-wrapper { display: block !important; }
        }
      `}</style>

      <ToastManager />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
