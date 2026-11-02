import express from 'express';
import { AssociationProduct } from '../models/AssociationProduct.js';
import { AtmcProduct } from '../models/AtmcProduct.js';
import {
  fetchFromOpenFoodFactsByBarcode,
  searchOpenFoodFactsByQuery,
} from '../services/openFoodFactsService.js';

const router = express.Router();

/**
 * GET /api/products/search
 * Single unified search input accepting product name, brand, or barcode lookup.
 * Performs dual-layer hybrid search:
 * Layer B: Official Tunisian Celiac Association Dataset
 * Layer A: Open Food Facts API
 */
router.get('/search', async (req, res) => {
  const query = (req.query.q || '').trim();

  if (!query) {
    // Return featured / common association staple products
    try {
      const featured = await AssociationProduct.find().limit(20);
      return res.json({
        success: true,
        layerA: [],
        layerB: featured.map((p) => ({
          id: p._id,
          source: 'Association Tunisienne de la Cœliaque',
          productNameFr: p.productNameFr,
          productNameAr: p.productNameAr,
          brand: p.brand,
          category: p.category,
          isGlutenFree: p.isGlutenFree,
          status: p.status,
          barcode: p.barcode,
          notes: p.notes,
          notesAr: p.notesAr,
          officialDocReference: p.officialDocReference,
        })),
        totalResults: featured.length,
      });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }

  const isBarcode = /^\d{6,14}$/.test(query);

  try {
    let layerAResults = [];
    let layerBResults = [];

    // --- Layer B: Tunisian Celiac Association Dataset (High Priority for local foods) ---
    const associationFilter = {
      $or: [
        { productNameFr: new RegExp(query, 'i') },
        { productNameAr: new RegExp(query, 'i') },
        { brand: new RegExp(query, 'i') },
        { notes: new RegExp(query, 'i') },
        { keywords: { $in: [new RegExp(query, 'i')] } },
      ],
    };

    if (isBarcode) {
      associationFilter.$or.push({ barcode: query });
    }

    const matchedAssociation = await AssociationProduct.find(associationFilter).limit(15);
    layerBResults = matchedAssociation.map((item) => ({
      id: item._id,
      source: 'Association Tunisienne de la Cœliaque',
      productNameFr: item.productNameFr,
      productNameAr: item.productNameAr,
      brand: item.brand,
      category: item.category,
      isGlutenFree: item.isGlutenFree,
      status: item.status,
      badgeText:
        item.status === 'SAFE'
          ? 'Sans Gluten (Autorisé ATC)'
          : item.status === 'UNSAFE'
          ? 'Contient du Gluten (Interdit ATC)'
          : 'Risque de Contamination Croisée',
      badgeTextAr:
        item.status === 'SAFE'
          ? 'خالٍ من الغلوتين (مرخص ATC)'
          : item.status === 'UNSAFE'
          ? 'يحتوي على الغلوتين (ممنوع ATC)'
          : 'خطر التلوث المتبادل',
      barcode: item.barcode,
      notes: item.notes,
      notesAr: item.notesAr,
      officialDocReference: item.officialDocReference,
      imageUrl: null,
    }));

    // Also query full ATMC 2023 dataset
    const atmcFilter = {
      $or: [
        { name: new RegExp(query, 'i') },
        { brand: new RegExp(query, 'i') },
        { rawText: new RegExp(query, 'i') },
        { items: { $in: [new RegExp(query, 'i')] } },
        { categoryFr: new RegExp(query, 'i') },
        { categoryAr: new RegExp(query, 'i') },
      ],
    };
    const matchedAtmc = await AtmcProduct.find(atmcFilter).limit(20);
    matchedAtmc.forEach((item) => {
      layerBResults.push({
        id: item._id,
        source: 'Guide Officiel ATMC 2023',
        productNameFr: item.name,
        productNameAr: item.categoryAr,
        brand: item.brand || 'Produit Répertorié ATMC',
        category: item.categoryFr,
        isGlutenFree: item.status === 'ALLOWED',
        status: item.status === 'ALLOWED' ? 'SAFE' : item.status === 'NOT_ALLOWED' ? 'UNSAFE' : 'WARNING',
        badgeText: item.statusLabelFr,
        badgeTextAr: item.statusLabelAr,
        barcode: '',
        notes: item.rawText,
        notesAr: item.categoryAr,
        officialDocReference: item.source,
        imageUrl: null,
      });
    });

    // --- Layer A: Open Food Facts API (Global barcodes & packaged brands) ---
    try {
      if (isBarcode) {
        const offProduct = await fetchFromOpenFoodFactsByBarcode(query);
        if (offProduct) {
          layerAResults.push(offProduct);
        }
      } else {
        layerAResults = await searchOpenFoodFactsByQuery(query);
      }
    } catch (apiErr) {
      console.warn(`[Product Routes] Layer A Open Food Facts warning: ${apiErr.message}`);
      // Graceful degradation in case of low connectivity
    }

    // Combine results prioritizing local association dataset
    return res.json({
      success: true,
      query,
      isBarcode,
      totalCount: layerBResults.length + layerAResults.length,
      layerB: layerBResults,
      layerA: layerAResults,
      combined: [...layerBResults, ...layerAResults],
    });
  } catch (err) {
    console.error(`[Product Routes] Search error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la recherche de produits.',
      error: err.message,
    });
  }
});

/**
 * GET /api/products/barcode/:barcode
 */
router.get('/barcode/:barcode', async (req, res) => {
  const barcode = req.params.barcode.trim();
  try {
    // 1. Check local association dataset first
    const localProduct = await AssociationProduct.findOne({ barcode });
    if (localProduct) {
      return res.json({
        success: true,
        source: 'Association Tunisienne de la Cœliaque',
        data: localProduct,
      });
    }

    // 2. Query Open Food Facts
    const offProduct = await fetchFromOpenFoodFactsByBarcode(barcode);
    if (offProduct) {
      return res.json({
        success: true,
        source: 'Open Food Facts',
        data: offProduct,
      });
    }

    return res.status(404).json({
      success: false,
      message: 'Code-barres non trouvé dans les bases de données locale et mondiale.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/products/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await AssociationProduct.distinct('category');
    return res.json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
