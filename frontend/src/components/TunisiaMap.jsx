import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  MapPin,
  Stethoscope,
  Croissant,
  UtensilsCrossed,
  Coffee,
  ShoppingBag,
  Star,
  Clock,
  Phone,
  CheckCircle2,
  Filter,
  PlusCircle,
  Search,
  Navigation,
} from 'lucide-react';
import { fetchSpots, fetchCities } from '../services/api';

// Create custom DOM / SVG marker icons for each category
const createCategoryIcon = (category, isVerified) => {
  let bgColor = '#8BA850'; // Default Sage Green
  let iconHtml = '📍';

  if (category === 'DOCTOR') {
    bgColor = '#2B6CB0'; // Medical Blue
    iconHtml = '🩺';
  } else if (category === 'ARTISAN') {
    bgColor = '#756452'; // Earthy Brown Bakery
    iconHtml = '🥐';
  } else if (category === 'RESTAURANT') {
    bgColor = '#FF8A41'; // Vibrant Orange Restaurant
    iconHtml = '🍽️';
  } else if (category === 'CAFE') {
    bgColor = '#D97706'; // Amber Cafe
    iconHtml = '☕';
  } else if (category === 'SUPERMARKET') {
    bgColor = '#059669'; // Emerald Supermarket
    iconHtml = '🛒';
  }

  const borderClass = isVerified ? 'border-2 border-white ring-2 ring-primary' : 'border border-white/80';

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="background-color: ${bgColor};" class="w-9 h-9 rounded-full flex items-center justify-center text-white text-base shadow-lg ${borderClass} transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform">
        <span>${iconHtml}</span>
        ${isVerified ? '<span style="position:absolute; bottom:-2px; right:-2px; background:#8BA850; border-radius:50%; width:12px; height:12px; border:2px solid white;"></span>' : ''}
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

// Map controller component to pan and zoom programmatically
function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom, { duration: 1.2 });
    }
  }, [center, zoom, map]);
  return null;
}

export default function TunisiaMap({ onOpenSubmitModal, lang }) {
  const [spots, setSpots] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpot, setActiveSpot] = useState(null);
  const [mapCenter, setMapCenter] = useState([35.8, 10.2]); // Center of Tunisia
  const [mapZoom, setMapZoom] = useState(7);

  // Load spots & cities
  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedCity, verifiedOnly, searchQuery]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchSpots({
        category: selectedCategory,
        city: selectedCity,
        isVerified: verifiedOnly ? 'true' : '',
        q: searchQuery,
      });

      if (res && res.data) {
        setSpots(res.data);
      }

      const cityRes = await fetchCities();
      if (cityRes && cityRes.data) {
        setCities(cityRes.data);
      }
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Center on clicked spot
  const handleSpotClick = (spot) => {
    setActiveSpot(spot);
    if (spot.location && spot.location.coordinates) {
      const [lng, lat] = spot.location.coordinates;
      setMapCenter([lat, lng]);
      setMapZoom(14);
    }
  };

  // Reset view to all Tunisia
  const handleResetView = () => {
    setMapCenter([35.8, 10.2]);
    setMapZoom(7);
    setActiveSpot(null);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-canvas-card via-[#FAF8F2] to-canvas/60 rounded-3xl p-6 sm:p-8 border border-canvas-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/15 text-secondary-dark text-xs font-extrabold mb-3">
            <MapPin className="w-4 h-4 text-secondary" />
            <span>RÉSEAU NATIONAL TUNISIEN VÉRIFIÉ</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-secondary-dark tracking-tight leading-tight">
            Carte Interactive des Bonnes Adresses
          </h1>
          <p className="mt-2 text-base text-secondary/90 leading-relaxed">
            Trouvez les médecins gastro-entérologues et nutritionnistes spécialisés cœliaque ainsi que les boulangeries, pâtisseries, restaurants et rayons certifiés sans gluten à travers toute la Tunisie.
          </p>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="shrink-0 flex items-center gap-2.5 px-5 py-3.5 bg-primary text-white font-bold rounded-2xl shadow-md hover:bg-primary-dark transition-all duration-200 active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>Proposer une Adresse</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#FAF8F2] rounded-3xl p-6 border border-canvas-border shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search text filter */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/50" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom, spécialité..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-canvas-border text-sm font-medium placeholder:text-secondary/50 focus:outline-none focus:ring-2 focus:ring-secondary text-secondary-dark"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-canvas-border text-sm font-medium text-secondary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="ALL">Toutes les catégories</option>
            <option value="DOCTOR">🩺 Médecins Spécialistes Cœliaque</option>
            <option value="ARTISAN">🥐 Boulangeries & Pâtisseries Sans Gluten</option>
            <option value="RESTAURANT">🍽️ Restaurants & Pizzerias GF</option>
            <option value="CAFE">☕ Cafés & Salons de thé certifiés</option>
            <option value="SUPERMARKET">🛒 Supermarchés & Rayons Dédiés</option>
          </select>

          {/* City Filter */}
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-white border border-canvas-border text-sm font-medium text-secondary-dark focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="ALL">Toutes les villes de Tunisie</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                📍 {c}
              </option>
            ))}
          </select>

          {/* Verified Toggle & Reset */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-xl border border-canvas-border w-full">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary accent-primary"
              />
              <span className="text-xs font-bold text-secondary-dark">
                Vérifié ATC uniquement
              </span>
            </label>

            <button
              onClick={handleResetView}
              className="p-2.5 bg-white border border-canvas-border rounded-xl hover:bg-canvas/50 text-secondary transition-colors"
              title="Recentrer sur la Tunisie"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Map & Spot List View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Map Container (7 cols) */}
        <div className="lg:col-span-7 bg-[#FAF8F2] rounded-3xl p-4 border border-canvas-border shadow-sm overflow-hidden h-[580px] relative">
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            scrollWheelZoom={true}
            className="w-full h-full rounded-2xl"
          >
            <ChangeMapView center={mapCenter} zoom={mapZoom} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {spots.map((spot) => {
              if (!spot.location || !spot.location.coordinates) return null;
              const [lng, lat] = spot.location.coordinates;
              const icon = createCategoryIcon(spot.category, spot.isVerified);

              return (
                <Marker
                  key={spot._id}
                  position={[lat, lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => setActiveSpot(spot),
                  }}
                >
                  <Popup>
                    <div className="p-3 max-w-xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-canvas text-secondary-dark">
                          {spot.category}
                        </span>
                        {spot.isVerified && (
                          <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Vérifié ATC
                          </span>
                        )}
                      </div>
                      <h4 className="font-extrabold text-sm text-secondary-dark leading-snug">
                        {spot.name}
                      </h4>
                      <p className="text-xs text-secondary/80">{spot.address}</p>
                      {spot.speciality && (
                        <p className="text-[11px] font-medium text-primary-dark">
                          {spot.speciality}
                        </p>
                      )}
                      {spot.phone && (
                        <p className="text-xs font-semibold text-secondary flex items-center gap-1">
                          <Phone className="w-3 h-3 text-accent" /> {spot.phone}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Map Legend overlay */}
          <div className="absolute bottom-6 left-6 z-[400] bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-canvas-border shadow-md text-[11px] space-y-1.5 hidden sm:block">
            <span className="font-bold text-secondary-dark block mb-1">Légende :</span>
            <div className="flex items-center gap-2 text-secondary">
              <span className="w-3 h-3 rounded-full bg-[#2B6CB0]"></span> Médecin Spécialiste
            </div>
            <div className="flex items-center gap-2 text-secondary">
              <span className="w-3 h-3 rounded-full bg-[#756452]"></span> Boulangerie / Pâtisserie
            </div>
            <div className="flex items-center gap-2 text-secondary">
              <span className="w-3 h-3 rounded-full bg-[#FF8A41]"></span> Restaurant Sans Gluten
            </div>
            <div className="flex items-center gap-2 text-secondary">
              <span className="w-3 h-3 rounded-full bg-[#059669]"></span> Rayon Supermarché
            </div>
          </div>
        </div>

        {/* Spot List Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4 max-h-[580px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-2 border-b border-canvas-border/50">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Adresses Répertoriées ({spots.length})
            </span>
            <span className="text-xs text-secondary/70">Cliquez pour situer sur la carte</span>
          </div>

          {spots.length > 0 ? (
            spots.map((spot) => {
              const isSelected = activeSpot && activeSpot._id === spot._id;
              return (
                <div
                  key={spot._id}
                  onClick={() => handleSpotClick(spot)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-white border-primary shadow-md ring-2 ring-primary/20 scale-[1.01]'
                      : 'bg-[#FAF8F2] border-canvas-border hover:bg-white hover:border-secondary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-canvas/80 text-secondary-dark uppercase tracking-wider">
                          {spot.category}
                        </span>
                        <span className="text-xs font-bold text-accent">📍 {spot.city}</span>
                        {spot.isVerified && (
                          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary-dark border border-primary/20">
                            <CheckCircle2 className="w-3 h-3 text-primary" /> Vérifié ATC
                          </span>
                        )}
                      </div>
                      <h3 className="font-extrabold text-base text-secondary-dark mt-1.5">
                        {spot.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-xl text-xs font-bold text-accent-dark shrink-0">
                      <Star className="w-3.5 h-3.5 fill-accent text-accent" />
                      <span>{spot.rating || 4.8}</span>
                    </div>
                  </div>

                  <p className="text-xs text-secondary mt-2 leading-relaxed">{spot.address}</p>

                  {spot.speciality && (
                    <p className="text-xs font-semibold text-primary-dark mt-1">
                      ✨ {spot.speciality}
                    </p>
                  )}

                  {spot.notes && (
                    <div className="mt-3 p-2.5 rounded-xl bg-canvas/40 border border-canvas-border/50 text-xs text-secondary-dark">
                      {spot.notes}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-canvas-border/50 flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
                    {spot.phone ? (
                      <span className="flex items-center gap-1 font-semibold text-secondary-dark">
                        <Phone className="w-3.5 h-3.5 text-accent" /> {spot.phone}
                      </span>
                    ) : (
                      <span></span>
                    )}

                    {spot.hours && (
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3 text-secondary/60" /> {spot.hours}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-[#FAF8F2] rounded-2xl p-8 text-center border border-canvas-border">
              <MapPin className="w-8 h-8 text-secondary/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-secondary-dark">Aucune adresse trouvée</p>
              <p className="text-xs text-secondary mt-1">
                Modifiez vos filtres ou proposez une nouvelle adresse via le bouton en haut.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
