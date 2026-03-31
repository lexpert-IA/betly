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
import BetlyLoader from '../components/BetlyLoader';

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

// ── Deposit tab — Single window with Crypto/Euros tabs ───────────────────────
function DepositTab({ address, userId, betlyBalance, onWalletCreated }) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [creatingWallet, setCreatingWallet] = useState(false);
  const [createError, setCreateError] = useState('');
  const [fundTab, setFundTab] = useState('crypto'); // 'crypto' | 'euros'
  const [fiatProvider, setFiatProvider] = useState(null); // null | 'coinbase' | 'binance'
  const { balance, nativeBalance, bridgedBalance, refetch } = useUsdcBalance(address, 10000);

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
      if (data.deposited > 0) refreshUser();
    } catch (e) {
      setCheckResult({ error: e.message });
    } finally {
      setChecking(false);
    }
  }

  // ── Styles communs ──
  const S = {
    card: { background: '#0e0e16', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 },
    label: { fontSize: 11, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600 },
    divider: { height: 1, background: 'rgba(255,255,255,0.05)', margin: '0' },
  };

  // ── No wallet → setup flow ──
  if (!address) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 32 }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', margin: '0 0 8px' }}>
            Créer votre portefeuille
          </h2>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Un portefeuille USDC sur Polygon est requis pour déposer des fonds et parier.
          </p>
        </div>

        {/* Main CTA */}
        <div style={{
          ...S.card,
          padding: 32, marginBottom: 16,
          border: '1px solid rgba(124,58,237,0.25)',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at top left, rgba(124,58,237,0.07) 0%, transparent 60%)',
          }} />
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#f8fafc' }}>Portefeuille Betly</span>
                <span style={{
                  padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)',
                }}>Recommandé</span>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px', lineHeight: 1.6 }}>
                Portefeuille non-custodial créé instantanément. Aucune extension de navigateur requise. Compatible avec tous les échanges et bridges.
              </p>
              <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                {[
                  { icon: '⚡', text: 'Création instantanée' },
                  { icon: '🔐', text: 'Clé privée chiffrée' },
                  { icon: '🌐', text: 'Réseau Polygon' },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                    <span>{icon}</span>{text}
                  </div>
                ))}
              </div>
              {createError && (
                <div style={{
                  fontSize: 12, color: '#ef4444', marginBottom: 16, padding: '10px 14px',
                  background: 'rgba(239,68,68,0.06)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)',
                }}>
                  {createError}
                </div>
              )}
              <button
                onClick={handleCreateWallet}
                disabled={creatingWallet}
                style={{
                  padding: '13px 32px', borderRadius: 12, border: 'none',
                  background: creatingWallet ? 'rgba(124,58,237,0.3)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: creatingWallet ? 'wait' : 'pointer',
                  boxShadow: creatingWallet ? 'none' : '0 4px 20px rgba(124,58,237,0.3)',
                  transition: 'all .2s',
                }}
              >
                {creatingWallet ? 'Création en cours…' : 'Créer mon portefeuille'}
              </button>
            </div>
          </div>
        </div>

        {/* Alternative — wallet externe */}
        <div style={{ ...S.card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#c8c8d8', marginBottom: 2 }}>Connecter un wallet existant</div>
              <div style={{ fontSize: 12, color: '#475569' }}>MetaMask, Coinbase Wallet, WalletConnect — via le bouton Wallet en haut</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // ── Wallet active — single deposit window ──
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 8 }}>

      {/* ═══ SINGLE DEPOSIT WINDOW ═══ */}
      <div style={{
        background: '#111118', borderRadius: 18,
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>

        {/* ── Top: Balance + Address + Warning ── */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Balance row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Solde on-chain</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
                ${balance !== null ? parseFloat(balance).toFixed(2) : '0.00'}
              </div>
              {balance !== null && (nativeBalance > 0 || bridgedBalance > 0) && (
                <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 12 }}>
                  {nativeBalance > 0 && <span style={{ color: '#64748b' }}>USDC: <strong style={{ color: '#22c55e' }}>${nativeBalance.toFixed(2)}</strong></span>}
                  {bridgedBalance > 0 && <span style={{ color: '#64748b' }}>USDC.e: <strong style={{ color: '#60a5fa' }}>${bridgedBalance.toFixed(2)}</strong></span>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              {typeof betlyBalance === 'number' && (
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Solde Betly</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#a855f7' }}>${betlyBalance.toFixed(2)}</div>
                </div>
              )}
              <button
                onClick={refetch}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)',
                  background: 'transparent', color: '#64748b', fontSize: 10, cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#a855f7'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.3)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
              >
                Actualiser
              </button>
            </div>
          </div>

          {/* Address + QR inline */}
          <div style={{
            padding: '14px 16px', borderRadius: 12,
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ padding: 8, background: '#fff', borderRadius: 8, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                <QRCodeSVG value={address} size={64} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                  Ton adresse de d&eacute;p&ocirc;t &middot; Polygon
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {address}
                </div>
              </div>
            </div>
            <button
              onClick={copyAddr}
              style={{
                width: '100%', padding: '10px', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 12, fontWeight: 700,
                background: copied ? 'rgba(34,197,94,0.1)' : 'rgba(124,58,237,0.1)',
                color: copied ? '#22c55e' : '#a855f7',
                transition: 'all .15s',
              }}
            >
              {copied ? '\u2713 Adresse copi\u00e9e' : 'Copier l\u2019adresse'}
            </button>
          </div>

          {/* Warning */}
          <div style={{
            display: 'flex', gap: 8, marginTop: 12, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.1)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/><path d="M12 17h.01"/>
            </svg>
            <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
              Envoie uniquement des <strong style={{ color: '#f8fafc' }}>USDC</strong> ou <strong style={{ color: '#f8fafc' }}>USDC.e</strong> sur le r&eacute;seau <strong style={{ color: '#a855f7' }}>Polygon</strong>. Autre token ou r&eacute;seau = fonds perdus.
            </div>
          </div>
        </div>

        {/* ── Credit CTA (when USDC detected) ── */}
        {balance !== null && parseFloat(balance) > 0 && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(34,197,94,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
                  ${parseFloat(balance).toFixed(2)} USDC d&eacute;tect&eacute;s
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>Cr&eacute;dite ton solde Betly</div>
              </div>
              <button
                onClick={checkDeposit}
                disabled={checking}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: checking ? 'rgba(34,197,94,0.2)' : '#22c55e',
                  color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                  opacity: checking ? 0.7 : 1, transition: 'all .15s',
                }}
              >
                {checking ? 'V\u00e9rification\u2026' : 'Cr\u00e9diter mon compte'}
              </button>
            </div>
            {checkResult && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: 12,
                background: checkResult.error ? 'rgba(239,68,68,0.06)' : checkResult.deposited > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)',
                color: checkResult.error ? '#ef4444' : checkResult.deposited > 0 ? '#22c55e' : '#64748b',
              }}>
                {checkResult.error
                  ? `Erreur : ${checkResult.error}`
                  : checkResult.deposited > 0
                    ? `\u2713 ${checkResult.deposited.toFixed(2)} USDC cr\u00e9dit\u00e9s — Nouveau solde : ${checkResult.newBalance?.toFixed(2)} USDC`
                    : checkResult.message}
              </div>
            )}
          </div>
        )}

        {/* ── Tab switcher: Crypto / Fiat ── */}
        <div style={{ padding: '16px 24px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e2e8', marginBottom: 12 }}>
            {balance !== null && parseFloat(balance) > 0 ? 'Recharger' : 'Pas encore d\u2019USDC ? Choisis comment en obtenir'}
          </div>
          <div style={{
            display: 'flex', gap: 0, borderRadius: 10, overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.06)', marginBottom: 16,
          }}>
            {[
              { key: 'crypto', label: 'D\u00e9poser crypto', icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>
                </svg>
              )},
              { key: 'fiat', label: 'Acheter (Fiat)', icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>
                </svg>
              )},
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => { setFundTab(key); setFiatProvider(null); }}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '11px 0', border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: fundTab === key ? 700 : 500,
                  background: fundTab === key ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.02)',
                  color: fundTab === key ? '#a855f7' : '#64748b',
                  transition: 'all .15s',
                  borderBottom: fundTab === key ? '2px solid #a855f7' : '2px solid transparent',
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Crypto tab ── */}
        {fundTab === 'crypto' && (
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, marginBottom: 12 }}>
              Envoie des <strong style={{ color: '#22c55e' }}>USDC</strong> ou <strong style={{ color: '#60a5fa' }}>USDC.e</strong> depuis ton wallet ou exchange vers l'adresse ci-dessus.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)', color: '#22c55e' }}>USDC</span>
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)', color: '#60a5fa' }}>USDC.e</span>
              <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', color: '#a855f7' }}>Polygon uniquement</span>
            </div>

            {/* Bridge option */}
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                Crypto sur une autre cha&icirc;ne ?
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12, lineHeight: 1.5 }}>
                Bridge tes USDC depuis Ethereum, Arbitrum, Base ou Optimism vers Polygon.
              </div>
              <a
                href={`https://jumper.exchange/?toChain=137&toToken=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359&toAddress=${address}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 8, textDecoration: 'none',
                  background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
                  color: '#fff', fontSize: 12, fontWeight: 700,
                  transition: 'opacity .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Ouvrir Jumper Exchange
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7"/><path d="M7 7h10v10"/>
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* ── Fiat tab ── */}
        {fundTab === 'fiat' && (
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14, lineHeight: 1.5 }}>
              Ach&egrave;te des USDC avec ta carte bancaire ou un virement, puis envoie-les sur ton adresse Betly.
            </div>

            {/* Provider selection */}
            {!fiatProvider ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'coinbase', name: 'Coinbase', sub: 'Carte bancaire \u00b7 Virement SEPA', color: '#0052ff', letter: 'C', tag: 'Recommand\u00e9', tagColor: '#22c55e' },
                  { key: 'binance', name: 'Binance', sub: 'Carte \u00b7 Virement \u00b7 P2P', color: '#f0b90b', letter: 'B', letterColor: '#1a1a1a', tag: 'Volumes \u00e9lev\u00e9s', tagColor: '#f59e0b' },
                ].map(({ key, name, sub, color, letter, letterColor, tag, tagColor }) => (
                  <button
                    key={key}
                    onClick={() => setFiatProvider(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 12,
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all .15s', width: '100%',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}44`; e.currentTarget.style.background = `${color}08`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 900, color: letterColor || '#fff',
                    }}>{letter}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc' }}>{name}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{sub}</div>
                    </div>
                    <span style={{ padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, color: tagColor, background: `${tagColor}12` }}>
                      {tag}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <>
                {/* Back to providers */}
                <button
                  onClick={() => setFiatProvider(null)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#64748b', fontSize: 12, padding: 0, transition: 'color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#a855f7'}
                  onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                  Retour
                </button>

                {/* Coinbase detail */}
                {fiatProvider === 'coinbase' && (
                  <div style={{ padding: '18px', borderRadius: 12, background: 'rgba(0,82,255,0.04)', border: '1px solid rgba(0,82,255,0.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#0052ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff' }}>C</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>Coinbase</div>
                    </div>
                    <ol style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: '#94a3b8', lineHeight: 2.2 }}>
                      <li>Cr&eacute;e un compte <strong style={{ color: '#e2e2e8' }}>Coinbase</strong> (pi&egrave;ce d'identit&eacute;)</li>
                      <li>Ach&egrave;te de l'<strong style={{ color: '#22c55e' }}>USDC</strong> par carte ou virement</li>
                      <li>Clique <strong style={{ color: '#e2e2e8' }}>Envoyer</strong> &rarr; colle ton adresse Betly</li>
                      <li>S&eacute;lectionne le r&eacute;seau <strong style={{ color: '#a855f7' }}>Polygon</strong></li>
                    </ol>
                    <a
                      href="https://www.coinbase.com/buy/usdc"
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '10px 18px', borderRadius: 10, textDecoration: 'none',
                        background: '#0052ff', color: '#fff', fontSize: 13, fontWeight: 700,
                        transition: 'opacity .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Ouvrir Coinbase
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17 17 7"/><path d="M7 7h10v10"/>
                      </svg>
                    </a>
                  </div>
                )}

                {/* Binance detail */}
                {fiatProvider === 'binance' && (
                  <div style={{ padding: '18px', borderRadius: 12, background: 'rgba(240,185,11,0.04)', border: '1px solid rgba(240,185,11,0.12)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0b90b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#1a1a1a' }}>B</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc' }}>Binance</div>
                    </div>
                    <ol style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: '#94a3b8', lineHeight: 2.2 }}>
                      <li>Cr&eacute;e un compte <strong style={{ color: '#e2e2e8' }}>Binance</strong> + KYC</li>
                      <li>Ach&egrave;te de l'<strong style={{ color: '#22c55e' }}>USDC</strong> via "Acheter des cryptos"</li>
                      <li>Portefeuille &rarr; <strong style={{ color: '#e2e2e8' }}>Retrait</strong> &rarr; USDC</li>
                      <li>R&eacute;seau <strong style={{ color: '#a855f7' }}>Polygon</strong> &rarr; colle ton adresse</li>
                    </ol>
                    <a
                      href="https://www.binance.com/fr/buy-sell-crypto"
                      target="_blank" rel="noopener noreferrer"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '10px 18px', borderRadius: 10, textDecoration: 'none',
                        background: '#f0b90b', color: '#1a1a1a', fontSize: 13, fontWeight: 700,
                        transition: 'opacity .15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Ouvrir Binance
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17 17 7"/><path d="M7 7h10v10"/>
                      </svg>
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Withdraw tab — Polymarket-inspired ───────────────────────────────────────
function WithdrawTab({ address, betlyBalance, userId }) {
  const [dest, setDest] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');

  const available = typeof betlyBalance === 'number' ? betlyBalance : 0;
  const maxAmount = Math.max(0, Math.floor(available));

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
      setMsg(data.message || 'Retrait initi\u00e9. Traitement sous 24h.');
    } catch (err) {
      setStatus('error');
      setMsg(err.message);
    }
  }

  function setPercentage(pct) {
    const val = Math.floor(available * pct / 100);
    if (val > 0) setAmount(String(val));
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', paddingTop: 8 }}>
      <div style={{
        background: '#111118', borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '24px 24px 0' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f8fafc', marginBottom: 4 }}>
            Retirer des USDC
          </div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Envoie tes USDC vers n'importe quelle adresse Polygon
          </div>
        </div>

        {/* Available balance */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 18px', borderRadius: 12,
            background: 'rgba(124,58,237,0.04)', border: '1px solid rgba(124,58,237,0.1)',
          }}>
            <div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>Disponible</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>
                ${available.toFixed(2)}
              </div>
            </div>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: 'rgba(124,58,237,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
                <path d="M12 18V6"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '0 24px 24px' }}>
          {/* Destination */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>
              Adresse de destination
            </label>
            <input
              type="text"
              placeholder="0x..."
              value={dest}
              onChange={e => setDest(e.target.value)}
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)',
                color: '#f8fafc', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>Montant</label>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>
                {amount || '0'} <span style={{ color: '#64748b', fontWeight: 400 }}>USDC</span>
              </span>
            </div>
            <input
              type="number"
              min="1"
              max={maxAmount}
              step="1"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12, marginBottom: 10,
                background: '#0a0a0f', border: '1px solid rgba(255,255,255,0.08)',
                color: '#f8fafc', fontSize: 20, fontWeight: 700, outline: 'none',
                boxSizing: 'border-box', transition: 'border-color .15s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.4)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              {[25, 50, 75, 100].map(pct => (
                <button
                  key={pct}
                  onClick={() => setPercentage(pct)}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all .15s',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: amount && Math.floor(available * pct / 100) === parseInt(amount)
                      ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.02)',
                    color: amount && Math.floor(available * pct / 100) === parseInt(amount)
                      ? '#a855f7' : '#64748b',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; }}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          {status === 'pending' ? (
            <div style={{
              textAlign: 'center', padding: '16px 0',
              color: '#a855f7', fontSize: 14, fontWeight: 600,
            }}>
              Traitement en cours...
            </div>
          ) : status === 'done' ? (
            <div style={{
              textAlign: 'center', padding: '16px', borderRadius: 12,
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
              color: '#22c55e', fontSize: 14, fontWeight: 600,
            }}>
              {msg}
            </div>
          ) : (
            <>
              {status === 'error' && (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, marginBottom: 12,
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                  color: '#ef4444', fontSize: 13,
                }}>
                  {msg}
                </div>
              )}
              <button
                onClick={submit}
                disabled={!dest || !amount || parseFloat(amount) <= 0}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  cursor: (!dest || !amount) ? 'not-allowed' : 'pointer',
                  background: (!dest || !amount) ? 'rgba(124,58,237,0.2)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: '#fff', fontSize: 15, fontWeight: 800,
                  opacity: (!dest || !amount) ? 0.5 : 1,
                  transition: 'all .2s', letterSpacing: '0.3px',
                  boxShadow: (!dest || !amount) ? 'none' : '0 4px 20px rgba(124,58,237,0.3)',
                }}
              >
                Retirer {amount ? `$${amount}` : ''}
              </button>
            </>
          )}
        </div>

        {/* Footer warning */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
          </svg>
          <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
            V&eacute;rifie bien l'adresse avant d'envoyer. Les transactions blockchain sont irr&eacute;versibles.
          </div>
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
        <BetlyLoader size={90} text="Chargement du compte..." />
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
