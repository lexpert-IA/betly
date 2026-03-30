import { useState, useRef, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useAuth } from '../hooks/useAuth';
import { useUsdcBalance } from '../hooks/useUsdcBalance';

export default function WalletButton() {
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const { user, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Custodial wallet (DB) ou wallet connecté (MetaMask/Dynamic)
  const address = primaryWallet?.address || user?.walletAddress;
  const isCustodial = !primaryWallet?.address && !!user?.walletAddress;

  const { balance } = useUsdcBalance(address);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // ── Pas de wallet → "Bet now" CTA ─────────────────────────────────────────
  if (!address) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {/* Bet now — CTA principal */}
        <button
          onClick={() => {
            if (user) {
              window.location.href = '/account?tab=deposit';
            } else {
              openAuth();
            }
          }}
          style={{
            padding: '7px 18px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.3px',
            boxShadow: '0 0 20px rgba(124,58,237,0.45), 0 2px 8px rgba(0,0,0,0.3)',
            transition: 'all .2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 0 32px rgba(168,85,247,0.6), 0 4px 12px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(124,58,237,0.45), 0 2px 8px rgba(0,0,0,0.3)';
          }}
        >
          <span style={{ fontSize: 14 }}>🎯</span>
          Bet now
        </button>

        {/* Connecter wallet — option secondaire */}
        <button
          onClick={() => setShowAuthFlow(true)}
          style={{
            padding: '6px 12px',
            borderRadius: 9,
            cursor: 'pointer',
            background: 'rgba(124,58,237,0.08)',
            border: '1px solid rgba(124,58,237,0.25)',
            color: '#a78bfa',
            fontSize: 11,
            fontWeight: 600,
            transition: 'all .15s',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.16)';
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.5)';
            e.currentTarget.style.color = '#c4b5fd';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(124,58,237,0.08)';
            e.currentTarget.style.borderColor = 'rgba(124,58,237,0.25)';
            e.currentTarget.style.color = '#a78bfa';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 12V22H4V12" /><path d="M22 7H2v5h20V7z" /><path d="M12 22V7" />
            <path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" />
          </svg>
          Wallet
        </button>
      </div>
    );
  }

  const shortAddr = `${address.slice(0, 6)}…${address.slice(-4)}`;

  // ── Wallet connecté ────────────────────────────────────────────────────────
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 12px',
          borderRadius: 10,
          cursor: 'pointer',
          background: open
            ? 'rgba(124,58,237,0.18)'
            : 'rgba(124,58,237,0.08)',
          border: `1px solid ${open ? 'rgba(124,58,237,0.55)' : 'rgba(124,58,237,0.2)'}`,
          transition: 'all .15s',
          boxShadow: open ? '0 0 16px rgba(124,58,237,0.2)' : 'none',
        }}
      >
        {/* Dot indicateur */}
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isCustodial
            ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
            : '#22c55e',
          boxShadow: isCustodial
            ? '0 0 6px rgba(168,85,247,0.8)'
            : '0 0 6px rgba(34,197,94,0.8)',
          flexShrink: 0,
        }} />

        <span style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.2px' }}>
          {shortAddr}
        </span>

        {balance !== null && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 99,
            background: 'rgba(168,85,247,0.12)',
            border: '1px solid rgba(168,85,247,0.2)',
            fontSize: 11,
            fontWeight: 700,
            color: '#a855f7',
          }}>
            {parseFloat(balance).toFixed(2)} USDC
          </span>
        )}

        <span style={{ fontSize: 9, color: '#7c3aed', marginLeft: 1 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 46,
          right: 0,
          width: 230,
          background: '#111118',
          border: '1px solid rgba(124,58,237,0.2)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,.6), 0 0 24px rgba(124,58,237,0.08)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* Badge custodial */}
          {isCustodial && (
            <div style={{
              padding: '6px 14px',
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(168,85,247,0.08))',
              borderBottom: '1px solid rgba(124,58,237,0.15)',
              fontSize: 10,
              fontWeight: 700,
              color: '#a78bfa',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}>
              <span>🔐</span> Wallet Betly
            </div>
          )}

          {/* Adresse */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Adresse Polygon
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {address}
            </div>
          </div>

          {/* Balance */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: 10, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Balance USDC on-chain
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#a855f7' }}>
              {balance !== null ? `${parseFloat(balance).toFixed(2)}` : '…'}
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', marginLeft: 4 }}>USDC</span>
            </div>
          </div>

          {/* Actions */}
          {[
            { label: '⬇️  Déposer',  href: '/account?tab=deposit'  },
            { label: '⬆️  Retirer',  href: '/account?tab=withdraw' },
          ].map(({ label, href }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'block',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 600,
                color: '#94a3b8',
                textDecoration: 'none',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'all .1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.08)'; e.currentTarget.style.color = '#c4b5fd'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              {label}
            </a>
          ))}

          {/* Déconnecter — uniquement si wallet externe */}
          {!isCustodial && (
            <button
              onClick={async () => {
                await primaryWallet.connector.endSession();
                setOpen(false);
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: '#ef4444',
                transition: 'all .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              Déconnecter wallet
            </button>
          )}
        </div>
      )}
    </div>
  );
}
