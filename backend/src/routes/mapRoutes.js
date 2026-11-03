import express from 'express';
import { db, unwrap } from '../config/db.js';
import { toSpot, toProposal } from '../models/mappers.js';
import { containsPattern, exactPattern } from '../utils/regex.js';
import { requireAdmin } from '../middleware/adminAuth.js';

const router = express.Router();

const CATEGORIES = ['DOCTOR', 'CAFE', 'RESTAURANT', 'ARTISAN', 'SUPERMARKET'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const validCoords = (c) => Array.isArray(c) && c.length === 2 && c.every((n) => n !== '' && Number.isFinite(Number(n)));

// Unknown or malformed ids answer 404 instead of a database error
const findById = async (table, id) => {
  if (!UUID_RE.test(id)) return null;
  const [row] = unwrap(await db().from(table).select('*').eq('id', id).limit(1));
  return row || null;
};

/** Request body (camelCase, as sent by the backoffice) to spots columns; only fields present are set */
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
  if (body.rating !== undefined) row.rating = Number(body.rating);
  if (body.reviewCount !== undefined) row.review_count = Number(body.reviewCount);
  if (body.isVerified !== undefined) row.is_verified = Boolean(body.isVerified);
  if (validCoords(body.coordinates)) {
    row.lng = Number(body.coordinates[0]);
    row.lat = Number(body.coordinates[1]);
  }
  return row;
};

/**
 * GET /api/map/spots
 * Filters: category, city, isVerified, q (search query)
 */
router.get('/spots', async (req, res) => {
  try {
    const { category, city, isVerified, q } = req.query;
    let query = db().from('spots').select('*').order('is_verified', { ascending: false }).order('rating', { ascending: false });

    if (category && category !== 'ALL') query = query.eq('category', category.toUpperCase());
    if (city && city !== 'ALL') query = query.ilike('city', exactPattern(city));
    if (isVerified !== undefined && isVerified !== '' && isVerified !== 'ALL') query = query.eq('is_verified', isVerified === 'true');
    if (q && q.trim()) query = query.ilike('search_text', containsPattern(q.trim()));

    const spots = unwrap(await query).map(toSpot);
    return res.json({ success: true, count: spots.length, data: spots });
  } catch (error) {
    console.error(`[Map Routes] Error fetching spots: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Erreur lors du chargement des adresses de la carte.' });
  }
});

/**
 * GET /api/map/spots/:id
 */
router.get('/spots/:id', async (req, res) => {
  try {
    const spot = await findById('spots', req.params.id);
    if (!spot) return res.status(404).json({ success: false, message: 'Lieu non trouvé.' });
    return res.json({ success: true, data: toSpot(spot) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/map/spots
 * Create a spot directly (backoffice). The public goes through /proposals.
 */
router.post('/spots', requireAdmin, async (req, res) => {
  try {
    const row = spotFields(req.body);
    if (!row.name || !row.category || row.lng === undefined || !row.city || !row.address) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez renseigner les champs obligatoires (nom, catégorie, ville, coordonnées, adresse).',
      });
    }
    if (!CATEGORIES.includes(row.category)) {
      return res.status(400).json({ success: false, message: 'Catégorie inconnue.' });
    }
    if (row.is_verified === undefined) row.is_verified = true;
    if (!row.submitted_by) row.submitted_by = 'Backoffice Admin';

    const [saved] = unwrap(await db().from('spots').insert(row).select());
    return res.status(201).json({ success: true, message: 'Lieu enregistré avec succès.', data: toSpot(saved) });
  } catch (error) {
    console.error(`[Map Routes] Spot creation error: ${error.message}`);
    return res.status(500).json({ success: false, message: "Erreur lors de l'enregistrement de l'adresse.", error: error.message });
  }
});

/**
 * PUT /api/map/spots/:id
 * Update any spot field
 */
router.put('/spots/:id', requireAdmin, async (req, res) => {
  try {
    if (!(await findById('spots', req.params.id))) {
      return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    }
    const [updated] = unwrap(await db().from('spots').update(spotFields(req.body)).eq('id', req.params.id).select());
    return res.json({ success: true, message: 'Lieu mis à jour avec succès.', data: toSpot(updated) });
  } catch (error) {
    console.error(`[Map Routes] Update error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Erreur lors de la modification du lieu.', error: error.message });
  }
});

/**
 * DELETE /api/map/spots/:id
 */
router.delete('/spots/:id', requireAdmin, async (req, res) => {
  try {
    if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    const [deleted] = unwrap(await db().from('spots').delete().eq('id', req.params.id).select());
    if (!deleted) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    return res.json({ success: true, message: 'Lieu supprimé définitivement.', data: toSpot(deleted) });
  } catch (error) {
    console.error(`[Map Routes] Delete error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Erreur lors de la suppression du lieu.', error: error.message });
  }
});

/**
 * PATCH /api/map/spots/:id/verify
 * Toggle (or set) the verification status
 */
router.patch('/spots/:id/verify', requireAdmin, async (req, res) => {
  try {
    const spot = await findById('spots', req.params.id);
    if (!spot) return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    const isVerified = req.body.isVerified !== undefined ? Boolean(req.body.isVerified) : !spot.is_verified;
    const [updated] = unwrap(await db().from('spots').update({ is_verified: isVerified }).eq('id', spot.id).select());
    return res.json({
      success: true,
      message: `Statut vérifié mis à jour (${updated.is_verified ? 'Vérifié' : 'En attente'}).`,
      data: toSpot(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const PROPOSAL_FIELDS = ['name', 'category', 'city', 'address', 'phone', 'speciality', 'hours', 'notes'];

/**
 * POST /api/map/proposals
 * Public: suggest a spot. It goes to the admin inbox, not to the map.
 */
router.post('/proposals', async (req, res) => {
  try {
    const row = {};
    PROPOSAL_FIELDS.forEach((f) => {
      row[f] = clean(req.body[f]);
    });
    row.category = row.category.toUpperCase();
    row.submitted_by = clean(req.body.submittedBy);

    if (!row.name || !row.category || !row.city || !row.address) {
      return res.status(400).json({ success: false, message: 'Veuillez renseigner le nom, le type de lieu, la ville et l’adresse.' });
    }
    if (!CATEGORIES.includes(row.category)) {
      return res.status(400).json({ success: false, message: 'Type de lieu inconnu.' });
    }
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
  } catch (error) {
    console.error(`[Map Routes] Proposal error: ${error.message}`);
    return res.status(500).json({ success: false, message: "L'adresse n'a pas pu être enregistrée." });
  }
});

/**
 * GET /api/map/proposals?status=PENDING|APPROVED|REJECTED|ALL
 * Admin inbox
 */
router.get('/proposals', requireAdmin, async (req, res) => {
  try {
    const status = (req.query.status || 'PENDING').toUpperCase();
    let query = db().from('spot_proposals').select('*').order('created_at', { ascending: false });
    if (status !== 'ALL') query = query.eq('status', status);
    const [proposals, pending] = await Promise.all([
      query,
      db().from('spot_proposals').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ]);
    const data = unwrap(proposals).map(toProposal);
    if (pending.error) throw new Error(pending.error.message);
    return res.json({ success: true, count: data.length, pendingCount: pending.count ?? 0, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/map/proposals/:id/approve
 * Creates the verified spot. The body may override any field (e.g. exact coordinates).
 */
router.post('/proposals/:id/approve', requireAdmin, async (req, res) => {
  try {
    const proposal = await findById('spot_proposals', req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: 'Proposition introuvable.' });
    if (proposal.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' });
    }

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
      is_verified: true,
    };
    if (row.lng == null || row.lat == null) {
      return res.status(400).json({ success: false, message: 'Indiquez la position (latitude et longitude) du lieu.' });
    }

    const [spot] = unwrap(await db().from('spots').insert(row).select());
    unwrap(
      await db()
        .from('spot_proposals')
        .update({ status: 'APPROVED', reviewed_at: new Date().toISOString(), spot_id: spot.id })
        .eq('id', proposal.id)
        .eq('status', 'PENDING')
    );
    return res.json({ success: true, message: 'Adresse validée et publiée sur la carte.', data: toSpot(spot) });
  } catch (error) {
    console.error(`[Map Routes] Approve error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/map/proposals/:id/reject
 */
router.post('/proposals/:id/reject', requireAdmin, async (req, res) => {
  try {
    const proposal = await findById('spot_proposals', req.params.id);
    if (!proposal) return res.status(404).json({ success: false, message: 'Proposition introuvable.' });
    if (proposal.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' });
    }
    const [updated] = unwrap(
      await db()
        .from('spot_proposals')
        .update({ status: 'REJECTED', reviewed_at: new Date().toISOString() })
        .eq('id', proposal.id)
        .select()
    );
    return res.json({ success: true, message: 'Proposition refusée.', data: toProposal(updated) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/map/admin/check
 * Lets the backoffice validate an admin token
 */
router.get('/admin/check', requireAdmin, (req, res) => {
  return res.json({ success: true });
});

/**
 * GET /api/map/cities
 * Unique list of cities in the directory
 */
router.get('/cities', async (req, res) => {
  try {
    const rows = unwrap(await db().from('spots').select('city'));
    const cities = [...new Set(rows.map((r) => r.city).filter((c) => c && c.trim()))].sort((a, b) => a.localeCompare(b, 'fr'));
    return res.json({ success: true, data: cities });
  } catch (error) {
    console.error(`[Map Routes] Error fetching cities: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Erreur lors du chargement des villes.' });
  }
});

export default router;
