import React, { useState, useEffect, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Stethoscope, Croissant, UtensilsCrossed, Coffee, ShoppingBag, Phone, Clock, Search, BadgeCheck, LocateFixed, Plus, Images, Crosshair, LoaderCircle } from 'lucide-react';
import { fetchSpots, fetchCities } from '../services/api';
import { openState, formatTime, distanceKm, DAY_NAMES } from '../services/hours';
import { t, PageHead, EmptyState, FilterSheet, Notice, SPOT_CATEGORIES, spotCategory } from './ui';
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

/** "Ouvert · ferme à 22 h" / "Fermé · ouvre demain à 10 h", or null when the hours cannot be read */
const openLabel = (state, lang) => {
  if (!state) return null;
  const tr = t(lang);
  if (state.open) return tr(`Ouvert · ferme à ${formatTime(state.closesAt)}`, `مفتوح · يغلق على ${formatTime(state.closesAt)}`);
  if (!state.opensAt) return tr('Fermé', 'مغلق');
  const { day, minutes, today, tomorrow } = state.opensAt;
  const time = formatTime(minutes);
  if (today) return tr(`Fermé · ouvre à ${time}`, `مغلق · يفتح على ${time}`);
  if (tomorrow) return tr(`Fermé · ouvre demain à ${time}`, `مغلق · يفتح غدا على ${time}`);
  return tr(`Fermé · ouvre ${DAY_NAMES.fr[day]} à ${time}`, `مغلق · يفتح ${DAY_NAMES.ar[day]} على ${time}`);
};

const formatKm = (km, lang) =>
  km < 1 ? `${Math.round(km * 1000 / 50) * 50} m` : `${km.toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { maximumFractionDigits: km < 10 ? 1 : 0 })} km`;

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
  const [openNow, setOpenNow] = useState(false);
  // "Near me": the user's position (never sent to the server), and the state of the request
  const [userPos, setUserPos] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState('');
  const [offlineCopy, setOfflineCopy] = useState(null);
  // Re-evaluates "open now" every minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

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
        setOfflineCopy(res?.offlineCopy || null);
        setLoadError(false);
      })
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, selectedCity, verifiedOnly, searchQuery]);

  // Opening state and distance per spot; "open now" and "near me" filter and sort the list and the map
  const shownSpots = useMemo(() => {
    let list = spots.map((spot) => {
      const [lng, lat] = spot.location?.coordinates || [];
      return {
        ...spot,
        openState: openState(spot.hours, now),
        distance: userPos && lat !== undefined ? distanceKm(userPos, [lat, lng]) : null,
      };
    });
    if (openNow) list = list.filter((s) => s.openState?.open);
    if (userPos) list = [...list].sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    return list;
  }, [spots, now, openNow, userPos]);

  const locate = () => {
    setLocateError('');
    if (!navigator.geolocation) {
      setLocateError(tr('Votre navigateur ne donne pas accès à la position.', 'متصفحك لا يتيح تحديد الموقع.'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(p);
        setLocating(false);
        setFlyTarget({ center: p, zoom: 12 });
      },
      (err) => {
        setLocating(false);
        setLocateError(
          err.code === 1
            ? tr('Position refusée. Autorisez la localisation pour ce site dans votre navigateur.', 'تم رفض تحديد الموقع. اسمح به لهذا الموقع في متصفحك.')
            : tr('Position introuvable pour le moment. Réessayez dehors ou choisissez une ville.', 'تعذر تحديد الموقع حاليا. أعد المحاولة أو اختر مدينة.')
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  };

  const counts = useMemo(() => {
    const c = {};
    spots.forEach((s) => {
      spotCategories(s).forEach((cat) => {
        c[cat] = (c[cat] || 0) + 1;
      });
    });
    return c;
  }, [spots]);

  const activeFilterCount = (selectedCategory !== 'ALL' ? 1 : 0) + (selectedCity !== 'ALL' ? 1 : 0) + (verifiedOnly ? 1 : 0) + (openNow ? 1 : 0);

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
      <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} className="h-4 w-4 accent-[#4F6B1C]" />
      {tr('Vérifiées seulement', 'الموثقة فقط')}
    </label>
  );

  const openNowToggle = (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-canvas-line bg-canvas-paper px-3.5 py-2.5 text-[15px]" title={tr('D’après les horaires indiqués, heure de Tunisie', 'حسب الأوقات المذكورة، بتوقيت تونس')}>
      <input type="checkbox" checked={openNow} onChange={(e) => setOpenNow(e.target.checked)} className="h-4 w-4 accent-[#4F6B1C]" />
      {tr('Ouvert maintenant', 'مفتوح الآن')}
    </label>
  );

  const nearMeButton = (
    <button
      type="button"
      onClick={locate}
      className="btn-quiet h-full whitespace-nowrap px-3 sm:px-4"
      aria-pressed={Boolean(userPos)}
      aria-label={tr('Près de moi', 'بالقرب مني')}
      title={tr('Trier par distance (votre position reste sur l’appareil)', 'الترتيب حسب المسافة (يبقى موقعك على الجهاز)')}
      disabled={locating}
    >
      {locating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Crosshair className="h-4 w-4" aria-hidden="true" />}
      <span className="hidden sm:inline">{tr('Près de moi', 'بالقرب مني')}</span>
    </button>
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

      <div className="flex gap-2 lg:grid lg:grid-cols-[1fr_auto_auto_auto_auto] lg:gap-3">
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
        <div className="hidden lg:block">{openNowToggle}</div>
        <div className="shrink-0">{nearMeButton}</div>
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
            {openNowToggle}
          </div>
        </FilterSheet>
      </div>

      {locateError && <Notice tone="warning">{locateError}</Notice>}
      {offlineCopy && (
        <Notice tone="info" title={tr('Hors ligne : adresses enregistrées sur cet appareil', 'غير متصل: عناوين محفوظة على هذا الجهاز')}>
          {tr('La liste est celle de votre dernière visite. Le fond de carte a besoin d’internet.', 'القائمة هي نفسها في زيارتك الأخيرة. الخريطة تحتاج إلى الإنترنت.')}
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div role="region" aria-label={tr('Carte des adresses. La liste qui suit présente les mêmes lieux.', 'خريطة العناوين. القائمة التالية تعرض نفس الأماكن.')} className="relative z-0 h-[55vh] min-h-[340px] overflow-hidden rounded-2xl border border-canvas-line shadow-[0_8px_24px_-16px_rgba(47,38,29,0.3)] lg:sticky lg:top-24 lg:h-[620px]">
          <MapContainer center={TUNISIA_CENTER} zoom={TUNISIA_ZOOM} scrollWheelZoom className="h-full w-full">
            <FlyTo target={flyTarget} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {userPos && (
              <CircleMarker center={userPos} radius={8} pathOptions={{ color: '#F3F0E6', weight: 3, fillColor: '#2F6FDB', fillOpacity: 1 }}>
                <Popup>{tr('Vous êtes ici', 'أنت هنا')}</Popup>
              </CircleMarker>
            )}
            {shownSpots.map((spot) => {
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
            className="glass glass-control absolute end-3 top-3 z-[500] w-11 px-0"
            aria-label={tr('Revoir toute la Tunisie', 'عرض كامل تونس')}
            title={tr('Revoir toute la Tunisie', 'عرض كامل تونس')}
          >
            <LocateFixed className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-w-0">
          <p className="mb-2 text-sm text-ink-soft" aria-live="polite">
            {loading
              ? tr('Chargement…', 'جاري التحميل…')
              : `${shownSpots.length} ${tr(shownSpots.length > 1 ? 'adresses' : 'adresse', 'عنوان')}${userPos ? tr(', de la plus proche à la plus lointaine', '، من الأقرب إلى الأبعد') : ''}`}
          </p>
          {loadError ? (
            <EmptyState title={tr('Les adresses n’ont pas pu être chargées', 'تعذر تحميل العناوين')}>
              {tr('Vérifiez votre connexion, puis changez un filtre pour réessayer.', 'تحقق من الاتصال ثم غيّر أحد المرشحات لإعادة المحاولة.')}
            </EmptyState>
          ) : !loading && spots.length > 0 && shownSpots.length === 0 ? (
            <EmptyState
              title={tr('Aucune adresse ouverte en ce moment', 'لا يوجد عنوان مفتوح الآن')}
              action={
                <button type="button" onClick={() => setOpenNow(false)} className="btn-quiet">
                  {tr('Voir toutes les adresses', 'عرض كل العناوين')}
                </button>
              }
            >
              {tr('D’après les horaires indiqués. Les lieux sans horaires lisibles ne sont pas comptés.', 'حسب الأوقات المذكورة. لا تُحتسب الأماكن التي لا تُقرأ أوقاتها.')}
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
              {shownSpots.map((spot) => {
                const cats = spotCategories(spot).map(spotCategory);
                const open = openLabel(spot.openState, lang);
                const active = activeId === spot._id;
                const cover = spotCover(spot);
                return (
                  <li
                    key={spot._id}
                    className={`overflow-hidden rounded-xl border bg-canvas-paper transition-colors ${
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
                        <span className="mt-1.5 flex items-baseline justify-between gap-3">
                          <span className="font-medium leading-snug">{spot.name}</span>
                          {spot.distance != null && <span className="shrink-0 text-sm tabular-nums text-ink-soft">{formatKm(spot.distance, lang)}</span>}
                        </span>
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
                              <span className="inline-flex flex-wrap items-center gap-x-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {open && (
                                  <span className={`font-medium ${spot.openState.open ? 'text-status-safe-ink' : 'text-ink'}`}>
                                    {open}
                                    {' · '}
                                  </span>
                                )}
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
