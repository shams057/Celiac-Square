import React, { useEffect, useState } from 'react';
import { Check, X, Search, RotateCw } from 'lucide-react';
import {
  fetchSellerApplications,
  approveSellerApplication,
  rejectSellerApplication,
  fetchAdminStores,
  setStoreActive,
  fetchUsers,
  setUserRole,
} from '../services/api';
import { useAuth } from './AuthContext';
import { t, PageHead, Spinner, Notice, EmptyState, Modal, storeType, StoreLogo } from './ui';

const APPLICATION_FILTERS = [
  { id: 'PENDING', fr: 'À traiter', ar: 'للمعالجة' },
  { id: 'APPROVED', fr: 'Acceptées', ar: 'مقبولة' },
  { id: 'REJECTED', fr: 'Refusées', ar: 'مرفوضة' },
  { id: 'ALL', fr: 'Toutes', ar: 'الكل' },
];

const ROLES = [
  { value: 'CLIENT', fr: 'Client', ar: 'عميل' },
  { value: 'SELLER', fr: 'Vendeur', ar: 'بائع' },
  { value: 'ADMIN', fr: 'Administrateur', ar: 'مدير' },
];

const errorText = (err, fallback) => err.response?.data?.message || fallback;

/** Backoffice page for the marketplace: seller requests, stores and account roles */
export default function BackofficeSellers({ lang }) {
  const tr = t(lang);
  const [view, setView] = useState('requests'); // 'requests' | 'stores' | 'users'
  const [pendingCount, setPendingCount] = useState(0);
  const [toast, setToast] = useState(null);

  const showToast = (message, tone = 'success') => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 4000);
  };

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
        title={tr('Vendeurs et comptes', 'البائعون والحسابات')}
        lede={
          pendingCount > 0
            ? tr(`${pendingCount} demande${pendingCount > 1 ? 's' : ''} de vendeur à traiter.`, `${pendingCount} طلبات بائع للمعالجة.`)
            : tr('Aucune demande de vendeur à traiter.', 'لا توجد طلبات بائع للمعالجة.')
        }
      />

      <div className="flex gap-6 overflow-x-auto border-b border-canvas-line scrollbar-none" role="tablist">
        {[
          ['requests', tr('Demandes', 'الطلبات'), pendingCount],
          ['stores', tr('Boutiques', 'المحلات'), 0],
          ['users', tr('Comptes', 'الحسابات'), 0],
        ].map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-[3px] pb-3 text-[15px] ${view === id ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
          >
            {label}
            {count > 0 && <span className="rounded-md bg-accent px-1.5 text-sm tabular-nums text-ink">{count}</span>}
          </button>
        ))}
      </div>

      {view === 'requests' && <RequestsView lang={lang} onPendingCount={setPendingCount} showToast={showToast} />}
      {view === 'stores' && <StoresView lang={lang} showToast={showToast} />}
      {view === 'users' && <UsersView lang={lang} showToast={showToast} />}
    </div>
  );
}

function RequestsView({ lang, onPendingCount, showToast }) {
  const tr = t(lang);
  const [filter, setFilter] = useState('PENDING');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [toReject, setToReject] = useState(null);
  const dateFmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetchSellerApplications(filter);
      setItems(res.data || []);
      onPendingCount(res.pendingCount || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const decide = async (application, approve) => {
    setBusyId(application._id);
    try {
      if (approve) {
        await approveSellerApplication(application._id);
        showToast(tr(`« ${application.businessName} » acceptée : la boutique est ouverte`, `تم قبول «${application.businessName}»: المحل مفتوح`));
      } else {
        await rejectSellerApplication(application._id);
        showToast(tr(`« ${application.businessName} » refusée`, `تم رفض «${application.businessName}»`));
      }
      setToReject(null);
      load();
    } catch (err) {
      showToast(errorText(err, tr('La décision n’a pas été enregistrée.', 'لم يتم تسجيل القرار.')), 'error');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr('Statut des demandes', 'حالة الطلبات')}>
        {APPLICATION_FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {tr(f.fr, f.ar)}
          </button>
        ))}
        <button type="button" onClick={load} className="btn-ghost ms-auto px-3" aria-label={tr('Actualiser', 'تحديث')}>
          <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && items.length === 0 ? (
        <Spinner label={tr('Chargement des demandes…', 'جاري تحميل الطلبات…')} />
      ) : error ? (
        <Notice tone="error" title={tr('Les demandes n’ont pas pu être chargées.', 'تعذر تحميل الطلبات.')} action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>} />
      ) : items.length === 0 ? (
        <EmptyState title={filter === 'PENDING' ? tr('Rien à traiter', 'لا شيء للمعالجة') : tr('Aucune demande', 'لا توجد طلبات')}>
          {filter === 'PENDING' ? tr('Les demandes envoyées depuis « Devenir vendeur » arriveront ici.', 'الطلبات المرسلة من «كن بائعا» ستصل هنا.') : null}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => {
            const type = storeType(a.type);
            return (
              <li key={a._id} className="rounded-2xl border border-white/70 bg-canvas-paper/80 p-4 backdrop-blur-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-[2px]" style={{ background: type.color }} aria-hidden="true" />
                        {tr(type.fr, type.ar)}
                      </span>
                      <span>{a.city}</span>
                      <span>{tr('Reçue le', 'وصلت يوم')} {dateFmt.format(new Date(a.createdAt))}</span>
                    </p>
                    <p className="mt-1.5 text-lg font-medium leading-snug">{a.businessName}</p>
                    {a.address && <p className="text-sm text-ink-soft">{a.address}</p>}
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                      <dt className="text-ink-faint">{tr('Demandeur', 'صاحب الطلب')}</dt>
                      <dd>{a.applicant ? `${a.applicant.fullName} · ${a.applicant.email}` : '—'}</dd>
                      <dt className="text-ink-faint">{tr('Téléphone', 'الهاتف')}</dt>
                      <dd dir="ltr" className="text-start">{a.phone}</dd>
                    </dl>
                    {a.description && <p className="mt-3 max-w-[70ch] whitespace-pre-line border-s-2 border-canvas-line ps-3 text-sm text-ink-soft">{a.description}</p>}
                  </div>

                  {a.status === 'PENDING' ? (
                    <div className="flex shrink-0 gap-2">
                      <button type="button" onClick={() => decide(a, true)} disabled={busyId === a._id} className="btn-primary">
                        <Check className="h-4 w-4" />
                        {tr('Accepter', 'اقبل')}
                      </button>
                      <button type="button" onClick={() => setToReject(a)} disabled={busyId === a._id} className="btn-quiet">
                        <X className="h-4 w-4" />
                        {tr('Refuser', 'ارفض')}
                      </button>
                    </div>
                  ) : (
                    <p className={`shrink-0 text-sm font-medium ${a.status === 'APPROVED' ? 'text-status-safe-ink' : 'text-status-unsafe-ink'}`}>
                      {a.status === 'APPROVED' ? tr('Acceptée', 'مقبولة') : tr('Refusée', 'مرفوضة')}
                      {a.reviewedAt && <span className="block text-xs font-normal text-ink-faint">{dateFmt.format(new Date(a.reviewedAt))}</span>}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={Boolean(toReject)} onClose={() => setToReject(null)} lang={lang} title={tr('Refuser cette demande ?', 'رفض هذا الطلب؟')} width="max-w-md">
        <p className="text-sm text-ink-soft">
          {tr(`« ${toReject?.businessName} » ne pourra pas vendre. Le demandeur pourra envoyer une nouvelle demande.`, `لن يتمكن «${toReject?.businessName}» من البيع. يمكن لصاحب الطلب إرسال طلب جديد.`)}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-quiet" onClick={() => setToReject(null)}>{tr('Annuler', 'إلغاء')}</button>
          <button type="button" className="btn-danger" onClick={() => decide(toReject, false)} disabled={busyId === toReject?._id}>
            {tr('Refuser', 'ارفض')}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function StoresView({ lang, showToast }) {
  const tr = t(lang);
  const [stores, setStores] = useState(null);
  const [error, setError] = useState(false);

  const load = async () => {
    setError(false);
    try {
      setStores((await fetchAdminStores()).data || []);
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (store) => {
    try {
      const res = await setStoreActive(store._id, !store.isActive);
      setStores((list) => list.map((s) => (s._id === store._id ? { ...s, isActive: res.data.isActive } : s)));
      showToast(res.message);
    } catch (err) {
      showToast(errorText(err, tr('La boutique n’a pas pu être modifiée.', 'تعذر تعديل المحل.')), 'error');
    }
  };

  if (error) return <Notice tone="error" title={tr('Les boutiques n’ont pas pu être chargées.', 'تعذر تحميل المحلات.')} action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>} />;
  if (!stores) return <Spinner label={tr('Chargement des boutiques…', 'جاري تحميل المحلات…')} />;
  if (stores.length === 0) return <EmptyState title={tr('Aucune boutique', 'لا توجد محلات')}>{tr('Acceptez une demande de vendeur pour ouvrir la première.', 'اقبل طلب بائع لفتح أول محل.')}</EmptyState>;

  return (
    <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80">
      {stores.map((s) => (
        <li key={s._id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
          <StoreLogo store={s} className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{s.name}</p>
            <p className="truncate text-sm text-ink-soft">
              {tr(storeType(s.type).fr, storeType(s.type).ar)}
              {s.city ? ` · ${s.city}` : ''} · {tr(`${s.productCount} produit${s.productCount > 1 ? 's' : ''}`, `${s.productCount} منتج`)}
            </p>
            {s.owner && <p className="truncate text-xs text-ink-faint">{s.owner.fullName} · {s.owner.email}</p>}
          </div>
          <button type="button" onClick={() => toggle(s)} className={s.isActive ? 'btn-quiet' : 'btn-primary'}>
            {s.isActive ? tr('Suspendre', 'إيقاف') : tr('Réactiver', 'إعادة التفعيل')}
          </button>
        </li>
      ))}
    </ul>
  );
}

function UsersView({ lang, showToast }) {
  const tr = t(lang);
  const { user: me } = useAuth();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      setError(false);
      try {
        const res = await fetchUsers({ q: query.trim(), role });
        if (!cancelled) setUsers(res.data || []);
      } catch {
        if (!cancelled) setError(true);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, role]);

  const changeRole = async (u, next) => {
    try {
      const res = await setUserRole(u._id, next);
      setUsers((list) => list.map((x) => (x._id === u._id ? res.data : x)));
      showToast(tr(`${u.email} : ${ROLES.find((r) => r.value === next).fr}`, `${u.email}: ${ROLES.find((r) => r.value === next).ar}`));
    } catch (err) {
      showToast(errorText(err, tr('Le rôle n’a pas pu être changé.', 'تعذر تغيير الدور.')), 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tr('Nom ou e-mail…', 'الاسم أو البريد…')} aria-label={tr('Chercher un compte', 'ابحث عن حساب')} className="field ps-10" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="field sm:w-48" aria-label={tr('Rôle', 'الدور')}>
          <option value="">{tr('Tous les rôles', 'كل الأدوار')}</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{tr(r.fr, r.ar)}</option>
          ))}
        </select>
      </div>

      {error ? (
        <Notice tone="error" title={tr('Les comptes n’ont pas pu être chargés.', 'تعذر تحميل الحسابات.')} />
      ) : !users ? (
        <Spinner label={tr('Chargement des comptes…', 'جاري تحميل الحسابات…')} />
      ) : users.length === 0 ? (
        <EmptyState title={tr('Aucun compte ne correspond', 'لا يوجد حساب مطابق')} />
      ) : (
        <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-white/70 bg-canvas-paper/80">
          {users.map((u) => (
            <li key={u._id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{u.fullName || '—'}</p>
                <p className="truncate text-sm text-ink-soft" dir="ltr">{u.email}</p>
              </div>
              <select
                value={u.role}
                onChange={(e) => changeRole(u, e.target.value)}
                disabled={u._id === me?._id}
                title={u._id === me?._id ? tr('Vous ne pouvez pas changer votre propre rôle', 'لا يمكنك تغيير دورك') : undefined}
                className="field sm:w-44"
                aria-label={tr(`Rôle de ${u.email}`, `دور ${u.email}`)}
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{tr(r.fr, r.ar)}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
