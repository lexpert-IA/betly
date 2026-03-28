import { useState, useEffect, useRef } from 'react';

const API = import.meta.env.VITE_API_URL || '';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function EventRow({ event, onClick, isNew }) {
  const { type, side, amount, userId, marketTitle, outcome, time } = event;

  let icon, text, color;

  if (type === 'bet') {
    icon = side === 'YES' ? '🟢' : '🔴';
    color = side === 'YES' ? '#22c55e' : '#ef4444';
    text = (
      <>
        <span style={{ color: '#a78bfa', fontWeight: 600 }}>{userId}</span>
        {' a parié '}
        <span style={{ color, fontWeight: 700 }}>{side}</span>
        {` $${amount} sur `}
        <span style={{ color: '#e2e8f0' }}>{marketTitle?.slice(0, 42)}{marketTitle?.length > 42 ? '…' : ''}</span>
      </>
    );
  } else if (type === 'market_created') {
    icon = '✨';
    color = '#f59e0b';
    text = (
      <>
        {'Nouveau marché : '}
        <span style={{ color: '#e2e8f0' }}>{marketTitle?.slice(0, 50)}{marketTitle?.length > 50 ? '…' : ''}</span>
      </>
    );
  } else if (type === 'market_resolved') {
    icon = '🏆';
    color = '#a78bfa';
    text = (
      <>
        <span style={{ color: '#e2e8f0' }}>{marketTitle?.slice(0, 38)}{marketTitle?.length > 38 ? '…' : ''}</span>
        {' résolu — '}
        <span style={{ color: outcome === 'YES' ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
          {outcome} gagne
        </span>
      </>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'background 0.2s',
        background: isNew ? 'rgba(124,58,237,0.12)' : 'transparent',
        animation: isNew ? 'slideInFeed 0.4s ease-out' : 'none',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = isNew ? 'rgba(124,58,237,0.08)' : 'transparent'}
    >
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 13, marginTop: 1 }}>{icon}</span>
        <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, flex: 1 }}>{text}</span>
        <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap', marginTop: 2 }}>
          {timeAgo(time)}
        </span>
      </div>
    </div>
  );
}

export default function LiveFeed() {
  const [events, setEvents] = useState([]);
  const [newIds, setNewIds] = useState(new Set());
  const prevIdsRef = useRef(new Set());
  const [visible, setVisible] = useState(true);

  async function fetchEvents() {
    try {
      const r = await fetch(`${API}/api/feed/live`);
      if (!r.ok) return;
      const data = await r.json();
      const incoming = data.events || [];

      // Detect new events
      const incomingKeys = new Set(incoming.map(e => `${e.type}-${e.marketId}-${e.time}`));
      const fresh = new Set();
      incomingKeys.forEach(k => {
        if (!prevIdsRef.current.has(k)) fresh.add(k);
      });

      if (fresh.size > 0 && prevIdsRef.current.size > 0) {
        setNewIds(fresh);
        setTimeout(() => setNewIds(new Set()), 3000);
      }

      prevIdsRef.current = incomingKeys;
      setEvents(incoming);
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, 3000);
    return () => clearInterval(id);
  }, []);

  function navigate(marketId) {
    if (!marketId || marketId === 'mock-old') return;
    window.location.href = `/market/${marketId}`;
  }

  return (
    <div style={{
      width: 280,
      flexShrink: 0,
      position: 'sticky',
      top: 80,
      maxHeight: 'calc(100vh - 100px)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <style>{`
        @keyframes slideInFeed {
          from { opacity: 0; transform: translateX(12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15,15,25,0.95)',
        borderRadius: '12px 12px 0 0',
        border: '1px solid rgba(255,255,255,0.08)',
        borderBottomColor: 'transparent',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8, color: '#22c55e', animation: 'pulse 1.5s infinite' }}>●</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>
            LIVE
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>Ce qui se passe</span>
        </div>
        <button
          onClick={() => setVisible(v => !v)}
          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
        >
          {visible ? '−' : '+'}
        </button>
      </div>

      {visible && (
        <div style={{
          overflowY: 'auto',
          background: 'rgba(10,10,20,0.97)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderTop: '1px solid rgba(124,58,237,0.3)',
          borderRadius: '0 0 12px 12px',
          flex: 1,
        }}>
          {events.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#475569', fontSize: 12 }}>
              Aucune activité récente
            </div>
          ) : (
            events.map((e, i) => {
              const key = `${e.type}-${e.marketId}-${e.time}`;
              return (
                <EventRow
                  key={key}
                  event={e}
                  onClick={() => navigate(e.marketId)}
                  isNew={newIds.has(key)}
                />
              );
            })
          )}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
