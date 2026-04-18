import React from 'react';

export default function ConfidenceBadge({ score }) {
  let label, color, bg;

  if (score >= 80) {
    label = '✓ Fiable';
    color = '#22c55e';
    bg = 'rgba(34,197,94,0.12)';
  } else if (score >= 50) {
    label = '~ Modéré';
    color = '#f59e0b';
    bg = 'rgba(245,158,11,0.12)';
  } else {
    label = 'Risqué';
    color = '#ef4444';
    bg = 'rgba(239,68,68,0.12)';
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        color,
        background: bg,
        border: `1px solid ${color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
