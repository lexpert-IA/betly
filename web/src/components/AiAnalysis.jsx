import React from 'react';

const DECISION_STYLE = {
  approved: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: '✓ Approuvé' },
  review:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: '~ En révision' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: '✗ Rejeté' },
};

function MiniBar({ value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          flex: 1,
          height: '4px',
          borderRadius: '999px',
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: '100%',
            background: color,
            borderRadius: '999px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <span style={{ fontSize: '11px', color: '#9090a0', minWidth: '28px', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export default function AiAnalysis({ analysis, loading }) {
  if (loading) {
    return (
      <div
        style={{
          background: '#111118',
          border: '1px solid rgba(167,139,250,0.2)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#a78bfa',
          fontSize: '13px',
        }}
      >
        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
        <span>Analyse IA en cours...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!analysis) return null;

  const decision = DECISION_STYLE[analysis.decision] || DECISION_STYLE.review;

  return (
    <div
      style={{
        background: '#111118',
        border: `1px solid ${decision.color}33`,
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', color: '#9090a0', fontWeight: 500 }}>Analyse IA</span>
        <span
          style={{
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            color: decision.color,
            background: decision.bg,
          }}
        >
          {decision.label}
        </span>
      </div>

      {/* Score + category + oracle */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '32px', fontWeight: 700, color: decision.color, lineHeight: 1 }}>
            {analysis.confidenceScore}
          </div>
          <div style={{ fontSize: '10px', color: '#6060a0', marginTop: '2px' }}>/ 100</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#a78bfa',
                background: 'rgba(167,139,250,0.1)',
                textTransform: 'uppercase',
              }}
            >
              {analysis.category || 'autre'}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#60a5fa',
                background: 'rgba(96,165,250,0.1)',
              }}
            >
              Oracle L{analysis.oracleLevel}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: '#9090a0', lineHeight: 1.4 }}>
            {analysis.confidenceExplanation}
          </p>
        </div>
      </div>

      {/* Mini bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6060a0' }}>
          <span>Vérifiabilité</span>
          <span>Toxicité</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <MiniBar value={analysis.verifiability || 0} color="#22c55e" />
          </div>
          <div style={{ flex: 1 }}>
            <MiniBar value={analysis.toxicity || 0} color="#ef4444" />
          </div>
        </div>
      </div>

      {/* Rejection reason */}
      {analysis.rejectionReason && (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            fontSize: '12px',
            color: '#ef4444',
          }}
        >
          {analysis.rejectionReason}
        </div>
      )}
    </div>
  );
}
