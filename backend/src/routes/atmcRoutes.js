import { db, unwrap } from '../config/db.js';
import { toAtmcProduct } from '../models/mappers.js';
import { foldText } from '../utils/regex.js';
import { asyncRouter, clean } from '../utils/http.js';
import { cached } from '../services/cache.js';

const router = asyncRouter();

const STATUSES = ['ALLOWED', 'TO_CHECK', 'NOT_ALLOWED'];

// The guide is fixed (a seed of ~240 rows): kept in memory for a few minutes per instance
const loadGuide = () =>
  cached('atmc:all', 10 * 60 * 1000, async () =>
    unwrap(await db().from('atmc_products').select('*').order('category_fr').order('status')).map(toAtmcProduct)
  );

/** Levenshtein distance */
export function levenshtein(a, b) {
  const an = a.length;
  const bn = b.length;
  if (!an) return bn;
  if (!bn) return an;
  let prev = Array.from({ length: an + 1 }, (_, j) => j);
  for (let i = 1; i <= bn; i++) {
    const row = [i];
    for (let j = 1; j <= an; j++) {
      row[j] = b[i - 1] === a[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j - 1], row[j - 1], prev[j]);
    }
    prev = row;
  }
  return prev[an];
}

const words = (text) => foldText(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * How well one query word matches one word of the product (0 to 1).
 * Short words must match exactly: "blé" must not find "bleu" or "thé".
 */
const wordScore = (q, w) => {
  if (q === w) return 1;
  if (q.length <= 3) return 0;
  if (w.startsWith(q)) return 0.92;
  if (q.length <= 5) return 0;
  const dist = levenshtein(q, w);
  return dist <= 1 ? 0.85 : dist === 2 && q.length >= 8 ? 0.7 : 0;
};

/**
 * Similarity between the query and a product (0 to 1): every query word must be found
 * (exactly, as a prefix, or with a typo on longer words); the whole phrase scores highest.
 */
export const similarity = (query, text) => {
  const foldedQuery = foldText(query).trim();
  const foldedText = foldText(text);
  if (!foldedQuery) return 0;
  const queryWords = words(query);
  const textWords = words(text);
  if (!queryWords.length) return 0;

  let total = 0;
  for (const q of queryWords) {
    let best = 0;
    for (const w of textWords) best = Math.max(best, wordScore(q, w));
    if (best === 0) return 0;
    total += best;
  }
  const phraseBonus = queryWords.length > 1 && foldedText.includes(foldedQuery) ? 0.05 : 0;
  return Math.min(1, total / queryWords.length + phraseBonus);
};

/**
 * GET /api/atmc/products
 * Query params:
 *   category: categorySlug or ALL
 *   status: ALLOWED | TO_CHECK | NOT_ALLOWED | ALL
 *   q: search term with typo tolerance on longer words
 */
router.get('/products', async (req, res) => {
  const category = clean(req.query.category);
  const status = clean(req.query.status).toUpperCase();
  const searchQuery = clean(req.query.q).slice(0, 100);

  const candidates = (await loadGuide()).filter(
    (item) => (!category || category === 'ALL' || item.categorySlug === category) && (!STATUSES.includes(status) || item.status === status)
  );

  if (!searchQuery) return res.json({ success: true, count: candidates.length, data: candidates });

  const scored = candidates
    .map((item) => {
      const text = `${item.name} ${item.nameFr} ${item.brand} ${item.rawText} ${(item.items || []).join(' ')} ${item.categoryFr} ${item.categoryAr}`;
      // The product's own name counts more than its category or notes
      const nameScore = similarity(searchQuery, `${item.name} ${item.nameFr} ${item.brand}`);
      const score = Math.max(nameScore, similarity(searchQuery, text) * 0.9);
      return { ...item, similarityScore: Math.round(score * 100) };
    })
    .filter((item) => item.similarityScore >= 60)
    .sort((a, b) => b.similarityScore - a.similarityScore);

  return res.json({ success: true, query: searchQuery, count: scored.length, data: scored });
});

/**
 * GET /api/atmc/categories
 * Returns list of distinct categories with per-status counts
 */
router.get('/categories', async (req, res) => {
  const bySlug = new Map();
  for (const r of await loadGuide()) {
    const c =
      bySlug.get(r.categorySlug) ||
      { _id: r.categorySlug, categorySlug: r.categorySlug, categoryFr: r.categoryFr, categoryAr: r.categoryAr, totalCount: 0, allowedCount: 0, toCheckCount: 0, notAllowedCount: 0 };
    c.totalCount += 1;
    if (r.status === 'ALLOWED') c.allowedCount += 1;
    else if (r.status === 'TO_CHECK') c.toCheckCount += 1;
    else c.notAllowedCount += 1;
    bySlug.set(r.categorySlug, c);
  }
  const categories = [...bySlug.values()].sort((a, b) => a.categoryFr.localeCompare(b.categoryFr, 'fr'));
  return res.json({ success: true, count: categories.length, data: categories });
});

/**
 * GET /api/atmc/stats
 * Global stats for header summary
 */
router.get('/stats', async (req, res) => {
  const rows = await loadGuide();
  const countOf = (st) => rows.filter((r) => r.status === st).length;
  return res.json({
    success: true,
    data: {
      total: rows.length,
      allowed: countOf('ALLOWED'),
      toCheck: countOf('TO_CHECK'),
      notAllowed: countOf('NOT_ALLOWED'),
      categories: new Set(rows.map((r) => r.categorySlug)).size,
    },
  });
});

export default router;
