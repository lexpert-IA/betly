import React, { useState } from 'react';
import ShareModal from './ShareModal';

/**
 * ShareButton — bouton partage réutilisable
 * Props:
 *   variant: 'placed' | 'won' | 'live' | 'challenge'
 *   bet, market: données du pari / marché
 *   label: texte du bouton (optionnel)
 *   size: 'sm' | 'md' (défaut: 'sm')
 */
export default function ShareButton({ variant = 'placed', bet, market, label, size = 'sm' }) {
  const [open, setOpen] = useState(false);

  if (!market) return null;

  const isSm = size === 'sm';

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(true); }}
        title="Partager"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: isSm ? 4 : 6,
          padding: isSm ? '4px 10px' : '8px 16px',
          borderRadius: isSm ? 6 : 9,
          border: '1px solid rgba(168,85,247,0.25)',
          background: 'rgba(168,85,247,0.07)',
          color: '#a855f7',
          fontSize: isSm ? 11 : 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all .15s',
          flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.15)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(168,85,247,0.07)'; }}
      >
        <svg width={isSm ? 11 : 14} height={isSm ? 11 : 14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
        {label || (isSm ? 'Partager' : 'Partager ce pari')}
      </button>

      {open && (
        <ShareModal
          variant={variant}
          bet={bet}
          market={market}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
