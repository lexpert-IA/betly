import React from 'react';

export default function BetBar({ totalYes, totalNo }) {
  const total  = (totalYes || 0) + (totalNo || 0);
  const yesPct = total > 0 ? Math.round(((totalYes || 0) / total) * 100) : 50;
  const noPct  = 100 - yesPct;

  return (
    <div style={{ width: '100%' }}>
      {/* YES bar */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: '#a855f7' }}>OUI</span>
          <span style={{ color: '#a855f7' }}>{yesPct}%</span>
        </div>
        <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${yesPct}%`,
            background: 'linear-gradient(90deg, #7c3aed, #a855f7)',
            borderRadius: 999,
            animation: 'bar-grow 1s cubic-bezier(.4,0,.2,1) both',
          }} />
        </div>
      </div>

      {/* NO bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: '#94a3b8' }}>NON</span>
          <span style={{ color: '#94a3b8' }}>{noPct}%</span>
        </div>
        <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${noPct}%`,
            background: 'rgba(148,163,184,0.3)',
            borderRadius: 999,
            animation: 'bar-grow 1s cubic-bezier(.4,0,.2,1) both',
          }} />
        </div>
      </div>

      {/* Volume */}
      <div style={{ marginTop: 6, fontSize: 11, color: '#64748b', textAlign: 'right' }}>
        Vol. {total.toLocaleString('fr-FR')} USDC
      </div>
    </div>
  );
}
