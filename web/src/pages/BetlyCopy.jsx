/**
 * BetlyCopy.jsx — Copy-trading Polymarket intégré dans BETLY.
 * Consomme l'API POLYFRENCH (VITE_POLYFRENCH_API_URL).
 * Nécessite ?telegramId=xxx dans l'URL.
 */

import React from 'react';
import { usePolyfrenchApi, usePolyfrenchTelegramId } from '../hooks/usePolyfrenchApi';

// ── Helpers ─────────────────────────────────────────────────────────────────

function short(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function relTime(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (secs  < 10)  return 'à l\'instant';
  if (mins  < 1)   return `${secs}s`;
  if (mins  < 60)  return `${mins}min`;
  if (hours < 24)  return `${hours}h`;
  return `il y a ${days}j`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = '#a78bfa', progress, maxProgress }) {
  const pct = maxProgress > 0 ? Math.min((progress / maxProgress) * 100, 100) : 0;
  return (
    <div style={{
      background: '#111118',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{
        color: '#666', fontSize: 11, fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ color, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: '#555', fontSize: 11, marginTop: 5 }}>{sub}</div>}
      {progress != null && (
        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 8 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
        </div>
      )}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '16px 18px',
    }}>
      <div style={{ height: 11, width: 80, marginBottom: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
      <div style={{ height: 26, width: 100, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
      <div style={{ height: 4, marginTop: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    executed: { color: '#22c55e', label: 'Exécuté' },
    failed:   { color: '#ef4444', label: 'Échoué'  },
    skipped:  { color: '#f59e0b', label: 'Ignoré'  },
    pending:  { color: '#666',    label: 'En cours' },
  };
  const { color, label } = map[status] || { color: '#666', label: status };
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 500,
      background: `${color}18`, color,
    }}>
      {label}
    </span>
  );
}

function OutcomeBadge({ outcome }) {
  const isYes = outcome?.toUpperCase() === 'YES';
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: isYes ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
      color: isYes ? '#22c55e' : '#ef4444',
    }}>
      {outcome || '—'}
    </span>
  );
}

function TradesTable({ data, loading }) {
  const COLS = ['Outcome', 'Marché', 'Wallet copié', 'Montant', 'PnL', 'Statut', 'Date'];
  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Trades copiés récents</span>
        <span style={{ color: '#666', fontSize: 11 }}>{!loading && data ? `${data.length} affichés` : ''}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {COLS.map(h => (
                <th key={h} style={{
                  padding: '8px 14px', textAlign: 'left', color: '#555',
                  fontSize: 11, fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: '0.06em', whiteSpace: 'nowrap',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} style={{ padding: '10px 14px' }}>
                      <div style={{ height: 12, width: j === 1 ? 160 : 70, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '32px 18px', textAlign: 'center', color: '#555' }}>
                  Aucun trade copié pour l'instant
                </td>
              </tr>
            ) : data.map((t, i) => (
              <tr key={t.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '10px 14px' }}><OutcomeBadge outcome={t.outcome} /></td>
                <td style={{ padding: '10px 14px', maxWidth: 220 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ccc' }} title={t.question}>
                    {t.question || '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#a78bfa' }}>{short(t.walletAddress)}</span>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>${(t.amount || 0).toFixed(2)}</td>
                <td style={{ padding: '10px 14px' }}>
                  {t.pnl != null ? (
                    <span style={{ color: t.pnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 500 }}>
                      {t.pnl >= 0 ? '+' : ''}{t.pnl.toFixed(2)}
                    </span>
                  ) : <span style={{ color: '#555' }}>—</span>}
                </td>
                <td style={{ padding: '10px 14px' }}><StatusBadge status={t.status} /></td>
                <td style={{ padding: '10px 14px', color: '#555', fontSize: 11, whiteSpace: 'nowrap' }}>{relTime(t.executedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TopWallets({ data, loading }) {
  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        fontWeight: 600, fontSize: 13,
      }}>
        🏆 Top wallets Polymarket
      </div>
      {loading ? (
        <div style={{ padding: '10px 14px' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 18, height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 11, width: 90, background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 4 }} />
                <div style={{ height: 10, width: 60, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: '#555', fontSize: 12 }}>
          Aucun wallet scoré
        </div>
      ) : data.map((w, i) => (
        <div key={w.address || i} style={{
          padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s',
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ color: '#555', fontSize: 11, fontWeight: 600, minWidth: 18 }}>#{w.rank}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#a78bfa', marginBottom: 2 }}>
              {w.label || short(w.address)}
            </div>
            <div style={{ color: '#555', fontSize: 10 }}>
              WR {w.winRate ?? '—'}% · ROI {w.roi != null ? (w.roi >= 0 ? '+' : '') + w.roi + '%' : '—'}
            </div>
          </div>
          <span style={{ fontSize: 11, color: '#a78bfa', fontWeight: 600 }}>
            {(w.score || 0).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

function AlertsFeed({ data, loading }) {
  return (
    <div style={{
      background: '#111118', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, overflow: 'hidden', marginTop: 12,
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Alertes live</span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: '#a78bfa',
          display: 'inline-block', animation: 'pulse 2s infinite',
        }} />
      </div>
      {loading ? (
        <div style={{ padding: '10px 14px' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ height: 11, width: '80%', background: 'rgba(255,255,255,0.06)', borderRadius: 4, marginBottom: 4 }} />
              <div style={{ height: 10, width: '50%', background: 'rgba(255,255,255,0.06)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{ padding: '20px 14px', textAlign: 'center', color: '#555', fontSize: 12 }}>
          Aucune activité récente
        </div>
      ) : data.map((ev, i) => (
        <div key={ev.id || i} style={{
          padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', gap: 8, alignItems: 'flex-start', transition: 'background 0.15s',
        }}
        onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        onMouseOut={e => e.currentTarget.style.background = 'transparent'}
        >
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 3,
            background: ev.side?.toUpperCase() === 'BUY' ? '#22c55e' : '#ef4444',
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
              <span style={{ color: '#a78bfa', fontFamily: 'monospace' }}>{short(ev.walletAddress)}</span>
              {' '}
              <span style={{ color: ev.side?.toUpperCase() === 'BUY' ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {ev.side || '?'}
              </span>
              {' '}
              <span style={{ color: '#888' }}>{ev.outcome}</span>
            </div>
            <div style={{ fontSize: 10, color: '#555' }}>
              ${(ev.amount || 0).toFixed(2)} · {(ev.question || '').slice(0, 40)}…
            </div>
          </div>
          <span style={{ color: '#555', fontSize: 10, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {relTime(ev.detectedAt)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── No-ID screen ─────────────────────────────────────────────────────────────

function NoTelegramId() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', gap: 14, padding: '40px 16px',
    }}>
      <div style={{ fontSize: 36 }}>📈</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e2e2e8', margin: 0 }}>BETLY Copy</h2>
      <p style={{ color: '#555', fontSize: 13, textAlign: 'center', maxWidth: 380 }}>
        Accès via le bot Telegram POLYFRENCH. Ajoute{' '}
        <code style={{ background: '#111118', padding: '2px 7px', borderRadius: 4, color: '#a78bfa' }}>
          ?telegramId=TON_ID
        </code>
        {' '}à l'URL pour voir ton cockpit.
      </p>
      <a
        href="https://t.me/polyfrenchbot"
        target="_blank"
        rel="noreferrer"
        style={{
          padding: '10px 20px', borderRadius: 8, background: 'rgba(167,139,250,0.15)',
          border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa',
          fontSize: 13, fontWeight: 600, textDecoration: 'none',
        }}
      >
        Ouvrir POLYFRENCH Bot →
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BetlyCopy() {
  const telegramId = usePolyfrenchTelegramId();

  const { data: stats,      loading: statsLoading  } = usePolyfrenchApi('/api/stats');
  const { data: trades,     loading: tradesLoading } = usePolyfrenchApi('/api/trades/recent', { params: { limit: 10 } });
  const { data: wallets,    loading: walletsLoading } = usePolyfrenchApi('/api/leaderboard',   { params: { limit: 8  } });
  const { data: alerts,     loading: alertsLoading  } = usePolyfrenchApi('/api/alerts',        { params: { limit: 8  }, interval: 5000 });

  if (!telegramId) return <NoTelegramId />;

  const pnl        = stats?.pnl           ?? 0;
  const totalTrades = stats?.totalTrades  ?? 0;
  const winRate    = stats?.winRate        ?? 0;
  const dailyLoss  = stats?.dailyLoss      ?? 0;
  const dailyLimit = stats?.dailyLossLimit ?? 50;

  return (
    <div style={{ padding: '22px 20px 40px', display: 'flex', gap: 16, minWidth: 0 }}>
      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#e2e2e8', margin: 0 }}>
            {stats?.firstName ? `Bonjour, ${stats.firstName} 👋` : 'BETLY Copy'}
          </h1>
          <p style={{ color: '#555', fontSize: 12, marginTop: 3 }}>
            Copy-trading Polymarket en temps réel · Powered by POLYFRENCH
          </p>
        </div>

        {/* 4 stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                label="PnL total"
                value={`${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDC`}
                color={pnl >= 0 ? '#22c55e' : '#ef4444'}
                sub="depuis le début"
              />
              <StatCard
                label="Trades copiés"
                value={totalTrades}
                color="#a78bfa"
                sub="tous statuts"
                progress={totalTrades}
                maxProgress={Math.max(totalTrades, 50)}
              />
              <StatCard
                label="Win rate"
                value={`${winRate}%`}
                color={winRate >= 50 ? '#22c55e' : '#f59e0b'}
                sub="trades exécutés"
                progress={winRate}
                maxProgress={100}
              />
              <StatCard
                label="Perte du jour"
                value={`${dailyLoss.toFixed(2)} USDC`}
                color={dailyLoss >= dailyLimit * 0.8 ? '#ef4444' : '#f59e0b'}
                sub={`limite : ${dailyLimit} USDC`}
                progress={dailyLoss}
                maxProgress={dailyLimit}
              />
            </>
          )}
        </div>

        {/* Trades table */}
        <TradesTable data={trades} loading={tradesLoading} />

        {/* Footer */}
        <div style={{ marginTop: 24, textAlign: 'center', color: '#444', fontSize: 11 }}>
          BETLY Copy — Powered by{' '}
          <a
            href="https://polymarket.com"
            target="_blank" rel="noreferrer"
            style={{ color: '#a78bfa', textDecoration: 'none' }}
          >
            Polymarket
          </a>
          {stats?.walletAddress && (
            <span style={{ marginLeft: 8, fontFamily: 'monospace', color: '#555' }}>
              · {short(stats.walletAddress)}
            </span>
          )}
        </div>
      </div>

      {/* Right panel */}
      <aside style={{
        width: 230, minWidth: 230, flexShrink: 0,
        height: 'calc(100vh - 104px)', overflowY: 'auto',
        position: 'sticky', top: 72,
      }}>
        <TopWallets  data={wallets} loading={walletsLoading} />
        <AlertsFeed  data={alerts}  loading={alertsLoading}  />
      </aside>
    </div>
  );
}
