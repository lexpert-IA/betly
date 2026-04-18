import React, { useState, useEffect, useRef, useCallback } from 'react';
import AiAnalysis from '../components/AiAnalysis';
import { useUserId } from '../hooks/useApi';
import { useIsMobile } from '../hooks/useIsMobile';
import { apiFetch } from '../lib/api';
import { Shield, CheckCircle, XCircle, AlertTriangle, Loader2, Eye } from 'lucide-react';

const TAG_SUGGESTIONS = {
  sport:     ['football', 'nba', 'tennis', 'euro2026', 'ligue1'],
  crypto:    ['bitcoin', 'ethereum', 'defi', 'solana', 'altcoin'],
  politique: ['france', 'elections', 'macron', 'ue', '2027'],
  culture:   ['cinema', 'netflix', 'musique', 'jeux', 'series'],
  autre:     ['ia', 'tech', 'science', 'startup', 'economie'],
};

const PLATFORMS = [
  { key: 'twitter',   label: 'Twitter/X'  },
  { key: 'youtube',   label: 'YouTube'    },
  { key: 'tiktok',    label: 'TikTok'     },
  { key: 'instagram', label: 'Instagram'  },
];

// ── Moderation tracker component ─────────────────────────────────────────────
function ModerationTracker({ marketId, marketTitle }) {
  const [phase, setPhase] = useState('validating');
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState(null);
  const [doubleCheckReason, setDoubleCheckReason] = useState(null);
  const pollRef = useRef(null);
  const base = import.meta.env.VITE_API_URL || '';

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`${base}/api/markets/${marketId}/moderation-status`);
      if (!res.ok) return;
      const data = await res.json();
      setPhase(data.moderationPhase);
      setDecision(data.decision);
      setReason(data.reason);
      if (data.postModeration?.reason && data.moderationPhase === 'double_check') {
        setDoubleCheckReason(data.postModeration.reason);
      }
      // Stop polling when complete
      if (data.moderationPhase === 'complete' || data.moderationPhase === 'manual_review') {
        clearInterval(pollRef.current);
      }
    } catch { /* silent */ }
  }, [marketId]);

  useEffect(() => {
    poll(); // immediate first check
    pollRef.current = setInterval(poll, 2000); // poll every 2s
    return () => clearInterval(pollRef.current);
  }, [poll]);

  const PHASES = {
    validating: {
      icon: Shield, color: '#a855f7', bg: 'rgba(168,85,247,0.08)',
      border: 'rgba(168,85,247,0.2)', label: 'Validation IA en cours...',
      sub: 'L\'IA analyse la qualité, la vérifiabilité et la sécurité de votre marché.',
    },
    double_check: {
      icon: Eye, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.2)', label: 'Double vérification en cours...',
      sub: 'Un doute a été détecté. Un second contrôle IA est lancé.',
    },
    complete: decision === 'approved' ? {
      icon: CheckCircle, color: '#22c55e', bg: 'rgba(34,197,94,0.08)',
      border: 'rgba(34,197,94,0.2)', label: 'Marché approuvé !',
      sub: 'Votre marché est maintenant visible dans le feed.',
    } : {
      icon: XCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.2)', label: 'Marché rejeté',
      sub: reason || 'Ce marché ne respecte pas les critères de la plateforme.',
    },
    manual_review: {
      icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.2)', label: 'En attente de review manuelle',
      sub: 'Ce marché sera examiné par l\'équipe.',
    },
    unknown: {
      icon: Loader2, color: '#64748b', bg: 'rgba(255,255,255,0.04)',
      border: 'rgba(255,255,255,0.08)', label: 'Chargement...',
      sub: '',
    },
  };

  const p = PHASES[phase] || PHASES.unknown;
  const Icon = p.icon;
  const isLoading = phase === 'validating' || phase === 'double_check';

  return (
    <div style={{
      background: p.bg, border: `1px solid ${p.border}`, borderRadius: 12,
      padding: '20px', marginTop: 16,
    }}>
      {/* Title */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        "{marketTitle}"
      </div>

      {/* Progress steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16 }}>
        {/* Step 1: Pre-filter */}
        <StepDot done={true} color="#22c55e" label="Filtre" />
        <StepLine done={true} />
        {/* Step 2: AI Analysis */}
        <StepDot done={true} color="#22c55e" label="Analyse" />
        <StepLine done={phase !== 'validating'} />
        {/* Step 3: Post-moderation */}
        <StepDot
          done={phase === 'complete' && decision === 'approved'}
          active={phase === 'validating'}
          failed={phase === 'complete' && decision === 'rejected'}
          color={phase === 'complete' ? (decision === 'approved' ? '#22c55e' : '#ef4444') : '#a855f7'}
          label="Validation"
        />
        {(phase === 'double_check' || (phase === 'complete' && doubleCheckReason)) && (
          <>
            <StepLine done={phase === 'complete'} color="#f59e0b" />
            <StepDot
              done={phase === 'complete'}
              active={phase === 'double_check'}
              failed={phase === 'complete' && decision === 'rejected' && !!doubleCheckReason}
              color={phase === 'complete' ? (decision === 'approved' ? '#22c55e' : '#ef4444') : '#f59e0b'}
              label="Double vérif"
            />
          </>
        )}
      </div>

      {/* Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon
          size={20}
          color={p.color}
          style={isLoading ? { animation: 'spin 1.5s linear infinite' } : {}}
        />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: p.color }}>{p.label}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{p.sub}</div>
        </div>
      </div>

      {/* Reason detail for double_check */}
      {phase === 'double_check' && doubleCheckReason && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)',
          fontSize: 12, color: '#f59e0b',
        }}>
          Raison : {doubleCheckReason}
        </div>
      )}

      {/* Link to market if approved */}
      {phase === 'complete' && decision === 'approved' && (
        <div style={{ marginTop: 12 }}>
          <a href={`/market/${marketId}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', borderRadius: 10, textDecoration: 'none',
            background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
            color: '#22c55e', fontSize: 13, fontWeight: 700,
          }}>
            Voir le marché →
          </a>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function StepDot({ done, active, failed, color, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: done ? color : failed ? '#ef4444' : active ? `${color}30` : 'rgba(255,255,255,0.06)',
        border: active ? `2px solid ${color}` : '2px solid transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .3s',
      }}>
        {done && <CheckCircle size={14} color="#fff" />}
        {failed && <XCircle size={14} color="#fff" />}
        {active && (
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: color,
            animation: 'pulse-dot 1.5s ease-in-out infinite',
          }} />
        )}
      </div>
      <span style={{ fontSize: 9, color: '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
      <style>{`@keyframes pulse-dot { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.7); } }`}</style>
    </div>
  );
}

function StepLine({ done, color = '#22c55e' }) {
  return (
    <div style={{
      flex: 1, height: 2, minWidth: 20, margin: '0 4px',
      background: done ? color : 'rgba(255,255,255,0.08)',
      borderRadius: 99, transition: 'background .3s',
      marginBottom: 18, // align with dot (above label)
    }} />
  );
}

export default function CreateMarket() {
  const userId = useUserId();
  const isMobile = useIsMobile();
  const [form, setForm] = useState({
    title: '',
    description: '',
    resolutionDate: '',
    minBet: 1,
    tags: [],
    creatorMarket: false,
    subjectHandle: '',
    subjectPlatform: 'twitter',
    subjectFollowers: '',
    communityTag: '',
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
      const res = await apiFetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      setSubmitResult({ success: true, market: data.market, title: form.title });
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
    <div style={{ maxWidth: '580px', margin: '0 auto', padding: isMobile ? '16px 16px 100px' : '24px 16px' }}>
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
          Connecte-toi pour soumettre un marché.
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

        {/* Creator market toggle */}
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
          overflow: 'hidden',
        }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px', cursor: 'pointer',
              background: form.creatorMarket ? 'rgba(124,58,237,0.1)' : 'transparent',
            }}
            onClick={() => setForm(f => ({ ...f, creatorMarket: !f.creatorMarket }))}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                Marché Créateur
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Lie ce marché à un compte social (Squeezie, Aya…)
              </div>
            </div>
            <div style={{
              width: 36, height: 20, borderRadius: 10, position: 'relative',
              background: form.creatorMarket ? '#7c3aed' : 'rgba(255,255,255,0.1)',
              transition: 'background .2s',
              flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: 2, left: form.creatorMarket ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left .2s',
              }} />
            </div>
          </div>

          {form.creatorMarket && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Handle du créateur</label>
                  <input
                    type="text"
                    placeholder="@Squeezie"
                    value={form.subjectHandle}
                    onChange={e => setForm(f => ({ ...f, subjectHandle: e.target.value }))}
                    style={{ ...inputStyle }}
                    onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Plateforme</label>
                  <select
                    value={form.subjectPlatform}
                    onChange={e => setForm(f => ({ ...f, subjectPlatform: e.target.value }))}
                    style={{ ...inputStyle, width: 'auto', colorScheme: 'dark' }}
                  >
                    {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Tag communauté (optionnel)</label>
                <input
                  type="text"
                  placeholder="Ex: SqueezieFans"
                  value={form.communityTag}
                  onChange={e => setForm(f => ({ ...f, communityTag: e.target.value }))}
                  style={{ ...inputStyle }}
                  onFocus={e => e.target.style.borderColor = 'rgba(167,139,250,0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {analysis?.selfMarketWarning && (
                <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: 12 }}>
                  Tu es le sujet de ce marché. Les parieurs verront que tu peux influencer le résultat.
                </div>
              )}
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
          <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 700 }}>*</span>
          <span>
            <strong style={{ color: '#a78bfa' }}>5 USDC</strong> seront bloqués à la création du marché et retournés à la résolution.
          </span>
        </div>

        {/* Submit result + moderation tracker */}
        {submitResult && !submitResult.success && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', fontSize: '13px',
          }}>
            Erreur: {submitResult.message}
          </div>
        )}

        {submitResult?.success && submitResult.market && (
          <ModerationTracker
            marketId={submitResult.market._id}
            marketTitle={submitResult.title || submitResult.market.title}
          />
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
