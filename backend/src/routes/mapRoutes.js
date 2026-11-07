import { db, unwrap } from '../config/db.js';
import { toSpot, toProposal } from '../models/mappers.js';
import { containsPattern, exactPattern } from '../utils/regex.js';
import { asyncRouter, clean, UUID_RE, MAX_LEN, tooLong, badRequest } from '../utils/http.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { limits } from '../middleware/rateLimit.js';
import { cached, invalidate } from '../services/cache.js';
import { audit } from '../services/audit.js';

const router = asyncRouter();

const CATEGORIES = ['DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET'];
const MAX_SPOTS = 1000;

const validCoords = (c) =>
  Array.isArray(c) &&
  c.length === 2 &&
  c.every((n) => n !== '' && n !== null && Number.isFinite(Number(n))) &&
  Math.abs(Number(c[0])) <= 180 &&
  Math.abs(Number(c[1])) <= 90;

// Unknown or malformed ids answer 404 instead of a database error
const findById = async (table, id) => {
  if (!UUID_RE.test(id)) return null;
  const [row] = unwrap(await db().from(table).select('*').eq('id', id).limit(1));
  return row || null;
};

const TEXT_FIELDS = {
  name: ['nom', MAX_LEN.name],
  city: ['ville', MAX_LEN.city],
  address: ['adresse', MAX_LEN.address],
  phone: ['téléphone', MAX_LEN.phone],
  speciality: ['spécialité', MAX_LEN.speciality],
  hours: ['horaires', MAX_LEN.hours],
  notes: ['notes', MAX_LEN.notes],
  submitted_by: ['proposé par', MAX_LEN.submittedBy],
};

const lengthProblem = (row) =>
  tooLong(Object.fromEntries(Object.entries(TEXT_FIELDS).map(([column, [label, max]]) => [label, [row[column], max]])));

/** Verification stamp: who verified the spot and when */
const verification = (req, isVerified) =>
  isVerified
    ? { is_verified: true, verified_at: new Date().toISOString(), verified_by: req.user?.id ?? null }
    : { is_verified: false, verified_at: null, verified_by: null };

/**
 * Request body (camelCase, as sent by the backoffice) to spots columns; only fields present are set.
 * Ratings are not editable: there is no review system, so the platform shows none.
 */
const spotFields = (body) => {
  const row = {};
  if (body.name !== undefined) row.name = clean(body.name);
  if (body.category !== undefined) row.category = clean(body.category).toUpperCase();
  if (body.city !== undefined) row.city = clean(body.city);
  if (body.address !== undefined) row.address = clean(body.address);
  if (body.phone !== undefined) row.phone = clean(body.phone);
  if (body.speciality !== undefined) row.speciality = clean(body.speciality);
  if (body.hours !== undefined) row.hours = clean(body.hours);
  if (body.notes !== undefined) row.notes = clean(body.notes);
  if (body.submittedBy !== undefined) row.submitted_by = clean(body.submittedBy);
  if (body.crossContaminationRisk !== undefined) row.cross_contamination_risk = Boolean(body.crossContaminationRisk);
  if (validCoords(body.coordinates)) {
    row.lng = Number(body.coordinates[0]);
    row.lat = Number(body.coordinates[1]);
  }
  return row;
};

const invalidateSpots = () => invalidate('map:');

/**
 * GET /api/map/spots
 * Filters: category, city, isVerified, q (search query)
 */
router.get('/spots', async (req, res) => {
  const category = clean(req.query.category).toUpperCase();
  const city = clean(req.query.city);
  const isVerified = clean(req.query.isVerified);
  const q = clean(req.query.q).slice(0, 100);

  let query = db()
    .from('spots')
    .select('*')
    .order('is_verified', { ascending: false })
    .order('name')
    .limit(MAX_SPOTS);
  if (CATEGORIES.includes(category)) query = query.eq('category', category);
  if (city && city !== 'ALL') query = query.ilike('city', exactPattern(city.slice(0, MAX_LEN.city)));
  if (isVerified === 'true' || isVerified === 'false') query = query.eq('is_verified', isVerified === 'true');
  if (q) query = query.ilike('search_text', containsPattern(q));

  const spots = unwrap(await query).map(toSpot);
  return res.json({ success: true, count: spots.length, data: spots });
});

/**
 * GET /api/map/spots/:id
 */
router.get('/spots/:id', async (req, res) => {
  const spot = await findById('spots', req.params.id);
  if (!spot) return res.status(404).json({ success: false, message: 'Lieu non trouvé.' });
  return res.json({ success: true, data: toSpot(spot) });
});

/**
 * POST /api/map/spots
 * Create a spot directly (backoffice). The public goes through /proposals.
 */
router.post('/spots', requireAdmin, async (req, res) => {
  const row = spotFields(req.body);
  if (!row.name || !row.category || row.lng === undefined || !row.city || !row.address) {
    return badRequest(res, 'Veuillez renseigner les champs obligatoires (nom, catégorie, ville, coordonnées, adresse).');
  }
  if (!CATEGORIES.includes(row.category)) return badRequest(res, 'Catégorie inconnue.');
  const long = lengthProblem(row);
  if (long) return badRequest(res, long);
  if (!row.submitted_by) row.submitted_by = 'Backoffice Admin';

  const [saved] = unwrap(await db().from('spots').insert({ ...row, ...verification(req, req.body.isVerified !== false) }).select());
  invalidateSpots();
  await audit(req, 'spot.create', saved.id, { name: saved.name });
  return res.status(201).json({ success: true, message: 'Lieu enregistré avec succès.', data: toSpot(saved) });
});

/**
 * PUT /api/map/spots/:id
 * Update any spot field
 */
router.put('/spots/:id', requireAdmin, async (req, res) => {
  const spot = await findById('spots', req.params.id);
  if (!spot) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
  const row = spotFields(req.body);
  if (row.category !== undefined && !CATEGORIES.includes(row.category)) return badRequest(res, 'Catégorie inconnue.');
  for (const required of ['name', 'city', 'address']) {
    if (row[required] !== undefined && !row[required]) return badRequest(res, 'Le nom, la ville et l’adresse sont obligatoires.');
  }
  const long = lengthProblem(row);
  if (long) return badRequest(res, long);
  if (req.body.isVerified !== undefined && Boolean(req.body.isVerified) !== spot.is_verified) {
    Object.assign(row, verification(req, Boolean(req.body.isVerified)));
  }

  const [updated] = unwrap(await db().from('spots').update(row).eq('id', spot.id).select());
  invalidateSpots();
  await audit(req, 'spot.update', spot.id, { fields: Object.keys(row) });
  return res.json({ success: true, message: 'Lieu mis à jour avec succès.', data: toSpot(updated) });
});

/**
 * DELETE /api/map/spots/:id
 */
router.delete('/spots/:id', requireAdmin, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
  const [deleted] = unwrap(await db().from('spots').delete().eq('id', req.params.id).select());
  if (!deleted) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
  invalidateSpots();
  await audit(req, 'spot.delete', deleted.id, { name: deleted.name });
  return res.json({ success: true, message: 'Lieu supprimé définitivement.', data: toSpot(deleted) });
});

/**
 * PATCH /api/map/spots/:id/verify
 * Toggle (or set) the verification status
 */
router.patch('/spots/:id/verify', requireAdmin, async (req, res) => {
  const spot = await findById('spots', req.params.id);
  if (!spot) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
  const isVerified = req.body.isVerified !== undefined ? Boolean(req.body.isVerified) : !spot.is_verified;
  const [updated] = unwrap(await db().from('spots').update(verification(req, isVerified)).eq('id', spot.id).select());
  invalidateSpots();
  await audit(req, isVerified ? 'spot.verify' : 'spot.unverify', spot.id, { name: spot.name });
  return res.json({
    success: true,
    message: `Statut vérifié mis à jour (${updated.is_verified ? 'Vérifié' : 'En attente'}).`,
    data: toSpot(updated),
  });
});

const PROPOSAL_FIELDS = ['name', 'category', 'city', 'address', 'phone', 'speciality', 'hours', 'notes'];

/**
 * POST /api/map/proposals
 * Public: suggest a spot. It goes to the admin inbox, not to the map.
 * Coordinates are optional: without them, the admin places the spot before approving it.
 */
router.post('/proposals', limits.submissions, async (req, res) => {
  const row = {};
  PROPOSAL_FIELDS.forEach((f) => {
    row[f] = clean(req.body[f]);
  });
  row.category = row.category.toUpperCase();
  row.submitted_by = clean(req.body.submittedBy);
  // Hidden field that people never see: bots fill it in
  if (clean(req.body.website)) return res.status(201).json({ success: true, message: 'Adresse envoyée. Elle sera publiée après vérification.' });

  if (!row.name || !row.category || !row.city || !row.address) {
    return badRequest(res, 'Veuillez renseigner le nom, le type de lieu, la ville et l’adresse.');
  }
  if (!CATEGORIES.includes(row.category)) return badRequest(res, 'Type de lieu inconnu.');
  const long = lengthProblem(row);
  if (long) return badRequest(res, long);
  if (validCoords(req.body.coordinates)) {
    row.lng = Number(req.body.coordinates[0]);
    row.lat = Number(req.body.coordinates[1]);
  }

  const [proposal] = unwrap(await db().from('spot_proposals').insert(row).select('id, name'));
  return res.status(201).json({
    success: true,
    message: 'Adresse envoyée. Elle sera publiée après vérification.',
    data: { _id: proposal.id, name: proposal.name },
  });
});

/**
 * GET /api/map/proposals?status=PENDING|APPROVED|REJECTED|ALL
 * Admin inbox
 */
router.get('/proposals', requireAdmin, async (req, res) => {
  const status = clean(req.query.status).toUpperCase() || 'PENDING';
  let query = db().from('spot_proposals').select('*').order('created_at', { ascending: false }).limit(500);
  if (['PENDING', 'APPROVED', 'REJECTED'].includes(status)) query = query.eq('status', status);
  const [proposals, pending] = await Promise.all([
    query,
    db().from('spot_proposals').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
  ]);
  if (pending.error) throw new Error(pending.error.message);
  const data = unwrap(proposals).map(toProposal);
  return res.json({ success: true, count: data.length, pendingCount: pending.count ?? 0, data });
});

/**
 * POST /api/map/proposals/:id/approve
 * Creates the verified spot. The body may override any field (e.g. exact coordinates).
 * The proposal is claimed first (PENDING -> APPROVED in one conditional update), so a
 * double click or two admins at once cannot publish the same place twice.
 */
router.post('/proposals/:id/approve', requireAdmin, async (req, res) => {
  const proposal = await findById('spot_proposals', req.params.id);
  if (!proposal) return res.status(404).json({ success: false, message: 'Proposition introuvable.' });
  if (proposal.status !== 'PENDING') return res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' });

  const overrides = spotFields(req.body || {});
  const row = {
    name: proposal.name,
    category: proposal.category,
    city: proposal.city,
    address: proposal.address,
    phone: proposal.phone,
    speciality: proposal.speciality,
    hours: proposal.hours,
    notes: proposal.notes,
    submitted_by: proposal.submitted_by || 'Communauté',
    lng: proposal.lng,
    lat: proposal.lat,
    ...overrides,
    ...verification(req, true),
  };
  if (row.lng == null || row.lat == null) return badRequest(res, 'Indiquez la position exacte (latitude et longitude) du lieu.');
  if (!CATEGORIES.includes(row.category)) return badRequest(res, 'Catégorie inconnue.');
  const long = lengthProblem(row);
  if (long) return badRequest(res, long);

  const [claimed] = unwrap(
    await db()
      .from('spot_proposals')
      .update({ status: 'APPROVED', reviewed_at: new Date().toISOString() })
      .eq('id', proposal.id)
      .eq('status', 'PENDING')
      .select('id')
  );
  if (!claimed) return res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' });

  try {
    const [spot] = unwrap(await db().from('spots').insert(row).select());
    unwrap(await db().from('spot_proposals').update({ spot_id: spot.id }).eq('id', proposal.id));
    invalidateSpots();
    await audit(req, 'proposal.approve', proposal.id, { spotId: spot.id, name: spot.name });
    return res.json({ success: true, message: 'Adresse validée et publiée sur la carte.', data: toSpot(spot) });
  } catch (error) {
    // Put the proposal back in the inbox so it can be approved again
    await db().from('spot_proposals').update({ status: 'PENDING', reviewed_at: null }).eq('id', proposal.id);
    throw error;
  }
});

/**
 * POST /api/map/proposals/:id/reject
 */
router.post('/proposals/:id/reject', requireAdmin, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Proposition introuvable.' });
  const [updated] = unwrap(
    await db()
      .from('spot_proposals')
      .update({ status: 'REJECTED', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .eq('status', 'PENDING')
      .select()
  );
  if (!updated) {
    const exists = await findById('spot_proposals', req.params.id);
    return exists
      ? res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' })
      : res.status(404).json({ success: false, message: 'Proposition introuvable.' });
  }
  await audit(req, 'proposal.reject', updated.id, { name: updated.name });
  return res.json({ success: true, message: 'Proposition refusée.', data: toProposal(updated) });
});

/**
 * GET /api/map/cities
 * Unique list of cities in the directory
 */
router.get('/cities', async (req, res) => {
  const cities = await cached('map:cities', 10 * 60 * 1000, async () => {
    const rows = unwrap(await db().from('spots').select('city').limit(MAX_SPOTS));
    return [...new Set(rows.map((r) => r.city).filter((c) => c && c.trim()))].sort((a, b) => a.localeCompare(b, 'fr'));
  });
  return res.json({ success: true, data: cities });
});

export default router;
