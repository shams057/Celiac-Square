import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Pencil, Trash2, EyeOff, Store } from 'lucide-react';
import {
  fetchAdminStore,
  createAdminStore,
  updateAdminStore,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  errorMessage,
} from '../services/api';
import { t, Spinner, Notice, EmptyState, Modal, formatPrice, storeType } from './ui';
import { StoreForm, ProductForm } from './SellerDashboard';

/**
 * Back-office editor of one marketplace store (storeId null = a new one): its profile,
 * who runs it, whether it is visible, and its products. Uses the same forms as the seller.
 */
export default function BackofficeStoreEditor({ lang, storeId, onBack, onChanged, showToast }) {
  const tr = t(lang);
  const [store, setStore] = useState(storeId ? undefined : null); // undefined while loading, null for a new store
  const [loadError, setLoadError] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [product, setProduct] = useState(null); // being edited ({} = new)
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async (id) => {
    setLoadError(false);
    try {
      const { data } = await fetchAdminStore(id);
      setStore(data);
      setOwnerEmail(data.owner?.email || '');
      setIsActive(data.isActive);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    if (storeId) load(storeId);
  }, [storeId]);

  const saveStore = (payload) => {
    const body = { ...payload, ownerEmail: ownerEmail.trim(), isActive };
    return store?._id ? updateAdminStore(store._id, body) : createAdminStore(body);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAdminProduct(store._id, toDelete._id);
      setStore((s) => ({ ...s, products: s.products.filter((p) => p._id !== toDelete._id) }));
      showToast(tr(`« ${toDelete.title} » supprimé`, `تم حذف «${toDelete.title}»`));
      setToDelete(null);
      onChanged();
    } catch (err) {
      showToast(errorMessage(err, tr('La suppression a échoué.', 'فشل الحذف.')), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const back = (
    <button type="button" className="btn-ghost -ms-2" onClick={onBack}>
      <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
      {tr('Toutes les boutiques', 'كل المحلات')}
    </button>
  );

  if (loadError) {
    return (
      <div className="space-y-4">
        {back}
        <Notice tone="error" title={tr('La boutique n’a pas pu être chargée.', 'تعذر تحميل المحل.')} action={<button type="button" className="btn-quiet" onClick={() => load(storeId)}>{tr('Réessayer', 'إعادة المحاولة')}</button>} />
      </div>
    );
  }
  if (store === undefined) return <Spinner label={tr('Chargement de la boutique…', 'جاري تحميل المحل…')} />;

  const isNew = !store?._id;

  return (
    <div className="space-y-6">
      {back}

      <section className="panel p-5 sm:p-6">
        <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em]">{isNew ? tr('Nouvelle boutique', 'محل جديد') : store.name}</h2>
        <p className="mb-5 text-sm text-ink-soft">
          {isNew
            ? tr('Elle apparaît sur le marché dès qu’elle a un produit visible. Vous pourrez l’attribuer à un vendeur plus tard.', 'يظهر في السوق بمجرد أن يكون له منتج ظاهر. يمكنك إسناده لبائع لاحقا.')
            : tr(`${tr(storeType(store.type).fr, storeType(store.type).ar)} · ${store.products.length} produit${store.products.length > 1 ? 's' : ''}`, `${store.products.length} منتج`)}
        </p>
        <StoreForm
          key={store?._id || 'new'}
          lang={lang}
          store={store}
          save={saveStore}
          onSaved={(saved) => {
            showToast(isNew ? tr('Boutique créée', 'تم إنشاء المحل') : tr('Boutique enregistrée', 'تم حفظ المحل'));
            onChanged();
            setStore((s) => ({ ...(s || { products: [] }), ...saved }));
            setOwnerEmail(saved.owner?.email || '');
            setIsActive(saved.isActive);
          }}
        >
          <div className="grid gap-4 border-t border-canvas-line pt-4 sm:grid-cols-2 sm:items-end">
            <div>
              <label htmlFor="store-owner" className="field-label">
                {tr('Compte du vendeur', 'حساب البائع')} <span className="font-normal text-ink-faint">{tr('facultatif', 'اختياري')}</span>
              </label>
              <input
                id="store-owner"
                type="email"
                dir="ltr"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="vendeur@exemple.tn"
                maxLength={254}
                className="field"
              />
              <p className="mt-1 text-xs text-ink-faint">
                {tr('Vide : la boutique est gérée par l’équipe. Avec un e-mail, ce compte devient vendeur et peut la modifier.', 'فارغ: يديره الفريق. مع بريد إلكتروني، يصبح الحساب بائعا ويمكنه تعديله.')}
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-canvas-line/70 bg-canvas-paper/80 px-3.5 py-2.5 text-[15px] sm:mb-5">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 accent-[#FF8A41]" />
              {tr('Visible sur le marché', 'ظاهر في السوق')}
            </label>
          </div>
        </StoreForm>
      </section>

      {!isNew && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">{tr('Produits', 'المنتجات')}</h3>
            <button type="button" className="btn-primary" onClick={() => setProduct({})}>
              <Plus className="h-4 w-4" />
              {tr('Ajouter un produit', 'أضف منتجا')}
            </button>
          </div>
          {store.products.length === 0 ? (
            <EmptyState title={tr('Aucun produit pour l’instant', 'لا منتجات بعد')}>{tr('Ajoutez un titre, une description, un prix et des photos.', 'أضف عنوانا ووصفا وسعرا وصورا.')}</EmptyState>
          ) : (
            <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-canvas-line bg-canvas-paper/80">
              {store.products.map((p) => (
                <li key={p._id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-canvas-sunk">
                    {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : <Store className="m-auto h-full w-6 text-ink-faint" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.title}</p>
                    <p className="line-clamp-1 text-sm text-ink-soft">{p.description || tr('Pas de description', 'لا وصف')}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-sm">
                      {p.price != null && <span className="font-semibold tabular-nums">{formatPrice(p.price, lang)}</span>}
                      {!p.isAvailable && (
                        <span className="inline-flex items-center gap-1 text-ink-faint">
                          <EyeOff className="h-3.5 w-3.5" />
                          {tr('Masqué', 'مخفي')}
                        </span>
                      )}
                    </p>
                  </div>
                  <button type="button" className="btn-ghost p-2" onClick={() => setProduct(p)} aria-label={tr(`Modifier ${p.title}`, `تعديل ${p.title}`)}>
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" className="btn-ghost p-2 hover:text-status-unsafe-ink" onClick={() => setToDelete(p)} aria-label={tr(`Supprimer ${p.title}`, `حذف ${p.title}`)}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Modal open={Boolean(product)} onClose={() => setProduct(null)} lang={lang} title={product?._id ? tr('Modifier le produit', 'تعديل المنتج') : tr('Nouveau produit', 'منتج جديد')} subtitle={store?.name}>
        {product && (
          <ProductForm
            lang={lang}
            product={product}
            create={(payload) => createAdminProduct(store._id, payload)}
            update={(id, payload) => updateAdminProduct(store._id, id, payload)}
            onSaved={(saved) => {
              setStore((s) => ({ ...s, products: product._id ? s.products.map((p) => (p._id === saved._id ? saved : p)) : [saved, ...s.products] }));
              showToast(product._id ? tr('Produit enregistré', 'تم حفظ المنتج') : tr('Produit publié', 'تم نشر المنتج'));
              setProduct(null);
              onChanged();
            }}
          />
        )}
      </Modal>

      <Modal open={Boolean(toDelete)} onClose={() => setToDelete(null)} lang={lang} title={tr('Supprimer ce produit ?', 'حذف هذا المنتج؟')} width="max-w-md">
        <p className="text-sm text-ink-soft">
          {tr(`« ${toDelete?.title} » et ses photos seront supprimés définitivement. Les commandes passées gardent leur ligne.`, `سيتم حذف «${toDelete?.title}» وصوره نهائيا. تحتفظ الطلبات السابقة بسطرها.`)}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-quiet" onClick={() => setToDelete(null)}>{tr('Annuler', 'إلغاء')}</button>
          <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? tr('Suppression…', 'جاري الحذف…') : tr('Supprimer', 'حذف')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
