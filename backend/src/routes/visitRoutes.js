import { createHash } from 'node:crypto';
import { db, isMissingTable } from '../config/db.js';
import { asyncRouter, clean } from '../utils/http.js';
import { limits } from '../middleware/rateLimit.js';

/**
 * POST /api/visits { visitor } — counts a visit for the back-office statistics (services/stats.js).
 * The site sends one when someone arrives, or comes back after 30 minutes away (services/api.js).
 * `visitor` is the random id the browser keeps for the forum's read counts; it is stored hashed, so visits
 * cannot be matched with those reads, and nothing else is kept: no IP address, page or account.
 * Always answers 204: counting must never get in a visitor's way.
 */
const router = asyncRouter();

const VISITOR_RE = /^[A-Za-z0-9-]{8,64}$/;
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|monitor|curl|wget|python|axios|node-fetch/i;

export const hashVisitor = (visitor) => createHash('sha256').update(`visit:${visitor}`).digest('hex').slice(0, 32);

router.post('/', limits.visits, async (req, res) => {
  const visitor = clean(req.body?.visitor);
  if (VISITOR_RE.test(visitor) && !BOTS.test(req.headers['user-agent'] || '')) {
    // Signed in or not, from the request alone (no call to the auth service just to count a visit)
    const signedIn = /^Bearer [^.\s]+\.[^.\s]+\.[^.\s]+$/.test(req.headers.authorization || '');
    const { error } = await db().from('site_visits').insert({ visitor: hashVisitor(visitor), signed_in: signedIn });
    if (error && !isMissingTable(error)) console.warn('Visit not counted:', error.message);
  }
  res.status(204).end();
});

export default router;
