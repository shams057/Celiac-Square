import express from 'express';
import { matchProductsFromText } from '../services/productMatcher.js';
import { foldText } from '../utils/regex.js';
import { analyzeIngredientsText, isIngredientsAiConfigured } from '../services/visionService.js';

const router = express.Router();

// The photo shows an ingredients list rather than the front of the package.
// Tested on accent-folded text: OCR returns "É" as "E" + a combining accent.
const INGREDIENTS_RE = /ingredient|composition|zutaten|مكونات/;

// Below this, the product is shown with alternatives for the user to confirm
const CONFIRM_BELOW = 0.7;

/**
 * POST /api/vision/match
 * Body: { text } — text read from the package by OCR in the browser.
 * Returns the best matching product from the Tunisian guides.
 */
router.post('/match', express.json({ limit: '50kb' }), async (req, res) => {
  try {
    const text = typeof req.body?.text === 'string' ? req.body.text.slice(0, 5000) : '';
    if (!text.trim()) {
      return res.status(400).json({ success: false, message: 'Aucun texte n’a été lu sur la photo.' });
    }

    const { tokens, matches } = await matchProductsFromText(text, 4);
    const best = matches[0] || null;
    const confidence = best ? Number(best.confidence.toFixed(2)) : 0;

    return res.json({
      success: true,
      data: {
        identifiedProduct: best ? best.name : null,
        confidence,
        confidencePercentage: Math.round(confidence * 100),
        requiresFallback: !best || confidence < CONFIRM_BELOW,
        matchedProduct: best ? best.product : null,
        glutenStatus: best ? best.product.status : 'UNKNOWN',
        candidates: matches.slice(best && confidence >= CONFIRM_BELOW ? 1 : 0).map((m) => ({
          candidateName: m.name,
          matchedProduct: m.product,
        })),
        // Words read on the package, offered as a search when nothing matches
        keywords: tokens.slice(0, 6),
        looksLikeIngredients: INGREDIENTS_RE.test(foldText(text)),
        engine: 'OCR',
      },
    });
  } catch (error) {
    console.error(`[Vision Match] ${error.message}`);
    return res.status(500).json({ success: false, message: 'La recherche du produit a échoué.' });
  }
});

/**
 * POST /api/vision/ingredients
 * Body: { text } — the ingredients list read from the photo by OCR in the browser.
 * Gemini estimates whether the product contains gluten.
 */
router.post('/ingredients', express.json({ limit: '50kb' }), async (req, res) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 4000) : '';
  if (!text) {
    return res.status(400).json({ success: false, message: 'Aucun texte d’ingrédients n’a été lu sur la photo.' });
  }
  if (!isIngredientsAiConfigured()) {
    return res.status(503).json({ success: false, message: 'L’analyse des ingrédients n’est pas configurée (GEMINI_API_KEY).' });
  }
  try {
    const data = await analyzeIngredientsText(text);
    return res.json({ success: true, data });
  } catch (error) {
    console.error(`[Vision Ingredients] ${error.message}`);
    return res.status(502).json({
      success: false,
      message: 'Le service d’analyse ne répond pas pour le moment. Réessayez dans un instant.',
    });
  }
});

export default router;
