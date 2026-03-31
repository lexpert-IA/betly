const { default: Anthropic } = require('@anthropic-ai/sdk');
const config  = require('../../config');
const logger  = require('../utils/logger');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// ── Hard blocklist — instant reject, no AI needed ────────────────────────────
const BANNED_PATTERNS = [
  // Violence / harm
  /\b(tuer|assassin|meurtr|murder|kill|suicide|suicid|buter|crever|égorger|décapit|massacr|exterminer|génocid|attentat|terroris)\b/i,
  // Minors / children
  /\b(enfant|mineur|bébé|gosse|gamin|bambin|nourrisson|pédophil|pédoporn|child|kid|baby|minor)\b/i,
  // Cannibalism / extreme
  /\b(manger.*(?:humain|personne|gens|quelqu)|cannibalis|anthropophag|dévorer.*(?:humain|personne))\b/i,
  // Sexual exploitation
  /\b(viol\b|violer|viole\b|pédophil|incest|porno(?:graphi)?|exploitation.sexuel|abus.sexuel|trafficking)\b/i,
  // Hate / discrimination
  /\b(nègre|négro|nigger|faggot|pédé\b|tapette|gouine|nazi|hitler|suprémacist|aryen|race.supérieur)\b/i,
  // Drugs / dangerous substances
  /\b(héroïne|cocaïne|crack|methamphet|fentanyl|overdose|drogue.*enfant)\b/i,
  // Self-harm
  /\b(automutilat|se.couper|se.tailler.les.vein|se.pendre|se.noyer)\b/i,
  // Animal cruelty
  /\b(tortur.*animal|maltraitance.animal|cruauté.animal|zoophil)\b/i,
  // Illegal activities
  /\b(esclavag|traite.des|blanchiment|arme.biologique|arme.chimique)\b/i,
];

// Patterns that are suspicious but need context (send to AI with warning)
const SUSPICIOUS_PATTERNS = [
  /\b(mort|mourir|décès|décéder|crever)/i,
  /\b(drogue|cannabis|weed|marijuana)/i,
  /\b(arme|fusil|pistolet|bombe)/i,
  /\b(haine|racis|sexis|homophob|islamophob|antisémit)/i,
  /\b(nudité|sexe|sexuel|érotique|onlyfans)/i,
  /\b(prison|criminel|délit|infraction)/i,
  /\b(paris.truqué|match.fixé|insider|délit.d.initié)/i,
  /\b(complot|conspiration|illuminati|franc.maçon)/i,
];

// Non-verifiable / absurd patterns
const UNVERIFIABLE_PATTERNS = [
  /\b(dieu|diable|paradis|enfer|âme|esprit|fantôme|extraterrestre|alien|ovni|ufo)/i,
  /\b(je vais|tu vas|il va|elle va)\b.*\b(manger|boire|dormir|faire|aller)/i,
  /\b(rêve|rêver|cauchemar)/i,
  /\b(penser|croire|sentir|ressentir)\b.*\b(que|si)\b/i,
  /\best.ce que (je|tu|il|elle|on) (vais|vas|va)\b/i,
];

// ── Pre-filter: instant reject or flag ───────────────────────────────────────
function preFilter(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const textOriginal = `${title} ${description || ''}`.toLowerCase();

  // Check hard banned patterns
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(textOriginal) || pattern.test(text)) {
      const match = textOriginal.match(pattern) || text.match(pattern);
      return {
        blocked: true,
        reason: 'Contenu interdit détecté. Ce type de marché ne peut pas être créé sur BETLY.',
        matchedPattern: match ? match[0] : 'banned',
      };
    }
  }

  // Check suspicious patterns
  let suspiciousCount = 0;
  const suspiciousMatches = [];
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(textOriginal) || pattern.test(text)) {
      suspiciousCount++;
      const match = textOriginal.match(pattern) || text.match(pattern);
      if (match) suspiciousMatches.push(match[0]);
    }
  }

  // Multiple suspicious patterns = likely bad
  if (suspiciousCount >= 3) {
    return {
      blocked: true,
      reason: 'Contenu potentiellement dangereux détecté (multiples signaux).',
      matchedPattern: suspiciousMatches.join(', '),
    };
  }

  // Check unverifiable patterns
  let unverifiable = false;
  for (const pattern of UNVERIFIABLE_PATTERNS) {
    if (pattern.test(textOriginal) || pattern.test(text)) {
      unverifiable = true;
      break;
    }
  }

  return {
    blocked: false,
    suspicious: suspiciousCount > 0,
    suspiciousMatches,
    unverifiable,
  };
}

// ── System prompt — much stricter ────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'agent de modération de BETLY, une plateforme de paris communautaires.
Tu dois être STRICT. La sécurité des utilisateurs est la PRIORITÉ ABSOLUE.

Analyse ce marché et retourne un JSON avec :
- confidenceScore (0-100) : score global de qualité
- verifiability (0-100) : peut-on vérifier objectivement via source publique externe ?
- toxicity (0-100) : contenu problématique, dangereux, ou inapproprié ?
- oracleLevel (1/2/3) : difficulté de vérification
- category (sport/crypto/politique/culture/autre)
- decision (approved/rejected/review) : ≥70 → approved, 40-69 → review, <40 → rejected
- rejectionReason (string si rejected/review, sinon null)
- confidenceExplanation (1 phrase)
- selfMarketWarning (boolean)
- reformulationSuggestion (string|null)

CRITÈRES DE REJET AUTOMATIQUE (decision=rejected, toxicity≥90) :
- Tout contenu impliquant des MINEURS ou ENFANTS
- Violence, menaces de mort, torture, mutilation
- Contenu sexuel explicite ou exploitation
- Discours haineux, racisme, discrimination
- Activités illégales graves (trafic, terrorisme, etc.)
- Cannibalisme, nécrophilie, ou contenu extrême
- Paris sur la mort ou la souffrance de personnes réelles
- Auto-mutilation ou encouragement au suicide
- Marchés non-vérifiables (actions personnelles privées, rêves, pensées)
- Harcèlement ciblé d'une personne identifiable

CRITÈRES DE REVIEW (decision=review, score 40-69) :
- Contenu ambigu qui pourrait être offensant selon le contexte
- Marchés dont la vérifiabilité est incertaine
- Paris impliquant des sujets sensibles (religion, santé, etc.)
- Contenu promotionnel déguisé

CRITÈRES D'APPROBATION (decision=approved, score ≥70) :
- Marché clairement vérifiable via source publique
- Structure binaire OUI/NON claire
- Pas de contenu offensant ou dangereux
- Sujet d'intérêt public (sport, politique, crypto, culture, tech)

Critères spécifiques marchés créateurs :
1. Résolvabilité obligatoire via source publique
2. Structure binaire OUI/NON claire
3. Si le créateur est le sujet : selfMarketWarning=true mais PAS un motif de rejet

Retourne UNIQUEMENT le JSON, pas de texte autour.`;

// ── Main analysis function ───────────────────────────────────────────────────
async function analyzeMarket(title, description, meta = {}) {
  // Step 1: Pre-filter (instant reject for obvious violations)
  const filter = preFilter(title, description);
  if (filter.blocked) {
    logger.warn(`moderator: PRE-FILTER BLOCKED — "${title}" — pattern: ${filter.matchedPattern}`);
    return {
      confidenceScore: 0,
      verifiability: 0,
      toxicity: 100,
      oracleLevel: 3,
      category: 'autre',
      decision: 'rejected',
      rejectionReason: filter.reason,
      confidenceExplanation: 'Contenu automatiquement bloqué par le filtre de sécurité.',
      selfMarketWarning: false,
      reformulationSuggestion: null,
    };
  }

  // Step 2: AI analysis (Claude) or mock fallback
  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'placeholder') {
    return _mockAnalysis(title, description, filter);
  }

  try {
    const metaStr = meta.creatorMarket
      ? `\nType: Marché Créateur\nSujet: @${meta.subjectHandle || 'inconnu'}`
      : '';
    const flagStr = filter.suspicious
      ? `\n⚠️ ATTENTION: Mots suspects détectés: ${filter.suspiciousMatches.join(', ')}. Sois particulièrement STRICT.`
      : '';
    const unverStr = filter.unverifiable
      ? `\n⚠️ ATTENTION: Ce marché semble contenir des éléments non-vérifiables. Vérifie attentivement.`
      : '';

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Titre: ${title}\nDescription: ${description || ''}${metaStr}${flagStr}${unverStr}` }],
    });
    const raw  = msg.content[0].text.trim();
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);

    // Safety net: if AI says approved but pre-filter flagged suspicious, cap at review
    if (filter.suspicious && result.decision === 'approved' && result.toxicity < 30) {
      result.decision = 'review';
      result.rejectionReason = result.rejectionReason || 'Contenu signalé pour vérification manuelle en raison de mots sensibles.';
      logger.info(`moderator: Overrode AI approval to review — suspicious patterns detected`);
    }

    logger.info(`moderator: Claude analysis — score:${result.confidenceScore} decision:${result.decision} toxicity:${result.toxicity}`);
    return result;
  } catch (err) {
    logger.warn(`moderator: Claude API error — ${err.message} — falling back to mock`);
    return _mockAnalysis(title, description, filter);
  }
}

// ── Mock analysis (fallback when no API key) — now much stricter ─────────────
function _mockAnalysis(title, description, filter = {}) {
  const text = `${title} ${description || ''}`.toLowerCase();

  // If pre-filter flagged suspicious, be strict
  if (filter.suspicious) {
    return {
      confidenceScore: 35,
      verifiability: 30,
      toxicity: 60,
      oracleLevel: 3,
      category: 'autre',
      decision: 'review',
      rejectionReason: 'Contenu signalé pour vérification manuelle.',
      confidenceExplanation: 'Ce marché contient des éléments sensibles et nécessite une révision.',
      selfMarketWarning: false,
      reformulationSuggestion: 'Reformulez sans contenu sensible.',
    };
  }

  // If unverifiable, force review
  if (filter.unverifiable) {
    return {
      confidenceScore: 30,
      verifiability: 15,
      toxicity: 20,
      oracleLevel: 3,
      category: 'autre',
      decision: 'review',
      rejectionReason: 'Ce marché ne semble pas vérifiable objectivement via une source publique.',
      confidenceExplanation: 'Un marché doit pouvoir être vérifié par une source externe et publique.',
      selfMarketWarning: false,
      reformulationSuggestion: 'Créez un marché basé sur un événement public vérifiable.',
    };
  }

  // Standard mock — keyword-based scoring
  const verifiability = text.includes('?') ? 70 + Math.floor(Math.random() * 25) : 50 + Math.floor(Math.random() * 30);
  const toxicity = Math.floor(Math.random() * 10);
  const confidenceScore = Math.round((verifiability * 0.6) + ((100 - toxicity) * 0.4));

  let oracleLevel = 2;
  if (text.match(/bitcoin|ethereum|btc|eth|crypto/)) oracleLevel = 1;
  if (text.match(/sport|foot|basket|tennis|nba|ligue/)) oracleLevel = 1;
  if (text.match(/élection|vote|politique|président/)) oracleLevel = 1;

  let category = 'autre';
  if (text.match(/bitcoin|ethereum|btc|eth|crypto|token/)) category = 'crypto';
  else if (text.match(/foot|basket|tennis|sport|nba|ligue|match/)) category = 'sport';
  else if (text.match(/élection|vote|politique|président|gouvernement/)) category = 'politique';
  else if (text.match(/film|musique|série|oscar|grammy|culture/)) category = 'culture';

  const decision = confidenceScore >= 70 ? 'approved' : confidenceScore >= 40 ? 'review' : 'rejected';

  return {
    confidenceScore,
    verifiability,
    toxicity,
    oracleLevel,
    category,
    decision,
    rejectionReason: decision !== 'approved' ? 'Ce marché nécessite une vérification avant publication.' : null,
    confidenceExplanation: decision === 'approved'
      ? `Marché vérifiable avec un bon niveau de clarté (score ${confidenceScore}/100).`
      : `Ce marché nécessite une révision avant publication.`,
    selfMarketWarning: false,
    reformulationSuggestion: null,
  };
}

module.exports = { analyzeMarket, preFilter };
