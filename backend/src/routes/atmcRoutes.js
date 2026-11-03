import express from 'express';
import { db, unwrap } from '../config/db.js';
import { toAtmcProduct } from '../models/mappers.js';

const fetchAtmc = async ({ category, status } = {}) => {
  let query = db().from('atmc_products').select('*').order('category_fr').order('status');
  if (category && category !== 'ALL') query = query.eq('category_slug', category);
  if (status && status !== 'ALL') query = query.eq('status', status.toUpperCase());
  return unwrap(await query).map(toAtmcProduct);
};

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
    const searchQuery = (q || '').trim();
    const candidates = await fetchAtmc({ category, status });

    if (!searchQuery) {
      return res.json({ success: true, count: candidates.length, data: candidates });
    }

    // Score and rank candidates by typo similarity
    const scored = candidates
      .map((item) => {
        const textToMatch = `${item.name} ${item.nameFr} ${item.brand} ${item.rawText} ${(item.items || []).join(' ')} ${item.categoryFr} ${item.categoryAr}`;
        const simScore = calculateSimilarity(searchQuery, textToMatch);
        return {
          ...item,
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
    const rows = unwrap(await db().from('atmc_products').select('category_slug, category_fr, category_ar, status'));
    const bySlug = new Map();
    for (const r of rows) {
      const c =
        bySlug.get(r.category_slug) ||
        { _id: r.category_slug, categorySlug: r.category_slug, categoryFr: r.category_fr, categoryAr: r.category_ar, totalCount: 0, allowedCount: 0, toCheckCount: 0, notAllowedCount: 0 };
      c.totalCount += 1;
      if (r.status === 'ALLOWED') c.allowedCount += 1;
      else if (r.status === 'TO_CHECK') c.toCheckCount += 1;
      else c.notAllowedCount += 1;
      bySlug.set(r.category_slug, c);
    }
    const categories = [...bySlug.values()].sort((a, b) => a.categoryFr.localeCompare(b.categoryFr, 'fr'));

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
    const rows = unwrap(await db().from('atmc_products').select('status, category_slug'));
    const countOf = (st) => rows.filter((r) => r.status === st).length;
    const total = rows.length;
    const allowed = countOf('ALLOWED');
    const toCheck = countOf('TO_CHECK');
    const notAllowed = countOf('NOT_ALLOWED');
    const categoryCount = new Set(rows.map((r) => r.category_slug));

    return res.json({
      success: true,
      data: {
        total,
        allowed,
        toCheck,
        notAllowed,
        categories: categoryCount.size,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
