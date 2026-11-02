import express from 'express';
import { AtmcProduct } from '../models/AtmcProduct.js';

const router = express.Router();

/**
 * Levenshtein distance calculation for typo similarity
 */
function levenshtein(a, b) {
  const an = a.length, bn = b.length;
  if (!an) return bn;
  if (!bn) return an;
  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;
  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Compute fuzzy similarity between user query and text (0.0 to 1.0)
 */
function calculateSimilarity(query, targetText) {
  if (!query || !targetText) return 0;
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const t = targetText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  if (t === q) return 1.0;
  if (t.includes(q)) return 0.95;

  const words = t.split(/[^a-zA-Z0-9\u0600-\u06FF]+/);
  let bestWordSim = 0;

  for (const w of words) {
    if (!w) continue;
    if (w === q) return 0.98;
    if (w.includes(q) || q.includes(w)) {
      bestWordSim = Math.max(bestWordSim, 0.9);
      continue;
    }
    const dist = levenshtein(q, w);
    const maxLen = Math.max(q.length, w.length);
    const sim = 1 - dist / maxLen;
    if (sim > bestWordSim) bestWordSim = sim;
  }

  // Also full-string Levenshtein for short strings
  if (Math.abs(q.length - t.length) <= 4) {
    const fullDist = levenshtein(q, t);
    const fullSim = 1 - fullDist / Math.max(q.length, t.length);
    if (fullSim > bestWordSim) bestWordSim = fullSim;
  }

  return bestWordSim;
}

/**
 * GET /api/atmc/products
 * Query params:
 *   category: categorySlug or ALL
 *   status: ALLOWED | TO_CHECK | NOT_ALLOWED | ALL
 *   q: search term with fuzzy typo tolerance
 */
router.get('/products', async (req, res) => {
  try {
    const { category, status, q } = req.query;
    const filter = {};

    if (category && category !== 'ALL') {
      filter.categorySlug = category;
    }

    if (status && status !== 'ALL') {
      filter.status = status.toUpperCase();
    }

    const searchQuery = (q || '').trim();

    if (!searchQuery) {
      const products = await AtmcProduct.find(filter).sort({ categoryFr: 1, status: 1 });
      return res.json({
        success: true,
        count: products.length,
        data: products,
      });
    }

    // When a search query is present, pull all candidates matching category/status filter
    const candidates = await AtmcProduct.find(filter);

    // Score and rank candidates by typo similarity
    const scored = candidates
      .map((item) => {
        const textToMatch = `${item.name} ${item.brand} ${item.rawText} ${(item.items || []).join(' ')} ${item.categoryFr} ${item.categoryAr}`;
        const simScore = calculateSimilarity(searchQuery, textToMatch);
        return {
          ...item.toObject(),
          similarityScore: Math.round(simScore * 100),
        };
      })
      .filter((item) => item.similarityScore >= 50) // Keep matches with >= 50% similarity
      .sort((a, b) => b.similarityScore - a.similarityScore);

    return res.json({
      success: true,
      query: searchQuery,
      count: scored.length,
      data: scored,
    });
  } catch (error) {
    console.error(`[ATMC Routes] Error fetching products: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des produits ATMC.',
      error: error.message,
    });
  }
});

/**
 * GET /api/atmc/categories
 * Returns list of distinct categories with per-status counts
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await AtmcProduct.aggregate([
      {
        $group: {
          _id: '$categorySlug',
          categoryFr: { $first: '$categoryFr' },
          categoryAr: { $first: '$categoryAr' },
          categorySlug: { $first: '$categorySlug' },
          totalCount: { $sum: 1 },
          allowedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'ALLOWED'] }, 1, 0] },
          },
          toCheckCount: {
            $sum: { $cond: [{ $eq: ['$status', 'TO_CHECK'] }, 1, 0] },
          },
          notAllowedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'NOT_ALLOWED'] }, 1, 0] },
          },
        },
      },
      { $sort: { categoryFr: 1 } },
    ]);

    return res.json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error(`[ATMC Routes] Error fetching categories: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des catégories ATMC.',
      error: error.message,
    });
  }
});

/**
 * GET /api/atmc/stats
 * Global stats for header summary
 */
router.get('/stats', async (req, res) => {
  try {
    const [total, allowed, toCheck, notAllowed, categoryCount] = await Promise.all([
      AtmcProduct.countDocuments(),
      AtmcProduct.countDocuments({ status: 'ALLOWED' }),
      AtmcProduct.countDocuments({ status: 'TO_CHECK' }),
      AtmcProduct.countDocuments({ status: 'NOT_ALLOWED' }),
      AtmcProduct.distinct('categorySlug'),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        allowed,
        toCheck,
        notAllowed,
        categories: categoryCount.length,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
