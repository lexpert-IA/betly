import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from './ToastManager';

const API = import.meta.env.VITE_API_URL || '';

/**
 * CopyTradeButton — copies a trade (same market + same side)
 * Props:
 *   marketId: string
 *   side: 'YES' | 'NO'
 *   marketTitle: string (optional, for display)
 */
export default function CopyTradeButton({ marketId, side, marketTitle }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);

  async function confirmCopy() {
    if (!user) { toast('Crée un compte pour copier ce trade !', 'warning'); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/markets/${marketId}/bet?userId=${encodeURIComponent(user.userId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ side, amount: amt }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast(`Trade copié ! ${side === 'YES' ? 'OUI' : 'NON'} $${amt} placé 🎯`, 'success');
      setOpen(false);
      setAmount('10');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="btn-press"
        style={{
          padding: '3px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
          background: 'rgba(124,58,237,0.12)',
          border: '1px solid rgba(124,58,237,0.25)',
          color: '#a855f7', fontWeight: 600, transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.22)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,58,237,0.12)'; }}
      >
        📋 Copier
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400 }}
          />
          {/* Popover */}
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 401, width: 240,
              background: '#111118',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, padding: 14,
              boxShadow: '0 16px 40px rgba(0,0,0,.6)',
              animation: 'slideDownSearch .2s ease',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              width: 10, height: 10, background: '#111118',
              border: '1px solid rgba(255,255,255,0.1)',
              borderTop: 'none', borderLeft: 'none',
              transform: 'translateX(-50%) rotate(45deg)',
            }} />

            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
              📋 Copier ce trade
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
              {side === 'YES' ? '🟢 OUI' : '🔴 NON'} ·{' '}
              {marketTitle ? marketTitle.slice(0, 40) + (marketTitle.length > 40 ? '…' : '') : `Marché ${marketId?.slice(0, 8)}`}
            </div>

            {/* Amount slider */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#64748b' }}>Montant</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>${amount} USDC</span>
              </div>
              <input
                type="range" min="1" max="100" step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                style={{ width: '100%', accentColor: side === 'YES' ? '#a855f7' : '#94a3b8' }}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[5, 10, 25, 50].map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    style={{
                      flex: 1, padding: '3px 0', borderRadius: 5, fontSize: 10, cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: String(amount) === String(a) ? 'rgba(168,85,247,0.2)' : 'transparent',
                      color: String(amount) === String(a) ? '#a855f7' : '#64748b',
                    }}
                  >
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={confirmCopy}
              disabled={loading}
              className="btn-press"
              style={{
                width: '100%', padding: '8px', borderRadius: 8, border: 'none',
                background: side === 'YES'
                  ? 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  : 'rgba(148,163,184,0.3)',
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Envoi…' : `Confirmer ${side === 'YES' ? 'OUI' : 'NON'} $${amount}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
