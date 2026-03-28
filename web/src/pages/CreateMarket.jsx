import React, { useState, useEffect, useRef } from 'react';
import AiAnalysis from '../components/AiAnalysis';
import { useUserId } from '../hooks/useApi';

const TAG_SUGGESTIONS = {
  sport:     ['football', 'nba', 'tennis', 'euro2026', 'ligue1'],
  crypto:    ['bitcoin', 'ethereum', 'defi', 'solana', 'altcoin'],
  politique: ['france', 'elections', 'macron', 'ue', '2027'],
  culture:   ['cinema', 'netflix', 'musique', 'jeux', 'series'],
  autre:     ['ia', 'tech', 'science', 'startup', 'economie'],
};

export default function CreateMarket() {
  const userId = useUserId();
  const [form, setForm] = useState({
    title: '',
    description: '',
    resolutionDate: '',
    minBet: 1,
    tags: [],
  });
  const [tagInput, setTagInput] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const debounceRef = useRef(null);

  // Auto-analyze when title changes (debounced 800ms)
  useEffect(() => {
    if (form.title.length < 10) {
      setAnalysis(null);
      setAnalyzing(false);
      return;
    }

    setAnalyzing(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const base = import.meta.env.VITE_API_URL || '';
        const res = await fetch(`${base}/api/markets/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, description: form.description }),
        });
        const data = await res.json();
        setAnalysis(data);
      } catch {
        setAnalysis(null);
      } finally {
        setAnalyzing(false);
      }
    }, 800);

    return () => clearTimeout(debounceRef.current);
  }, [form.title, form.description]);

  const canSubmit =
    userId &&
    form.title.trim().length >= 10 &&
    form.resolutionDate &&
    !submitting &&
    !analyzing &&
    analysis?.decision !== 'rejected';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitResult(null);
    try {
      const base = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${base}/api/markets?userId=${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      setSubmitResult({ success: true, market: data.market });
      setForm({ title: '', description: '', resolutionDate: '', minBet: 1 });
      setAnalysis(null);
    } catch (err) {
      setSubmitResult({ success: false, message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#0a0a0f',
    color: '#e2e2e8',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  const labelStyle = {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#9090a0',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  return (
    <div style={{ maxWidth: '580px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#e2e2e8', marginBottom: '4px' }}>
          Créer un marché
        </h1>
        <p style={{ fontSize: '13px', color: '#6060a0' }}>
          Propose une question vérifiable à la communauté.
        </p>
      </div>

      {!userId && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            color: '#f59e0b',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          Ajoute <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '3px' }}>?userId=TON_ID</code> dans l'URL pour créer un marché.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Title */}
        <div>
          <label style={labelStyle}>Titre *</label>
          <input
            type="text"
            placeholder="Ex: Le Bitcoin dépassera 200 000$ en 2026 ?"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <div style={{ marginTop: '4px', fontSize: '11px', color: form.title.length < 10 ? '#6060a0' : '#22c55e' }}>
            {form.title.length} caractères {form.title.length < 10 ? '(min. 10 pour l\'analyse)' : '— analyse active'}
          </div>
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>Description (optionnel)</label>
          <textarea
            placeholder="Précise les conditions de résolution..."
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
            onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        {/* AI Analysis */}
        {(analyzing || analysis) && (
          <AiAnalysis analysis={analysis} loading={analyzing} />
        )}

        {/* Resolution date */}
        <div>
          <label style={labelStyle}>Date de résolution *</label>
          <input
            type="date"
            value={form.resolutionDate}
            onChange={e => setForm(f => ({ ...f, resolutionDate: e.target.value }))}
            required
            min={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
            style={{ ...inputStyle, colorScheme: 'dark' }}
            onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        {/* Min bet */}
        <div>
          <label style={labelStyle}>Mise minimum (USDC)</label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={form.minBet}
            onChange={e => setForm(f => ({ ...f, minBet: parseFloat(e.target.value) || 1 }))}
            style={{ ...inputStyle, width: '120px' }}
            onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags (max 3, optionnel)</label>
          {/* Current tags */}
          {form.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {form.tags.map(tag => (
                <span key={tag} style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                  color: '#a855f7', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}
                onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}
                title="Cliquer pour supprimer"
                >
                  #{tag} ×
                </span>
              ))}
            </div>
          )}
          {/* Input */}
          {form.tags.length < 3 && (
            <input
              type="text"
              placeholder="Tape un tag et appuie sur Entrée..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ' ') && tagInput.trim().length >= 2) {
                  e.preventDefault();
                  const clean = tagInput.trim();
                  if (!form.tags.includes(clean)) {
                    setForm(f => ({ ...f, tags: [...f.tags, clean] }));
                  }
                  setTagInput('');
                }
              }}
              style={{ ...inputStyle, marginBottom: 6 }}
              onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          )}
          {/* Suggestions based on analysis category */}
          {analysis?.category && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#475569', alignSelf: 'center' }}>Suggestions :</span>
              {(TAG_SUGGESTIONS[analysis.category] || TAG_SUGGESTIONS.autre)
                .filter(t => !form.tags.includes(t))
                .slice(0, 5)
                .map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (form.tags.length < 3 && !form.tags.includes(tag)) {
                        setForm(f => ({ ...f, tags: [...f.tags, tag] }));
                      }
                    }}
                    disabled={form.tags.length >= 3}
                    style={{
                      padding: '2px 9px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                      background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#94a3b8', transition: 'all .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; e.currentTarget.style.color = '#a855f7'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#94a3b8'; }}
                  >
                    #{tag}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Stake notice */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(167,139,250,0.07)',
            border: '1px solid rgba(167,139,250,0.15)',
            fontSize: '12px',
            color: '#9090a0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ color: '#a78bfa', fontSize: '14px' }}>🔒</span>
          <span>
            <strong style={{ color: '#a78bfa' }}>5 USDC</strong> seront bloqués à la création du marché et retournés à la résolution.
          </span>
        </div>

        {/* Submit result */}
        {submitResult && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: submitResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${submitResult.success ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              color: submitResult.success ? '#22c55e' : '#ef4444',
              fontSize: '13px',
            }}
          >
            {submitResult.success
              ? `Marché créé avec succès ! ID: ${submitResult.market._id}`
              : `Erreur: ${submitResult.message}`}
            {submitResult.success && (
              <div style={{ marginTop: '8px' }}>
                <a href="/" style={{ color: '#22c55e', fontSize: '13px' }}>← Voir le feed</a>
              </div>
            )}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: canSubmit
              ? 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)'
              : 'rgba(255,255,255,0.05)',
            color: canSubmit ? '#fff' : '#4040a0',
            fontSize: '14px',
            fontWeight: 700,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'opacity 0.15s',
          }}
        >
          {submitting ? 'Publication...' : 'Publier le marché'}
        </button>
      </form>
    </div>
  );
}
