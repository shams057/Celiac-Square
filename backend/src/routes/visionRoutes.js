import { matchProductsFromText } from '../services/productMatcher.js';
import { foldText } from '../utils/regex.js';
import { asyncRouter } from '../utils/http.js';
import { analyzeIngredientsText, analyzeIngredientsImage, isIngredientsAiConfigured, isVisionAiConfigured } from '../services/visionService.js';
import { identifyProductFromImage } from '../services/productVision.js';
import { parseImageDataUrl, ImageError } from '../utils/images.js';

// Photos are resized by the browser (about 100–400 kB); this leaves room without accepting huge uploads
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const AI_DOWN = {
  success: false,
  code: 'AI_UNAVAILABLE',
  message: 'Le service d’analyse ne répond pas pour le moment. Réessayez dans un instant.',
};
const AI_OFF = { success: false, code: 'AI_NOT_CONFIGURED', message: 'L’analyse par IA n’est pas configurée (OLLAMA_API_KEY).' };

/** The photo in the body, or a 400 already sent */
const photoOf = (req, res) => {
  try {
    return parseImageDataUrl(req.body?.image, MAX_PHOTO_BYTES);
  } catch (error) {
    if (!(error instanceof ImageError)) throw error;
    res.status(400).json({ success: false, message: error.message });
    return null;
  }
};

const router = asyncRouter();

// The photo shows an ingredients list rather than the front of the package.
// Tested on accent-folded text: OCR returns "É" as "E" + a combining accent.
const INGREDIENTS_RE = /ingredient|composition|zutaten|مكونات/;

// Below this, the product is shown with alternatives for the user to confirm
const CONFIRM_BELOW = 0.7;

/**
 * POST /api/vision/identify
 * Body: { image: dataURL } — photo of the front of the package.
 * The AI reads the package and picks the guide entry; the status comes from the database.
 * On AI_UNAVAILABLE the browser falls back to OCR + /match.
 */
router.post('/identify', async (req, res) => {
  if (!isVisionAiConfigured()) return res.status(503).json(AI_OFF);
  const image = photoOf(req, res);
  if (!image) return undefined;
  try {
    return res.json({ success: true, data: await identifyProductFromImage(image) });
  } catch (error) {
    console.error(`[Vision Identify] ${error.message}`);
    return res.status(502).json(AI_DOWN);
  }
});

/**
 * POST /api/vision/match
 * Body: { text } — text read from the package by OCR in the browser (fallback when the AI is unavailable).
 * Returns the best matching product from the Tunisian guides.
 */
router.post('/match', async (req, res) => {
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
 * Body: { image: dataURL } — photo of the ingredients list, read by the AI,
 *    or { text } — the list read by OCR in the browser (fallback).
 * The AI estimates whether the product contains gluten; our own rules can only make the verdict stricter.
 */
router.post('/ingredients', async (req, res) => {
  if (!isIngredientsAiConfigured()) return res.status(503).json(AI_OFF);

  if (req.body?.image !== undefined) {
    const image = photoOf(req, res);
    if (!image) return undefined;
    try {
      return res.json({ success: true, data: await analyzeIngredientsImage(image) });
    } catch (error) {
      console.error(`[Vision Ingredients] ${error.message}`);
      return res.status(502).json(AI_DOWN);
    }
  }

  const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 4000) : '';
  if (!text) return res.status(400).json({ success: false, message: 'Aucun texte d’ingrédients n’a été lu sur la photo.' });
  try {
    return res.json({ success: true, data: await analyzeIngredientsText(text) });
  } catch (error) {
    console.error(`[Vision Ingredients] ${error.message}`);
    return res.status(502).json(AI_DOWN);
  }
});

export default router;
