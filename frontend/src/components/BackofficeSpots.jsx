import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Star,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Save,
  RefreshCw,
  SlidersHorizontal,
  Navigation,
  Stethoscope,
  Croissant,
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
} from 'lucide-react';
import {
  fetchSpots,
  fetchCities,
  createSpot,
  updateSpot,
  deleteSpot,
  toggleSpotVerification,
} from '../services/api';

const CATEGORIES = [
  { value: 'DOCTOR', labelFr: 'Médecin / Gastro / Pédiatre', labelAr: 'طبيب / اختصاصي', icon: Stethoscope, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'ARTISAN', labelFr: 'Boulangerie / Pâtisserie', labelAr: 'مخبزة / حلويات', icon: Croissant, color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'RESTAURANT', labelFr: 'Restaurant Sans Gluten', labelAr: 'مطعم بدون غلوتين', icon: UtensilsCrossed, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  { value: 'CAFE', labelFr: 'Café / Salon de thé', labelAr: 'مقهى / قاعة شاي', icon: Coffee, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  { value: 'SUPERMARKET', labelFr: 'Épicerie / Supermarché', labelAr: 'مغازة / متجر صحي', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];

const PRESET_COORDINATES = [
  { name: 'Tunis Centre', coords: [10.1815, 36.8065] },
  { name: 'Ariana', coords: [10.1972, 36.8522] },
  { name: 'La Marsa', coords: [10.3255, 36.8782] },
  { name: 'Sousse', coords: [10.6369, 35.8256] },
  { name: 'Sfax', coords: [10.7602, 34.7405] },
  { name: 'Bizerte', coords: [9.8739, 37.2744] },
  { name: 'Nabeul', coords: [10.7376, 36.4561] },
  { name: 'Djerba (Houmt Souk)', coords: [10.8572, 33.875] },
];

const EMPTY_SPOT_FORM = {
  name: '',
  category: 'RESTAURANT',
  city: 'Tunis',
  address: '',
  latitude: '36.8065',
  longitude: '10.1815',
  phone: '',
  speciality: '',
  hours: 'Lun-Sam: 09:00 - 19:00',
  rating: 4.8,
  reviewCount: 1,
  isVerified: true,
  notes: '',
  submittedBy: 'Backoffice Admin',
};

export default function BackofficeSpots({ lang = 'fr' }) {
  const [spots, setSpots] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState(null);

  // Filters
  const [filterQuery, setFilterQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCity, setFilterCity] = useState('ALL');
  const [filterVerified, setFilterVerified] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'PENDING'

  // Edit / Add Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SPOT_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Delete Confirmation Modal
  const [spotToDelete, setSpotToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Show auto-dismissing toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Load spots directly from MongoDB
  const loadSpots = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchSpots({
        category: 'ALL',
        city: 'ALL',
        isVerified: 'ALL',
      });
      if (res && res.data) {
        setSpots(res.data);
      }
      const cityRes = await fetchCities();
      if (cityRes && cityRes.data) {
        setCities(cityRes.data);
      }
    } catch (err) {
      console.error('Failed to load spots from database:', err);
      setErrorMsg('Erreur lors du chargement des adresses depuis la base de données MongoDB.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSpots();
  }, []);

  // Filtered view
  const filteredSpots = useMemo(() => {
    return spots.filter((spot) => {
      // Query filter
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        const matchName = spot.name?.toLowerCase().includes(q);
        const matchAddress = spot.address?.toLowerCase().includes(q);
        const matchNotes = spot.notes?.toLowerCase().includes(q);
        const matchSpeciality = spot.speciality?.toLowerCase().includes(q);
        if (!matchName && !matchAddress && !matchNotes && !matchSpeciality) return false;
      }
      // Category filter
      if (filterCategory !== 'ALL' && spot.category !== filterCategory) return false;
      // City filter
      if (filterCity !== 'ALL' && spot.city?.toLowerCase() !== filterCity.toLowerCase()) return false;
      // Verified filter
      if (filterVerified === 'VERIFIED' && !spot.isVerified) return false;
      if (filterVerified === 'PENDING' && spot.isVerified) return false;

      return true;
    });
  }, [spots, filterQuery, filterCategory, filterCity, filterVerified]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData(EMPTY_SPOT_FORM);
    setIsModalOpen(true);
  };

  // Open Edit Modal with full prefilled details
  const handleOpenEdit = (spot) => {
    setModalMode('edit');
    setEditingId(spot._id);
    const coords = spot.location?.coordinates || [10.1815, 36.8065];
    setFormData({
      name: spot.name || '',
      category: spot.category || 'RESTAURANT',
      city: spot.city || 'Tunis',
      address: spot.address || '',
      longitude: String(coords[0]),
      latitude: String(coords[1]),
      phone: spot.phone || '',
      speciality: spot.speciality || '',
      hours: spot.hours || '',
      rating: spot.rating !== undefined ? spot.rating : 4.8,
      reviewCount: spot.reviewCount !== undefined ? spot.reviewCount : 1,
      isVerified: Boolean(spot.isVerified),
      notes: spot.notes || '',
      submittedBy: spot.submittedBy || 'Backoffice Admin',
    });
    setIsModalOpen(true);
  };

  // Handle Form Submission (Create or Update directly in MongoDB)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.address.trim() || !formData.city.trim()) {
      alert('Veuillez remplir au moins le nom, la ville et l’adresse.');
      return;
    }

    const lng = parseFloat(formData.longitude);
    const lat = parseFloat(formData.latitude);
    if (isNaN(lng) || isNaN(lat)) {
      alert('Veuillez fournir des coordonnées GPS valides (Latitude et Longitude).');
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        city: formData.city.trim(),
        address: formData.address.trim(),
        coordinates: [lng, lat],
        phone: formData.phone.trim(),
        speciality: formData.speciality.trim(),
        hours: formData.hours.trim(),
        rating: Number(formData.rating) || 4.8,
        reviewCount: Number(formData.reviewCount) || 1,
        isVerified: Boolean(formData.isVerified),
        notes: formData.notes.trim(),
        submittedBy: formData.submittedBy.trim(),
      };

      if (modalMode === 'create') {
        const res = await createSpot(payload);
        if (res && res.success) {
          showToast(`Lieu "${res.data.name}" ajouté directement dans MongoDB !`);
          setIsModalOpen(false);
          loadSpots();
        } else {
          alert(res.message || "Erreur lors de l'ajout.");
        }
      } else {
        const res = await updateSpot(editingId, payload);
        if (res && res.success) {
          showToast(`Lieu "${res.data.name}" modifié avec succès dans MongoDB !`);
          setIsModalOpen(false);
          loadSpots();
        } else {
          alert(res.message || 'Erreur lors de la mise à jour.');
        }
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert("Erreur de communication avec le serveur lors de l'enregistrement.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick 1-click toggle for verification status
  const handleToggleVerify = async (spot) => {
    try {
      const newStatus = !spot.isVerified;
      const res = await toggleSpotVerification(spot._id, newStatus);
      if (res && res.success) {
        showToast(
          `Lieu "${spot.name}" marqué comme ${newStatus ? 'Vérifié ✅' : 'En attente ⏳'}.`
        );
        setSpots((prev) =>
          prev.map((s) => (s._id === spot._id ? { ...s, isVerified: newStatus } : s))
        );
      }
    } catch (err) {
      console.error('Verify toggle error:', err);
      alert('Erreur lors de la modification du statut.');
    }
  };

  // Delete spot directly from MongoDB
  const handleConfirmDelete = async () => {
    if (!spotToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteSpot(spotToDelete._id);
      if (res && res.success) {
        showToast(`Lieu "${spotToDelete.name}" supprimé définitivement de MongoDB.`, 'error');
        setSpots((prev) => prev.filter((s) => s._id !== spotToDelete._id));
        setSpotToDelete(null);
      } else {
        alert(res.message || 'Erreur lors de la suppression.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Erreur lors de la suppression dans la base de données.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 text-sm font-bold text-white transition-all transform duration-300 ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0" />
          ) : (
            <Check className="w-5 h-5 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Backoffice Header & Stats */}
      <div className="bg-gradient-to-r from-secondary-dark via-[#2d3a30] to-primary rounded-3xl p-6 sm:p-8 text-white shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-accent-light">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Backoffice Administratif</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Gestion Directe de la Base de Données (Spots & Adresses)
            </h1>
            <p className="text-sm sm:text-base text-canvas/80 max-w-2xl leading-relaxed">
              Ajoutez, modifiez ou supprimez n'importe quelle adresse répertoriée en Tunisie. Chaque
              action met à jour directement la collection <code className="bg-black/30 px-1.5 py-0.5 rounded text-accent-light font-mono">spots</code> de MongoDB.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleOpenCreate}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-accent text-white font-extrabold rounded-2xl shadow-lg hover:bg-accent-dark transition-all duration-200 active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>Ajouter un Nouveau Lieu</span>
            </button>
            <button
              onClick={loadSpots}
              title="Rafraîchir depuis la base"
              className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/15 text-center">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
            <span className="text-2xl font-black">{spots.length}</span>
            <p className="text-xs text-white/80 font-bold uppercase mt-0.5">Total Adresses</p>
          </div>
          <div className="bg-emerald-500/20 backdrop-blur-sm rounded-2xl p-3 border border-emerald-400/30">
            <span className="text-2xl font-black text-emerald-300">
              {spots.filter((s) => s.isVerified).length}
            </span>
            <p className="text-xs text-emerald-200 font-bold uppercase mt-0.5">Vérifiées</p>
          </div>
          <div className="bg-amber-500/20 backdrop-blur-sm rounded-2xl p-3 border border-amber-400/30">
            <span className="text-2xl font-black text-amber-300">
              {spots.filter((s) => !s.isVerified).length}
            </span>
            <p className="text-xs text-amber-200 font-bold uppercase mt-0.5">En Attente</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-3">
            <span className="text-2xl font-black">{cities.length}</span>
            <p className="text-xs text-white/80 font-bold uppercase mt-0.5">Gouvernorats / Villes</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-canvas-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Keyword search */}
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/60" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Rechercher par nom, adresse, médecin, notes..."
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-canvas-border bg-canvas/30 text-sm font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary/60 hover:text-secondary-dark text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-canvas-border bg-canvas/30 text-sm font-semibold text-secondary-dark focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Toutes Catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.labelFr}
              </option>
            ))}
          </select>

          {/* City Filter */}
          <select
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-canvas-border bg-canvas/30 text-sm font-semibold text-secondary-dark focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Toutes les Villes</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>

          {/* Verification Status */}
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-canvas-border bg-canvas/30 text-sm font-semibold text-secondary-dark focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="ALL">Tous Statuts</option>
            <option value="VERIFIED">Vérifiés uniquement</option>
            <option value="PENDING">En attente de vérification</option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-secondary pt-2 border-t border-canvas-border/50">
          <span>
            Affichage de <strong className="text-secondary-dark">{filteredSpots.length}</strong> sur{' '}
            {spots.length} lieux enregistrés
          </span>
          {(filterQuery || filterCategory !== 'ALL' || filterCity !== 'ALL' || filterVerified !== 'ALL') && (
            <button
              onClick={() => {
                setFilterQuery('');
                setFilterCategory('ALL');
                setFilterCity('ALL');
                setFilterVerified('ALL');
              }}
              className="text-primary hover:text-primary-dark font-bold underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {/* Spots List / Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="font-semibold text-sm">Chargement des données MongoDB...</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-800">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="font-bold">{errorMsg}</p>
        </div>
      ) : filteredSpots.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-canvas-border">
          <MapPin className="w-10 h-10 text-secondary/40 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-secondary-dark mb-1">Aucun lieu correspondant</h3>
          <p className="text-sm text-secondary mb-4">
            Aucune adresse ne correspond aux critères de filtre sélectionnés.
          </p>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow hover:bg-primary-dark"
          >
            Créer un nouveau lieu
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredSpots.map((spot) => {
            const catObj = CATEGORIES.find((c) => c.value === spot.category) || CATEGORIES[2];
            const IconComponent = catObj.icon;
            const coords = spot.location?.coordinates || [0, 0];
            const googleMapsUrl = `https://www.google.com/maps?q=${coords[1]},${coords[0]}`;

            return (
              <div
                key={spot._id}
                className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                  spot.isVerified
                    ? 'border-canvas-border hover:border-primary/50'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                {/* Spot Details */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category pill */}
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${catObj.color}`}
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      {catObj.labelFr}
                    </span>

                    {/* City pill */}
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-canvas text-secondary-dark border border-canvas-border">
                      📍 {spot.city}
                    </span>

                    {/* Verification Badge with 1-click toggle */}
                    <button
                      onClick={() => handleToggleVerify(spot)}
                      title="Cliquer pour changer le statut"
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold transition-all ${
                        spot.isVerified
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}
                    >
                      {spot.isVerified ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Vérifié</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>En attente de vérification</span>
                        </>
                      )}
                    </button>

                    {/* Rating */}
                    {spot.rating && (
                      <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {spot.rating} ({spot.reviewCount || 1} avis)
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base sm:text-lg font-extrabold text-secondary-dark truncate">
                      {spot.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-secondary font-medium">
                      {spot.address}
                    </p>
                  </div>

                  {/* Speciality and Notes */}
                  {(spot.speciality || spot.notes) && (
                    <div className="text-xs text-secondary-dark/80 bg-canvas/40 p-2.5 rounded-xl border border-canvas-border/50 space-y-1">
                      {spot.speciality && (
                        <p>
                          <strong>Spécialité :</strong> {spot.speciality}
                        </p>
                      )}
                      {spot.notes && (
                        <p className="text-secondary italic">
                          "{spot.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Metadata Bar */}
                  <div className="flex items-center gap-4 text-xs text-secondary flex-wrap pt-1">
                    {spot.phone && (
                      <span className="flex items-center gap-1 font-semibold text-secondary-dark">
                        <Phone className="w-3 h-3 text-primary" />
                        {spot.phone}
                      </span>
                    )}
                    {spot.hours && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-secondary" />
                        {spot.hours}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-secondary/70">
                      GPS: [{coords[1]?.toFixed(4)}, {coords[0]?.toFixed(4)}]
                    </span>
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-semibold text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Voir sur Maps
                    </a>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex md:flex-col items-center gap-2 shrink-0 w-full md:w-auto justify-end pt-3 md:pt-0 border-t md:border-t-0 border-canvas-border/50">
                  <button
                    onClick={() => handleOpenEdit(spot)}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => setSpotToDelete(spot)}
                    className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ADD / EDIT SPOT MODAL (FULL DETAILS) */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-canvas-border my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-canvas-border mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  {modalMode === 'create' ? <Plus className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-secondary-dark">
                    {modalMode === 'create' ? 'Ajouter un Lieu dans MongoDB' : 'Modifier les Détails du Lieu'}
                  </h2>
                  <p className="text-xs text-secondary font-medium">
                    Toutes les modifications sont immédiatement appliquées dans la base de données.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-canvas flex items-center justify-center text-secondary hover:text-secondary-dark font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-xs sm:text-sm">
              {/* Name */}
              <div>
                <label className="block font-bold text-secondary-dark mb-1">
                  Nom du lieu / Établissement <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Maison Sans Gluten, Dr. Trabelsi, Restaurant Safir..."
                  className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Category & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-secondary-dark mb-1">
                    Catégorie <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none font-semibold"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.labelFr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-secondary-dark mb-1">
                    Gouvernorat / Ville <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="ex: Tunis, Ariana, Sousse, Sfax..."
                    className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block font-bold text-secondary-dark mb-1">
                  Adresse complète <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="ex: 15 Rue Ibn Khaldoun, Centre Urbain Nord..."
                  className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Coordinates GPS [Lng, Lat] with presets */}
              <div className="bg-canvas/40 p-4 rounded-2xl border border-canvas-border space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-secondary-dark flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-primary" />
                    <span>Coordonnées GPS [Longitude, Latitude]</span>
                  </label>
                  <span className="text-[11px] text-secondary">Requis pour l'affichage Leaflet</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-secondary block mb-0.5">Latitude (Nord)</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      placeholder="36.8065"
                      className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-white font-mono text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-secondary block mb-0.5">Longitude (Est)</span>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      placeholder="10.1815"
                      className="w-full px-3 py-2 rounded-lg border border-canvas-border bg-white font-mono text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <span className="text-[11px] font-bold text-secondary block mb-1">
                    Préréglages rapides de villes :
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COORDINATES.map((preset) => (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() =>
                          setFormData({
                            ...formData,
                            longitude: String(preset.coords[0]),
                            latitude: String(preset.coords[1]),
                            city: preset.name.split(' ')[0],
                          })
                        }
                        className="px-2 py-0.5 bg-white hover:bg-primary hover:text-white text-secondary-dark rounded-md text-[11px] font-medium border border-canvas-border transition-colors"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phone & Speciality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-secondary-dark mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+216 71 000 000"
                    className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-secondary-dark mb-1">
                    Spécialité / Sous-titre
                  </label>
                  <input
                    type="text"
                    value={formData.speciality}
                    onChange={(e) => setFormData({ ...formData, speciality: e.target.value })}
                    placeholder="ex: Pains & Pâtisseries certifiés, Gastro-entérologie..."
                    className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Hours, Rating, ReviewCount */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-secondary-dark mb-1">Horaires</label>
                  <input
                    type="text"
                    value={formData.hours}
                    onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                    placeholder="Lun-Sam: 09:00 - 18:00"
                    className="w-full px-3 py-2 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-secondary-dark mb-1">Note (1-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="5"
                    value={formData.rating}
                    onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-secondary-dark mb-1">Nombre d'avis</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reviewCount}
                    onChange={(e) => setFormData({ ...formData, reviewCount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-secondary-dark mb-1">
                  Notes & Conseils de sécurité cœliaque
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Protocole de non-contamination, farine certifiée, laboratoire dédié..."
                  className="w-full px-4 py-2.5 rounded-xl border border-canvas-border focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              {/* Verification Toggle & Author */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-canvas/30 rounded-2xl border border-canvas-border">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVerified}
                    onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                    className="w-5 h-5 rounded border-canvas-border text-primary focus:ring-primary"
                  />
                  <div>
                    <span className="font-extrabold text-secondary-dark block">
                      Marquer comme Vérifié
                    </span>
                    <span className="text-[11px] text-secondary">
                      Les adresses vérifiées affichent le badge vert officiel sur la carte.
                    </span>
                  </div>
                </label>

                <div className="w-full sm:w-auto">
                  <span className="text-[11px] text-secondary font-bold block mb-0.5">Auteur</span>
                  <input
                    type="text"
                    value={formData.submittedBy}
                    onChange={(e) => setFormData({ ...formData, submittedBy: e.target.value })}
                    className="px-3 py-1.5 rounded-lg border border-canvas-border bg-white text-xs"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-canvas-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-canvas hover:bg-canvas-border text-secondary-dark font-bold rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dark text-white font-extrabold rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{formSubmitting ? 'Enregistrement...' : 'Enregistrer dans MongoDB'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {spotToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-canvas-border text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-black text-secondary-dark">
                Supprimer définitivement ce lieu ?
              </h3>
              <p className="text-xs text-secondary mt-1">
                Êtes-vous sûr de vouloir supprimer{' '}
                <strong className="text-secondary-dark">"{spotToDelete.name}"</strong> ({spotToDelete.city}) ?
                Cette action supprimera l'enregistrement directement de la base MongoDB.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSpotToDelete(null)}
                className="flex-1 py-2.5 bg-canvas hover:bg-canvas-border text-secondary-dark font-bold rounded-xl text-xs"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? 'Suppression...' : 'Oui, Supprimer de MongoDB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
