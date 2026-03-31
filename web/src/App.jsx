import React, { useState, useEffect } from 'react';
import { DynamicContextProvider } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';
import { DynamicWagmiConnector } from '@dynamic-labs/wagmi-connector';
import { WagmiProvider } from 'wagmi';
import { QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig, queryClient } from './lib/wagmiConfig';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useIsMobile } from './hooks/useIsMobile';
import Topbar from './components/Topbar';
import AuthModal from './components/AuthModal';
import PseudoModal from './components/PseudoModal';
import ToastManager from './components/ToastManager';
// LiveFeed removed — not production-ready
import BottomNav from './components/BottomNav';
import Feed from './pages/Feed';
import CreateMarket from './pages/CreateMarket';
import Leaderboard from './pages/Leaderboard';
import Account from './pages/Account';
import Profile from './pages/Profile';
import BetlyCopy from './pages/BetlyCopy';
import MarketDetail from './pages/MarketDetail';
import TagPage from './pages/TagPage';
import AdminPage from './pages/AdminPage';
import AffiliatePage from './pages/AffiliatePage';
import CreatorDashboard from './pages/CreatorDashboard';
import VerifyCreator from './pages/VerifyCreator';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import ResponsibleGamingPage from './pages/ResponsibleGamingPage';
import LegalPage from './pages/LegalPage';
import PositionsPage from './pages/PositionsPage';
import SharePage from './pages/SharePage';
import AgentsPage from './pages/AgentsPage';
import DocsPage from './pages/DocsPage';
import AgeVerification from './components/AgeVerification';

const DYNAMIC_ENV_ID = (import.meta.env.VITE_DYNAMIC_ENV_ID || '043ee6c8-bac8-4266-8345-794bb7a378a7').trim();

// ── Wallet SDK error boundary ─────────────────────────────────────────────────
class WalletErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) {
    console.error('[BETLY] Wallet SDK init failed — running without wallet features:', err.message);
  }
  render() {
    if (this.state.failed) {
      return (
        <AuthProvider>
          <AppInner walletDisabled />
        </AuthProvider>
      );
    }
    return this.props.children;
  }
}

// ── Per-route error boundary — catches crashes in any page component ──────────
class PageErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err) {
    console.error(`[BETLY] Page crash on ${window.location.pathname}:`, err.message, err.stack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          maxWidth: 480, margin: '80px auto', padding: 32,
          background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: '#ef4444' }}>Erreur</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
            Cette page a rencontré un problème
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20, fontFamily: 'monospace' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff',
              fontSize: 13, fontWeight: 700,
            }}
          >
            Retour à l'accueil
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Footer({ isMobile }) {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(10,10,15,0.8)',
      padding: isMobile ? '20px 16px 100px' : '28px 32px',
      marginTop: 8,
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        {/* Left — brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <img src="/betly-logo.png" alt="BETLY" style={{ height: 24 }} />
          <span style={{ fontSize: 12, color: '#334155' }}>
            © 2026 BETLY Labs Inc. — République du Panama
          </span>
        </div>

        {/* Right — legal links */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'CGU', href: '/terms' },
            { label: 'Confidentialité', href: '/privacy' },
            { label: 'Jeu responsable', href: '/responsible-gaming' },
            { label: 'Mentions légales', href: '/legal' },
            { label: 'Créateurs', href: '/affiliate' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              style={{
                fontSize: 12,
                color: '#475569',
                textDecoration: 'none',
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#a855f7'}
              onMouseLeave={e => e.currentTarget.style.color = '#475569'}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{
        maxWidth: 1400,
        margin: '12px auto 0',
        fontSize: 11,
        color: '#334155',
        lineHeight: 1.5,
      }}>
        BETLY est une plateforme de marchés de prédiction. Pas un casino. · Les marchés de prédiction comportent un risque de perte en capital. · 18+ uniquement. · Jouez de manière responsable.
      </div>
    </footer>
  );
}

function getPage() {
  const path = window.location.pathname;
  if (path === '/create') return 'create';
  if (path === '/copy') return 'copy';
  if (path === '/leaderboard') return 'leaderboard';
  if (path === '/account') return 'account';
  if (path === '/admin') return 'admin';
  if (path === '/affiliate') return 'affiliate';
  if (path === '/creator') return 'creator';
  if (path === '/verify-creator') return 'verify-creator';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  if (path === '/responsible-gaming') return 'responsible-gaming';
  if (path === '/legal') return 'legal';
  if (path === '/positions') return 'positions';
  if (path === '/agents') return 'agents';
  if (path === '/docs') return 'docs';
  if (path.startsWith('/share/')) return 'share';
  if (path.startsWith('/profile/')) return 'profile';
  if (path.startsWith('/market/')) return 'market';
  if (path.startsWith('/tag/')) return 'tag';
  return 'feed';
}

// Guard for pages that require auth — shows message with login button (no auto-popup)
function AuthGuard({ children }) {
  const { user, loading, openAuth } = useAuth();
  if (loading) return null;
  if (!user) return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 16px', textAlign: 'center' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Connexion requise</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Connecte-toi pour accéder à cette page.</div>
      <button
        onClick={openAuth}
        style={{
          padding: '10px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff',
          fontSize: 14, fontWeight: 700,
        }}
      >
        Se connecter
      </button>
    </div>
  );
  return children;
}

function AppInner({ walletDisabled = false }) {
  const { user, firebaseUser, loading, authModalOpen, closeAuth } = useAuth();
  const page = getPage();
  const isMobile = useIsMobile();

  // Debug: log Dynamic env var on mount
  useEffect(() => {
    console.log('[BETLY] VITE_DYNAMIC_ENV_ID:', DYNAMIC_ENV_ID ? DYNAMIC_ENV_ID.slice(0, 8) + '…' : 'MISSING');
    if (walletDisabled) console.warn('[BETLY] Running in no-wallet mode (Dynamic SDK failed)');
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {/* Wallet degraded mode bandeau */}
      {walletDisabled && (
        <div style={{
          background: 'rgba(245,158,11,0.1)', borderBottom: '1px solid rgba(245,158,11,0.25)',
          padding: '8px 16px', textAlign: 'center',
          fontSize: 12, color: '#f59e0b', fontWeight: 500,
        }}>
          Connexion wallet en cours d'activation — utilise ton pseudo pour continuer
        </div>
      )}

      {/* Auth modals */}
      {!loading && authModalOpen && !firebaseUser && <AuthModal onClose={closeAuth} />}
      {!loading && firebaseUser && !user && <PseudoModal />}

      {/* Topbar — always shown, but simplified on mobile */}
      <Topbar walletDisabled={walletDisabled} />

      <div style={{
        display: 'flex',
        gap: 0,
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 16px',
        alignItems: 'flex-start',
      }}>
        {/* Main content */}
        <main
          className="page-enter"
          style={{
            flex: 1,
            minWidth: 0,
            paddingBottom: isMobile ? 76 : 48,
          }}
        >
          <PageErrorBoundary key={page}>
            {page === 'feed'        && <Feed />}
            {page === 'create'      && <AuthGuard><CreateMarket /></AuthGuard>}
            {page === 'copy'        && <BetlyCopy />}
            {page === 'leaderboard' && <Leaderboard />}
            {page === 'account'     && <AuthGuard><Account /></AuthGuard>}
            {page === 'market'      && (
              <MarketDetail marketId={window.location.pathname.split('/market/')[1]} />
            )}
            {page === 'profile'     && (
              <Profile profileId={window.location.pathname.split('/profile/')[1]} />
            )}
            {page === 'tag'         && (
              <TagPage tag={window.location.pathname.split('/tag/')[1]} />
            )}
            {page === 'admin'       && <AdminPage />}
            {page === 'affiliate'      && <AffiliatePage />}
            {page === 'creator'        && <CreatorDashboard />}
            {page === 'verify-creator' && <VerifyCreator />}
            {page === 'privacy'             && <PrivacyPage />}
            {page === 'terms'               && <TermsPage />}
            {page === 'responsible-gaming'  && <ResponsibleGamingPage />}
            {page === 'legal'               && <LegalPage />}
            {page === 'positions'           && <AuthGuard><PositionsPage /></AuthGuard>}
            {page === 'share'               && <SharePage betId={window.location.pathname.split('/share/')[1]} />}
            {page === 'agents'              && <AgentsPage />}
            {page === 'docs'                && <DocsPage />}
          </PageErrorBoundary>
        </main>

      </div>

      {/* Footer */}
      {!['admin'].includes(page) && <Footer isMobile={isMobile} />}

      {/* Mobile bottom nav */}
      {isMobile && <BottomNav />}

      <ToastManager />
      <AgeVerification />
    </div>
  );
}

export default function App() {
  return (
    <WalletErrorBoundary>
      <DynamicContextProvider
        settings={{
          environmentId: DYNAMIC_ENV_ID,
          walletConnectors: [EthereumWalletConnectors],
          evmNetworks: [
            {
              blockExplorerUrls: ['https://polygonscan.com/'],
              chainId: 137,
              chainName: 'Polygon',
              iconUrls: ['https://app.dynamic.xyz/assets/networks/polygon.svg'],
              name: 'Polygon',
              nativeCurrency: { decimals: 18, name: 'POL', symbol: 'POL' },
              networkId: 137,
              rpcUrls: ['https://polygon-bor-rpc.publicnode.com'],
              vanityName: 'Polygon',
            },
          ],
        }}
      >
        <WagmiProvider config={wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <DynamicWagmiConnector>
              <AuthProvider>
                <AppInner />
              </AuthProvider>
            </DynamicWagmiConnector>
          </QueryClientProvider>
        </WagmiProvider>
      </DynamicContextProvider>
    </WalletErrorBoundary>
  );
}
