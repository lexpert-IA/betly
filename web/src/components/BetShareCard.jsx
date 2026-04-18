import React from 'react';

// ── Category colors ───────────────────────────────────────────────────────────
const CAT_COLORS = {
  crypto:   '#f59e0b',
  sport:    '#22c55e',
  politique:'#ef4444',
  culture:  '#a855f7',
  tech:     '#06b6d4',
  autre:    '#64748b',
};

function catColor(cat) { return CAT_COLORS[cat?.toLowerCase()] || '#a855f7'; }

// ── Shared card shell ─────────────────────────────────────────────────────────
function CardShell({ badge, category, children }) {
  return (
    <div style={{
      background: '#0a0a0f',
      borderRadius: 18,
      padding: 22,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* gradient border via pseudo element simulation */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: 'linear-gradient(135deg, rgba(124,58,237,0.6) 0%, rgba(96,165,250,0.4) 100%)',
        padding: 1, zIndex: 0,
        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
        WebkitMaskComposite: 'xor',
        maskComposite: 'exclude',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <img src="/betly-logo.png" alt="BETLY" style={{ height: 20 }} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {category && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 999,
                background: `${catColor(category)}20`,
                border: `1px solid ${catColor(category)}40`,
                color: catColor(category), letterSpacing: '0.5px',
              }}>
                {category.toUpperCase()}
              </span>
            )}
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
              background: badge.bg, color: badge.color, letterSpacing: '0.5px',
            }}>
              {badge.text}
            </span>
          </div>
        </div>
        {children}
        <div style={{ fontSize: 9, color: '#334155', marginTop: 14, textAlign: 'right', letterSpacing: '0.3px' }}>
          betly.gg · marchés de prédiction
        </div>
      </div>
    </div>
  );
}

// ── Variante 1 — PARI PLACÉ ───────────────────────────────────────────────────
function CardBetPlaced({ bet, market }) {
  const side      = bet.side === 'YES' ? 'OUI' : 'NON';
  const sideColor = bet.side === 'YES' ? '#a855f7' : '#ef4444';
  const odds      = bet.odds ? Math.round(bet.odds * 100) : null;
  const gain      = bet.payout && bet.amount ? (bet.payout - bet.amount).toFixed(2) : null;

  return (
    <CardShell badge={{ text: 'PARI PLACÉ', bg: 'rgba(168,85,247,0.15)', color: '#a855f7' }} category={market.category}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4, marginBottom: 16, borderLeft: `3px solid ${sideColor}`, paddingLeft: 10 }}>
        {(market.title || '').slice(0, 90)}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: `${sideColor}18`, border: `1px solid ${sideColor}35`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>POSITION</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: sideColor, lineHeight: 1 }}>{side}</div>
          {odds && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>{odds}¢</div>}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 9, color: '#64748b', marginBottom: 3, fontWeight: 600 }}>MISE</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', lineHeight: 1 }}>{bet.amount} USDC</div>
          {gain && <div style={{ fontSize: 10, color: '#22c55e', marginTop: 4 }}>+{gain} potentiel</div>}
        </div>
      </div>
      {bet.username && (
        <div style={{ marginTop: 12, fontSize: 10, color: '#475569' }}>@{bet.username}</div>
      )}
    </CardShell>
  );
}

// ── Variante 2 — PARI GAGNÉ ───────────────────────────────────────────────────
function CardBetWon({ bet, market }) {
  const gain    = bet.payout && bet.amount ? (bet.payout - bet.amount).toFixed(2) : null;
  const roi     = bet.payout && bet.amount ? Math.round(((bet.payout - bet.amount) / bet.amount) * 100) : null;

  return (
    <CardShell badge={{ text: 'GAGNE', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' }} category={market.category}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4, marginBottom: 16, borderLeft: '3px solid #22c55e', paddingLeft: 10 }}>
        {(market.title || '').slice(0, 90)}
      </p>
      <div style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>J\'avais raison.</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>
          {gain ? `+$${gain}` : 'Gagné'} encaissés
        </div>
        {roi && <div style={{ fontSize: 12, color: '#4ade80', marginTop: 4 }}>ROI : +{roi}%</div>}
      </div>
      {bet.username && (
        <div style={{ fontSize: 10, color: '#475569' }}>@{bet.username}</div>
      )}
    </CardShell>
  );
}

// ── Variante 3 — MARCHÉ EN COURS ──────────────────────────────────────────────
function CardMarketLive({ market }) {
  const total   = (market.totalYes || 0) + (market.totalNo || 0);
  const yesPct  = total > 0 ? Math.round((market.totalYes / total) * 100) : 50;
  const noPct   = 100 - yesPct;

  function timeLeft() {
    if (!market.resolutionDate) return null;
    const ms = new Date(market.resolutionDate) - Date.now();
    if (ms <= 0) return 'Terminé';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 48) return `${Math.floor(h / 24)}j`;
    return `${h}h ${m}min`;
  }

  const tl = timeLeft();

  return (
    <CardShell badge={{ text: 'EN COURS', bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' }} category={market.category}>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4, marginBottom: 16 }}>
        {(market.title || '').slice(0, 90)}
      </p>
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: '#a855f7' }}>OUI {yesPct}%</span>
          <span style={{ fontWeight: 700, color: '#94a3b8' }}>NON {noPct}%</span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${yesPct}%`, background: 'linear-gradient(90deg,#7c3aed,#a855f7)', borderRadius: 999 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
        {total > 0 && <span>Volume : ${total.toFixed(0)} USDC</span>}
        {tl && <span>Expire dans : {tl}</span>}
      </div>
    </CardShell>
  );
}

// ── Variante 4 — DEFI ─────────────────────────────────────────────────────────
function CardChallenge({ bet, market }) {
  const side      = bet.side === 'YES' ? 'OUI' : 'NON';
  const sideColor = bet.side === 'YES' ? '#a855f7' : '#ef4444';
  const shareUrl  = typeof window !== 'undefined'
    ? `${window.location.origin}/share/${bet._id || bet.betId}`
    : `betly.gg/share/${bet._id || bet.betId}`;

  return (
    <CardShell badge={{ text: 'DEFI', bg: 'rgba(239,68,68,0.15)', color: '#ef4444' }} category={market.category}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>
        {bet.username ? `@${bet.username}` : 'Un parieur'} défie sa communauté
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4, marginBottom: 16, borderLeft: `3px solid ${sideColor}`, paddingLeft: 10 }}>
        {(market.title || '').slice(0, 90)}
      </p>
      <div style={{
        background: `${sideColor}15`, border: `1px solid ${sideColor}30`,
        borderRadius: 10, padding: '12px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          Il mise <strong style={{ color: sideColor }}>{side}</strong>. Et toi ?
        </span>
        <span style={{ fontSize: 11, color: '#475569', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {shareUrl}
        </span>
      </div>
    </CardShell>
  );
}

// ── Export principal ───────────────────────────────────────────────────────────
export default function BetShareCard({ variant = 'placed', bet, market }) {
  if (!market) return null;
  if ((variant === 'placed' || variant === 'won' || variant === 'challenge') && !bet) return null;

  if (variant === 'won')       return <CardBetWon       bet={bet}    market={market} />;
  if (variant === 'live')      return <CardMarketLive              market={market} />;
  if (variant === 'challenge') return <CardChallenge    bet={bet}    market={market} />;
  return <CardBetPlaced bet={bet} market={market} />;
}
