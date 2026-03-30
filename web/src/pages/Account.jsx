import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useUsdcBalance } from '../hooks/useUsdcBalance';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { computeAvatarColor } from '../hooks/useAuth';
import CopyTradeButton from '../components/CopyTradeButton';
import ShareButton from '../components/ShareButton';
import { apiFetch } from '../lib/api';

// ── Level config ──────────────────────────────────────────────────────────────
const LEVELS = {
  debutant: { emoji: '', label: 'Débutant',  color: '#22c55e', desc: '0–10 paris' },
  actif:    { emoji: '', label: 'Actif',      color: '#60a5fa', desc: '11–50 paris' },
  expert:   { emoji: '', label: 'Expert',     color: '#a855f7', desc: '51–200 paris' },
  oracle:   { emoji: '', label: 'Oracle',     color: '#f59e0b', desc: '201+ paris · WR >65%' },
  legende:  { emoji: '', label: 'Légende',    color: '#fbbf24', desc: 'Top 10 classement' },
};

const BADGE_CONFIG = {
  regulier:   { emoji: '', label: 'Régulier',   desc: '7 jours consécutifs' },
  acharne:    { emoji: '', label: 'Acharné',    desc: '30 jours consécutifs' },
  legendaire: { emoji: '', label: 'Légendaire', desc: '100 jours consécutifs' },
};

function LevelBadge({ level, totalBets, winRate, style = {} }) {
  const cfg = LEVELS[level] || LEVELS.debutant;
  return (
    <span
      title={`${cfg.label} · ${cfg.desc}${winRate ? ` · ${winRate}% win rate` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
        background: `${cfg.color}18`, border: `1px solid ${cfg.color}44`,
        color: cfg.color, cursor: 'help', ...style,
      }}
    >
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function StreakBadge({ streak }) {
  if (!streak || streak < 1) return null;
  const color = streak >= 30 ? '#f59e0b' : streak >= 7 ? '#f97316' : '#ef4444';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
      background: `${color}15`, border: `1px solid ${color}40`,
      color,
    }}>
      {streak} jour{streak > 1 ? 's' : ''}
    </span>
  );
}

function StatBox({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '18px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || '#e2e2e8', marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: '#6060a0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Deposit tab ───────────────────────────────────────────────────────────────
function DepositTab({ address, userId, betlyBalance, onWalletCreated }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [createError, setCreateError] = useState('');
  const { balance, refetch } = useUsdcBalance(address, 10000);

  const API = import.meta.env.VITE_API_URL || '';

  async function handleCreateWallet() {
    setCreatingWallet(true);
    setCreateError('');
    try {
      const res = await apiFetch('/api/wallet/create', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      if (onWalletCreated) await onWalletCreated();
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreatingWallet(false);
    }
  }

  function copyAddr() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function checkDeposit() {
    if (!balance || !userId) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const res = await apiFetch('/api/deposit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onChainBalance: parseFloat(balance), walletAddress: address }),
      });
      const data = await res.json();
      setCheckResult(data);
      if (data.deposited > 0) {
        refreshUser();
      }
    } catch (e) {
      setCheckResult({ error: e.message });
    } finally {
      setChecking(false);
    }
  }

  // ── shared sub-styles ──
  const card = {
    background: '#111118',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    padding: '20px 20px 18px',
    marginBottom: 12,
  };
  const stepRow = { display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 };
  const stepNum = {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
    background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)',
    color: '#a855f7', fontSize: 11, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  };
  const stepText = { fontSize: 13, color: '#94a3b8', lineHeight: 1.5 };
  const badge = (color, bg, text) => (
    <span style={{
      padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
      color, background: bg, border: `1px solid ${color}44`,
    }}>{text}</span>
  );
  const externalBtn = (href, label, color = '#7c3aed') => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: `linear-gradient(135deg, ${color}, ${color}bb)`,
        color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
        transition: 'opacity .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      {label} ↗
    </a>
  );

  // ── Pas de wallet → choix création / connexion ──────────────────────────────
  if (!address) {
    return (
      <div style={{ maxWidth: 460, margin: '0 auto', paddingTop: 16 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👛</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', marginBottom: 6 }}>
            Configure ton wallet
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
            Tu as besoin d'un wallet Polygon pour déposer des USDC et commencer à parier.
          </div>
        </div>

        {/* Option 1 — Créer wallet Betly */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(168,85,247,0.05))',
          border: '1px solid rgba(124,58,237,0.35)',
          borderRadius: 16, padding: '22px 24px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, boxShadow: '0 0 16px rgba(124,58,237,0.4)',
            }}>🔐</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>Wallet Betly</div>
              <div style={{ fontSize: 11, color: '#a78bfa' }}>Créé en 1 clic · Aucune extension requise</div>
            </div>
            <span style={{
              marginLeft: 'auto', padding: '3px 10px', borderRadius: 99,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              fontSize: 10, fontWeight: 700, color: '#22c55e',
            }}>Recommandé</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            On génère un wallet Polygon sécurisé pour toi. Tu déposes des USDC dessus et tu paries immédiatement — comme sur Polymarket.
          </div>
          {createError && (
            <div style={{ fontSize: 12, color: '#ef4444', marginBottom: 10, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8 }}>
              {createError}
            </div>
          )}
          <button
            onClick={handleCreateWallet}
            disabled={creatingWallet}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
              background: creatingWallet
                ? 'rgba(124,58,237,0.4)'
                : 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: '#fff', fontSize: 14, fontWeight: 800,
              cursor: creatingWallet ? 'not-allowed' : 'pointer',
              boxShadow: creatingWallet ? 'none' : '0 0 20px rgba(124,58,237,0.4)',
              transition: 'all .2s',
              letterSpacing: '0.3px',
            }}
          >
            {creatingWallet ? 'Création en cours…' : '🚀 Créer mon wallet Betly'}
          </button>
        </div>

        {/* Option 2 — Wallet existant */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '18px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(255,165,0,0.15)', border: '1px solid rgba(255,165,0,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🦊</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>Wallet existant</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>MetaMask, Coinbase Wallet, WalletConnect…</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
            Tu as déjà un wallet crypto ? Connecte-le via le bouton <strong style={{ color: '#94a3b8' }}>Wallet</strong> en haut à droite.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', paddingTop: 8 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
          Déposer des USDC
        </div>
        <div style={{ fontSize: 12, color: '#475569' }}>
          Choisis ta méthode pour créditer ton compte Betly
        </div>
      </div>

      {/* ══ Option 1 — Coinbase ══ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#0052ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff',
            }}>C</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Option 1 — Coinbase</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Recommandé en France</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {badge('#22c55e', 'rgba(34,197,94,0.1)', 'Recommandé')}
            {badge('#60a5fa', 'rgba(96,165,250,0.1)', '5–10 min')}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          {[
            'Crée un compte Coinbase (5 min, pièce d\'identité requise)',
            'Achète de l\'USDC avec ta carte bancaire ou virement',
            'Va dans "Envoyer" → colle ton adresse BETLY ci-dessous',
            'Choisis le réseau Polygon (MATIC) — obligatoire',
          ].map((step, i) => (
            <div key={i} style={stepRow}>
              <div style={stepNum}>{i + 1}</div>
              <div style={stepText}>{step}</div>
            </div>
          ))}
        </div>

        {externalBtn('https://www.coinbase.com/buy/usdc', 'Ouvrir Coinbase', '#0052ff')}
      </div>

      {/* ══ Option 2 — Binance ══ */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#f0b90b', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: '#1a1a1a',
            }}>B</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Option 2 — Binance</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Plus de volumes disponibles</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {badge('#f59e0b', 'rgba(245,158,11,0.1)', '10–15 min')}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          {[
            'Crée un compte Binance et valide ton identité (KYC)',
            'Achète de l\'USDC via "Acheter des cryptos"',
            'Va dans "Portefeuille" → "Retrait" → cherche USDC',
            'Colle ton adresse BETLY, sélectionne le réseau Polygon',
          ].map((step, i) => (
            <div key={i} style={stepRow}>
              <div style={stepNum}>{i + 1}</div>
              <div style={stepText}>{step}</div>
            </div>
          ))}
        </div>

        {externalBtn('https://www.binance.com/fr/buy-sell-crypto', 'Ouvrir Binance', '#b8860b')}
      </div>

      {/* ══ Option 3 — Déjà des USDC ══ */}
      <div style={{ ...card, border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>D</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>Option 3 — J'ai déjà des USDC</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>Envoi direct depuis ton wallet</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {badge('#22c55e', 'rgba(34,197,94,0.1)', '✓ Gratuit')}
            {badge('#a855f7', 'rgba(168,85,247,0.1)', '< 2 min')}
          </div>
        </div>

        {/* Warning réseau */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 12px', borderRadius: 8, marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
        }}>
          <span style={{ fontSize: 14, color: '#f87171', fontWeight: 700 }}>!</span>
          <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>
            Envoie UNIQUEMENT des USDC sur le réseau <strong>Polygon</strong>.
            Autre réseau = fonds perdus.
          </span>
        </div>

        {/* QR Code */}
        {address ? (
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-block', padding: 14, background: '#fff', borderRadius: 14, marginBottom: 12 }}>
              <QRCodeSVG value={address} size={160} />
            </div>

            {/* Address */}
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 12, color: '#94a3b8', fontFamily: 'monospace',
              wordBreak: 'break-all', textAlign: 'left',
            }}>
              {address}
            </div>
            <button
              onClick={copyAddr}
              style={{
                width: '100%', padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.15)',
                color: copied ? '#22c55e' : '#a855f7',
                fontSize: 12, fontWeight: 700, transition: 'all .2s',
              }}
            >
              {copied ? '✓ Adresse copiée !' : 'Copier l\'adresse'}
            </button>
          </div>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
            Connecte ton wallet pour voir l'adresse de dépôt
          </div>
        )}

        {/* On-chain balance */}
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)',
          marginBottom: 12,
        }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Balance USDC on-chain · Polygon</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>
            {balance !== null ? `${parseFloat(balance).toFixed(2)} USDC` : '—'}
          </div>
          <div style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>
            Polling toutes les 10s ·{' '}
            <button onClick={refetch} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 10, padding: 0, fontWeight: 600 }}>
              Forcer
            </button>
          </div>
        </div>

        {/* Vérifier dépôt */}
        {address && balance !== null && (
          <div>
            <button
              onClick={checkDeposit}
              disabled={checking}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: checking ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: checking ? '#64748b' : '#fff', fontSize: 13, fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {checking ? 'Vérification en cours…' : 'J\'ai envoyé — vérifier mon dépôt'}
            </button>
            {checkResult && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, fontSize: 12,
                background: checkResult.error ? 'rgba(239,68,68,0.1)' : checkResult.deposited > 0 ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${checkResult.error ? 'rgba(239,68,68,0.3)' : checkResult.deposited > 0 ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                color: checkResult.error ? '#ef4444' : checkResult.deposited > 0 ? '#22c55e' : '#64748b',
              }}>
                {checkResult.error
                  ? `Erreur : ${checkResult.error}`
                  : checkResult.deposited > 0
                    ? `${checkResult.deposited.toFixed(2)} USDC crédités ! Nouveau solde : ${checkResult.newBalance?.toFixed(2)} USDC`
                    : checkResult.message}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Withdraw tab ──────────────────────────────────────────────────────────────
function WithdrawTab({ address, betlyBalance, userId }) {
  const [dest, setDest] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null); // null | 'pending' | 'done' | 'error'
  const [msg, setMsg] = useState('');

  const API = import.meta.env.VITE_API_URL || '';

  async function submit() {
    if (!dest || !amount || parseFloat(amount) <= 0) return;
    if (!userId) { setStatus('error'); setMsg('Connecte-toi pour retirer'); return; }
    setStatus('pending');
    setMsg('');
    try {
      const res = await apiFetch('/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toAddress: dest, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setStatus('done');
      setMsg(data.message || 'Retrait initié. Traitement sous 24h.');
    } catch (err) {
      setStatus('error');
      setMsg(err.message);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', paddingTop: 8 }}>
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 28,
      }}>
        <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
          Retire tes USDC vers n'importe quelle adresse Polygon
        </div>

        {/* Balance disponible */}
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 20,
          background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.15)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>Balance disponible</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#a855f7' }}>
            {typeof betlyBalance === 'number' ? `${betlyBalance.toFixed(2)} USDC` : '—'}
          </span>
        </div>

        {/* Dest address */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Adresse de destination</div>
          <input
            type="text"
            placeholder="0x..."
            value={dest}
            onChange={e => setDest(e.target.value)}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.12)',
              color: '#f8fafc', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>Montant</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#a855f7' }}>{amount || '0'} USDC</span>
          </div>
          <input
            type="range" min="1" max={typeof betlyBalance === 'number' ? Math.max(1, Math.floor(betlyBalance)) : 100} step="1"
            value={amount || 1}
            onChange={e => setAmount(e.target.value)}
            style={{ width: '100%', accentColor: '#a855f7', marginBottom: 8 }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {[10, 25, 50, 100].map(a => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer',
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

        {/* Submit */}
        {status === 'pending' ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#a855f7', fontSize: 13 }}>Traitement en cours…</div>
        ) : status === 'done' ? (
          <div style={{ textAlign: 'center', padding: '12px 0', color: '#22c55e', fontSize: 13 }}>✓ {msg}</div>
        ) : (
          <>
            {status === 'error' && (
              <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 12 }}>
                {msg}
              </div>
            )}
            <button
              onClick={submit}
              disabled={!dest || !amount}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: '#fff', fontSize: 13, fontWeight: 700,
                opacity: (!dest || !amount) ? 0.5 : 1,
              }}
            >
              Retirer {amount ? `${amount} USDC` : ''}
            </button>
          </>
        )}

        <div style={{ marginTop: 14, fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
          Vérifie l'adresse de destination. Les transactions blockchain sont irréversibles.
        </div>
      </div>
    </div>
  );
}

// ── Affiliate section ─────────────────────────────────────────────────────────
function AffiliateSection({ user, session }) {
  const [copied, setCopied] = useState(false);
  const code = user?.referralCode || session?.referralCode || null;
  if (!code) return null;

  const link = `${window.location.origin}/?ref=${code}`;

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
      borderRadius: 12, padding: 20, marginBottom: 24,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
        Ton code d'affiliation
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
        Invite des amis — chaque inscription via ton lien te rapporte des USDC.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 0, padding: '9px 14px', borderRadius: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          fontSize: 12, color: '#a78bfa', fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {link}
        </div>
        <button
          onClick={copyLink}
          style={{
            padding: '9px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.2)',
            color: copied ? '#22c55e' : '#a855f7',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
            border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'rgba(124,58,237,0.3)'}`,
            transition: 'all .15s',
          }}
        >
          {copied ? '✓ Copié !' : 'Copier'}
        </button>
        <a
          href="/affiliate"
          style={{
            padding: '9px 14px', borderRadius: 8, textDecoration: 'none',
            background: 'transparent', color: '#64748b',
            fontSize: 12, fontWeight: 600, flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'color .15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#a855f7'}
          onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
        >
          Voir stats →
        </a>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Account() {
  const { user: session, logout, refreshUser } = useAuth();
  const { data, loading, error } = useApi('/api/account');
  const { primaryWallet } = useDynamicContext();
  const walletAddress = primaryWallet?.address || session?.walletAddress;

  // Tab from URL param
  const urlTab = new URLSearchParams(window.location.search).get('tab');
  const [activeTab, setActiveTab] = useState(urlTab || 'stats');

  const user = data?.user;
  const recentBets = data?.recentBets || [];

  const winRate = user && user.totalBets > 0
    ? ((user.wonBets / user.totalBets) * 100).toFixed(1)
    : '0';

  const avatarColor = session ? (session.avatarColor || computeAvatarColor(session.username || '')) : '#7c3aed';
  const displayName = session?.username || user?.username || user?.displayName || 'Anonyme';
  const level = user?.level || 'debutant';
  const streak = user?.currentStreak || 0;
  const badges = user?.badges || [];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

      {/* Profile header */}
      <div style={{
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16, padding: 28, marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      }}>
        {/* Avatar + level ring */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 900, color: '#fff',
            boxShadow: `0 0 28px ${avatarColor}66`,
            border: `3px solid ${(LEVELS[level] || LEVELS.debutant).color}44`,
          }}>
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          {/* Level emoji overlay */}
          <div style={{
            position: 'absolute', bottom: -4, right: -4,
            width: 24, height: 24, borderRadius: '50%',
            background: '#111118', border: `2px solid ${(LEVELS[level] || LEVELS.debutant).color}66`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
          }}>
            {(LEVELS[level] || LEVELS.debutant).emoji}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              {displayName}
            </h1>
            <LevelBadge level={level} totalBets={user?.totalBets} winRate={winRate} />
            {streak > 0 && <StreakBadge streak={streak} />}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {badges.map(b => {
                const cfg = BADGE_CONFIG[b];
                if (!cfg) return null;
                return (
                  <span key={b} title={cfg.desc} style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                    border: '1px solid rgba(245,158,11,0.25)', cursor: 'help',
                  }}>
                    {cfg.emoji} {cfg.label}
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Réputation: <span style={{ color: '#f59e0b', fontWeight: 600 }}>{user?.reputation || 50}/100</span>
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Depuis: <span style={{ color: '#94a3b8' }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : '—'}</span>
            </span>
            {user?.longestStreak > 0 && (
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Record streak: <span style={{ color: '#f97316', fontWeight: 600 }}>{user.longestStreak}j</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`/profile/${session?.userId}`}
              style={{
                padding: '6px 14px', borderRadius: 7, textDecoration: 'none',
                background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)',
                color: '#a855f7', fontSize: 12, fontWeight: 600,
              }}
            >
              Profil public
            </a>
            <button
              onClick={logout}
              style={{
                padding: '6px 14px', borderRadius: 7,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20,
        background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 10, padding: 4,
      }}>
        {[
          { key: 'stats', label: 'Stats' },
          { key: 'deposit', label: 'Déposer' },
          { key: 'withdraw', label: 'Retirer' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            style={{
              flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
              background: activeTab === key ? 'rgba(124,58,237,0.2)' : 'transparent',
              color: activeTab === key ? '#a855f7' : '#64748b',
              fontSize: 12, fontWeight: activeTab === key ? 700 : 400,
              transition: 'all .15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Balance breakdown bar */}
      {user && (
        <div style={{
          display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.07)', marginBottom: 16,
        }}>
          {[
            { label: 'Disponible', value: Math.max(0, (user.balance || 0) - (user.lockedBalance || 0)), color: '#22c55e' },
            { label: 'En jeu', value: user.lockedBalance || 0, color: '#f59e0b' },
            { label: 'Total', value: user.balance || 0, color: '#a855f7' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              flex: 1, padding: '10px 0', textAlign: 'center',
              background: '#111118', borderRight: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color }}>${value.toFixed(2)}</div>
              <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Deposit / Withdraw tabs */}
      {activeTab === 'deposit' && (
        <DepositTab address={walletAddress} userId={session?.userId} betlyBalance={user?.balance} onWalletCreated={refreshUser} />
      )}
      {activeTab === 'withdraw' && (
        <WithdrawTab address={walletAddress} betlyBalance={user?.balance} userId={session?.userId} />
      )}

      {activeTab === 'stats' && <>

      {/* Level progression bar */}
      {user && (
        <div style={{
          background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Progression</span>
            <span style={{ fontSize: 12, color: '#64748b' }}>{user.totalBets || 0} paris au total</span>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {Object.entries(LEVELS).map(([key, cfg]) => {
              const isCurrent = key === level;
              return (
                <div key={key} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 6, borderRadius: 999, marginBottom: 4,
                    background: isCurrent
                      ? `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`
                      : Object.keys(LEVELS).indexOf(key) < Object.keys(LEVELS).indexOf(level)
                        ? `${cfg.color}55`
                        : 'rgba(255,255,255,0.06)',
                    boxShadow: isCurrent ? `0 0 8px ${cfg.color}66` : 'none',
                  }} />
                  <span style={{ fontSize: 9, color: isCurrent ? cfg.color : '#475569' }}>
                    {cfg.emoji}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: (LEVELS[level] || LEVELS.debutant).color }}>
              {(LEVELS[level] || LEVELS.debutant).emoji} {(LEVELS[level] || LEVELS.debutant).label} — {(LEVELS[level] || LEVELS.debutant).desc}
            </span>
          </div>
        </div>
      )}

      {error && activeTab === 'stats' && (
        <div style={{ padding: 12, borderRadius: 8, marginBottom: 16, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 13 }}>
          Erreur: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6060a0', fontSize: 13 }}>Chargement...</div>
      ) : (
        <>
          {/* Stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 28 }}>

            <StatBox label="Balance" value={`${(user?.balance || 0).toFixed(2)}`} color="#a78bfa" sub="USDC" />
            <StatBox label="Total Paris" value={user?.totalBets || 0} color="#60a5fa" />
            <StatBox label="Gagnés" value={user?.wonBets || 0} color="#22c55e" />
            <StatBox label="Win Rate" value={`${winRate}%`} color={parseFloat(winRate) >= 50 ? '#22c55e' : '#ef4444'} />
            <StatBox label="Gains" value={`${(user?.totalEarned || 0).toFixed(2)}`} color="#22c55e" sub="USDC" />
            <StatBox label="Streak" value={streak > 0 ? `${streak}j` : '—'} color="#f97316" />
          </div>

          {/* Affiliation */}
          <AffiliateSection user={user} session={session} />

          {/* Recent bets */}
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e2e8', marginBottom: 12 }}>Paris récents</h2>
            {recentBets.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 32, color: '#6060a0', fontSize: 13,
                background: '#111118', borderRadius: 10, border: '1px solid rgba(255,255,255,0.07)',
              }}>
                Aucun pari encore.{' '}
                <a href="/" style={{ color: '#a78bfa', textDecoration: 'none' }}>Voir les marchés →</a>
              </div>
            ) : (
              <div style={{ background: '#111118', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                {recentBets.map((bet, i) => (
                  <div
                    key={bet._id || i}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 16px', cursor: bet.marketId ? 'pointer' : 'default',
                      borderBottom: i < recentBets.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      fontSize: 13, transition: 'background .15s',
                    }}
                    onClick={() => bet.marketId && (window.location.href = `/market/${bet.marketId}`)}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 4,
                        background: bet.side === 'YES' ? 'rgba(124,58,237,0.15)' : 'rgba(148,163,184,0.15)',
                        color: bet.side === 'YES' ? '#a855f7' : '#94a3b8',
                        fontWeight: 700, fontSize: 11,
                      }}>
                        {bet.side === 'YES' ? 'OUI' : 'NON'}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>
                        {new Date(bet.placedAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#e2e2e8', fontWeight: 600 }}>{bet.amount} USDC</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                        color: bet.status === 'won' ? '#22c55e' : bet.status === 'lost' ? '#ef4444' : '#64748b',
                        background: bet.status === 'won' ? 'rgba(34,197,94,0.1)' : bet.status === 'lost' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                      }}>
                        {bet.status === 'won' ? '✓ Gagné' : bet.status === 'lost' ? '✗ Perdu' : 'En cours'}
                      </span>
                      {bet.marketId && bet.status === 'active' && (
                        <CopyTradeButton marketId={bet.marketId} side={bet.side} />
                      )}
                      <ShareButton
                        variant={bet.status === 'won' ? 'won' : 'placed'}
                        bet={{ _id: bet._id, betId: bet._id, side: bet.side, amount: bet.amount, odds: bet.odds, payout: bet.payout }}
                        market={{ _id: bet.marketId, title: bet.marketTitle || '', category: bet.category }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      </>}
    </div>
  );
}
