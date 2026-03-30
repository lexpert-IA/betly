/**
 * Post-Moderation Agent
 *
 * Runs AFTER market creation as a final validation gate.
 * 3 outcomes:
 *   - approved  (40%) → market goes active
 *   - rejected  (40%) → market gets rejected with reason
 *   - double_check (20%) → triggers a second verification prompt
 */

const { default: Anthropic } = require('@anthropic-ai/sdk');
const config = require('../../config');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

// ── Final validation prompt ──────────────────────────────────────────────────
const FINAL_VALIDATION_PROMPT = `Tu es le contrôleur FINAL de BETLY. Un marché vient d'être créé et a passé le premier filtre.
Tu dois faire une DERNIÈRE vérification STRICTE avant publication.

ANALYSE ces critères dans l'ordre :

1. SÉCURITÉ (bloquant)
   - Contenu violent, haineux, sexuel, impliquant des mineurs → REJETÉ
   - Harcèlement ou ciblage d'une personne → REJETÉ
   - Incitation à des activités illégales → REJETÉ

2. VÉRIFIABILITÉ (bloquant)
   - Le résultat peut-il être vérifié par une source PUBLIQUE et OBJECTIVE ?
   - Actions personnelles ("je vais manger...", "il va dormir...") → REJETÉ
   - Prédictions subjectives non mesurables → REJETÉ
   - Pas de source de résolution identifiable → REJETÉ

3. QUALITÉ
   - Le marché est-il intéressant pour la communauté ?
   - La question est-elle claire et binaire (OUI/NON) ?
   - La date de résolution est-elle cohérente ?

4. FORMULATION
   - Pas d'ambiguïté dans l'interprétation ?
   - Grammaire et orthographe acceptables ?

Réponds UNIQUEMENT avec un JSON :
{
  "decision": "approved" | "rejected" | "double_check",
  "reason": "Explication courte (1-2 phrases)",
  "concerns": ["liste", "de", "points", "d'attention"]
}

RÈGLES DE DÉCISION :
- Si un critère BLOQUANT est violé → "rejected"
- Si tout est parfait et sans ambiguïté → "approved"
- Si tu as le moindre doute sur la vérifiabilité, l'ambiguïté, ou un aspect limite → "double_check"
- Sois STRICT : mieux vaut un double_check de trop qu'un mauvais marché en ligne`;

// ── Double check prompt (2nd opinion, different angle) ───────────────────────
const DOUBLE_CHECK_PROMPT = `Tu es l'AVOCAT DU DIABLE de BETLY. Un marché a été signalé pour double vérification.
Un premier modérateur avait des doutes. Tu dois trancher DÉFINITIVEMENT.

Pose-toi ces questions :
1. Si ce marché était publié et qu'un journaliste le voyait, est-ce que ça ferait scandale ?
2. Quelqu'un pourrait-il perdre de l'argent à cause d'une ambiguïté dans la question ?
3. Le résultat est-il RÉELLEMENT vérifiable par une source publique dans le délai donné ?
4. Ce marché apporte-t-il une VALEUR à la communauté BETLY ?

Si la réponse à la question 1 est OUI → rejected
Si la réponse à la question 2 est OUI → rejected
Si la réponse à la question 3 est NON → rejected
Si les 4 réponses sont favorables → approved

Réponds UNIQUEMENT avec un JSON :
{
  "decision": "approved" | "rejected",
  "reason": "Explication claire de ta décision finale",
  "verdict": "1 phrase résumant le verdict"
}`;

// ── Run final validation ─────────────────────────────────────────────────────
async function runPostModeration(market) {
  const title = market.title;
  const description = market.description || '';
  const resolutionDate = market.resolutionDate;
  const category = market.category;
  const tags = (market.tags || []).join(', ');

  const userMessage = `Marché à valider :
Titre: ${title}
Description: ${description}
Catégorie: ${category}
Tags: ${tags}
Date de résolution: ${resolutionDate}
Créateur: ${market.creatorId}
${market.creatorMarket ? `Marché créateur: @${market.subjectHandle} sur ${market.subjectPlatform}` : ''}
${market.selfMarket ? '⚠️ Le créateur EST le sujet du marché' : ''}`;

  // Try Claude API
  if (config.anthropic.apiKey && config.anthropic.apiKey !== 'placeholder') {
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: FINAL_VALIDATION_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
      const raw = msg.content[0].text.trim();
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const result = JSON.parse(text);
      logger.info(`postModerator: Final validation — market:${market._id} decision:${result.decision}`);
      return result;
    } catch (err) {
      logger.warn(`postModerator: Claude error — ${err.message} — using fallback`);
    }
  }

  // Fallback: rule-based validation
  return _fallbackValidation(title, description);
}

// ── Run double check (2nd AI pass) ───────────────────────────────────────────
async function runDoubleCheck(market, firstPassReason) {
  const userMessage = `Marché signalé pour double vérification :
Titre: ${market.title}
Description: ${market.description || ''}
Catégorie: ${market.category}
Date de résolution: ${market.resolutionDate}
Raison du signalement: ${firstPassReason}`;

  if (config.anthropic.apiKey && config.anthropic.apiKey !== 'placeholder') {
    try {
      const msg = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: DOUBLE_CHECK_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });
      const raw = msg.content[0].text.trim();
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const result = JSON.parse(text);
      logger.info(`postModerator: Double check — market:${market._id} decision:${result.decision}`);
      return result;
    } catch (err) {
      logger.warn(`postModerator: Double check Claude error — ${err.message}`);
    }
  }

  // Fallback: conservative, reject if flagged
  return { decision: 'rejected', reason: 'Double vérification automatique : marché rejeté par précaution.', verdict: 'Rejeté par défaut lors de la double vérification.' };
}

// ── Fallback rule-based validation ───────────────────────────────────────────
function _fallbackValidation(title, description) {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Personal actions → reject
  if (/\b(je vais|tu vas|il va|elle va|on va)\b/.test(text)) {
    return { decision: 'rejected', reason: 'Les actions personnelles ne sont pas vérifiables.', concerns: ['non-vérifiable'] };
  }

  // Check for question mark (good sign)
  const hasQuestion = text.includes('?');

  // Check for measurable keywords
  const measurable = /\b(gagner|perdre|atteindre|dépasser|remporter|éliminer|qualifier|voter|élire|sortir|lancer|annoncer)\b/.test(text);

  if (!hasQuestion && !measurable) {
    return { decision: 'double_check', reason: 'Formulation ambiguë, pas de question claire ni de verbe mesurable.', concerns: ['formulation'] };
  }

  if (hasQuestion && measurable) {
    return { decision: 'approved', reason: 'Marché bien formulé avec une question claire et vérifiable.', concerns: [] };
  }

  return { decision: 'double_check', reason: 'Marché nécessite une vérification supplémentaire.', concerns: ['vérifiabilité incertaine'] };
}

// ── Full post-moderation pipeline ────────────────────────────────────────────
async function postModerate(market) {
  const Market = require('../../db/models/Market');

  try {
    // Step 1: Final validation
    const result = await runPostModeration(market);

    if (result.decision === 'approved') {
      // ✅ VERT — Approved
      await Market.findByIdAndUpdate(market._id, {
        status: 'active',
        'postModeration.decision': 'approved',
        'postModeration.reason': result.reason,
        'postModeration.moderatedAt': new Date(),
      });
      logger.info(`postModerator: ✅ APPROVED — ${market._id} "${market.title}"`);
      return { final: 'approved', reason: result.reason };
    }

    if (result.decision === 'rejected') {
      // ❌ ROUGE — Rejected
      await Market.findByIdAndUpdate(market._id, {
        status: 'rejected',
        rejectionReason: result.reason,
        'postModeration.decision': 'rejected',
        'postModeration.reason': result.reason,
        'postModeration.moderatedAt': new Date(),
      });
      logger.info(`postModerator: ❌ REJECTED — ${market._id} "${market.title}" — ${result.reason}`);
      return { final: 'rejected', reason: result.reason };
    }

    // 🟠 ORANGE — Double check
    await Market.findByIdAndUpdate(market._id, {
      status: 'double_check',
      'postModeration.decision': 'double_check',
      'postModeration.reason': result.reason,
      'postModeration.moderatedAt': new Date(),
    });
    logger.info(`postModerator: 🟠 DOUBLE CHECK — ${market._id} "${market.title}" — ${result.reason}`);

    // Step 2: Run double check (2nd AI pass with different prompt)
    const doubleResult = await runDoubleCheck(market, result.reason);

    if (doubleResult.decision === 'approved') {
      await Market.findByIdAndUpdate(market._id, {
        status: 'active',
        'postModeration.doubleCheck.decision': 'approved',
        'postModeration.doubleCheck.reason': doubleResult.reason,
        'postModeration.doubleCheck.checkedAt': new Date(),
      });
      logger.info(`postModerator: ✅ DOUBLE CHECK PASSED — ${market._id}`);
      return { final: 'approved', reason: doubleResult.reason, doubleChecked: true };
    }

    // Double check rejected
    await Market.findByIdAndUpdate(market._id, {
      status: 'rejected',
      rejectionReason: doubleResult.reason,
      'postModeration.doubleCheck.decision': 'rejected',
      'postModeration.doubleCheck.reason': doubleResult.reason,
      'postModeration.doubleCheck.checkedAt': new Date(),
    });
    logger.info(`postModerator: ❌ DOUBLE CHECK REJECTED — ${market._id} — ${doubleResult.reason}`);
    return { final: 'rejected', reason: doubleResult.reason, doubleChecked: true };

  } catch (err) {
    logger.error(`postModerator: Error — ${market._id} — ${err.message}`);
    // On error, put in pending_review for manual check
    await Market.findByIdAndUpdate(market._id, {
      status: 'pending_review',
      flagged: true,
    });
    return { final: 'error', reason: err.message };
  }
}

module.exports = { postModerate, runPostModeration, runDoubleCheck };
