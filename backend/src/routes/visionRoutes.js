import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { identifyProductFromImage } from '../services/visionService.js';
import { AssociationProduct } from '../models/AssociationProduct.js';
import {
  searchOpenFoodFactsByQuery,
  fetchFromOpenFoodFactsByBarcode,
} from '../services/openFoodFactsService.js';

const router = express.Router();

// Configure Multer for image uploads
const uploadDir = path.resolve('uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `vision_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

  // Try matching with Association DB first
  const words = term.split(/\s+/).filter((w) => w.length > 2);
  const regexPatterns = [new RegExp(term, 'i'), ...words.map((w) => new RegExp(w, 'i'))];

  const localMatch = await AssociationProduct.findOne({
    $or: [
      { productNameFr: { $in: regexPatterns } },
      { productNameAr: { $in: regexPatterns } },
      { brand: { $in: regexPatterns } },
      { keywords: { $in: regexPatterns } },
    ],
  });

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

    // Clean up temporary uploaded file if needed
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn(`[Vision CleanUp] Notice: ${err.message}`);
    });

    return res.json({
      success: true,
      data: {
        identifiedProduct: visionResult.identifiedProduct,
        confidence: confidenceScore,
        confidencePercentage: Math.round(confidenceScore * 100),
        requiresFallback,
        visualDescriptors: visionResult.visualDescriptors || [],
        engine: visionResult.engine || 'Multimodal Vision Engine',
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
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    return res.status(500).json({
      success: false,
      message: "Une erreur est survenue lors de l'analyse visuelle du produit.",
      error: error.message,
    });
  }
});

export default router;
