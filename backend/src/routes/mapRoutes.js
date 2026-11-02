import express from 'express';
import { Spot } from '../models/Spot.js';

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
      filter.city = new RegExp(`^${city}$`, 'i');
    }

    if (isVerified !== undefined && isVerified !== '' && isVerified !== 'ALL') {
      filter.isVerified = isVerified === 'true';
    }

    if (q && q.trim().length > 0) {
      filter.$or = [
        { name: new RegExp(q.trim(), 'i') },
        { address: new RegExp(q.trim(), 'i') },
        { speciality: new RegExp(q.trim(), 'i') },
        { notes: new RegExp(q.trim(), 'i') },
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
 * Create a new gluten-free spot directly in the database
 */
router.post('/spots', async (req, res) => {
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
      rating: rating !== undefined ? Number(rating) : 4.8,
      reviewCount: reviewCount !== undefined ? Number(reviewCount) : 1,
      isVerified: isVerified !== undefined ? Boolean(isVerified) : true, // Default to verified when created via admin/backoffice
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
router.put('/spots/:id', async (req, res) => {
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
router.delete('/spots/:id', async (req, res) => {
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
router.patch('/spots/:id/verify', async (req, res) => {
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
