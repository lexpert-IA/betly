import { useState, useEffect, useRef, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const LEVEL_LABEL = { debutant: 'debutant', actif: 'actif', expert: 'expert', oracle: 'oracle', legende: 'legende' };

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ markets: [], users: [], tags: [] });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const debouncedQ = useDebounce(query, 220);

  // Focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Block body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Fetch results
  useEffect(() => {
    if (debouncedQ.length < 2) { setResults({ markets: [], users: [], tags: [] }); return; }
    setLoading(true);
    fetch(`${API}/api/search?q=${encodeURIComponent(debouncedQ)}`)
      .then(r => r.json())
      .then(d => { setResults(d); setSelected(0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedQ]);

  // Keyboard nav
  const allItems = [
    ...results.markets.map(m => ({ type: 'market', data: m })),
    ...results.users.map(u => ({ type: 'user', data: u })),
    ...results.tags.map(t => ({ type: 'tag', data: t })),
  ];

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === 'Enter' && allItems[selected]) navigate(allItems[selected]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allItems, selected]);

  function navigate(item) {
    onClose();
    if (item.type === 'market') window.location.href = `/market/${item.data._id}`;
    else if (item.type === 'user') window.location.href = `/profile/${item.data._id || item.data.username}`;
    else if (item.type === 'tag') window.location.href = `/tag/${item.data.tag}`;
  }

  const hasResults = results.markets.length + results.users.length + results.tags.length > 0;
  let idx = 0;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          zIndex: 500, backdropFilter: 'blur(4px)',
          animation: 'fadeInSearch .15s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '12vh',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(600px, calc(100vw - 32px))',
        zIndex: 501,
        background: '#111118',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 24px 80px rgba(0,0,0,.7)',
        animation: 'slideDownSearch .2s cubic-bezier(.34,1.56,.64,1)',
      }}>
        <style>{`
          @keyframes fadeInSearch { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slideDownSearch { from { transform: translateX(-50%) translateY(-20px); opacity: 0 } to { transform: translateX(-50%) translateY(0); opacity: 1 } }
        `}</style>

        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher marchés, utilisateurs, tags…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 16, color: '#f8fafc', fontFamily: 'inherit',
            }}
          />
          {loading && <span style={{ fontSize: 12, color: '#64748b' }}>…</span>}
          <kbd style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 11,
            background: 'rgba(255,255,255,0.07)', color: '#64748b',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {query.length < 2 ? (
            <div style={{ padding: '24px 18px', color: '#475569', fontSize: 13, textAlign: 'center' }}>
              Tape au moins 2 caractères…
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <kbd style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>↑↓ naviguer</kbd>
                <kbd style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>↵ ouvrir</kbd>
                <kbd style={{ padding: '3px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(255,255,255,0.06)', color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>Esc fermer</kbd>
              </div>
            </div>
          ) : !hasResults && !loading ? (
            <div style={{ padding: '32px 18px', color: '#475569', fontSize: 13, textAlign: 'center' }}>
              Aucun résultat pour « {query} »
            </div>
          ) : (
            <>
              {/* Marchés */}
              {results.markets.length > 0 && (
                <div>
                  <div style={{ padding: '10px 18px 4px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Marchés
                  </div>
                  {results.markets.map(m => {
                    const isSelected = idx === selected;
                    const i = idx++;
                    const yes = Math.round(((m.totalYes || 0) / ((m.totalYes||0)+(m.totalNo||0)||1)) * 100);
                    return (
                      <div
                        key={m._id}
                        onClick={() => navigate({ type: 'market', data: m })}
                        style={{
                          padding: '10px 18px', cursor: 'pointer',
                          background: isSelected ? 'rgba(124,58,237,0.12)' : 'transparent',
                          display: 'flex', gap: 12, alignItems: 'center',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={() => setSelected(i)}
                      >
                        <span style={{ fontSize: 13, flexShrink: 0, color: '#a855f7', fontWeight: 700 }}>M</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.title}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            OUI {yes}% · {((m.totalYes||0)+(m.totalNo||0)).toFixed(0)} USDC
                          </div>
                        </div>
                        {isSelected && <span style={{ fontSize: 11, color: '#64748b' }}>↵</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Utilisateurs */}
              {results.users.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ padding: '10px 18px 4px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Utilisateurs
                  </div>
                  {results.users.map(u => {
                    const isSelected = idx === selected;
                    const i = idx++;
                    return (
                      <div
                        key={u._id || u.username}
                        onClick={() => navigate({ type: 'user', data: u })}
                        style={{
                          padding: '10px 18px', cursor: 'pointer',
                          background: isSelected ? 'rgba(124,58,237,0.12)' : 'transparent',
                          display: 'flex', gap: 12, alignItems: 'center',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={() => setSelected(i)}
                      >
                        <span style={{ fontSize: 11, color: '#a855f7', fontWeight: 700 }}>{LEVEL_LABEL[u.level] || 'user'}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>{u.username}</span>
                          {u.displayName !== u.username && (
                            <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6 }}>{u.displayName}</span>
                          )}
                        </div>
                        {u.currentStreak > 0 && (
                          <span style={{ fontSize: 11, color: '#f97316' }}>{u.currentStreak}j</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tags */}
              {results.tags.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ padding: '10px 18px 4px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Tags
                  </div>
                  <div style={{ padding: '4px 18px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {results.tags.map(t => {
                      const isSelected = idx === selected;
                      const i = idx++;
                      return (
                        <button
                          key={t.tag}
                          onClick={() => navigate({ type: 'tag', data: t })}
                          onMouseEnter={() => setSelected(i)}
                          style={{
                            padding: '4px 12px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                            background: isSelected ? 'rgba(124,58,237,0.2)' : 'rgba(124,58,237,0.08)',
                            border: `1px solid ${isSelected ? 'rgba(124,58,237,0.5)' : 'rgba(124,58,237,0.2)'}`,
                            color: '#a855f7',
                          }}
                        >
                          #{t.tag} <span style={{ color: '#64748b', fontSize: 10 }}>({t.count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
