import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, RotateCw, Pencil, Trash2, BadgeCheck, Clock, ExternalLink, Check, X } from 'lucide-react';
import {
  fetchSpots,
  fetchCities,
  createSpot,
  updateSpot,
  deleteSpot,
  toggleSpotVerification,
  fetchProposals,
  approveProposal,
  rejectProposal,
  errorMessage,
} from '../services/api';
import { t, PageHead, Spinner, Notice, EmptyState, Modal, SPOT_CATEGORIES, spotCategory } from './ui';

const PRESET_COORDINATES = [
  { name: 'Tunis', coords: [10.1815, 36.8065] },
  { name: 'Ariana', coords: [10.1972, 36.8522] },
  { name: 'La Marsa', coords: [10.3255, 36.8782] },
  { name: 'Sousse', coords: [10.6369, 35.8256] },
  { name: 'Sfax', coords: [10.7602, 34.7405] },
  { name: 'Bizerte', coords: [9.8739, 37.2744] },
  { name: 'Nabeul', coords: [10.7376, 36.4561] },
  { name: 'Djerba', coords: [10.8572, 33.875] },
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
  hours: '',
  isVerified: true,
  notes: '',
  submittedBy: 'Backoffice Admin',
};

// Map addresses and community proposals. Shown inside the Backoffice, which checks the admin role.
export default function BackofficeSpots({ lang = 'fr' }) {
  const tr = t(lang);
  const [spots, setSpots] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [toast, setToast] = useState(null);

  const [filterQuery, setFilterQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterCity, setFilterCity] = useState('ALL');
  const [filterVerified, setFilterVerified] = useState('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SPOT_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [spotToDelete, setSpotToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Community proposals inbox
  const [view, setView] = useState('inbox'); // 'inbox' | 'spots'
  const [proposals, setProposals] = useState([]);
  const [proposalFilter, setProposalFilter] = useState('PENDING');
  const [pendingProposals, setPendingProposals] = useState(0);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalToReject, setProposalToReject] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSpots = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [res, cityRes] = await Promise.all([fetchSpots({ category: 'ALL', city: 'ALL', isVerified: 'ALL' }), fetchCities()]);
      if (res?.data) setSpots(res.data);
      if (cityRes?.data) setCities(cityRes.data);
    } catch (err) {
      console.error('Failed to load spots:', err);
      setErrorMsg('load');
    } finally {
      setLoading(false);
    }
  };

  const loadProposals = async (status = proposalFilter) => {
    setProposalsLoading(true);
    try {
      const res = await fetchProposals(status);
      if (res?.success) {
        setProposals(res.data);
        setPendingProposals(res.pendingCount);
      }
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setProposalsLoading(false);
    }
  };

  useEffect(() => {
    loadSpots();
  }, []);

  useEffect(() => {
    loadProposals(proposalFilter);
  }, [proposalFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Approving goes through the full form so the admin can set the exact position
  const handleOpenApprove = (proposal) => {
    // Proposals usually come without a position: the fields stay empty so the admin must set the real one
    const coords = proposal.coordinates?.length === 2 ? proposal.coordinates : ['', ''];
    setModalMode('approve');
    setEditingId(proposal._id);
    setFormError('');
    setFormData({
      ...EMPTY_SPOT_FORM,
      name: proposal.name,
      category: proposal.category,
      city: proposal.city,
      address: proposal.address,
      longitude: String(coords[0]),
      latitude: String(coords[1]),
      phone: proposal.phone || '',
      speciality: proposal.speciality || '',
      hours: proposal.hours || '',
      notes: proposal.notes || '',
      submittedBy: proposal.submittedBy || 'Communauté',
      isVerified: true,
    });
    setIsModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!proposalToReject) return;
    setIsRejecting(true);
    try {
      const res = await rejectProposal(proposalToReject._id);
      if (res?.success) {
        showToast(tr(`« ${proposalToReject.name} » refusée`, `تم رفض «${proposalToReject.name}»`));
        setProposalToReject(null);
        loadProposals();
      }
    } catch (err) {
      showToast(errorMessage(err, tr('Le refus n’a pas été enregistré.', 'لم يتم تسجيل الرفض.')), 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  const pendingCount = spots.filter((s) => !s.isVerified).length;

  const filteredSpots = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return spots.filter((spot) => {
      if (q && ![spot.name, spot.address, spot.notes, spot.speciality].some((v) => v?.toLowerCase().includes(q))) return false;
      if (filterCategory !== 'ALL' && spot.category !== filterCategory) return false;
      if (filterCity !== 'ALL' && spot.city?.toLowerCase() !== filterCity.toLowerCase()) return false;
      if (filterVerified === 'VERIFIED' && !spot.isVerified) return false;
      if (filterVerified === 'PENDING' && spot.isVerified) return false;
      return true;
    });
  }, [spots, filterQuery, filterCategory, filterCity, filterVerified]);

  const handleOpenCreate = () => {
    setModalMode('create');
    setEditingId(null);
    setFormData(EMPTY_SPOT_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (spot) => {
    const coords = spot.location?.coordinates || [10.1815, 36.8065];
    setModalMode('edit');
    setEditingId(spot._id);
    setFormError('');
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
      isVerified: Boolean(spot.isVerified),
      notes: spot.notes || '',
      submittedBy: spot.submittedBy || 'Backoffice Admin',
    });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    const lng = parseFloat(formData.longitude);
    const lat = parseFloat(formData.latitude);
    if (Number.isNaN(lng) || Number.isNaN(lat) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      setFormError(tr('Saisissez la latitude et la longitude exactes du lieu (clic droit sur Google Maps → coordonnées).', 'أدخل خط العرض وخط الطول الدقيقين للمكان.'));
      return;
    }
    setFormSubmitting(true);
    setFormError('');
    const payload = {
      name: formData.name.trim(),
      category: formData.category,
      city: formData.city.trim(),
      address: formData.address.trim(),
      coordinates: [lng, lat],
      phone: formData.phone.trim(),
      speciality: formData.speciality.trim(),
      hours: formData.hours.trim(),
      isVerified: Boolean(formData.isVerified),
      notes: formData.notes.trim(),
      submittedBy: formData.submittedBy.trim(),
    };
    try {
      const res =
        modalMode === 'create'
          ? await createSpot(payload)
          : modalMode === 'approve'
          ? await approveProposal(editingId, payload)
          : await updateSpot(editingId, payload);
      if (res?.success) {
        const toastText = {
          create: tr(`« ${res.data.name} » ajoutée`, `تمت إضافة «${res.data.name}»`),
          approve: tr(`« ${res.data.name} » validée et publiée`, `تم توثيق «${res.data.name}» ونشره`),
          edit: tr(`« ${res.data.name} » enregistrée`, `تم حفظ «${res.data.name}»`),
        };
        showToast(toastText[modalMode]);
        setIsModalOpen(false);
        loadSpots();
        if (modalMode === 'approve') loadProposals();
      } else {
        setFormError(res?.message || tr('L’enregistrement a échoué.', 'فشل الحفظ.'));
      }
    } catch (err) {
      setFormError(errorMessage(err, tr('Le serveur ne répond pas. Réessayez.', 'الخادم لا يستجيب. أعد المحاولة.')));
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleVerify = async (spot) => {
    const newStatus = !spot.isVerified;
    try {
      const res = await toggleSpotVerification(spot._id, newStatus);
      if (res?.success) {
        setSpots((prev) => prev.map((s) => (s._id === spot._id ? { ...s, isVerified: newStatus } : s)));
        showToast(newStatus ? tr(`« ${spot.name} » vérifiée`, `تم توثيق «${spot.name}»`) : tr(`« ${spot.name} » remise en attente`, `أعيد «${spot.name}» إلى الانتظار`));
      }
    } catch (err) {
      showToast(tr('Le statut n’a pas pu être modifié.', 'تعذر تغيير الحالة.'), 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!spotToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteSpot(spotToDelete._id);
      if (res?.success) {
        setSpots((prev) => prev.filter((s) => s._id !== spotToDelete._id));
        showToast(tr(`« ${spotToDelete.name} » supprimée`, `تم حذف «${spotToDelete.name}»`));
        setSpotToDelete(null);
      }
    } catch (err) {
      showToast(tr('La suppression a échoué.', 'فشل الحذف.'), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const set = (key) => (e) => setFormData({ ...formData, [key]: e.target.value });
  const hasFilters = filterQuery || filterCategory !== 'ALL' || filterCity !== 'ALL' || filterVerified !== 'ALL';

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`fixed bottom-28 left-1/2 z-[1100] -translate-x-1/2 animate-fade-in rounded-full px-4 py-3 text-sm font-medium shadow-lg ${
            toast.tone === 'error' ? 'bg-status-unsafe text-white' : 'bg-ink text-canvas-paper'
          }`}
        >
          {toast.message}
        </div>
      )}

      <PageHead
        title={tr('Gérer les adresses', 'إدارة العناوين')}
        lede={
          pendingProposals > 0
            ? tr(`${pendingProposals} proposition${pendingProposals > 1 ? 's' : ''} à traiter. ${spots.length} adresses publiées.`, `${pendingProposals} اقتراحات للمعالجة. ${spots.length} عنوانا منشورا.`)
            : tr(`Aucune proposition à traiter. ${spots.length} adresses publiées.`, `لا توجد اقتراحات للمعالجة. ${spots.length} عنوانا منشورا.`)
        }
        action={
          <div className="flex gap-2">
            <button type="button" onClick={handleOpenCreate} className="btn-primary">
              <Plus className="h-4 w-4" />
              {tr('Ajouter une adresse', 'أضف عنوانا')}
            </button>
            <button
              type="button"
              onClick={() => {
                loadSpots();
                loadProposals();
              }}
              className="btn-quiet px-3" aria-label={tr('Actualiser', 'تحديث')} title={tr('Actualiser', 'تحديث')}>
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        }
      />

      {/* View switch */}
      <div className="flex gap-6 border-b border-canvas-line" role="tablist">
        {[
          ['inbox', tr('Boîte de réception', 'صندوق الوارد'), pendingProposals],
          ['spots', tr('Adresses publiées', 'العناوين المنشورة'), spots.length],
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`-mb-px flex items-center gap-2 border-b-[3px] pb-3 text-[15px] ${view === id ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {label}
            {count > 0 && (
              <span className={`rounded-md px-1.5 text-sm tabular-nums ${id === 'inbox' ? 'bg-accent text-ink' : 'bg-canvas-sunk text-ink-soft'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'inbox' ? (
        <InboxView
          lang={lang}
          proposals={proposals}
          loading={proposalsLoading}
          filter={proposalFilter}
          setFilter={setProposalFilter}
          onApprove={handleOpenApprove}
          onReject={setProposalToReject}
        />
      ) : (
      <>
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Statut', 'الحالة')}>
        {[
          ['ALL', tr('Toutes', 'الكل'), spots.length],
          ['PENDING', tr('En attente', 'في الانتظار'), pendingCount],
          ['VERIFIED', tr('Vérifiées', 'موثقة'), spots.length - pendingCount],
        ].map(([id, label, count]) => (
          <button key={id} type="button" className="chip" aria-pressed={filterVerified === id} onClick={() => setFilterVerified(id)}>
            {label} <span className="tabular-nums opacity-70">{count}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder={tr('Nom, adresse, notes…', 'الاسم، العنوان، الملاحظات…')}
            aria-label={tr('Filtrer les adresses', 'تصفية العناوين')}
            className="field ps-10"
          />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="field sm:w-52" aria-label={tr('Catégorie', 'الصنف')}>
          <option value="ALL">{tr('Toutes les catégories', 'كل الأصناف')}</option>
          {SPOT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {tr(c.fr, c.ar)}
            </option>
          ))}
        </select>
        <select value={filterCity} onChange={(e) => setFilterCity(e.target.value)} className="field sm:w-44" aria-label={tr('Ville', 'المدينة')}>
          <option value="ALL">{tr('Toutes les villes', 'كل المدن')}</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      {loading && spots.length === 0 ? (
        <Spinner label={tr('Chargement des adresses…', 'جاري تحميل العناوين…')} />
      ) : errorMsg ? (
        <Notice
          tone="error"
          title={tr('Les adresses n’ont pas pu être chargées.', 'تعذر تحميل العناوين.')}
          action={
            <button type="button" className="btn-quiet" onClick={loadSpots}>
              {tr('Réessayer', 'إعادة المحاولة')}
            </button>
          }
        >
          {tr('Vérifiez que le serveur et MongoDB sont démarrés.', 'تحقق من تشغيل الخادم وقاعدة البيانات.')}
        </Notice>
      ) : filteredSpots.length === 0 ? (
        <EmptyState
          title={tr('Aucune adresse ne correspond', 'لا يوجد عنوان مطابق')}
          action={
            hasFilters ? (
              <button
                type="button"
                className="btn-quiet"
                onClick={() => {
                  setFilterQuery('');
                  setFilterCategory('ALL');
                  setFilterCity('ALL');
                  setFilterVerified('ALL');
                }}
              >
                {tr('Effacer les filtres', 'مسح المرشحات')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={handleOpenCreate}>
                {tr('Ajouter une adresse', 'أضف عنوانا')}
              </button>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80 backdrop-blur-sm">
          {filteredSpots.map((spot) => {
            const cat = spotCategory(spot.category);
            const coords = spot.location?.coordinates || [0, 0];
            return (
              <li key={spot._id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-[2px]" style={{ background: cat.color }} aria-hidden="true" />
                      {tr(cat.fr, cat.ar)}
                    </span>
                    <span>{spot.city}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleVerify(spot)}
                      title={tr('Changer le statut', 'تغيير الحالة')}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                        spot.isVerified
                          ? 'bg-status-safe/20 text-status-safe-ink hover:bg-status-safe/30'
                          : 'bg-status-warning/20 text-status-warning-ink hover:bg-status-warning/30'
                      }`}
                    >
                      {spot.isVerified ? <BadgeCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {spot.isVerified ? tr('Vérifiée', 'موثقة') : tr('En attente', 'في الانتظار')}
                    </button>
                  </p>
                  <p className="mt-1.5 font-medium">{spot.name}</p>
                  <p className="text-sm text-ink-soft">{spot.address}</p>
                  {spot.notes && <p className="mt-2 max-w-[70ch] text-sm text-ink-soft">{spot.notes}</p>}
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-faint">
                    {spot.phone && <span dir="ltr">{spot.phone}</span>}
                    <span className="tabular-nums" dir="ltr">
                      {coords[1]?.toFixed(4)}, {coords[0]?.toFixed(4)}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${coords[1]},${coords[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-ink"
                    >
                      {tr('Ouvrir dans Google Maps', 'افتح في خرائط Google')}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {spot.submittedBy && <span>{tr(`Proposée par ${spot.submittedBy}`, `اقترحها ${spot.submittedBy}`)}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => handleOpenEdit(spot)} className="btn-quiet px-3 py-2">
                    <Pencil className="h-4 w-4" />
                    {tr('Modifier', 'تعديل')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpotToDelete(spot)}
                    className="btn-ghost px-3 py-2 text-status-unsafe-ink hover:bg-status-unsafe/10 hover:text-status-unsafe-ink"
                    aria-label={tr(`Supprimer ${spot.name}`, `حذف ${spot.name}`)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      </>
      )}

      {/* Add / edit / approve */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        lang={lang}
        width="max-w-2xl"
        title={
          modalMode === 'create'
            ? tr('Ajouter une adresse', 'أضف عنوانا')
            : modalMode === 'approve'
            ? tr('Valider la proposition', 'توثيق الاقتراح')
            : tr('Modifier l’adresse', 'تعديل العنوان')
        }
        subtitle={
          modalMode === 'approve'
            ? tr('Vérifiez les informations et corrigez la position : elle a été placée au centre de la ville.', 'تحقق من المعلومات وصحح الموقع: تم وضعه في وسط المدينة.')
            : undefined
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && <Notice tone="error">{formError}</Notice>}

          <div>
            <label htmlFor="bo-name" className="field-label">{tr('Nom', 'الاسم')}</label>
            <input id="bo-name" maxLength={120} required value={formData.name} onChange={set('name')} className="field" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bo-category" className="field-label">{tr('Catégorie', 'الصنف')}</label>
              <select id="bo-category" value={formData.category} onChange={set('category')} className="field">
                {SPOT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {tr(c.fr, c.ar)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bo-city" className="field-label">{tr('Ville', 'المدينة')}</label>
              <input id="bo-city" maxLength={80} required value={formData.city} onChange={set('city')} className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="bo-address" className="field-label">{tr('Adresse', 'العنوان')}</label>
            <input id="bo-address" maxLength={200} required value={formData.address} onChange={set('address')} className="field" />
          </div>

          <fieldset className="rounded-lg border border-canvas-line p-4">
            <legend className="px-1 text-sm font-medium">{tr('Position sur la carte', 'الموقع على الخريطة')}</legend>
            {modalMode === 'approve' && (formData.latitude === '' || formData.longitude === '') && (
              <p className="mb-3 text-sm text-status-warning-ink">
                {tr('La personne n’a pas indiqué de position : saisissez celle du lieu avant de publier.', 'لم يحدد صاحب الاقتراح الموقع: أدخل موقع المكان قبل النشر.')}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bo-lat" className="field-label">Latitude</label>
                <input id="bo-lat" type="number" step="any" required dir="ltr" value={formData.latitude} onChange={set('latitude')} className="field tabular-nums" />
              </div>
              <div>
                <label htmlFor="bo-lng" className="field-label">Longitude</label>
                <input id="bo-lng" type="number" step="any" required dir="ltr" value={formData.longitude} onChange={set('longitude')} className="field tabular-nums" />
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-soft">{tr('Centrer sur une ville :', 'التمركز على مدينة:')}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {PRESET_COORDINATES.map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  className="chip px-2.5 py-1"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      longitude: String(preset.coords[0]),
                      latitude: String(preset.coords[1]),
                      city: preset.name,
                    })
                  }
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bo-phone" className="field-label">{tr('Téléphone', 'الهاتف')}</label>
              <input id="bo-phone" maxLength={30} type="tel" dir="ltr" value={formData.phone} onChange={set('phone')} className="field" />
            </div>
            <div>
              <label htmlFor="bo-speciality" className="field-label">{tr('Spécialité', 'الاختصاص')}</label>
              <input id="bo-speciality" maxLength={120} value={formData.speciality} onChange={set('speciality')} className="field" />
            </div>
          </div>

          <div>
            <label htmlFor="bo-hours" className="field-label">{tr('Horaires', 'التوقيت')}</label>
            <input id="bo-hours" maxLength={120} value={formData.hours} onChange={set('hours')} className="field" />
          </div>

          <div>
            <label htmlFor="bo-notes" className="field-label">{tr('Précautions contre la contamination', 'احتياطات ضد التلوث')}</label>
            <textarea id="bo-notes" maxLength={1000} rows={3} value={formData.notes} onChange={set('notes')} className="field" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-canvas-line bg-canvas-paper px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={formData.isVerified}
                onChange={(e) => setFormData({ ...formData, isVerified: e.target.checked })}
                className="h-4 w-4 accent-[#4E6127]"
              />
              <span className="text-[15px]">{tr('Adresse vérifiée', 'عنوان موثق')}</span>
            </label>
            <div>
              <label htmlFor="bo-author" className="field-label">{tr('Proposée par', 'اقترحها')}</label>
              <input id="bo-author" maxLength={80} value={formData.submittedBy} onChange={set('submittedBy')} className="field" />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-canvas-line pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn-ghost">
              {tr('Annuler', 'إلغاء')}
            </button>
            <button type="submit" disabled={formSubmitting} className="btn-primary">
              {formSubmitting
                ? tr('Enregistrement…', 'جاري الحفظ…')
                : modalMode === 'create'
                ? tr('Ajouter l’adresse', 'أضف العنوان')
                : modalMode === 'approve'
                ? tr('Valider et publier', 'وثّق وانشر')
                : tr('Enregistrer', 'احفظ')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={Boolean(spotToDelete)}
        onClose={() => setSpotToDelete(null)}
        lang={lang}
        width="max-w-md"
        title={tr('Supprimer cette adresse ?', 'حذف هذا العنوان؟')}
      >
        <p className="text-[15px]">
          {tr(
            `« ${spotToDelete?.name} » (${spotToDelete?.city}) sera retirée de la carte. Cette action est définitive.`,
            `سيتم حذف «${spotToDelete?.name}» (${spotToDelete?.city}) من الخريطة نهائيا.`
          )}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setSpotToDelete(null)} className="btn-ghost">
            {tr('Annuler', 'إلغاء')}
          </button>
          <button type="button" disabled={isDeleting} onClick={handleConfirmDelete} className="btn-danger">
            {isDeleting ? tr('Suppression…', 'جاري الحذف…') : tr('Supprimer', 'احذف')}
          </button>
        </div>
      </Modal>

      {/* Reject proposal confirmation */}
      <Modal
        open={Boolean(proposalToReject)}
        onClose={() => setProposalToReject(null)}
        lang={lang}
        width="max-w-md"
        title={tr('Refuser cette proposition ?', 'رفض هذا الاقتراح؟')}
      >
        <p className="text-[15px]">
          {tr(
            `« ${proposalToReject?.name} » ne sera pas publiée. Elle restera visible dans les propositions refusées.`,
            `لن يُنشر «${proposalToReject?.name}». سيبقى ظاهرا في الاقتراحات المرفوضة.`
          )}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setProposalToReject(null)} className="btn-ghost">
            {tr('Annuler', 'إلغاء')}
          </button>
          <button type="button" disabled={isRejecting} onClick={handleConfirmReject} className="btn-danger">
            {isRejecting ? tr('Refus…', 'جاري الرفض…') : tr('Refuser', 'ارفض')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

const PROPOSAL_FILTERS = [
  { id: 'PENDING', fr: 'À traiter', ar: 'للمعالجة' },
  { id: 'APPROVED', fr: 'Validées', ar: 'موثقة' },
  { id: 'REJECTED', fr: 'Refusées', ar: 'مرفوضة' },
];

function InboxView({ lang, proposals, loading, filter, setFilter, onApprove, onReject }) {
  const tr = t(lang);
  const dateFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Statut des propositions', 'حالة الاقتراحات')}>
        {PROPOSAL_FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {tr(f.fr, f.ar)}
          </button>
        ))}
      </div>

      {loading && proposals.length === 0 ? (
        <Spinner label={tr('Chargement des propositions…', 'جاري تحميل الاقتراحات…')} />
      ) : proposals.length === 0 ? (
        <EmptyState title={filter === 'PENDING' ? tr('Rien à traiter', 'لا شيء للمعالجة') : tr('Aucune proposition', 'لا توجد اقتراحات')}>
          {filter === 'PENDING'
            ? tr('Les adresses proposées par les visiteurs arriveront ici avant d’être publiées.', 'العناوين التي يقترحها الزوار ستصل هنا قبل نشرها.')
            : null}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => {
            const cat = spotCategory(p.category);
            return (
              <li key={p._id} className="rounded-2xl border border-white/70 bg-canvas-paper/80 backdrop-blur-sm p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-[2px]" style={{ background: cat.color }} aria-hidden="true" />
                        {tr(cat.fr, cat.ar)}
                      </span>
                      <span>{p.city}</span>
                      <span>{tr('Reçue le', 'وصلت يوم')} {dateFmt.format(new Date(p.createdAt))}</span>
                    </p>
                    <p className="mt-1.5 text-lg font-medium leading-snug">{p.name}</p>
                    <p className="text-sm text-ink-soft">{p.address}</p>
                    {(p.speciality || p.hours || p.phone) && (
                      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                        {p.speciality && (
                          <>
                            <dt className="text-ink-faint">{tr('Ce qu’on y trouve', 'ماذا يوجد')}</dt>
                            <dd>{p.speciality}</dd>
                          </>
                        )}
                        {p.hours && (
                          <>
                            <dt className="text-ink-faint">{tr('Horaires', 'التوقيت')}</dt>
                            <dd>{p.hours}</dd>
                          </>
                        )}
                        {p.phone && (
                          <>
                            <dt className="text-ink-faint">{tr('Téléphone', 'الهاتف')}</dt>
                            <dd dir="ltr" className="text-start">{p.phone}</dd>
                          </>
                        )}
                      </dl>
                    )}
                    {p.notes && <p className="mt-3 max-w-[70ch] border-s-2 border-canvas-line ps-3 text-sm text-ink-soft">{p.notes}</p>}
                    <p className="mt-3 text-xs text-ink-faint">
                      {p.submittedBy ? tr(`Proposée par ${p.submittedBy}`, `اقترحها ${p.submittedBy}`) : tr('Proposée anonymement', 'اقتراح مجهول')}
                    </p>
                  </div>

                  {p.status === 'PENDING' ? (
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => onApprove(p)} className="btn-primary">
                        <Check className="h-4 w-4" />
                        {tr('Valider', 'وثّق')}
                      </button>
                      <button type="button" onClick={() => onReject(p)} className="btn-quiet">
                        <X className="h-4 w-4" />
                        {tr('Refuser', 'ارفض')}
                      </button>
                    </div>
                  ) : (
                    <p className={`shrink-0 text-sm font-medium ${p.status === 'APPROVED' ? 'text-status-safe-ink' : 'text-status-unsafe-ink'}`}>
                      {p.status === 'APPROVED' ? tr('Validée', 'موثقة') : tr('Refusée', 'مرفوضة')}
                      {p.reviewedAt && <span className="block text-xs font-normal text-ink-faint">{dateFmt.format(new Date(p.reviewedAt))}</span>}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
