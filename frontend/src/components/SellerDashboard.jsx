import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, ImagePlus, X, EyeOff, Store } from 'lucide-react';
import { fetchMyStore, saveMyStore, createMyProduct, updateMyProduct, deleteMyProduct, errorMessage } from '../services/api';
import { resizeImage } from '../services/images';
import { t, PageHead, Spinner, Notice, EmptyState, Modal, STORE_TYPES, storeType, formatPrice, StoreLogo } from './ui';

const MAX_IMAGES = 5;
const EMPTY_PRODUCT = { title: '', description: '', price: '', images: [], isAvailable: true };

const errorText = errorMessage;

/** A seller's own shop: its profile and the products it sells */
export default function SellerDashboard({ lang }) {
  const tr = t(lang);
  const [store, setStore] = useState(undefined); // undefined while loading, null when not created yet
  const [loadError, setLoadError] = useState(false);
  const [editingStore, setEditingStore] = useState(false);
  const [product, setProduct] = useState(null); // the product being edited ({} = new)
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  const load = async () => {
    setLoadError(false);
    try {
      const res = await fetchMyStore();
      setStore(res.data);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteMyProduct(toDelete._id);
      setStore((s) => ({ ...s, products: s.products.filter((p) => p._id !== toDelete._id) }));
      showToast(tr(`« ${toDelete.title} » supprimé`, `تم حذف «${toDelete.title}»`));
      setToDelete(null);
    } catch (err) {
      showToast(errorText(err, tr('La suppression a échoué.', 'فشل الحذف.')));
    } finally {
      setDeleting(false);
    }
  };

  if (loadError) {
    return (
      <Notice tone="error" title={tr('Votre boutique n’a pas pu être chargée.', 'تعذر تحميل محلك.')} action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>} />
    );
  }
  if (store === undefined) return <Spinner label={tr('Chargement de votre boutique…', 'جاري تحميل محلك…')} />;

  if (store === null) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHead title={tr('Ouvrir ma boutique', 'افتح محلي')} lede={tr('Présentez votre établissement : il apparaîtra sur le marché dès que vous ajoutez des produits.', 'قدّم محلك: سيظهر في السوق بمجرد إضافة منتجات.')} />
        <div className="panel p-5 sm:p-6">
          <StoreForm lang={lang} store={null} onSaved={(saved) => setStore({ ...saved, products: [] })} />
        </div>
      </div>
    );
  }

  const type = storeType(store.type);
  const locked = !store.isActive; // suspended by the team: read-only
  return (
    <div className="space-y-6">
      {locked && (
        <Notice tone="error" title={tr('Votre boutique est suspendue par l’équipe.', 'محلك موقوف من الفريق.')}>
          {tr(
            'Elle n’apparaît plus sur le marché et vous ne pouvez pas la modifier pour le moment. Contactez l’équipe pour en savoir plus.',
            'لم يعد ظاهرا في السوق ولا يمكنك تعديله حاليا. اتصل بالفريق لمعرفة المزيد.'
          )}
        </Notice>
      )}
      {toast && (
        <div role="status" className="fixed bottom-28 left-1/2 z-[1100] -translate-x-1/2 animate-fade-in rounded-full bg-ink px-4 py-3 text-sm font-medium text-canvas-paper shadow-lg">
          {toast}
        </div>
      )}

      <PageHead
        title={tr('Ma boutique', 'محلي')}
        lede={tr(
          `${store.products.length} produit${store.products.length > 1 ? 's' : ''} en ligne. Les membres voient vos produits disponibles sur le marché.`,
          `${store.products.length} منتج. يرى الأعضاء منتجاتك المتوفرة في السوق.`
        )}
        action={
          <button type="button" className="btn-primary" onClick={() => setProduct({})} disabled={locked}>
            <Plus className="h-4 w-4" />
            {tr('Ajouter un produit', 'أضف منتجا')}
          </button>
        }
      />

      <section className="panel flex items-center gap-4 p-4 sm:p-5">
        <StoreLogo store={store} className="h-16 w-16" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{store.name}</p>
          <p className="truncate text-sm text-ink-soft">
            {tr(type.fr, type.ar)}
            {store.city ? ` · ${store.city}` : ''}
          </p>
          {locked && <p className="mt-1 text-sm font-medium text-status-unsafe-ink">{tr('Boutique suspendue par l’équipe : elle n’est pas visible.', 'المحل موقوف من الفريق: غير ظاهر.')}</p>}
        </div>
        <button type="button" className="btn-quiet shrink-0" onClick={() => setEditingStore(true)} disabled={locked} aria-label={tr('Modifier la boutique', 'تعديل المحل')}>
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">{tr('Modifier', 'تعديل')}</span>
        </button>
      </section>

      {store.products.length === 0 ? (
        <EmptyState
          title={tr('Aucun produit pour l’instant', 'لا منتجات بعد')}
          action={<button type="button" className="btn-primary" onClick={() => setProduct({})} disabled={locked}><Plus className="h-4 w-4" />{tr('Ajouter mon premier produit', 'أضف أول منتج')}</button>}
        >
          {tr('Ajoutez un titre, une description et des photos.', 'أضف عنوانا ووصفا وصورا.')}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-canvas-line/60 overflow-hidden rounded-2xl border border-canvas-line bg-canvas-paper/80">
          {store.products.map((p) => (
            <li key={p._id} className="flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-canvas-sunk sm:h-20 sm:w-20">
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
              <button type="button" className="btn-ghost p-2" onClick={() => setProduct(p)} disabled={locked} aria-label={tr(`Modifier ${p.title}`, `تعديل ${p.title}`)}>
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" className="btn-ghost p-2 hover:text-status-unsafe-ink" onClick={() => setToDelete(p)} disabled={locked} aria-label={tr(`Supprimer ${p.title}`, `حذف ${p.title}`)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={editingStore} onClose={() => setEditingStore(false)} lang={lang} title={tr('Ma boutique', 'محلي')}>
        <StoreForm
          lang={lang}
          store={store}
          onSaved={(saved) => {
            setStore((s) => ({ ...s, ...saved }));
            setEditingStore(false);
            showToast(tr('Boutique enregistrée', 'تم حفظ المحل'));
          }}
        />
      </Modal>

      <Modal open={Boolean(product)} onClose={() => setProduct(null)} lang={lang} title={product?._id ? tr('Modifier le produit', 'تعديل المنتج') : tr('Nouveau produit', 'منتج جديد')}>
        {product && (
          <ProductForm
            lang={lang}
            product={product}
            onSaved={(saved) => {
              setStore((s) => ({
                ...s,
                products: product._id ? s.products.map((p) => (p._id === saved._id ? saved : p)) : [saved, ...s.products],
              }));
              setProduct(null);
              showToast(product._id ? tr('Produit enregistré', 'تم حفظ المنتج') : tr('Produit publié', 'تم نشر المنتج'));
            }}
          />
        )}
      </Modal>

      <Modal open={Boolean(toDelete)} onClose={() => setToDelete(null)} lang={lang} title={tr('Supprimer ce produit ?', 'حذف هذا المنتج؟')} width="max-w-md">
        <p className="text-sm text-ink-soft">
          {tr(`« ${toDelete?.title} » et ses photos seront supprimés définitivement.`, `سيتم حذف «${toDelete?.title}» وصوره نهائيا.`)}
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

function StoreForm({ lang, store, onSaved }) {
  const tr = t(lang);
  const [form, setForm] = useState({
    name: store?.name || '',
    type: store?.type || 'RESTAURANT',
    city: store?.city || '',
    address: store?.address || '',
    phone: store?.phone || '',
    description: store?.description || '',
  });
  const [logo, setLogo] = useState(store?.logoUrl || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setLogo(await resizeImage(file, 512));
    } catch {
      setError(tr('Cette image n’a pas pu être lue.', 'تعذرت قراءة هذه الصورة.'));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...form };
      if (logo !== (store?.logoUrl || '')) payload.logo = logo;
      const res = await saveMyStore(payload);
      onSaved(res.data);
    } catch (err) {
      setError(errorText(err, tr('La boutique n’a pas pu être enregistrée.', 'تعذر حفظ المحل.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4">
        <StoreLogo store={{ type: form.type, logoUrl: logo }} className="h-16 w-16" />
        <div className="flex gap-2">
          <button type="button" className="btn-quiet" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {logo ? tr('Changer le logo', 'تغيير الشعار') : tr('Ajouter un logo', 'أضف شعارا')}
          </button>
          {logo && (
            <button type="button" className="btn-ghost px-3" onClick={() => setLogo('')} aria-label={tr('Retirer le logo', 'إزالة الشعار')}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickLogo} aria-label={tr('Logo de la boutique', 'شعار المحل')} />
      </div>
      <div>
        <label htmlFor="store-name" className="field-label">{tr('Nom de la boutique', 'اسم المحل')}</label>
        <input id="store-name" value={form.name} onChange={set('name')} required maxLength={120} className="field" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="store-type" className="field-label">{tr('Type', 'النوع')}</label>
          <select id="store-type" value={form.type} onChange={set('type')} className="field">
            {STORE_TYPES.map((s) => (
              <option key={s.value} value={s.value}>{tr(s.fr, s.ar)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="store-city" className="field-label">{tr('Ville', 'المدينة')}</label>
          <input id="store-city" value={form.city} onChange={set('city')} maxLength={80} className="field" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="store-address" className="field-label">{tr('Adresse', 'العنوان')}</label>
          <input id="store-address" value={form.address} onChange={set('address')} maxLength={200} className="field" />
        </div>
        <div>
          <label htmlFor="store-phone" className="field-label">{tr('Téléphone', 'الهاتف')}</label>
          <input id="store-phone" type="tel" value={form.phone} onChange={set('phone')} maxLength={30} className="field" dir="ltr" />
        </div>
      </div>
      <div>
        <label htmlFor="store-description" className="field-label">{tr('Présentation', 'تقديم')}</label>
        <textarea id="store-description" value={form.description} onChange={set('description')} rows={3} maxLength={2000} className="field" />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? tr('Enregistrement…', 'جاري الحفظ…') : tr('Enregistrer', 'حفظ')}
      </button>
    </form>
  );
}

function ProductForm({ lang, product, onSaved }) {
  const tr = t(lang);
  const [form, setForm] = useState({ ...EMPTY_PRODUCT, ...product, price: product.price ?? '' });
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const addImages = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_IMAGES - form.images.length);
    e.target.value = '';
    if (!files.length) return;
    setReading(true);
    setError('');
    try {
      const added = await Promise.all(files.map((f) => resizeImage(f)));
      setForm((f) => ({ ...f, images: [...f.images, ...added].slice(0, MAX_IMAGES) }));
    } catch {
      setError(tr('Une image n’a pas pu être lue.', 'تعذرت قراءة صورة.'));
    } finally {
      setReading(false);
    }
  };

  const removeImage = (i) => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));

  // The first photo is the one shown on the marketplace
  const makeCover = (i) => setForm((f) => ({ ...f, images: [f.images[i], ...f.images.filter((_, j) => j !== i)] }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const payload = {
      title: form.title,
      description: form.description,
      price: form.price === '' ? null : form.price,
      images: form.images,
      isAvailable: form.isAvailable,
    };
    try {
      const res = product._id ? await updateMyProduct(product._id, payload) : await createMyProduct(payload);
      onSaved(res.data);
    } catch (err) {
      setError(errorText(err, tr('Le produit n’a pas pu être enregistré.', 'تعذر حفظ المنتج.')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <p className="field-label">{tr('Photos', 'الصور')} <span className="font-normal text-ink-faint">({form.images.length}/{MAX_IMAGES})</span></p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {form.images.map((src, i) => (
            <div key={src.slice(-40) + i} className="group relative aspect-square overflow-hidden rounded-xl bg-canvas-sunk">
              <img src={src} alt="" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute bottom-1 start-1 rounded-md bg-black/80 px-1.5 py-0.5 text-[11px] text-white">{tr('Principale', 'رئيسية')}</span>
              ) : (
                <button type="button" onClick={() => makeCover(i)} className="absolute bottom-1 start-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] text-onbright">
                  {tr('Principale', 'رئيسية')}
                </button>
              )}
              <button type="button" onClick={() => removeImage(i)} className="absolute end-1 top-1 rounded-full bg-black/80 p-1 text-white" aria-label={tr('Retirer la photo', 'إزالة الصورة')}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          {form.images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={reading}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-canvas-line text-xs text-ink-soft hover:border-accent hover:text-ink"
            >
              <ImagePlus className="h-5 w-5" />
              {reading ? tr('Lecture…', 'قراءة…') : tr('Ajouter', 'إضافة')}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addImages} aria-label={tr('Photos du produit', 'صور المنتج')} />
      </div>

      <div>
        <label htmlFor="product-title" className="field-label">{tr('Titre', 'العنوان')}</label>
        <input id="product-title" value={form.title} onChange={set('title')} required maxLength={120} className="field" />
      </div>
      <div>
        <label htmlFor="product-description" className="field-label">{tr('Description', 'الوصف')}</label>
        <textarea
          id="product-description"
          value={form.description}
          onChange={set('description')}
          rows={4}
          maxLength={2000}
          placeholder={tr('Ingrédients, précautions contre la contamination croisée, conservation…', 'المكونات، الاحتياطات ضد التلوث، طريقة الحفظ…')}
          className="field"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="product-price" className="field-label">{tr('Prix (DT)', 'السعر (د.ت)')} <span className="font-normal text-ink-faint">{tr('facultatif', 'اختياري')}</span></label>
          <input id="product-price" type="number" min="0" step="0.001" inputMode="decimal" value={form.price} onChange={set('price')} className="field" dir="ltr" />
        </div>
        <label className="flex items-center gap-3 self-end rounded-xl border border-canvas-line/70 bg-canvas-paper/80 px-3.5 py-2.5 text-[15px]">
          <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} className="h-4 w-4 accent-[#FF8A41]" />
          {tr('Visible sur le marché', 'ظاهر في السوق')}
        </label>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <button type="submit" disabled={busy || reading} className="btn-primary w-full">
        {busy ? tr('Enregistrement…', 'جاري الحفظ…') : product._id ? tr('Enregistrer', 'حفظ') : tr('Publier le produit', 'نشر المنتج')}
      </button>
    </form>
  );
}
