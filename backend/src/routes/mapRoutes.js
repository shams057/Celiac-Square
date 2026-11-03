import express from 'express';
import { Spot } from '../models/Spot.js';
import { containsRegex, escapeRegExp } from '../utils/regex.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { SpotProposal } from '../models/SpotProposal.js';

const router = express.Router();

/**
 * GET /api/map/spots
 * Filters: category, city, isVerified, q (search query)
 */
router.get('/spots', async (req, res) => {
  try {
    const { category, city, isVerified, q } = req.query;
    const filter = {};

    if (category && category !== 'ALL') {
      filter.category = category.toUpperCase();
    }

    if (city && city !== 'ALL') {
      filter.city = new RegExp(`^${escapeRegExp(city)}$`, 'i');
    }

    if (isVerified !== undefined && isVerified !== '' && isVerified !== 'ALL') {
      filter.isVerified = isVerified === 'true';
    }

    if (q && q.trim().length > 0) {
      filter.$or = [
        { name: containsRegex(q.trim()) },
        { address: containsRegex(q.trim()) },
        { speciality: containsRegex(q.trim()) },
        { notes: containsRegex(q.trim()) },
      ];
    }

    const spots = await Spot.find(filter).sort({ isVerified: -1, rating: -1 });
    return res.json({
      success: true,
      count: spots.length,
      data: spots,
    });
  } catch (error) {
    console.error(`[Map Routes] Error fetching spots: ${error.message}`);
    // Return empty list or memory fallback
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des adresses de la carte.',
      error: error.message,
    });
  }
});

/**
 * GET /api/map/spots/:id
 */
router.get('/spots/:id', async (req, res) => {
  try {
    const spot = await Spot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Lieu non trouvé.' });
    }
    return res.json({ success: true, data: spot });
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
    const {
      name,
      category,
      coordinates,
      city,
      address,
      phone,
      speciality,
      hours,
      rating,
      reviewCount,
      isVerified,
      notes,
      submittedBy,
    } = req.body;

    if (!name || !category || !coordinates || !city || !address) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez renseigner les champs obligatoires (nom, catégorie, ville, coordonnées, adresse).',
      });
    }

    const newSpot = new Spot({
      name: name.trim(),
      category: category.toUpperCase(),
      location: {
        type: 'Point',
        coordinates: [Number(coordinates[0]), Number(coordinates[1])], // [lng, lat]
      },
      city: city.trim(),
      address: address.trim(),
      phone: phone ? phone.trim() : '',
      speciality: speciality ? speciality.trim() : '',
      hours: hours ? hours.trim() : '',
      rating: rating !== undefined ? Number(rating) : undefined,
      reviewCount: reviewCount !== undefined ? Number(reviewCount) : undefined,
      isVerified: isVerified !== undefined ? Boolean(isVerified) : true,
      notes: notes ? notes.trim() : '',
      submittedBy: submittedBy || 'Backoffice Admin',
    });

    const savedSpot = await newSpot.save();
    return res.status(201).json({
      success: true,
      message: 'Lieu enregistré avec succès dans la base de données.',
      data: savedSpot,
    });
  } catch (error) {
    console.error(`[Map Routes] Spot creation error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement de l'adresse dans la base de données.",
      error: error.message,
    });
  }
});

/**
 * PUT /api/map/spots/:id
 * Full modification of any spot details directly in MongoDB
 */
router.put('/spots/:id', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      category,
      coordinates,
      city,
      address,
      phone,
      speciality,
      hours,
      rating,
      reviewCount,
      isVerified,
      notes,
      submittedBy,
    } = req.body;

    const spot = await Spot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Lieu introuvable dans la base de données.' });
    }

    if (name !== undefined) spot.name = name.trim();
    if (category !== undefined) spot.category = category.toUpperCase();
    if (coordinates !== undefined && Array.isArray(coordinates) && coordinates.length === 2) {
      spot.location = {
        type: 'Point',
        coordinates: [Number(coordinates[0]), Number(coordinates[1])],
      };
    }
    if (city !== undefined) spot.city = city.trim();
    if (address !== undefined) spot.address = address.trim();
    if (phone !== undefined) spot.phone = phone.trim();
    if (speciality !== undefined) spot.speciality = speciality.trim();
    if (hours !== undefined) spot.hours = hours.trim();
    if (rating !== undefined) spot.rating = Number(rating);
    if (reviewCount !== undefined) spot.reviewCount = Number(reviewCount);
    if (isVerified !== undefined) spot.isVerified = Boolean(isVerified);
    if (notes !== undefined) spot.notes = notes.trim();
    if (submittedBy !== undefined) spot.submittedBy = submittedBy.trim();

    const updated = await spot.save();
    return res.json({
      success: true,
      message: 'Lieu mis à jour avec succès dans MongoDB.',
      data: updated,
    });
  } catch (error) {
    console.error(`[Map Routes] Update error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du lieu.',
      error: error.message,
    });
  }
});

/**
 * DELETE /api/map/spots/:id
 * Permanently delete a spot from MongoDB
 */
router.delete('/spots/:id', requireAdmin, async (req, res) => {
  try {
    const deleted = await Spot.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    }
    return res.json({
      success: true,
      message: 'Lieu supprimé définitivement de la base de données MongoDB.',
      data: deleted,
    });
  } catch (error) {
    console.error(`[Map Routes] Delete error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du lieu.',
      error: error.message,
    });
  }
});

/**
 * PATCH /api/map/spots/:id/verify
 * Quick toggle verification status
 */
router.patch('/spots/:id/verify', requireAdmin, async (req, res) => {
  try {
    const spot = await Spot.findById(req.params.id);
    if (!spot) {
      return res.status(404).json({ success: false, message: 'Lieu introuvable.' });
    }
    spot.isVerified = req.body.isVerified !== undefined ? Boolean(req.body.isVerified) : !spot.isVerified;
    const updated = await spot.save();
    return res.json({
      success: true,
      message: `Statut vérifié mis à jour (${updated.isVerified ? 'Vérifié' : 'En attente'}).`,
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

const PROPOSAL_FIELDS = ['name', 'category', 'city', 'address', 'phone', 'speciality', 'hours', 'notes', 'submittedBy'];
const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * POST /api/map/proposals
 * Public: suggest a spot. It goes to the admin inbox, not to the map.
 */
router.post('/proposals', async (req, res) => {
  try {
    const data = {};
    PROPOSAL_FIELDS.forEach((f) => {
      data[f] = clean(req.body[f]);
    });
    data.category = data.category.toUpperCase();

    if (!data.name || !data.category || !data.city || !data.address) {
      return res.status(400).json({
        success: false,
        message: 'Veuillez renseigner le nom, le type de lieu, la ville et l’adresse.',
      });
    }
    const coords = req.body.coordinates;
    if (Array.isArray(coords) && coords.length === 2 && coords.every((c) => Number.isFinite(Number(c)))) {
      data.coordinates = [Number(coords[0]), Number(coords[1])];
    }

    const proposal = await SpotProposal.create(data);
    return res.status(201).json({
      success: true,
      message: 'Adresse envoyée. Elle sera publiée après vérification.',
      data: { _id: proposal._id, name: proposal.name },
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
    const filter = status === 'ALL' ? {} : { status };
    const proposals = await SpotProposal.find(filter).sort({ createdAt: -1 });
    const pendingCount = await SpotProposal.countDocuments({ status: 'PENDING' });
    return res.json({ success: true, count: proposals.length, pendingCount, data: proposals });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/map/proposals/:id/approve
 * Creates the verified Spot. The body may override any field (e.g. exact coordinates).
 */
router.post('/proposals/:id/approve', requireAdmin, async (req, res) => {
  try {
    const proposal = await SpotProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposition introuvable.' });
    }
    if (proposal.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' });
    }

    const body = req.body || {};
    const pick = (f) => (body[f] !== undefined ? clean(String(body[f])) : proposal[f]);
    const coords = Array.isArray(body.coordinates) && body.coordinates.length === 2 ? body.coordinates : proposal.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2 || !coords.every((c) => Number.isFinite(Number(c)))) {
      return res.status(400).json({ success: false, message: 'Indiquez la position (latitude et longitude) du lieu.' });
    }

    const spot = await Spot.create({
      name: pick('name'),
      category: pick('category').toUpperCase(),
      city: pick('city'),
      address: pick('address'),
      phone: pick('phone'),
      speciality: pick('speciality'),
      hours: pick('hours'),
      notes: pick('notes'),
      submittedBy: pick('submittedBy') || 'Communauté',
      location: { type: 'Point', coordinates: [Number(coords[0]), Number(coords[1])] },
      isVerified: true,
    });

    proposal.status = 'APPROVED';
    proposal.reviewedAt = new Date();
    proposal.spot = spot._id;
    await proposal.save();

    return res.json({ success: true, message: 'Adresse validée et publiée sur la carte.', data: spot });
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
    const proposal = await SpotProposal.findById(req.params.id);
    if (!proposal) {
      return res.status(404).json({ success: false, message: 'Proposition introuvable.' });
    }
    if (proposal.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Cette proposition a déjà été traitée.' });
    }
    proposal.status = 'REJECTED';
    proposal.reviewedAt = new Date();
    await proposal.save();
    return res.json({ success: true, message: 'Proposition refusée.', data: proposal });
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
 * Returns unique list of cities in the directory
 */
router.get('/cities', async (req, res) => {
  try {
    const cities = await Spot.distinct('city');
    const validCities = cities.filter((c) => c && c.trim().length > 0).sort();
    return res.json({ success: true, data: validCities });
  } catch (error) {
    console.error(`[Map Routes] Error fetching cities: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du chargement des villes.',
      error: error.message,
    });
  }
});

export default router;
