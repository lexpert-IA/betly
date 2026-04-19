import React, { useState, useEffect } from 'react';
import { useGameSocket } from '../components/game/useGameSocket';
import GameTable from '../components/game/GameTable';
import LiveChat from '../components/game/LiveChat';
import BettingPanel from '../components/game/BettingPanel';
import BetModal from '../components/game/BetModal';
import VerifyModal from '../components/game/VerifyModal';
import PhaseBanner from '../components/game/PhaseBanner';
import WinnerOverlay from '../components/game/WinnerOverlay';

const TABS = [
  { key: 'game', label: 'Jeu' },
  { key: 'chat', label: 'Chat' },
  { key: 'bets', label: 'Paris' },
];

export default function LiveGamePage() {
  const {
    matchId, players, markets, myBets, chatMessages, phase, round,
    currentSpeaker, balance, totalPayout, winner, loading, error,
    startMatch, placeBet, updateBalance,
  } = useGameSocket();

  const [mobileTab, setMobileTab] = useState('game');
  const [betModal, setBetModal] = useState(null); // { marketId, side }
  const [verifyEvent, setVerifyEvent] = useState(null);
  const [showWinner, setShowWinner] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (winner) setShowWinner(true);
  }, [winner]);

  const handleBetClick = (marketId, side) => {
    setBetModal({ marketId, side });
  };

  const handleBetConfirm = (amount) => {
    if (betModal) {
      placeBet(betModal.marketId, betModal.side, amount);
      setBetModal(null);
    }
  };

  const selectedMarket = betModal ? markets.find(m => m.id === betModal.marketId) : null;

  // No match — show start screen
  if (!matchId) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
        </div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 4,
          color: 'var(--text-primary)', marginBottom: 12,
        }}>
          LOUP-GAROU EN DIRECT
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
          8 agents IA jouent au Loup-Garou. Regarde, analyse et parie sur l'issue.
        </p>
        <button
          className="wolves-btn wolves-btn-primary"
          onClick={startMatch}
          disabled={loading}
          style={{ fontSize: 15, padding: '12px 32px', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Lancement...' : 'Lancer une partie'}
        </button>
        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 16 }}>{error}</div>
        )}
      </div>
    );
  }

  // Desktop layout
  if (!isMobile) {
    return (
      <div style={{ display: 'flex', gap: 16, padding: '16px 0', minHeight: 'calc(100vh - 140px)' }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <GameTable players={players} phase={phase} currentSpeaker={currentSpeaker} />
          <div style={{ flex: 1, minHeight: 0 }}>
            <LiveChat messages={chatMessages} matchId={matchId} onVerify={setVerifyEvent} />
          </div>
        </div>

        {/* Right column — betting */}
        <div style={{ width: 340, flexShrink: 0 }}>
          <BettingPanel markets={markets} myBets={myBets} balance={balance} onBet={handleBetClick} />
        </div>

        {/* Overlays */}
        <PhaseBanner phase={phase} round={round} />
        {betModal && (
          <BetModal
            market={selectedMarket}
            side={betModal.side}
            balance={balance}
            onConfirm={handleBetConfirm}
            onClose={() => setBetModal(null)}
          />
        )}
        {verifyEvent && (
          <VerifyModal matchId={matchId} eventId={verifyEvent} onClose={() => setVerifyEvent(null)} />
        )}
        {showWinner && (
          <WinnerOverlay
            winner={winner}
            players={players}
            totalPayout={totalPayout}
            onNewGame={() => { setShowWinner(false); startMatch(); }}
            onClose={() => setShowWinner(false)}
          />
        )}
      </div>
    );
  }

  // Mobile layout — tabs
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 140px)' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 56, zIndex: 10, background: 'var(--bg-primary)',
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setMobileTab(t.key)} style={{
            flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            color: mobileTab === t.key ? 'var(--accent)' : 'var(--text-muted)',
            borderBottom: mobileTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            fontFamily: 'var(--font-body)',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '12px 0' }}>
        {mobileTab === 'game' && (
          <GameTable players={players} phase={phase} currentSpeaker={currentSpeaker} />
        )}
        {mobileTab === 'chat' && (
          <LiveChat messages={chatMessages} matchId={matchId} onVerify={setVerifyEvent} />
        )}
        {mobileTab === 'bets' && (
          <BettingPanel markets={markets} myBets={myBets} balance={balance} onBet={handleBetClick} />
        )}
      </div>

      {/* Overlays */}
      <PhaseBanner phase={phase} round={round} />
      {betModal && (
        <BetModal
          market={selectedMarket}
          side={betModal.side}
          balance={balance}
          onConfirm={handleBetConfirm}
          onClose={() => setBetModal(null)}
        />
      )}
      {verifyEvent && (
        <VerifyModal matchId={matchId} eventId={verifyEvent} onClose={() => setVerifyEvent(null)} />
      )}
      {showWinner && (
        <WinnerOverlay
          winner={winner}
          players={players}
          totalPayout={totalPayout}
          onNewGame={() => { setShowWinner(false); startMatch(); }}
          onClose={() => setShowWinner(false)}
        />
      )}
    </div>
  );
}
