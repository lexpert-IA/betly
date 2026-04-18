import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from './ToastManager';
import { apiFetch } from '../lib/api';
import ShareButton from './ShareButton';

const BASE = import.meta.env.VITE_API_URL || '';

const NOTIF_ICONS = {
  // Legacy
  market_resolved:     'W',
  bet_won:             '$',
  bet_lost:            '-',
  new_follower:        '+',
  new_comment:         'C',
  vote_open:           'V',
  // Paris
  bet_placed:          '+',
  bet_partial:         '~',
  bet_limit_filled:    'F',
  bet_refunded:        'R',
  market_expiring:     'T',
  market_resolved_won: 'W',
  market_resolved_lost:'L',
  // Wallet
  deposit_detected:    'D',
  deposit_confirmed:   'D',
  withdrawal_processing:'W',
  withdrawal_completed:'W',
  // Social
  market_first_bet:    '1',
  profile_followed:    '+',
  comment_on_market:   'C',
  trade_copied:        'T',
  whale_alert:         '!',
  // Modération
  market_approved:     'Y',
  market_rejected:     'X',
  market_flagged:      '!',
  account_warning:     '!',
  // Communauté
  vote_result:         'V',
  level_up:            'U',
  streak_milestone:    'S',
};

function timeAgo(date) {
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

export default function NotificationBell({ onNewNotif }) {
  const { user } = useAuth();
  const [open, setOpen]       = useState(false);
  const [count, setCount]     = useState(0);
  const [notifs, setNotifs]   = useState([]);
  const [loaded, setLoaded]   = useState(false);
  const panelRef = useRef(null);
  const prevCount = useRef(0);

  const userId = user?.userId;

  // Poll unread count every 15s
  const fetchCount = useCallback(async () => {
    if (!userId) return;
    try {
      const res  = await apiFetch('/api/notifications/unread-count');
      const data = await res.json();
      const newCount = data.count || 0;
      if (newCount > prevCount.current && prevCount.current !== -1) {
        onNewNotif?.(newCount - prevCount.current);
        try {
          const nRes  = await apiFetch('/api/notifications');
          const nData = await nRes.json();
          const fresh = (nData.notifications || []).filter(n => !n.read && n.type === 'bet_won');
          fresh.forEach(n => toast(n.message, 'win', 5000));
        } catch {}
      }
      prevCount.current = newCount;
      setCount(newCount);
    } catch {}
  }, [userId, onNewNotif]);

  useEffect(() => {
    prevCount.current = -1; // skip first toast
    fetchCount();
    const t = setInterval(fetchCount, 15000);
    return () => clearInterval(t);
  }, [fetchCount]);

  // Load full list + mark read on open
  async function openPanel() {
    if (!userId) return;
    setOpen(true);
    if (!loaded) {
      try {
        const res  = await apiFetch('/api/notifications');
        const data = await res.json();
        setNotifs(data.notifications || []);
        setLoaded(true);
      } catch {}
    }
    // Mark all as read
    try {
      await apiFetch('/api/notifications/read-all', { method: 'POST' });
      setCount(0);
      prevCount.current = 0;
      setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    } catch {}
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!userId) return null;

  return (
    <div ref={panelRef} style={{ position: 'relative', flexShrink: 0 }}>
      {/* Bell button */}
      <button
        onClick={() => open ? setOpen(false) : openPanel()}
        style={{
          position: 'relative',
          width: 36, height: 36, borderRadius: 8,
          background: open ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, transition: 'all .2s',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#e2e8f0' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: '#fff',
            fontSize: 9, fontWeight: 800,
            minWidth: 16, height: 16, borderRadius: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 3px',
            border: '1.5px solid #111118',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          width: 320,
          background: '#111118',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 12,
          boxShadow: '0 16px 48px rgba(0,0,0,.6), 0 0 0 1px rgba(124,58,237,.15)',
          zIndex: 500,
          animation: 'notif-drop .15s ease',
          overflow: 'hidden',
        }}>
          <style>{`
            @keyframes notif-drop { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>

          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Notifications</span>
            {notifs.length > 0 && (
              <span style={{ fontSize: 11, color: '#64748b' }}>{notifs.length} au total</span>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {!loaded ? (
              <div style={{ padding: '20px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                Chargement...
              </div>
            ) : notifs.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#64748b' }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
                <div style={{ fontSize: 13, color: '#64748b' }}>Aucune notification</div>
              </div>
            ) : (
              notifs.map((n, i) => {
                const isWon = n.type === 'bet_won' || n.type === 'market_resolved_won';
                return (
                  <div
                    key={n._id || i}
                    onClick={() => { if (n.marketId) window.location.href = `/market/${n.marketId}`; setOpen(false); }}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '11px 16px',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      cursor: n.marketId ? 'pointer' : 'default',
                      background: !n.read ? 'rgba(124,58,237,0.06)' : 'transparent',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                    onMouseLeave={e => e.currentTarget.style.background = !n.read ? 'rgba(124,58,237,0.06)' : 'transparent'}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(124,58,237,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14,
                    }}>
                      {NOTIF_ICONS[n.type] || 'N'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: '#e2e8f0', lineHeight: 1.4, margin: 0, marginBottom: 3 }}>
                        {n.message}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                        <span style={{ fontSize: 10, color: '#475569' }}>{timeAgo(n.createdAt)}</span>
                        {isWon && n.betId && (
                          <ShareButton
                            variant="won"
                            bet={{ _id: n.betId, payout: n.payout, amount: n.amount, side: n.side }}
                            market={{ _id: n.marketId, title: n.marketTitle || '' }}
                            label="Partager ma victoire"
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#a855f7', flexShrink: 0, marginTop: 3,
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
