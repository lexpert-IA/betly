/**
 * Module 2 — NATHAN (Market Generator)
 * Takes scored trends from trendDetector and generates 1-3 prediction markets
 * using Claude API. Filters by confidence ≥ 70.
 */

const { default: Anthropic } = require('@anthropic-ai/sdk');
const config  = require('../../config');
const logger  = require('../utils/logger');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

const SYSTEM_PROMPT = `Tu es NATHAN, l'agent de génération de marchés de BETLY — une plateforme de paris communautaires.

À partir d'une tendance détectée, génère 1 à 3 marchés de prédiction pertinents.

Pour chaque marché, retourne un objet JSON avec :
- title (string) : question binaire OUI/NON, claire, sans ambiguïté, en français
- description (string) : contexte en 1-2 phrases, inclus source de résolution
- category (sport|crypto|politique|culture|tech|gaming|autre)
- oracleLevel (1|2|3) : 1=API auto, 2=IA+sources, 3=vote communautaire
- resolutionDays (number) : nombre de jours avant résolution (7-90)
- confidence (0-100) : ta confiance que ce marché est résolvable, engageant et non-toxique
- tags (string[]) : 2-5 tags pertinents
- resolutionSource (string) : quelle source vérifiera le résultat (ex: "CoinGecko API", "résultat officiel UEFA", "tweet officiel")

Règles strictes :
1. La question DOIT être binaire OUI/NON et vérifiable objectivement
2. Pas de contenu toxique, discriminatoire ou illégal
3. Le marché doit être intéressant et engageant pour une communauté francophone
4. Inclure une source de résolution concrète
5. Les délais doivent être réalistes (pas trop court, pas trop long)
6. Évite les doublons évidents avec des marchés qui pourraient déjà exister

Retourne UNIQUEMENT un JSON array, pas de texte autour. Exemple :
[{"title":"...","description":"...","category":"sport","oracleLevel":1,"resolutionDays":30,"confidence":85,"tags":["foot","ligue1"],"resolutionSource":"résultat officiel Ligue 1"}]`;

// ── Market dedup cache (in-memory, reset on restart) ────────────────────────
const recentTitles = new Set();
const MAX_CACHE = 500;

function isDuplicate(title) {
  const normalized = title.toLowerCase().replace(/[^a-zàâéèêëïîôùûüç0-9\s]/g, '').trim();
  if (recentTitles.has(normalized)) return true;
  recentTitles.add(normalized);
  if (recentTitles.size > MAX_CACHE) {
    const first = recentTitles.values().next().value;
    recentTitles.delete(first);
  }
  return false;
}

async function generateMarketsFromTrend(trend) {
  if (!config.anthropic.apiKey || config.anthropic.apiKey === 'placeholder') {
    logger.debug('marketGenerator: no API key — returning mock market');
    return _mockGenerate(trend);
  }

  try {
    const userMsg = `Tendance détectée :
- Sujet : ${trend.topic}
- Catégorie : ${trend.category}
- Score de tendance : ${trend.score}/100
- Sources : ${(trend.sources || [trend.source]).join(', ')}
- Engagement estimé : ${trend.engagement}

Génère 1 à 3 marchés de prédiction pertinents.`;

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = msg.content[0].text.trim();
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const markets = JSON.parse(text);

    if (!Array.isArray(markets)) {
      logger.warn('marketGenerator: Claude returned non-array — wrapping');
      return filterMarkets([markets], trend);
    }

    return filterMarkets(markets, trend);
  } catch (err) {
    logger.warn(`marketGenerator: Claude error — ${err.message} — falling back to mock`);
    return _mockGenerate(trend);
  }
}

function filterMarkets(markets, trend) {
  const MIN_CONFIDENCE = 70;

  return markets
    .filter(m => {
      if (!m.title || !m.description) {
        logger.debug(`marketGenerator: skipping market with missing title/description`);
        return false;
      }
      if ((m.confidence || 0) < MIN_CONFIDENCE) {
        logger.debug(`marketGenerator: skipping "${m.title}" — confidence ${m.confidence} < ${MIN_CONFIDENCE}`);
        return false;
      }
      if (isDuplicate(m.title)) {
        logger.debug(`marketGenerator: skipping duplicate "${m.title}"`);
        return false;
      }
      return true;
    })
    .map(m => ({
      title: m.title,
      description: m.description,
      category: m.category || trend.category || 'autre',
      oracleLevel: m.oracleLevel || 2,
      resolutionDays: Math.min(Math.max(m.resolutionDays || 30, 7), 90),
      confidence: m.confidence,
      tags: m.tags || [],
      resolutionSource: m.resolutionSource || null,
      trendSource: trend,
    }));
}

function _mockGenerate(trend) {
  const title = `${trend.topic.slice(0, 80)}... avant 30 jours ?`;
  if (isDuplicate(title)) return [];

  return [{
    title,
    description: `Marché auto-généré à partir d'une tendance ${trend.category} détectée sur ${trend.source}.`,
    category: trend.category || 'autre',
    oracleLevel: 2,
    resolutionDays: 30,
    confidence: 72,
    tags: [trend.category],
    resolutionSource: 'sources publiques',
    trendSource: trend,
  }];
}

/**
 * Generate markets from multiple trends (batch)
 * @param {Array} trends — scored trends from trendDetector
 * @returns {Array} — all generated markets that passed filters
 */
async function generateFromTrends(trends) {
  const allMarkets = [];

  // Process top 10 trends max per cycle
  const batch = trends.slice(0, 10);
  logger.info(`marketGenerator (NATHAN): processing ${batch.length} trends`);

  for (const trend of batch) {
    try {
      const markets = await generateMarketsFromTrend(trend);
      allMarkets.push(...markets);
      logger.info(`marketGenerator: trend "${trend.topic.slice(0, 50)}" → ${markets.length} market(s)`);
    } catch (err) {
      logger.warn(`marketGenerator: error on trend "${trend.topic.slice(0, 50)}" — ${err.message}`);
    }
  }

  logger.info(`marketGenerator (NATHAN): total generated = ${allMarkets.length}`);
  return allMarkets;
}

module.exports = { generateFromTrends, generateMarketsFromTrend };
