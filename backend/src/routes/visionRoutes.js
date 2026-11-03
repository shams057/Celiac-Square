import express from 'express';
import multer from 'multer';
import { identifyProductFromImage } from '../services/visionService.js';
import { db, unwrap } from '../config/db.js';
import { toAssociationProduct } from '../models/mappers.js';
import { containsPattern } from '../utils/regex.js';

const findAssociationProduct = async (text) => {
  const [row] = unwrap(await db().from('association_products').select('*').ilike('search_text', containsPattern(text)).limit(1));
  return row ? toAssociationProduct(row) : null;
};
import {
  searchOpenFoodFactsByQuery,
  fetchFromOpenFoodFactsByBarcode,
} from '../services/openFoodFactsService.js';

const router = express.Router();

// Images stay in memory: they are only forwarded to the vision model, and Vercel's disk is read-only.
// Vercel also caps request bodies at 4.5 MB, so the browser shrinks photos before sending them.
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Format de fichier non supporté. Veuillez soumettre une image.'));
    }
  },
});

/**
 * Helper to query internal Association dataset + Open Food Facts given a recognized term
 */
const matchProductInDatabases = async (searchTerm) => {
  if (!searchTerm) return null;
  const term = searchTerm.trim();

  // Association DB first: the full name, then its most specific words (longest first)
  const words = term
    .split(/\s+/)
    .map((w) => w.replace(/[()]/g, ''))
    .filter((w) => w.length > 3)
    .sort((a, b) => b.length - a.length);
  let localMatch = null;
  for (const text of [term, ...words]) {
    localMatch = await findAssociationProduct(text);
    if (localMatch) break;
  }

  if (localMatch) {
    return {
      source: 'Association Tunisienne de la Cœliaque',
      productNameFr: localMatch.productNameFr,
      productNameAr: localMatch.productNameAr,
      brand: localMatch.brand,
      category: localMatch.category,
      isGlutenFree: localMatch.isGlutenFree,
      status: localMatch.status,
      notes: localMatch.notes,
      notesAr: localMatch.notesAr,
      officialDocReference: localMatch.officialDocReference,
    };
  }

  // Next, query Open Food Facts
  try {
    const offResults = await searchOpenFoodFactsByQuery(term);
    if (offResults && offResults.length > 0) {
      return offResults[0];
    }
  } catch (e) {
    console.warn(`[Vision Route] Open Food Facts match warning: ${e.message}`);
  }

  return null;
};

/**
 * POST /api/vision/identify
 * Accepts multipart/form-data with field 'image'
 */
router.post('/identify', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Aucune image n'a été transmise pour l'analyse visuelle.",
      });
    }

    console.log(`[Vision API] Received image: ${req.file.originalname} (${req.file.size} bytes)`);

    // 1. Run vision engine
    const visionResult = await identifyProductFromImage(req.file);

    // 2. Query Association dataset & Open Food Facts for the identified item
    const matchedItem = await matchProductInDatabases(visionResult.identifiedProduct);

    // Also look up candidate info for fallback if confidence < 0.70
    const candidateMatches = [];
    if (visionResult.candidateNames && Array.isArray(visionResult.candidateNames)) {
      for (const candidateName of visionResult.candidateNames.slice(0, 3)) {
        const itemInfo = await matchProductInDatabases(candidateName);
        candidateMatches.push({
          candidateName,
          matchedProduct: itemInfo,
        });
      }
    }

    const confidenceScore = Number((visionResult.confidence || 0).toFixed(2));
    const requiresFallback = confidenceScore < 0.7;

    return res.json({
      success: true,
      data: {
        identifiedProduct: visionResult.identifiedProduct,
        confidence: confidenceScore,
        confidencePercentage: Math.round(confidenceScore * 100),
        requiresFallback,
        visualDescriptors: visionResult.visualDescriptors || [],
        engine: visionResult.engine || 'Multimodal Vision Engine',
        aiAvailable: Boolean(visionResult.aiAvailable),
        matchedProduct: matchedItem,
        candidates: candidateMatches,
        glutenStatus: matchedItem ? matchedItem.status : 'UNKNOWN',
        isGlutenFree: matchedItem ? matchedItem.isGlutenFree : false,
        safetyBadge: matchedItem
          ? matchedItem.status === 'SAFE'
            ? 'Sans Gluten'
            : matchedItem.status === 'UNSAFE'
            ? 'Contient du Gluten'
            : 'Risque de Contamination Croisée'
          : 'Non Référencé / Analyse Visuelle Requise',
        safetyBadgeAr: matchedItem
          ? matchedItem.status === 'SAFE'
            ? 'خالٍ من الغلوتين'
            : matchedItem.status === 'UNSAFE'
            ? 'يحتوي على الغلوتين'
            : 'خطر التلوث المتبادل'
          : 'غير مصنف في القائمة الرسمية',
      },
    });
  } catch (error) {
    console.error(`[Vision Error] ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'analyse visuelle du produit.",
      error: error.message,
    });
  }
});

export default router;
