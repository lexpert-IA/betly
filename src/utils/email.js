const { Resend } = require('resend');
const logger = require('./logger');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM   = 'BETLY <noreply@betly.gg>';

async function send({ to, subject, html }) {
  if (!resend) {
    logger.debug(`[email] RESEND_API_KEY absent — skipping: ${subject} → ${to}`);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
    logger.info(`[email] Sent: ${subject} → ${to}`);
  } catch (err) {
    logger.error(`[email] Failed: ${err.message}`);
  }
}

// ── Templates ────────────────────────────────────────────────────────────────
function base(content) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,sans-serif;color:#e2e8f0;">
  <div style="max-width:560px;margin:40px auto;background:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
    <div style="padding:20px 28px;background:linear-gradient(135deg,#7c3aed22,#1118);">
      <span style="font-size:18px;font-weight:900;background:linear-gradient(135deg,#a78bfa,#60a5fa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">BETLY</span>
    </div>
    <div style="padding:28px;">${content}</div>
    <div style="padding:16px 28px;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#334155;text-align:center;">
      © 2026 BETLY Labs Inc. · <a href="https://betly.gg/responsible-gaming" style="color:#a855f7;">Jeu responsable</a>
    </div>
  </div></body></html>`;
}

function h1(text) { return `<h1 style="font-size:20px;font-weight:800;color:#f8fafc;margin:0 0 12px;">${text}</h1>`; }
function p(text)  { return `<p style="font-size:14px;color:#94a3b8;margin:0 0 12px;line-height:1.6;">${text}</p>`; }
function cta(url, label) { return `<a href="${url}" style="display:inline-block;margin-top:16px;padding:12px 24px;border-radius:9px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:#fff;font-weight:700;font-size:14px;text-decoration:none;">${label}</a>`; }

// ── Exported senders ─────────────────────────────────────────────────────────

async function sendMarketResolved({ to, username, marketTitle, won, payout }) {
  const emoji = won ? '🎉' : '😔';
  const result = won
    ? `Tu as <strong style="color:#22c55e;">gagné ${payout.toFixed(2)} USDC</strong> !`
    : `Tu as perdu ta mise sur ce marché.`;
  await send({
    to,
    subject: `${emoji} Marché résolu : "${marketTitle.slice(0, 50)}"`,
    html: base(`
      ${h1(`${emoji} Marché résolu`)}
      ${p(`Bonjour ${username},`)}
      ${p(`Le marché <strong style="color:#f8fafc;">"${marketTitle}"</strong> vient d'être résolu.`)}
      ${p(result)}
      ${cta('https://betly.gg/account', 'Voir mon compte →')}
    `),
  });
}

async function sendWithdrawalCompleted({ to, username, amount }) {
  await send({
    to,
    subject: `✅ Retrait de ${amount.toFixed(2)} USDC effectué`,
    html: base(`
      ${h1('✅ Retrait confirmé')}
      ${p(`Bonjour ${username},`)}
      ${p(`Ton retrait de <strong style="color:#f8fafc;">${amount.toFixed(2)} USDC</strong> a été traité avec succès.`)}
      ${p('Les fonds apparaissent généralement sur ton wallet Polygon sous 5 à 30 minutes.')}
      ${cta('https://betly.gg/account', 'Voir mon historique →')}
    `),
  });
}

async function sendNewFollower({ to, username, followerName }) {
  await send({
    to,
    subject: `👤 ${followerName} te suit maintenant sur BETLY`,
    html: base(`
      ${h1('Nouveau follower !')}
      ${p(`Bonjour ${username},`)}
      ${p(`<strong style="color:#a855f7;">${followerName}</strong> a commencé à te suivre sur BETLY.`)}
      ${p('Continue à performer pour gagner encore plus de followers !')}
      ${cta(`https://betly.gg/profile/${username}`, 'Voir mon profil →')}
    `),
  });
}

async function sendVoteOpen({ to, username, marketTitle, marketId }) {
  await send({
    to,
    subject: `🗳️ Vote communautaire ouvert — "${marketTitle.slice(0, 40)}"`,
    html: base(`
      ${h1('🗳️ Vote de résolution ouvert')}
      ${p(`Bonjour ${username},`)}
      ${p(`Le marché <strong style="color:#f8fafc;">"${marketTitle}"</strong> est entré en phase de résolution communautaire.`)}
      ${p('Tu as parié sur ce marché — ton vote compte double !')}
      ${cta(`https://betly.gg/market/${marketId}`, 'Voter maintenant →')}
    `),
  });
}

module.exports = { sendMarketResolved, sendWithdrawalCompleted, sendNewFollower, sendVoteOpen };
