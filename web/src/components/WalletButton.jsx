import { useState, useRef, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useAuth } from '../hooks/useAuth';
import { useUsdcBalance } from '../hooks/useUsdcBalance';

export default function WalletButton() {
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

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

  // No wallet connected — show connect button
  if (!address) {
    return (
      <button
        onClick={() => setShowAuthFlow(true)}
        style={{
          padding: '7px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 13,
          fontWeight: 500,
          transition: 'all .15s',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.borderColor = 'var(--border-hover)';
          e.currentTarget.style.color = '#fff';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 12V22H4V12"/><path d="M22 7H2v5h20V7z"/><path d="M12 22V7"/>
        </svg>
        Wallet
      </button>
    );
  }

  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

  // Wallet connected
  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 8,
          cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'var(--border-hover)' : 'var(--border)'}`,
          transition: 'all .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
          e.currentTarget.style.borderColor = 'var(--border-hover)';
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
            e.currentTarget.style.borderColor = 'var(--border)';
          }
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: isCustodial ? '#1a7f37' : '#22c55e',
          boxShadow: `0 0 6px ${isCustodial ? 'rgba(26,127,55,0.7)' : 'rgba(34,197,94,0.7)'}`,
          flexShrink: 0,
        }} />

        <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', fontFamily: 'var(--font-mono)' }}>
          {shortAddr}
        </span>

        {balance !== null && (
          <span style={{
            padding: '2px 8px',
            borderRadius: 99,
            background: 'rgba(26,127,55,0.12)',
            border: '1px solid rgba(26,127,55,0.25)',
            fontSize: 11,
            fontWeight: 700,
            color: '#22c55e',
          }}>
            {parseFloat(balance).toFixed(2)}
          </span>
        )}

        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {open
            ? <polyline points="18 15 12 9 6 15"/>
            : <polyline points="6 9 12 15 18 9"/>
          }
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: 4,
          width: 240,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-hover)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          {/* Custodial badge */}
          {isCustodial && (
            <div style={{
              padding: '6px 14px',
              background: 'rgba(26,127,55,0.08)',
              borderBottom: '1px solid var(--border)',
              fontSize: 10,
              fontWeight: 600,
              color: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Wallet Wolves
            </div>
          )}

          {/* Address */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Adresse Polygon
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all', lineHeight: 1.5 }}>
              {address}
            </div>
          </div>

          {/* Balance */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Balance USDC
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
              {balance !== null ? parseFloat(balance).toFixed(2) : '...'}
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 4 }}>USDC</span>
            </div>
          </div>

          {/* Actions */}
          {[
            { label: 'Deposer', href: '/account?tab=deposit', icon: 'M12 19V5M5 12l7-7 7 7' },
            { label: 'Retirer', href: '/account?tab=withdraw', icon: 'M12 5v14M19 12l-7 7-7-7' },
          ].map(({ label, href, icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--border)',
                transition: 'all .1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={icon}/>
              </svg>
              {label}
            </a>
          ))}

          {/* Disconnect — external wallet only */}
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
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: 'var(--red)',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'all .1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Deconnecter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
