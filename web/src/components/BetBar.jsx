import React from 'react';

export default function BetBar({ totalYes, totalNo }) {
  const total = (totalYes || 0) + (totalNo || 0);
  const yesPct = total > 0 ? Math.round(((totalYes || 0) / total) * 100) : 50;
  const noPct = 100 - yesPct;

  return (
    <div style={{ width: '100%' }}>
      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>
        <span style={{ color: '#22c55e' }}>OUI {yesPct}%</span>
        <span style={{ color: '#ef4444' }}>NON {noPct}%</span>
      </div>

      {/* Bar */}
      <div
        style={{
          height: '6px',
          borderRadius: '999px',
          background: '#1e1e2a',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        <div
          style={{
            width: `${yesPct}%`,
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            borderRadius: '999px 0 0 999px',
            transition: 'width 0.3s ease',
          }}
        />
        <div
          style={{
            width: `${noPct}%`,
            background: 'linear-gradient(90deg, #ef4444, #dc2626)',
            borderRadius: '0 999px 999px 0',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Volume */}
      <div style={{ marginTop: '4px', fontSize: '11px', color: '#6060a0', textAlign: 'right' }}>
        Vol. {(total).toLocaleString('fr-FR')} USDC
      </div>
    </div>
  );
}
