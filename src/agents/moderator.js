const { default: Anthropic } = require('@anthropic-ai/sdk');
const config  = require('../../config');
const logger  = require('../utils/logger');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT = `Tu es l'agent de modération de BETLY, une plateforme de paris communautaires.
Analyse ce marché et retourne un JSON avec :
- confidenceScore (0-100) : score global
- verifiability (0-100) : peut-on vérifier objectivement via source externe ?
- toxicity (0-100) : contenu problématique ?
- oracleLevel (1/2/3)
- category (sport/crypto/politique/culture/autre)
- decision (approved/rejected/review) : ≥70 → approved, 40-69 → review, <40 → rejected
- rejectionReason (si rejected, sinon null)
- confidenceExplanation (1 phrase)
- selfMarketWarning (boolean) : true si le créateur est le sujet du marché ET peut influencer le résultat
- reformulationSuggestion (string|null) : si review, suggère une reformulation plus claire
Critères spécifiques marchés créateurs :
1. Résolvabilité obligatoire via source publique (tweet officiel, stats YouTube, etc.)
2. Structure binaire OUI/NON claire
3. Si le créateur est le sujet : selfMarketWarning=true mais PAS un motif de rejet
Retourne UNIQUEMENT le JSON, pas de texte autour.`;

async function analyzeMarket(title, description, meta = {}) {
  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'placeholder') {
    return _mockAnalysis(title, description);
  }

  try {
    const metaStr = meta.creatorMarket
      ? `\nType: Marché Créateur\nSujet: @${meta.subjectHandle || 'inconnu'}`
      : '';
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Titre: ${title}\nDescription: ${description || ''}${metaStr}` }],
    });
    const raw  = msg.content[0].text.trim();
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);
    logger.info(`moderator: Claude analysis — score:${result.confidenceScore} decision:${result.decision}`);
    return result;
  } catch (err) {
    logger.warn(`moderator: Claude API error — ${err.message} — falling back to mock`);
    return _mockAnalysis(title, description);
  }
}

function _mockAnalysis(title, description) {
  const text = (title + ' ' + (description || '')).toLowerCase();
  const toxicWords = ['mort', 'tuer', 'haine', 'racis', 'sexe'];
  const toxicity = toxicWords.some(w => text.includes(w)) ? 80 : Math.floor(Math.random() * 15);
  const verifiability = text.includes('?') ? 70 + Math.floor(Math.random() * 25) : 50 + Math.floor(Math.random() * 30);
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

  const decision = toxicity > 70 ? 'rejected' : confidenceScore < 30 ? 'review' : 'approved';

  return {
    confidenceScore,
    verifiability,
    toxicity,
    oracleLevel,
    category,
    decision,
    rejectionReason: decision === 'rejected' ? 'Contenu potentiellement toxique ou inapproprié' : null,
    confidenceExplanation: decision === 'approved'
      ? `Marché vérifiable avec un bon niveau de clarté (score ${confidenceScore}/100).`
      : `Ce marché nécessite une révision avant publication.`,
  };
}

module.exports = { analyzeMarket };
