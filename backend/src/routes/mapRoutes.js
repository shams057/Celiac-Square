import express from 'express';
import { Spot } from '../models/Spot.js';

const router = express.Router();

// Fallback in-memory spots if DB is not populated
let localSpotsMemory = [];

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

    if (isVerified !== undefined && isVerified !== '') {
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
 * User submission modal for new gluten-free spots in Tunisia (subject to admin verification)
 */
router.post('/spots', async (req, res) => {
  try {
    const { name, category, coordinates, city, address, phone, speciality, hours, notes } = req.body;

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
      notes: notes ? notes.trim() : '',
      isVerified: false, // Subject to admin verification
      submittedBy: req.body.submittedBy || 'Visiteur du site',
    });

    const savedSpot = await newSpot.save();
    return res.status(201).json({
      success: true,
      message: 'Votre proposition a été enregistrée avec succès et sera vérifiée par notre équipe.',
      data: savedSpot,
    });
  } catch (error) {
    console.error(`[Map Routes] Spot submission error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: "Erreur lors de l'enregistrement de l'adresse.",
      error: error.message,
    });
  }
});

/**
 * GET /api/map/cities
 * Returns unique list of cities in the directory
 */
router.get('/cities', async (req, res) => {
  try {
    const cities = await Spot.distinct('city');
    return res.json({ success: true, data: cities.sort() });
  } catch (error) {
    return res.json({
      success: true,
      data: ['Tunis', 'Ariana', 'La Marsa', 'Sousse', 'Sfax', 'Bizerte', 'Nabeul', 'Monastir', 'Djerba'],
    });
  }
});

export default router;
