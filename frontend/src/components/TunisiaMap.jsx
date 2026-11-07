import React, { useState, useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Stethoscope, Croissant, UtensilsCrossed, Coffee, ShoppingBag, Phone, Clock, Search, BadgeCheck, LocateFixed, Plus, Images } from 'lucide-react';
import { fetchSpots, fetchCities } from '../services/api';
import { t, PageHead, EmptyState, FilterSheet, SPOT_CATEGORIES, spotCategory } from './ui';
import SpotDetails, { spotCover, CrossContaminationBadge } from './SpotDetails';

const CATEGORY_ICONS = {
  DOCTOR: Stethoscope,
  ARTISAN: Croissant,
  RESTAURANT: UtensilsCrossed,
  CAFE: Coffee,
  SUPERMARKET: ShoppingBag,
};

const TUNISIA_CENTER = [34.8, 9.9];
// The whole country fits at 7 on a desktop-sized map, 6 on phones
const TUNISIA_ZOOM = typeof window !== 'undefined' && window.innerWidth >= 1024 ? 7 : 6;

// Square markers anchored at their centre; Leaflet handles the offset
const iconCache = {};
const markerIcon = (category, isVerified, active) => {
  const key = `${category}-${isVerified}-${active}`;
  if (iconCache[key]) return iconCache[key];
  const cat = spotCategory(category);
  const Icon = CATEGORY_ICONS[cat.value];
  const size = active ? 38 : 30;
  const glyph = renderToStaticMarkup(<Icon size={active ? 20 : 16} color="#F3F0E6" strokeWidth={2.25} />);
  const badge = isVerified
    ? '<span style="position:absolute;top:-5px;inset-inline-end:-5px;width:12px;height:12px;border-radius:2px;background:#8BA850;border:2px solid #F3F0E6"></span>'
    : '';
  const html = `<div style="position:relative;width:${size}px;height:${size}px;border-radius:5px;background:${cat.color};border:2px solid #F3F0E6;box-shadow:0 2px 6px rgba(47,38,29,.35);display:flex;align-items:center;justify-content:center">${glyph}${badge}</div>`;
  iconCache[key] = L.divIcon({
    className: 'cs-marker',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
  return iconCache[key];
};

/** Every category of a spot, main one first (older rows only carry `category`) */
const spotCategories = (spot) => (spot.categories?.length ? spot.categories : [spot.category]);

const verifiedDate = (iso, lang) =>
  new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.center, target.zoom, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export default function TunisiaMap({ onOpenSubmitModal, lang }) {
  const tr = t(lang);
  const [spots, setSpots] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeId, setActiveId] = useState(null);
  const [flyTarget, setFlyTarget] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchCities()
      .then((res) => res?.data && setCities(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSpots({
      category: selectedCategory,
      city: selectedCity,
      isVerified: verifiedOnly ? 'true' : '',
      q: searchQuery,
    })
      .then((res) => {
        if (cancelled) return;
        setSpots(res?.data || []);
        setLoadError(false);
      })
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, selectedCity, verifiedOnly, searchQuery]);

  const counts = useMemo(() => {
    const c = {};
    spots.forEach((s) => {
      spotCategories(s).forEach((cat) => {
        c[cat] = (c[cat] || 0) + 1;
      });
    });
    return c;
  }, [spots]);

  const activeFilterCount = (selectedCategory !== 'ALL' ? 1 : 0) + (selectedCity !== 'ALL' ? 1 : 0) + (verifiedOnly ? 1 : 0);

  const categoryChips = (
    <>
      <button type="button" className="chip" aria-pressed={selectedCategory === 'ALL'} onClick={() => setSelectedCategory('ALL')}>
        {tr('Tout', 'الكل')}
      </button>
      {SPOT_CATEGORIES.map((c) => (
        <button
          key={c.value}
          type="button"
          className="chip"
          aria-pressed={selectedCategory === c.value}
          onClick={() => setSelectedCategory(selectedCategory === c.value ? 'ALL' : c.value)}
        >
          <span className="h-3 w-3 rounded-[2px]" style={{ background: c.color }} aria-hidden="true" />
          {tr(c.fr, c.ar)}
          {selectedCategory === 'ALL' && counts[c.value] ? <span className="tabular-nums opacity-70">{counts[c.value]}</span> : null}
        </button>
      ))}
    </>
  );

  const citySelect = (
    <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="field lg:w-48" aria-label={tr('Ville', 'المدينة')}>
      <option value="ALL">{tr('Toutes les villes', 'كل المدن')}</option>
      {cities.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );

  const verifiedToggle = (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-canvas-line bg-canvas-paper px-3.5 py-2.5 text-[15px]">
      <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="h-4 w-4 accent-[#4E6127]" />
      {tr('Vérifiées seulement', 'الموثقة فقط')}
    </label>
  );

  const focusSpot = (spot) => {
    setActiveId(spot._id);
    const [lng, lat] = spot.location?.coordinates || [];
    if (lat !== undefined) setFlyTarget({ center: [lat, lng], zoom: 14 });
  };

  const resetView = () => {
    setActiveId(null);
    setFlyTarget({ center: TUNISIA_CENTER, zoom: TUNISIA_ZOOM });
  };

  return (
    <div className="space-y-6">
      <PageHead
        title={tr('Où manger, où consulter', 'أين تأكل، أين تستشير')}
        lede={tr(
          'Médecins qui suivent la maladie cœliaque, boulangeries sans gluten, restaurants et rayons dédiés, partout en Tunisie. Les adresses marquées d’un carré vert ont été vérifiées.',
          'أطباء يتابعون مرض الأبطن، مخابز بدون غلوتين، مطاعم وأجنحة مخصصة في كامل تونس. العناوين ذات المربع الأخضر تم التحقق منها.'
        )}
        action={
          <button type="button" onClick={onOpenSubmitModal} className="btn-quiet">
            <Plus className="h-4 w-4" />
            {tr('Proposer une adresse', 'اقترح عنوانا')}
          </button>
        }
      />

      {/* Category chips double as the map legend; on mobile they live in the filters sheet */}
      <div className="hidden flex-wrap gap-2 lg:flex" role="group" aria-label={tr('Catégories', 'الأصناف')}>
        {categoryChips}
      </div>

      <div className="flex gap-2 lg:grid lg:grid-cols-[1fr_auto_auto] lg:gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={tr('Nom, spécialité, quartier…', 'الاسم، الاختصاص، الحي…')}
            aria-label={tr('Rechercher une adresse', 'ابحث عن عنوان')}
            className="field ps-10"
          />
        </div>
        <div className="hidden lg:block">{citySelect}</div>
        <div className="hidden lg:block">{verifiedToggle}</div>
        <FilterSheet lang={lang} activeCount={activeFilterCount} className="shrink-0">
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">{tr('Type de lieu', 'نوع المكان')}</p>
              <div className="flex flex-wrap gap-2">{categoryChips}</div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">{tr('Ville', 'المدينة')}</p>
              {citySelect}
            </div>
            {verifiedToggle}
          </div>
        </FilterSheet>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div role="region" aria-label={tr('Carte des adresses. La liste qui suit présente les mêmes lieux.', 'خريطة العناوين. القائمة التالية تعرض نفس الأماكن.')} className="relative z-0 h-[55vh] min-h-[340px] overflow-hidden rounded-2xl border border-white/60 shadow-[0_8px_24px_-16px_rgba(47,38,29,0.3)] lg:sticky lg:top-24 lg:h-[620px]">
          <MapContainer center={TUNISIA_CENTER} zoom={TUNISIA_ZOOM} scrollWheelZoom className="h-full w-full">
            <FlyTo target={flyTarget} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {spots.map((spot) => {
              const [lng, lat] = spot.location?.coordinates || [];
              if (lat === undefined) return null;
              return (
                <Marker
                  key={spot._id}
                  position={[lat, lng]}
                  // While filtering, a café that is also a bakery shows the bakery icon under "Boulangerie"
                  icon={markerIcon(spotCategories(spot).includes(selectedCategory) ? selectedCategory : spotCategories(spot)[0], spot.isVerified, activeId === spot._id)}
                  title={`${spot.name}, ${spot.city}`}
                  keyboard
                  eventHandlers={{
                    click: () => setActiveId(spot._id),
                    // Div icons ignore `alt`: name the focusable marker element for screen readers
                    add: (e) => {
                      const el = e.target.getElement();
                      if (!el) return;
                      el.setAttribute('role', 'button');
                      el.setAttribute(
                        'aria-label',
                        `${spot.name}, ${spot.city} — ${spotCategories(spot).map((v) => tr(spotCategory(v).fr, spotCategory(v).ar)).join(', ')}${spot.isVerified ? `, ${tr('vérifiée', 'موثق')}` : ''}`
                      );
                    },
                  }}
                >
                  <Popup>
                    {spotCover(spot) && <img src={spotCover(spot).src} alt="" loading="lazy" className="mb-2 h-24 w-full rounded-md object-cover" />}
                    <p className="font-medium">{spot.name}</p>
                    {spot.crossContaminationRisk && <p className="text-status-warning-ink">{tr('Risque de contamination croisée', 'خطر التلوث التبادلي')}</p>}
                    <p className="text-ink-soft">{spot.address}</p>
                    {spot.phone && (
                      <a href={`tel:${spot.phone.replace(/[^\d+]/g, '')}`} className="mt-1 inline-block text-status-safe-ink underline">
                        {spot.phone}
                      </a>
                    )}
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
          <button
            type="button"
            onClick={resetView}
            className="absolute end-3 top-3 z-[500] flex h-11 w-11 items-center justify-center rounded-lg border border-canvas-line bg-canvas-paper text-ink shadow-sm hover:bg-white"
            aria-label={tr('Revoir toute la Tunisie', 'عرض كامل تونس')}
            title={tr('Revoir toute la Tunisie', 'عرض كامل تونس')}
          >
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm text-ink-soft" aria-live="polite">
            {loading ? tr('Chargement…', 'جاري التحميل…') : `${spots.length} ${tr(spots.length > 1 ? 'adresses' : 'adresse', 'عنوان')}`}
          </p>
          {loadError ? (
            <EmptyState title={tr('Les adresses n’ont pas pu être chargées', 'تعذر تحميل العناوين')}>
              {tr('Vérifiez votre connexion, puis changez un filtre pour réessayer.', 'تحقق من الاتصال ثم غيّر أحد المرشحات لإعادة المحاولة.')}
            </EmptyState>
          ) : !loading && spots.length === 0 ? (
            <EmptyState
              title={tr('Aucune adresse ici pour l’instant', 'لا توجد عناوين هنا حاليا')}
              action={
                <button type="button" onClick={onOpenSubmitModal} className="btn-primary">
                  {tr('Proposer une adresse', 'اقترح عنوانا')}
                </button>
              }
            >
              {tr('Vous connaissez un lieu sûr ? Signalez-le à la communauté.', 'هل تعرف مكانا آمنا؟ شاركه مع المجتمع.')}
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {spots.map((spot) => {
                const cats = spotCategories(spot).map(spotCategory);
                const active = activeId === spot._id;
                const cover = spotCover(spot);
                return (
                  <li
                    key={spot._id}
                    className={`overflow-hidden rounded-xl border bg-white transition-colors ${
                      active ? 'border-ink ring-1 ring-ink' : 'border-canvas-line hover:border-ink-faint'
                    }`}
                  >
                    <button type="button" onClick={() => focusSpot(spot)} aria-expanded={active} className="flex w-full gap-3 p-4 text-start">
                      {cover && (
                        <img src={cover.src} alt="" loading="lazy" decoding="async" className="h-16 w-16 shrink-0 rounded-lg object-cover sm:h-20 sm:w-20" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm text-ink-soft">
                          <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                            {cats.map((cat) => (
                              <span key={cat.value} className="h-3 w-3 rounded-[2px]" style={{ background: cat.color }} />
                            ))}
                          </span>
                          {cats.map((cat) => tr(cat.fr, cat.ar)).join(' · ')}, {spot.city}
                          {spot.isVerified && (
                            <span
                              className="ms-auto inline-flex items-center gap-1 text-status-safe-ink"
                              title={spot.verifiedAt ? tr(`Vérifiée par l’équipe le ${verifiedDate(spot.verifiedAt, lang)}`, `وثقه الفريق في ${verifiedDate(spot.verifiedAt, lang)}`) : undefined}
                            >
                              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                              {spot.verifiedAt
                                ? tr(`Vérifiée le ${verifiedDate(spot.verifiedAt, lang)}`, `موثق في ${verifiedDate(spot.verifiedAt, lang)}`)
                                : tr('Vérifiée', 'موثق')}
                            </span>
                          )}
                        </span>
                        <span className="mt-1.5 block font-medium leading-snug">{spot.name}</span>
                        <span className="mt-0.5 block text-sm text-ink-soft">{spot.address}</span>
                        {spot.crossContaminationRisk && (
                          <span className="mt-2 block">
                            <CrossContaminationBadge lang={lang} />
                          </span>
                        )}
                        {spot.speciality && <span className="mt-2 block text-sm">{spot.speciality}</span>}
                        {active && spot.notes && (
                          <span className={`mt-2 block border-s-2 ps-3 text-sm text-ink-soft ${spot.crossContaminationRisk ? 'border-status-warning' : 'border-status-safe'}`}>{spot.notes}</span>
                        )}
                        {(spot.phone || spot.hours) && (
                          <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
                            {spot.phone && (
                              <span className="inline-flex items-center gap-1.5 tabular-nums" dir="ltr">
                                <Phone className="h-3.5 w-3.5" />
                                {spot.phone}
                              </span>
                            )}
                            {spot.hours && (
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {spot.hours}
                              </span>
                            )}
                          </span>
                        )}
                        {!active && spot.media?.length > 0 && (
                          <span className="mt-2 inline-flex items-center gap-1.5 text-sm text-status-safe-ink">
                            <Images className="h-3.5 w-3.5" aria-hidden="true" />
                            {tr(`${spot.media.length} photos et vidéos${spot.media.some((m) => m.kind === 'menu') ? ', menu' : ''}`, `${spot.media.length} صور وفيديوهات`)}
                          </span>
                        )}
                      </span>
                    </button>
                    {active && <SpotDetails spot={spot} lang={lang} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
