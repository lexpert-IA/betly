import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';
const DEFAULT_SECRET = 'betly-admin-2025';

function timeAgo(date) {
  if (!date) return '—';
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

const STATUS_COLORS = {
  draft:          { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  pending_review: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  active:         { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  resolving:      { color: '#a855f7', bg: 'rgba(168,85,247,0.1)' },
  resolved:       { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  claiming:       { color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  closed:         { color: '#475569', bg: 'rgba(71,85,105,0.1)' },
  rejected:       { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  cancelled:      { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  disputed:       { color: '#e879f9', bg: 'rgba(232,121,249,0.1)' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.draft;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
      color: s.color, background: s.bg,
    }}>
      {status}
    </span>
  );
}

// ── Stats Card ─────────────────────────────────────────────────────────────────
function StatsPanel({ secret }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/stats?secret=${encodeURIComponent(secret)}`);
      const d = await r.json();
      if (r.ok) setStats(d);
    } finally { setLoading(false); }
  }, [secret]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: '#64748b', fontSize: 13 }}>Chargement stats…</div>;
  if (!stats) return null;

  const items = [
    { label: 'Marchés actifs',    value: stats.markets?.active ?? '—', color: '#22c55e' },
    { label: 'En review',         value: stats.markets?.pending_review ?? '—', color: '#f59e0b' },
    { label: 'Signalés',          value: stats.markets?.flagged ?? '—', color: '#ef4444' },
    { label: 'Total marchés',     value: stats.markets?.total ?? '—', color: '#a855f7' },
    { label: 'Utilisateurs',      value: stats.users?.total ?? '—', color: '#3b82f6' },
    { label: 'Bannis',            value: stats.users?.banned ?? '—', color: '#ef4444' },
    { label: 'Total paris',       value: stats.bets?.total ?? '—', color: '#f8fafc' },
    { label: 'Volume USDC',       value: stats.bets?.volume ? `${Number(stats.bets.volume).toFixed(0)} USDC` : '—', color: '#a855f7' },
    { label: 'Circuit breaker',   value: stats.circuitBreaker?.state ?? '—',
      color: stats.circuitBreaker?.state === 'OPEN' ? '#ef4444' : '#22c55e' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{
          background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>{label}</div>
          <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Pending Queue ──────────────────────────────────────────────────────────────
function PendingQueue({ secret, onAction }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/queue?secret=${encodeURIComponent(secret)}`);
      const d = await r.json();
      if (r.ok) setItems(d.markets || []);
    } finally { setLoading(false); }
  }, [secret]);

  useEffect(() => { load(); }, [load]);

  async function approve(id) {
    setActing(a => ({ ...a, [id]: 'approve' }));
    try {
      await fetch(`${API}/api/admin/approve/${id}?secret=${encodeURIComponent(secret)}`, { method: 'POST' });
      onAction?.(); load();
    } finally { setActing(a => { const n = { ...a }; delete n[id]; return n; }); }
  }

  async function reject(id, reason = 'Non conforme') {
    setActing(a => ({ ...a, [id]: 'reject' }));
    try {
      await fetch(`${API}/api/admin/reject/${id}?secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      onAction?.(); load();
    } finally { setActing(a => { const n = { ...a }; delete n[id]; return n; }); }
  }

  if (loading) return <div style={{ color: '#64748b', fontSize: 13, padding: '20px 0' }}>Chargement file d'attente…</div>;
  if (items.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
      Aucun marché en attente de validation
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(m => (
        <div key={m._id} style={{
          background: '#111118', border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 12, padding: 16,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <StatusBadge status={m.status} />
            {m.flagCount > 0 && (
              <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
                {m.flagCount} signalements
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
              {timeAgo(m.createdAt)}
            </span>
          </div>

          <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', lineHeight: 1.4 }}>{m.title}</div>
          {m.description && (
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
              {m.description.slice(0, 150)}{m.description.length > 150 ? '…' : ''}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11, color: '#64748b' }}>
            <span>Créateur: <span style={{ color: '#94a3b8' }}>{(m.creatorId || '—').slice(0, 12)}</span></span>
            <span>·</span>
            <span>Catégorie: <span style={{ color: '#94a3b8' }}>{m.category || '—'}</span></span>
            {m.confidenceScore > 0 && <>
              <span>·</span>
              <span>Score IA: <span style={{ color: m.confidenceScore >= 70 ? '#22c55e' : '#f59e0b' }}>{m.confidenceScore}%</span></span>
            </>}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => approve(m._id)}
              disabled={acting[m._id]}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(34,197,94,0.15)', color: '#22c55e',
                fontWeight: 700, fontSize: 12,
                opacity: acting[m._id] ? 0.5 : 1,
              }}
            >
              {acting[m._id] === 'approve' ? '⟳' : '✓ Approuver'}
            </button>
            <button
              onClick={() => reject(m._id)}
              disabled={acting[m._id]}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                fontWeight: 700, fontSize: 12,
                opacity: acting[m._id] ? 0.5 : 1,
              }}
            >
              {acting[m._id] === 'reject' ? '⟳' : '✗ Rejeter'}
            </button>
            <a
              href={`/market/${m._id}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#94a3b8', fontSize: 12, textDecoration: 'none',
                display: 'flex', alignItems: 'center',
              }}
            >
              Voir
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Resolve Panel ──────────────────────────────────────────────────────────────
function ResolvePanel({ secret }) {
  const [marketId, setMarketId] = useState('');
  const [outcome, setOutcome]   = useState('YES');
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState(null);

  async function resolve() {
    if (!marketId.trim()) return;
    setLoading(true); setMsg(null);
    try {
      const r = await fetch(
        `${API}/api/markets/${marketId.trim()}/resolve?secret=${encodeURIComponent(secret)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ outcome }),
        }
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erreur');
      setMsg({ type: 'ok', text: `Marché résolu → ${outcome}. ${d.payouts} payouts envoyés.` });
      setMarketId('');
    } catch (e) {
      setMsg({ type: 'err', text: e.message });
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: 20,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 14 }}>Résoudre un marché</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={marketId}
          onChange={e => setMarketId(e.target.value)}
          placeholder="Market ID (ObjectId)"
          style={{
            flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f8fafc', fontSize: 13, outline: 'none',
          }}
        />
        {['YES', 'NO'].map(s => (
          <button
            key={s}
            onClick={() => setOutcome(s)}
            style={{
              padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 700, fontSize: 13,
              background: outcome === s
                ? (s === 'YES' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)')
                : 'rgba(255,255,255,0.04)',
              color: outcome === s ? (s === 'YES' ? '#22c55e' : '#ef4444') : '#64748b',
            }}
          >
            {s === 'YES' ? '✓ OUI' : '✗ NON'}
          </button>
        ))}
        <button
          onClick={resolve}
          disabled={loading || !marketId.trim()}
          style={{
            padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: marketId.trim() ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.04)',
            color: marketId.trim() ? '#a855f7' : '#64748b',
            fontWeight: 700, fontSize: 13,
          }}
        >
          {loading ? '⟳' : 'Résoudre'}
        </button>
      </div>
      {msg && (
        <div style={{
          marginTop: 10, padding: '8px 10px', borderRadius: 6, fontSize: 12,
          background: msg.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          color: msg.type === 'ok' ? '#22c55e' : '#ef4444',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Users Panel ────────────────────────────────────────────────────────────────
function UsersPanel({ secret }) {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState({});
  const [search, setSearch]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/users?secret=${encodeURIComponent(secret)}&limit=50`);
      const d = await r.json();
      if (r.ok) setUsers(d.users || []);
    } finally { setLoading(false); }
  }, [secret]);

  useEffect(() => { load(); }, [load]);

  async function sanction(userId, type) {
    setActing(a => ({ ...a, [userId]: type }));
    try {
      await fetch(`${API}/api/admin/sanction?secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type }),
      });
      load();
    } finally { setActing(a => { const n = { ...a }; delete n[userId]; return n; }); }
  }

  const filtered = users.filter(u =>
    !search || (u.userId || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un utilisateur…"
        style={{
          width: '100%', padding: '9px 12px', borderRadius: 8, boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#f8fafc', fontSize: 13, outline: 'none', marginBottom: 14,
        }}
      />
      {loading ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>Chargement…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(u => (
            <div key={u._id || u.userId} style={{
              background: '#111118',
              border: `1px solid ${u.banned ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 10, padding: '12px 14px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                background: u.banned ? 'rgba(239,68,68,0.2)' : 'rgba(124,58,237,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#f8fafc',
              }}>
                {(u.userId || '?').slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                  {u.userId?.slice(0, 16) || '—'}
                  {u.banned && <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444' }}>BANNI</span>}
                  {u.warningCount > 0 && <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b' }}>x{u.warningCount}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                  {u.balance?.toFixed(2) || '0'} USDC · {u.betCount || 0} paris
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => sanction(u.userId, 'warning')}
                  disabled={acting[u.userId]}
                  title="Avertissement"
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 11, fontWeight: 600,
                  }}
                >
                  Warn
                </button>
                <button
                  onClick={() => sanction(u.userId, 'restrict_7d')}
                  disabled={acting[u.userId]}
                  title="Restreindre 7 jours"
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(249,115,22,0.12)', color: '#f97316', fontSize: 11, fontWeight: 600,
                  }}
                >
                  Lock
                </button>
                <button
                  onClick={() => sanction(u.userId, 'ban_permanent')}
                  disabled={acting[u.userId] || u.banned}
                  title="Bannir"
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 600,
                    opacity: u.banned ? 0.4 : 1,
                  }}
                >
                  Ban
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Flagged Markets ────────────────────────────────────────────────────────────
function FlaggedPanel({ secret }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/markets?status=active&limit=50`);
      const d = await r.json();
      const flagged = (d.markets || []).filter(m => m.flagCount > 0);
      setItems(flagged.sort((a, b) => b.flagCount - a.flagCount));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function dismiss(id) {
    setActing(a => ({ ...a, [id]: true }));
    try {
      await fetch(`${API}/api/admin/approve/${id}?secret=${encodeURIComponent(secret)}`, { method: 'POST' });
      load();
    } finally { setActing(a => { const n = { ...a }; delete n[id]; return n; }); }
  }

  async function reject(id) {
    setActing(a => ({ ...a, [id]: true }));
    try {
      await fetch(`${API}/api/admin/reject/${id}?secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Signalements multiples' }),
      });
      load();
    } finally { setActing(a => { const n = { ...a }; delete n[id]; return n; }); }
  }

  if (loading) return <div style={{ color: '#64748b', fontSize: 13 }}>Chargement…</div>;
  if (items.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
      Aucun marché signalé
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(m => (
        <div key={m._id} style={{
          background: '#111118', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12, padding: 14,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}>
              {m.flagCount} signalement{m.flagCount > 1 ? 's' : ''}
            </span>
            <StatusBadge status={m.status} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 6 }}>{m.title}</div>
          {m.flagReasons?.length > 0 && (
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
              Raisons : {[...new Set(m.flagReasons)].join(', ')}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => dismiss(m._id)}
              disabled={acting[m._id]}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 600, fontSize: 12,
              }}
            >
              Ignorer les signalements
            </button>
            <button
              onClick={() => reject(m._id)}
              disabled={acting[m._id]}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 600, fontSize: 12,
              }}
            >
              Retirer le marché
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Circuit Breaker ────────────────────────────────────────────────────────────
function CircuitPanel({ secret }) {
  const [state, setState]   = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      const r = await fetch(`${API}/api/health`);
      const d = await r.json();
      setState(d.circuitBreaker);
    } catch {}
  }

  async function reset() {
    setLoading(true);
    try {
      await fetch(`${API}/api/admin/circuit-reset?secret=${encodeURIComponent(secret)}`, { method: 'POST' });
      await load();
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const isOpen = state?.state === 'OPEN';

  return (
    <div style={{
      background: '#111118',
      border: `1px solid ${isOpen ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'}`,
      borderRadius: 12, padding: 16,
      display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
          Circuit Breaker
        </div>
        {state ? (
          <div style={{ fontSize: 12, color: isOpen ? '#ef4444' : '#22c55e' }}>
            {state.state} — {state.errors || 0} erreurs / 60s
            {state.openUntil && (
              <span style={{ color: '#64748b', marginLeft: 8 }}>
                · ouverture jusqu'à {new Date(state.openUntil).toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: '#64748b' }}>Chargement…</div>
        )}
      </div>
      {isOpen && (
        <button
          onClick={reset}
          disabled={loading}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'rgba(239,68,68,0.2)', color: '#ef4444',
            fontWeight: 700, fontSize: 12,
          }}
        >
          {loading ? '...' : 'Reset'}
        </button>
      )}
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────
// ── Revenue Panel ──────────────────────────────────────────────────────────────
function RevenuePanel({ secret }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/revenue?secret=${encodeURIComponent(secret)}`);
      const d = await r.json();
      if (r.ok) setData(d);
    } finally { setLoading(false); }
  }, [secret]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: '#64748b', fontSize: 13 }}>Chargement revenus…</div>;
  if (!data) return null;

  const { revenue, byType, topMarkets, affiliates } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Revenue overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {[
          { label: "Aujourd'hui",    value: `${revenue.day.toFixed(2)} USDC`,     color: '#f8fafc' },
          { label: 'Cette semaine',  value: `${revenue.week.toFixed(2)} USDC`,    color: '#a855f7' },
          { label: 'Ce mois',        value: `${revenue.month.toFixed(2)} USDC`,   color: '#22c55e' },
          { label: 'All-time net',   value: `${revenue.allTime.toFixed(2)} USDC`, color: '#fbbf24' },
          { label: 'Gross all-time', value: `${revenue.gross.toFixed(2)} USDC`,   color: '#94a3b8' },
          { label: 'Affiliés payés', value: `${affiliates.totalPaid.toFixed(2)} USDC`, color: '#ef4444' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 5 }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* By type */}
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>Répartition ce mois</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'market_fee', label: 'Marchés', color: '#a855f7', emoji: '' },
            { key: 'copy_fee',   label: 'Copy Trading', color: '#3b82f6', emoji: '' },
            { key: 'penalty',    label: 'Pénalités', color: '#ef4444', emoji: '' },
          ].map(({ key, label, color, emoji }) => {
            const d = byType[key] || { total: 0, count: 0 };
            return (
              <div key={key} style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color }}>{d.total.toFixed(2)} USDC</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{d.count} transactions</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top markets */}
      {topMarkets?.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>
            Top marchés (fees ce mois)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topMarkets.map((m, i) => (
              <div key={m.marketId} style={{
                background: '#111118', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(168,85,247,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#a855f7',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>{m.count} transactions</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>
                  {m.revenue.toFixed(2)} USDC
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Affiliates summary */}
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: 16,
        display: 'flex', gap: 24, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Affiliés actifs (all-time)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#a855f7' }}>{affiliates.uniqueCount}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Total versé aux affiliés</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>{affiliates.totalPaid.toFixed(2)} USDC</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Net plateforme (all-time)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{revenue.allTime.toFixed(2)} USDC</div>
        </div>
      </div>
    </div>
  );
}

// ── Creator Verifications Panel ────────────────────────────────────────────────
function CreatorVerifPanel({ secret }) {
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [acting, setActing]   = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/creator-verifications?secret=${encodeURIComponent(secret)}`);
      const d = await r.json();
      if (r.ok) setItems(d.verifications || []);
    } finally { setLoading(false); }
  }, [secret]);

  useEffect(() => { load(); }, [load]);

  async function review(id, action, note = '') {
    setActing(a => ({ ...a, [id]: action }));
    try {
      await fetch(`${API}/api/admin/creator-verifications/${id}/review?secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note }),
      });
      load();
    } finally { setActing(a => { const n = { ...a }; delete n[id]; return n; }); }
  }

  if (loading) return <div style={{ color: '#64748b', fontSize: 13 }}>Chargement…</div>;
  if (items.length === 0) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748b', fontSize: 14 }}>
      Aucune demande de vérification en attente
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map(v => (
        <div key={v._id} style={{
          background: '#111118',
          border: `1px solid ${v.tier === 'A' ? 'rgba(34,197,94,0.2)' : v.tier === 'B' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
          borderRadius: 12, padding: 16,
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
              background: v.tier === 'A' ? 'rgba(34,197,94,0.1)' : v.tier === 'B' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
              color: v.tier === 'A' ? '#22c55e' : v.tier === 'B' ? '#f59e0b' : '#ef4444',
            }}>
              Tier {v.tier}
            </span>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>@{v.handle}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>{v.platform}</span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{v.followerCount?.toLocaleString('fr-FR')} followers</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#475569' }}>
              {new Date(v.createdAt).toLocaleDateString('fr-FR')}
            </span>
          </div>

          {v.legitimacyScore !== undefined && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>
                Score légitimité : <strong style={{ color: v.legitimacyScore >= 70 ? '#22c55e' : v.legitimacyScore >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {v.legitimacyScore}/100
                </strong>
                {v.aiRecommendation && <span style={{ marginLeft: 8, color: '#475569' }}>→ {v.aiRecommendation}</span>}
              </div>
              {v.redFlags?.length > 0 && (
                <div style={{ fontSize: 11, color: '#ef4444' }}>
                  {v.redFlags.join(' · ')}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => review(v._id, 'approved')}
              disabled={acting[v._id]}
              style={{
                flex: 1, minWidth: 100, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 600, fontSize: 12,
              }}
            >
              Approuver
            </button>
            <button
              onClick={() => review(v._id, 'rejected')}
              disabled={acting[v._id]}
              style={{
                flex: 1, minWidth: 100, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontWeight: 600, fontSize: 12,
              }}
            >
              Rejeter
            </button>
            {v.tier !== 'A' && (
              <button
                onClick={() => review(v._id, 'request_video')}
                disabled={acting[v._id]}
                style={{
                  flex: 1, minWidth: 100, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontWeight: 600, fontSize: 12,
                }}
              >
                Demander vidéo
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Polymarket Linking Panel ──────────────────────────────────────────────────
function PolymarketPanel({ secret }) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null); // market id being edited
  const [tokenInput, setTokenInput] = useState('');
  const [slugInput, setSlugInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/markets?status=active&limit=100`);
      const d = await r.json();
      setMarkets(d.markets || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function linkMarket(id) {
    try {
      const r = await fetch(`${API}/api/admin/link-polymarket/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, polymarketTokenId: tokenInput || null, polymarketSlug: slugInput || null }),
      });
      if (r.ok) { setEditing(null); setTokenInput(''); setSlugInput(''); load(); }
    } catch {}
  }

  async function unlinkMarket(id) {
    try {
      await fetch(`${API}/api/admin/link-polymarket/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, polymarketTokenId: null, polymarketSlug: null }),
      });
      load();
    } catch {}
  }

  if (loading) return <div style={{ color: '#64748b', fontSize: 13 }}>Chargement...</div>;

  const linked = markets.filter(m => m.polymarketTokenId);
  const unlinked = markets.filter(m => !m.polymarketTokenId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Linked markets */}
      {linked.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#22d3ee', marginBottom: 10 }}>
            Marchés liés ({linked.length})
          </h3>
          {linked.map(m => (
            <div key={m._id} style={{
              background: '#111118', border: '1px solid rgba(34,211,238,0.2)',
              borderRadius: 10, padding: 12, marginBottom: 8,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{m.title}</div>
                <div style={{ fontSize: 11, color: '#22d3ee', marginTop: 4, wordBreak: 'break-all' }}>
                  Token: {m.polymarketTokenId?.slice(0, 20)}...
                </div>
              </div>
              <button onClick={() => unlinkMarket(m._id)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 600,
              }}>
                Délier
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Unlinked markets */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#94a3b8', marginBottom: 10 }}>
          Marchés non liés ({unlinked.length})
        </h3>
        {unlinked.map(m => (
          <div key={m._id} style={{
            background: '#111118', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 10, padding: 12, marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', flex: 1 }}>{m.title}</div>
              <button onClick={() => { setEditing(m._id); setTokenInput(''); setSlugInput(''); }} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'rgba(34,211,238,0.12)', color: '#22d3ee', fontSize: 11, fontWeight: 600,
              }}>
                Lier PM
              </button>
            </div>
            {editing === m._id && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  placeholder="Token ID (CLOB YES outcome)"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                    background: '#0a0a12', color: '#f8fafc', fontSize: 12, width: '100%',
                  }}
                />
                <input
                  placeholder="Slug polymarket.com (optionnel)"
                  value={slugInput}
                  onChange={e => setSlugInput(e.target.value)}
                  style={{
                    padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
                    background: '#0a0a12', color: '#f8fafc', fontSize: 12, width: '100%',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => linkMarket(m._id)} disabled={!tokenInput} style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: tokenInput ? 'rgba(34,211,238,0.2)' : 'rgba(255,255,255,0.04)',
                    color: tokenInput ? '#22d3ee' : '#475569', fontSize: 12, fontWeight: 600,
                  }}>
                    Confirmer
                  </button>
                  <button onClick={() => setEditing(null)} style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', color: '#64748b', fontSize: 12,
                  }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = ['Stats', 'Revenus', 'Queue', 'Signalés', 'Résoudre', 'Utilisateurs', 'Créateurs', 'Polymarket'];

export default function AdminPage() {
  const [secret, setSecret]   = useState('');
  const [auth, setAuth]       = useState(false);
  const [tab, setTab]         = useState('Stats');
  const [statsKey, setStatsKey] = useState(0);

  function login(e) {
    e.preventDefault();
    if (!secret.trim()) return;
    setAuth(true);
  }

  // Mobile-only message
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 769;
  if (isMobileView) {
    return (
      <div className="admin-mobile-msg" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', padding: '32px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#64748b', marginBottom: 16 }}>--</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>Admin desktop uniquement</div>
        <div style={{ fontSize: 14, color: '#64748b', maxWidth: 280, lineHeight: 1.5 }}>
          L'interface admin est disponible uniquement sur desktop (min. 769px).
        </div>
        <a href="/" style={{ marginTop: 24, color: '#a855f7', fontSize: 14 }}>← Retour au feed</a>
      </div>
    );
  }

  if (!auth) {
    return (
      <div style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
        <div style={{
          background: '#111118', border: '1px solid rgba(124,58,237,0.3)',
          borderRadius: 16, padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#a855f7', marginBottom: 12 }}>--</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 6 }}>Admin Betly</div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Entrez le mot de passe admin</div>
          <form onSubmit={login} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Mot de passe admin"
              autoFocus
              style={{
                padding: '10px 14px', borderRadius: 9,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#f8fafc', fontSize: 14, outline: 'none', textAlign: 'center',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '11px 0', borderRadius: 9, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                color: '#fff', fontWeight: 700, fontSize: 14,
              }}
            >
              Accéder
            </button>
          </form>
          <div style={{ marginTop: 12, fontSize: 11, color: '#334155' }}>
            Default: {DEFAULT_SECRET}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc' }}>Admin Betly</div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
          secret: {secret.slice(0, 4)}***
        </span>
        <button
          onClick={() => setAuth(false)}
          style={{
            padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: '#64748b', fontSize: 12, cursor: 'pointer',
          }}
        >
          Déconnexion
        </button>
      </div>

      {/* Circuit breaker banner */}
      <CircuitPanel secret={secret} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginTop: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: tab === t ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              color: tab === t ? '#a855f7' : '#64748b',
              fontWeight: tab === t ? 700 : 500, fontSize: 13,
              border: `1px solid ${tab === t ? 'rgba(124,58,237,0.35)' : 'transparent'}`,
            }}
          >
            {t}
          </button>
        ))}
        <button
          onClick={() => setStatsKey(k => k + 1)}
          style={{
            marginLeft: 'auto', padding: '7px 12px', borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: '#475569', fontSize: 12, cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Panels */}
      {tab === 'Stats'        && <StatsPanel key={statsKey} secret={secret} />}
      {tab === 'Revenus'      && <RevenuePanel key={statsKey} secret={secret} />}
      {tab === 'Queue'        && <PendingQueue secret={secret} onAction={() => setStatsKey(k => k + 1)} />}
      {tab === 'Signalés'     && <FlaggedPanel secret={secret} />}
      {tab === 'Résoudre'     && <ResolvePanel secret={secret} />}
      {tab === 'Utilisateurs' && <UsersPanel secret={secret} />}
      {tab === 'Créateurs'    && <CreatorVerifPanel secret={secret} />}
      {tab === 'Polymarket'   && <PolymarketPanel secret={secret} />}
    </div>
  );
}
