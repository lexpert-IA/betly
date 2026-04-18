import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch } from '../lib/api';
import { fireWin } from '../utils/confetti';
import { Zap, CheckCircle, Copy, ArrowRight, AlertCircle, AtSign, Play, Video, Camera } from 'lucide-react';

const PLATFORMS = [
  { key: 'twitter',   label: 'Twitter / X',  Icon: AtSign,  color: '#1d9bf0', placeholder: '@handle' },
  { key: 'youtube',   label: 'YouTube',       Icon: Play,    color: '#ff0000', placeholder: '@handle ou nom de chaîne' },
  { key: 'tiktok',    label: 'TikTok',        Icon: Video,   color: '#ff004f', placeholder: '@handle' },
  { key: 'instagram', label: 'Instagram',     Icon: Camera,  color: '#e1306c', placeholder: '@handle' },
];

export default function VerifyCreator() {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1=form 2=copy-code 3=done 4=pending-review
  const [platform, setPlatform] = useState('twitter');
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyData, setVerifyData] = useState(null); // { code, expiry, handle, tier, redFlags }
  const [copiedCode, setCopiedCode] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);

  const selectedPlat = PLATFORMS.find(p => p.key === platform) || PLATFORMS[0];

  async function handleInitVerify() {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/creator/verify-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.replace(/^@/, ''), platform }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setVerifyData(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(verifyData.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  async function handleCheck() {
    setError('');
    setChecking(true);
    try {
      const res = await apiFetch('/api/creator/verify-check', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      if (!data.verified && data.pendingReview) {
        setResult(data);
        setStep(4); // pending manual review
        return;
      }
      if (!data.verified) {
        setError(data.message || 'Code non trouvé — réessaie dans quelques secondes');
        return;
      }
      setResult(data);
      setStep(3);
      fireWin();
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  if (!user) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#64748b' }}>Connecte-toi pour vérifier ton compte créateur.</div>
      </div>
    );
  }

  if (user?.creatorVerified) {
    return (
      <div style={{ maxWidth: 480, margin: '80px auto', padding: 24, textAlign: 'center' }}>
        <CheckCircle size={40} color="#22c55e" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>
          Compte vérifié ✓
        </div>
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>
          @{user.creatorHandle} est bien lié à ton compte BETLY.
        </div>
        <a href="/creator" style={{
          padding: '10px 24px', borderRadius: 10, textDecoration: 'none',
          background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff',
          fontSize: 13, fontWeight: 700,
        }}>
          Mon Dashboard Créateur →
        </a>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '32px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
          color: '#a855f7', padding: '5px 14px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <Zap size={12} strokeWidth={1.5} />
          Programme Créateur
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
          Vérifie ton compte créateur
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          Prouve que tu contrôles le compte social pour débloquer les commissions et le badge vérifié.
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        {[
          { n: 1, label: 'Ton handle' },
          { n: 2, label: 'Code bio' },
          { n: 3, label: 'Vérifié !' },
        ].map(({ n, label }) => (
          <div key={n} style={{
            flex: 1, padding: '10px 8px', textAlign: 'center',
            background: step >= n ? 'rgba(124,58,237,0.15)' : 'transparent',
            borderRight: n < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: step >= n ? '#a855f7' : '#334155' }}>
              {n}. {label}
            </div>
          </div>
        ))}
      </div>

      {/* STEP 1 — Choose platform + handle */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Plateforme
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {PLATFORMS.map(({ key, label, Icon, color }) => (
                <button
                  key={key}
                  onClick={() => setPlatform(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    background: platform === key ? `${color}18` : 'rgba(255,255,255,0.04)',
                    border: platform === key ? `1.5px solid ${color}60` : '1px solid rgba(255,255,255,0.08)',
                    color: platform === key ? color : '#64748b',
                    fontSize: 13, fontWeight: platform === key ? 700 : 400,
                    transition: 'all .15s',
                  }}
                >
                  <Icon size={16} strokeWidth={1.5} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Ton handle {selectedPlat.label}
            </label>
            <input
              type="text"
              placeholder={selectedPlat.placeholder}
              value={handle}
              onChange={e => setHandle(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)',
                color: '#f8fafc', fontSize: 14, outline: 'none', fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(168,85,247,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12 }}>
              <AlertCircle size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <button
            onClick={handleInitVerify}
            disabled={loading || handle.replace('@','').length < 2}
            style={{
              padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              opacity: handle.replace('@','').length < 2 ? 0.5 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? 'Génération du code...' : <>Continuer <ArrowRight size={15} strokeWidth={2} /></>}
          </button>
        </div>
      )}

      {/* STEP 2 — Copy code to bio */}
      {step === 2 && verifyData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 14, padding: 20,
          }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
              Copie ce code et colle-le dans ta bio <strong style={{ color: '#f8fafc' }}>@{verifyData.handle}</strong> sur {selectedPlat.label} :
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10, padding: '12px 16px',
            }}>
              <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: '#a855f7', letterSpacing: 1 }}>
                {verifyData.code}
              </span>
              <button
                onClick={copyCode}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  background: copiedCode ? 'rgba(34,197,94,0.15)' : 'rgba(168,85,247,0.15)',
                  color: copiedCode ? '#22c55e' : '#a855f7',
                  fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
                  border: `1px solid ${copiedCode ? 'rgba(34,197,94,0.3)' : 'rgba(168,85,247,0.3)'}`,
                }}
              >
                <Copy size={12} strokeWidth={2} />
                {copiedCode ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 10 }}>
              Ce code expire dans 24h.
            </div>
          </div>

          {/* Tier info */}
          {verifyData?.tier && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, color: '#94a3b8' }}>
              {verifyData.tier === 'A' && 'Compte vérifié sur la plateforme → Approbation automatique'}
              {verifyData.tier === 'B' && '>50k followers → Vérification manuelle sous 48h après le code'}
              {verifyData.tier === 'C' && '5k–50k followers → Vérification manuelle sous 72h après le code'}
            </div>
          )}

          {/* Red flags */}
          {verifyData?.redFlags?.length > 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: '#f59e0b' }}>
              Points à vérifier : {verifyData.redFlags.join(' · ')}
            </div>
          )}

          <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
            <div style={{ fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>Comment faire :</div>
            <div>1. Va sur ton profil {selectedPlat.label}</div>
            <div>2. Modifie ta bio et colle le code : <strong style={{ color: '#a78bfa' }}>{verifyData.code}</strong></div>
            <div>3. Sauvegarde et reviens ici</div>
            <div>4. Clique "Vérifier maintenant"</div>
          </div>

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: 12 }}>
              <AlertCircle size={14} strokeWidth={1.5} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setStep(1); setError(''); }}
              style={{
                flex: 0, padding: '12px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: '#64748b', fontSize: 13, cursor: 'pointer',
              }}
            >
              ← Retour
            </button>
            <button
              onClick={handleCheck}
              disabled={checking}
              style={{
                flex: 1, padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#fff', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {checking ? 'Vérification en cours...' : <>Vérifier maintenant <Zap size={15} strokeWidth={2} /></>}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4 — Pending manual review */}
      {step === 4 && result && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28,
          }}>
            --
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
            Code validé — en attente de révision
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6, lineHeight: 1.6 }}>
            {result.message}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>
            Tu peux créer des marchés et utiliser BETLY normalement pendant la vérification.
          </div>
          <a href="/create" style={{
            padding: '11px 24px', borderRadius: 10, textDecoration: 'none',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#f8fafc', fontSize: 13, fontWeight: 600,
          }}>
            Créer un marché en attendant
          </a>
        </div>
      )}

      {/* STEP 3 — Success */}
      {step === 3 && result && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,0.12)', border: '2px solid rgba(34,197,94,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <CheckCircle size={32} color="#22c55e" strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', marginBottom: 6 }}>
            Compte vérifié !
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>
            @{verifyData?.handle} est maintenant lié à ton compte BETLY.
          </div>
          {result.followers > 0 && (
            <div style={{ fontSize: 12, color: '#a78bfa', marginBottom: 20 }}>
              {result.followers.toLocaleString('fr-FR')} abonnés détectés
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/creator" style={{
              padding: '11px 24px', borderRadius: 10, textDecoration: 'none',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 13, fontWeight: 700,
            }}>
              Mon Dashboard Créateur →
            </a>
            <a href="/create" style={{
              padding: '11px 24px', borderRadius: 10, textDecoration: 'none',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#f8fafc', fontSize: 13, fontWeight: 600,
            }}>
              Créer mon premier marché
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
