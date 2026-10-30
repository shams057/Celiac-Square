import React, { useState } from 'react';
import { X, MapPin, PlusCircle, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { submitSpot } from '../services/api';

const CITY_COORDINATES = {
  Tunis: [10.1815, 36.8065],
  Ariana: [10.1972, 36.8522],
  'La Marsa': [10.3236, 36.8781],
  Sousse: [10.6369, 35.8256],
  Sfax: [10.7602, 34.7405],
  Bizerte: [9.8739, 37.2744],
  Nabeul: [10.7329, 36.4561],
  Monastir: [10.8261, 35.7779],
  Djerba: [10.8573, 33.875],
  Kairouan: [10.0963, 35.6781],
  Gabès: [10.1005, 33.8815],
};

export default function SpotModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'ARTISAN',
    city: 'Tunis',
    address: '',
    phone: '',
    speciality: '',
    hours: '',
    notes: '',
    submittedBy: '',
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.address) {
      setErrorMsg('Veuillez renseigner au moins le nom et l’adresse.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Pick coordinates from selected city with small jitter if not entered
      const defaultCoords = CITY_COORDINATES[formData.city] || [10.1815, 36.8065];
      const payload = {
        ...formData,
        coordinates: [
          defaultCoords[0] + (Math.random() - 0.5) * 0.02,
          defaultCoords[1] + (Math.random() - 0.5) * 0.02,
        ],
      };

      const res = await submitSpot(payload);
      if (res && res.success) {
        setSuccessMsg(res.message || 'Adresse transmise avec succès !');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1800);
      } else {
        setErrorMsg(res.message || 'Erreur lors de la soumission.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Erreur lors de l’envoi de l’adresse.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#FAF8F2] w-full max-w-xl rounded-3xl p-6 sm:p-8 border border-canvas-border shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-secondary hover:bg-canvas transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-secondary-dark">
              Proposer une Adresse en Tunisie
            </h2>
            <p className="text-xs text-secondary">
              Aidez la communauté cœliaque tunisienne. Chaque lieu est vérifié avant publication.
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-4 mb-4 rounded-2xl bg-primary/15 border border-primary/30 text-primary-dark text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-4 mb-4 rounded-2xl bg-status-unsafe/15 border border-status-unsafe/30 text-status-unsafe text-sm flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold text-secondary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-secondary-dark font-bold">
                Nom du lieu ou du médecin *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Boulangerie Épi d'Or / Dr. Trabelsi"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-secondary-dark font-bold">Catégorie *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="ARTISAN">Boulangerie / Pâtisserie Sans Gluten</option>
                <option value="DOCTOR">Médecin Spécialiste Cœliaque</option>
                <option value="RESTAURANT">Restaurant / Pizzeria</option>
                <option value="CAFE">Café / Salon de thé</option>
                <option value="SUPERMARKET">Supermarché / Rayon dédié</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-secondary-dark font-bold">Ville en Tunisie *</label>
              <select
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
              >
                {Object.keys(CITY_COORDINATES).map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-1.5 text-secondary-dark font-bold">Numéro de Téléphone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+216 71 000 000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-secondary-dark font-bold">Adresse Complète *</label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Ex: 12 Rue Habib Bourguiba, La Marsa"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1.5 text-secondary-dark font-bold">Spécialité / Menu GF</label>
              <input
                type="text"
                value={formData.speciality}
                onChange={(e) => setFormData({ ...formData, speciality: e.target.value })}
                placeholder="Ex: Pains sans gluten, Malsouka, Pizzas dédiées"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-secondary-dark font-bold">Horaires d'Ouverture</label>
              <input
                type="text"
                value={formData.hours}
                onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                placeholder="Ex: Lun-Sam: 08:00 - 19:30"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-secondary-dark font-bold">Notes & Précautions</label>
            <textarea
              rows="3"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Ex: Cuisine séparée, four dédié, propriétaire sensibilisé à la contamination croisée..."
              className="w-full px-3.5 py-2 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
            ></textarea>
          </div>

          <div>
            <label className="block mb-1.5 text-secondary-dark font-bold">Votre Nom ou Pseudo (Facultatif)</label>
            <input
              type="text"
              value={formData.submittedBy}
              onChange={(e) => setFormData({ ...formData, submittedBy: e.target.value })}
              placeholder="Ex: Yasmine - Membre ATC"
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-canvas-border text-secondary-dark focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-canvas-border/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-canvas-border text-secondary-dark hover:bg-canvas font-bold text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-accent text-white hover:bg-accent-dark font-bold text-xs shadow flex items-center gap-2 active:scale-95 transition-all"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              <span>Soumettre pour Vérification</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
