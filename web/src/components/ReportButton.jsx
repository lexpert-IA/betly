import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from './ToastManager';
import { apiFetch } from '../lib/api';

const API = import.meta.env.VITE_API_URL || '';

const REASONS = [
  'Triche / manipulation',
  'Contenu inapproprié',
  'Marché irresolvable',
  'Spam',
  'Autre',
];

export default function ReportButton({ marketId, commentId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  async function submit() {
    if (!reason) return;
    if (!user) { toast('Connecte-toi pour signaler', 'warning'); return; }
    setLoading(true);
    try {
      const path = commentId
        ? `/api/comments/${commentId}/flag`
        : `/api/markets/${marketId}/flag`;
      const res = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      toast('Signalement envoyé. Merci.', 'success');
      setOpen(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.08)',
          background: 'transparent', color: '#475569', fontSize: 11, cursor: 'pointer',
          transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
        title="Signaler"
      >
        🚩 Signaler
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 500 }} />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
              zIndex: 501, width: 220,
              background: '#111118', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: 12,
              boxShadow: '0 12px 36px rgba(0,0,0,.6)',
              animation: 'slideDownSearch .15s ease',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
              🚩 Signaler
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    textAlign: 'left', fontSize: 12,
                    background: reason === r ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                    color: reason === r ? '#ef4444' : '#94a3b8',
                    border: `1px solid ${reason === r ? 'rgba(239,68,68,0.3)' : 'transparent'}`,
                    transition: 'all .1s',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={submit}
              disabled={!reason || loading}
              style={{
                width: '100%', padding: '8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: reason ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)',
                color: reason ? '#ef4444' : '#64748b', fontSize: 12, fontWeight: 700,
              }}
            >
              {loading ? 'Envoi...' : 'Envoyer le signalement'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
