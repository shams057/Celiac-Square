import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Trash2, ShoppingCart, PhoneCall, CheckCircle2, LogIn, MessageCircle } from 'lucide-react';
import { placeOrder, errorMessage } from '../services/api';
import { navigate, pathFor } from '../services/router';
import { useAuth } from './AuthContext';
import { t, Modal, Notice, EmptyState, formatPrice } from './ui';

// ---------------------------------------------------------------------------
// Order statuses, shared by the customer's page and the back-office
// ---------------------------------------------------------------------------

export const ORDER_STATUS = {
  NEW: { fr: 'En attente d’appel', ar: 'في انتظار الاتصال', staffFr: 'À appeler', staffAr: 'للاتصال', tone: 'bg-accent/20 text-ink' },
  CONFIRMED: { fr: 'Confirmée', ar: 'مؤكدة', staffFr: 'À transmettre', staffAr: 'للإرسال', tone: 'bg-status-safe/25 text-ink' },
  PREPARING: { fr: 'En préparation', ar: 'قيد التحضير', staffFr: 'Chez l’artisan', staffAr: 'عند الحرفي', tone: 'bg-status-warning/25 text-ink' },
  READY: { fr: 'Prête', ar: 'جاهزة', staffFr: 'Prête à expédier', staffAr: 'جاهزة للشحن', tone: 'bg-status-warning/40 text-ink' },
  SHIPPED: { fr: 'En livraison', ar: 'قيد التوصيل', staffFr: 'En livraison', staffAr: 'قيد التوصيل', tone: 'bg-sky-200/60 text-ink' },
  DELIVERED: { fr: 'Livrée', ar: 'تم التسليم', staffFr: 'Livrée', staffAr: 'تم التسليم', tone: 'bg-status-safe/50 text-ink' },
  CANCELLED: { fr: 'Annulée', ar: 'ملغاة', staffFr: 'Annulée', staffAr: 'ملغاة', tone: 'bg-canvas-sunk text-ink-soft' },
};

export const ORDER_FLOW = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'];

export function OrderStatusPill({ status, lang, staff = false }) {
  const s = ORDER_STATUS[status] || ORDER_STATUS.NEW;
  const label = staff ? (lang === 'ar' ? s.staffAr : s.staffFr) : lang === 'ar' ? s.ar : s.fr;
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${s.tone}`}>{label}</span>;
}

/** Sum of priced items plus delivery; `complete` is false while a price is still to be agreed */
export const orderTotals = (items, deliveryFee) => {
  const priced = items.filter((i) => i.unitPrice != null);
  const subtotal = priced.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  return {
    subtotal,
    total: subtotal + (deliveryFee ?? 0),
    complete: priced.length === items.length && deliveryFee != null,
    missingPrices: items.length - priced.length,
  };
};

export const when = (iso, lang) =>
  iso
    ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '';

// ---------------------------------------------------------------------------
// Cart: kept on this device until the order is placed
// ---------------------------------------------------------------------------

const CART_KEY = 'celiac-square-cart';
const ADDRESS_KEY = 'celiac-square-delivery';
const CartContext = createContext(null);

const readJson = (key, fallback) => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null');
    return v ?? fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the cart lasts for this visit only
  }
};

export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => {
    const saved = readJson(CART_KEY, []);
    return Array.isArray(saved) ? saved.filter((l) => l?.productId && l.quantity > 0) : [];
  });
  const [open, setOpen] = useState(false);

  useEffect(() => writeJson(CART_KEY, lines), [lines]);

  /** product: a marketplace product with its store ({ _id, title, images, price, store }) */
  const add = useCallback((product, quantity = 1) => {
    setLines((list) => {
      const existing = list.find((l) => l.productId === product._id);
      if (existing) return list.map((l) => (l === existing ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l));
      return [
        ...list,
        {
          productId: product._id,
          title: product.title,
          image: product.images?.[0] || '',
          price: product.price ?? null,
          storeId: product.store?._id || product.storeId,
          storeName: product.store?.name || '',
          quantity: Math.min(50, quantity),
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((productId, quantity) => {
    setLines((list) => (quantity < 1 ? list.filter((l) => l.productId !== productId) : list.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(50, quantity) } : l))));
  }, []);

  const remove = useCallback((ids) => setLines((list) => list.filter((l) => !ids.includes(l.productId))), []);
  const clear = useCallback(() => setLines([]), []);
  const count = lines.reduce((n, l) => n + l.quantity, 0);

  const value = useMemo(() => ({ lines, count, add, setQuantity, remove, clear, open, setOpen }), [lines, count, add, setQuantity, remove, clear, open]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);

/** "Panier" button with the number of items */
export function CartButton({ lang, className = '' }) {
  const tr = t(lang);
  const { count, setOpen } = useCart();
  return (
    <button type="button" onClick={() => setOpen(true)} className={`btn-quiet relative ${className}`} aria-label={tr(`Panier, ${count} article(s)`, `السلة، ${count}`)}>
      <ShoppingCart className="h-4 w-4" />
      {tr('Panier', 'السلة')}
      {count > 0 && <span className="rounded-md bg-accent px-1.5 text-sm font-medium tabular-nums text-ink">{count}</span>}
    </button>
  );
}

function QuantityStepper({ lang, value, onChange, min = 0 }) {
  const tr = t(lang);
  return (
    <div className="inline-flex items-center rounded-full border border-canvas-line bg-canvas-paper">
      <button type="button" className="p-2 text-ink-soft hover:text-ink disabled:opacity-40" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={tr('Moins', 'أقل')}>
        {value <= 1 && min === 0 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
      </button>
      <span className="min-w-[2ch] text-center text-sm font-medium tabular-nums" aria-live="polite">{value}</span>
      <button type="button" className="p-2 text-ink-soft hover:text-ink disabled:opacity-40" onClick={() => onChange(value + 1)} disabled={value >= 50} aria-label={tr('Plus', 'أكثر')}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Quantity picker and "add to cart", for the product sheet */
export function AddToCart({ lang, product }) {
  const tr = t(lang);
  const { add, setOpen } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  useEffect(() => {
    setQuantity(1);
    setAdded(false);
  }, [product?._id]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <QuantityStepper lang={lang} value={quantity} onChange={setQuantity} min={1} />
        <button
          type="button"
          className="btn-primary flex-1"
          onClick={() => {
            add(product, quantity);
            setAdded(true);
          }}
        >
          <ShoppingCart className="h-4 w-4" />
          {tr('Ajouter au panier', 'أضف إلى السلة')}
        </button>
      </div>
      {product.price == null && (
        <p className="text-xs text-ink-soft">{tr('Prix à confirmer : notre équipe vous l’indique par téléphone avant toute préparation.', 'السعر يُؤكَّد هاتفيا من فريقنا قبل التحضير.')}</p>
      )}
      {added && (
        <p className="text-sm text-status-safe-ink" role="status">
          {tr('Ajouté au panier.', 'أُضيف إلى السلة.')}{' '}
          <button type="button" className="font-medium underline" onClick={() => setOpen(true)}>
            {tr('Voir le panier', 'عرض السلة')}
          </button>
        </p>
      )}
    </div>
  );
}

/**
 * The cart and checkout, in a sheet. Placing the order needs an account; the team then
 * calls the customer to confirm prices and delivery before anything is prepared.
 */
export function CartSheet({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const { lines, setQuantity, remove, clear, open, setOpen } = useCart();
  const [step, setStep] = useState('cart'); // cart | checkout | done
  const [form, setForm] = useState(() => ({ customerName: '', phone: '', city: '', address: '', note: '', confirmChannel: 'WHATSAPP', ...readJson(ADDRESS_KEY, {}) }));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [placed, setPlaced] = useState({ orders: [], whatsappSent: false, word: 'OUI', days: 3 });

  useEffect(() => {
    if (open) {
      setError('');
      if (step === 'done') setStep('cart');
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // The account's name and phone fill the form, unless the customer already typed something
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, customerName: f.customerName || user.fullName || '', phone: f.phone || user.phone || '' }));
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const map = new Map();
    lines.forEach((l) => {
      if (!map.has(l.storeId)) map.set(l.storeId, { storeName: l.storeName, lines: [] });
      map.get(l.storeId).lines.push(l);
    });
    return [...map.values()];
  }, [lines]);
  const known = lines.filter((l) => l.price != null).reduce((sum, l) => sum + l.price * l.quantity, 0);
  const missing = lines.filter((l) => l.price == null).length;

  const close = () => setOpen(false);
  const field = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await placeOrder({ items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), ...form });
      writeJson(ADDRESS_KEY, { customerName: form.customerName, phone: form.phone, city: form.city, address: form.address, confirmChannel: form.confirmChannel });
      setPlaced({ orders: res.data || [], whatsappSent: Boolean(res.whatsappSent), word: res.confirmWord || 'OUI', days: res.waitDays || 3 });
      clear();
      setForm((f) => ({ ...f, note: '' }));
      setStep('done');
    } catch (err) {
      const body = err?.response?.data;
      if (body?.code === 'PRODUCTS_UNAVAILABLE' && Array.isArray(body.unavailable)) {
        remove(body.unavailable);
        setStep('cart');
      }
      setError(errorMessage(err, tr('La commande n’a pas pu être envoyée. Réessayez.', 'تعذر إرسال الطلب. أعد المحاولة.')));
    } finally {
      setSending(false);
    }
  };

  const title = step === 'done' ? tr('Commande envoyée', 'تم إرسال الطلب') : step === 'checkout' ? tr('Livraison', 'التوصيل') : tr('Votre panier', 'سلتك');

  return (
    <Modal open={open} onClose={close} lang={lang} title={title} width="max-w-lg">
      {step === 'done' ? (
        <div className="space-y-4 text-center">
          {placed.whatsappSent ? <MessageCircle className="mx-auto h-10 w-10 text-status-safe-ink" /> : <CheckCircle2 className="mx-auto h-10 w-10 text-status-safe-ink" />}
          <p className="text-lg font-medium">
            {placed.orders.length > 1
              ? tr(`${placed.orders.length} commandes envoyées, une par boutique.`, `أُرسلت ${placed.orders.length} طلبات، طلب لكل محل.`)
              : tr('Merci, votre commande est envoyée.', 'شكرا، تم إرسال طلبك.')}
          </p>
          <p className="text-sm text-ink-soft">
            {placed.whatsappSent
              ? tr(
                  `Ouvrez WhatsApp et répondez ${placed.word} à notre message pour la confirmer. Sans réponse sous ${placed.days} jours, notre équipe vous appelle. Paiement à la livraison.`,
                  `افتح واتساب وأجب بـ ${placed.word} على رسالتنا لتأكيد الطلب. إن لم تجب خلال ${placed.days} أيام، يتصل بك فريقنا. الدفع عند الاستلام.`
                )
              : tr(
                  'Notre équipe vous appelle pour confirmer les prix et la livraison. Rien n’est préparé avant cet appel. Paiement à la livraison.',
                  'سيتصل بك فريقنا لتأكيد الأسعار والتوصيل. لا يُحضَّر شيء قبل هذه المكالمة. الدفع عند الاستلام.'
                )}
          </p>
          <p className="text-sm font-medium tabular-nums" dir="ltr">{placed.orders.map((o) => o.reference).join(' · ')}</p>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              close();
              navigate(pathFor('orders'));
            }}
          >
            {tr('Suivre mes commandes', 'متابعة طلباتي')}
          </button>
        </div>
      ) : lines.length === 0 ? (
        <EmptyState title={tr('Votre panier est vide', 'سلتك فارغة')}>{tr('Ajoutez des produits depuis le marché.', 'أضف منتجات من السوق.')}</EmptyState>
      ) : step === 'cart' ? (
        <div className="space-y-5">
          {error && <Notice tone="warning">{error}</Notice>}
          {groups.map((g) => (
            <section key={g.storeName}>
              <h3 className="text-sm font-semibold">{g.storeName}</h3>
              <ul className="mt-2 divide-y divide-canvas-line">
                {g.lines.map((l) => (
                  <li key={l.productId} className="flex items-center gap-3 py-2.5">
                    {l.image ? <img src={l.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="h-12 w-12 shrink-0 rounded-xl bg-canvas-sunk" />}
                    <div className="min-w-0 flex-1">
                      <p dir="auto" className="line-clamp-2 text-start text-sm leading-snug">{l.title}</p>
                      <p className="text-xs text-ink-soft">{l.price != null ? formatPrice(l.price, lang) : tr('Prix à confirmer', 'السعر يُؤكَّد لاحقا')}</p>
                    </div>
                    <QuantityStepper lang={lang} value={l.quantity} onChange={(q) => setQuantity(l.productId, q)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="space-y-1 border-t border-canvas-line pt-4 text-sm">
            {known > 0 && (
              <p className="flex justify-between">
                <span className="text-ink-soft">{tr('Articles avec prix', 'منتجات بسعر')}</span>
                <span className="font-medium tabular-nums">{formatPrice(known, lang)}</span>
              </p>
            )}
            {missing > 0 && <p className="text-ink-soft">{tr(`${missing} article(s) au prix à confirmer par téléphone.`, `${missing} منتج بسعر يُؤكَّد هاتفيا.`)}</p>}
            <p className="text-ink-soft">{tr('Frais de livraison indiqués lors de l’appel. Paiement à la livraison.', 'تُحدَّد مصاريف التوصيل أثناء المكالمة. الدفع عند الاستلام.')}</p>
            {groups.length > 1 && <p className="text-ink-soft">{tr(`Une commande sera créée pour chacune des ${groups.length} boutiques.`, `سيُنشأ طلب لكل محل من المحلات الـ${groups.length}.`)}</p>}
          </div>
          <button type="button" className="btn-primary w-full" onClick={() => setStep('checkout')}>
            {tr('Commander', 'اطلب')}
          </button>
        </div>
      ) : !user ? (
        <div className="space-y-4">
          <Notice tone="info" title={tr('Connectez-vous pour commander', 'سجّل الدخول للطلب')}>
            {tr('Votre panier est gardé sur cet appareil.', 'سلتك محفوظة على هذا الجهاز.')}
          </Notice>
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => {
              close();
              navigate(pathFor('account'));
            }}
          >
            <LogIn className="h-4 w-4" />
            {tr('Se connecter ou créer un compte', 'تسجيل الدخول أو إنشاء حساب')}
          </button>
          <button type="button" className="btn-ghost w-full" onClick={() => setStep('cart')}>
            {tr('Retour au panier', 'العودة إلى السلة')}
          </button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm">
            <span className="font-medium">{tr('Nom complet', 'الاسم الكامل')}</span>
            <input className="field mt-1" required maxLength={100} autoComplete="name" {...field('customerName')} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{tr('Téléphone', 'الهاتف')}</span>
            <input className="field mt-1" required type="tel" inputMode="tel" maxLength={20} autoComplete="tel" placeholder="22 123 456" dir="ltr" {...field('phone')} />
            <span className="mt-1 block text-xs text-ink-soft">{tr('Nous vous appelons à ce numéro pour confirmer.', 'سنتصل بك على هذا الرقم للتأكيد.')}</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              <span className="font-medium">{tr('Ville', 'المدينة')}</span>
              <input className="field mt-1" required maxLength={80} autoComplete="address-level2" {...field('city')} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">{tr('Adresse de livraison', 'عنوان التوصيل')}</span>
              <input className="field mt-1" required maxLength={200} autoComplete="street-address" {...field('address')} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium">{tr('Remarque (facultatif)', 'ملاحظة (اختياري)')}</span>
            <textarea className="field mt-1 min-h-[80px]" maxLength={1000} placeholder={tr('Horaires, étage, allergie à signaler…', 'المواعيد، الطابق، حساسية…')} {...field('note')} />
          </label>
          {error && <Notice tone="error">{error}</Notice>}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{tr('Comment confirmer votre commande ?', 'كيف تؤكد طلبك؟')}</legend>
            {[
              {
                value: 'WHATSAPP',
                icon: MessageCircle,
                label: tr('Par WhatsApp', 'عبر واتساب'),
                hint:
                  missing > 0
                    ? tr('Un prix est à fixer : nous vous appellerons d’abord.', 'هناك سعر يجب تحديده: سنتصل بك أولا.')
                    : tr('Vous recevez un message avec le total : répondez OUI. Sans réponse sous 3 jours, nous appelons.', 'تصلك رسالة بالمجموع: أجب بـ OUI. دون رد خلال 3 أيام، نتصل بك.'),
              },
              { value: 'PHONE', icon: PhoneCall, label: tr('Par un appel de notre équipe', 'بمكالمة من فريقنا'), hint: tr('Nous vous appelons pour confirmer.', 'نتصل بك للتأكيد.') },
            ].map(({ value, icon: Icon, label, hint }) => (
              <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${form.confirmChannel === value ? 'border-accent bg-accent/10' : 'border-canvas-line'}`}>
                <input type="radio" name="confirm-channel" value={value} checked={form.confirmChannel === value} onChange={field('confirmChannel').onChange} className="mt-1" />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-ink-soft">{hint}</span>
                </span>
              </label>
            ))}
            <p className="text-xs text-ink-soft">{tr('Pas de paiement en ligne : vous payez à la livraison.', 'لا دفع عبر الإنترنت: الدفع عند الاستلام.')}</p>
          </fieldset>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setStep('cart')}>
              {tr('Retour', 'رجوع')}
            </button>
            <button type="submit" className="btn-primary flex-1" disabled={sending}>
              {sending ? tr('Envoi…', 'جاري الإرسال…') : tr('Envoyer la commande', 'إرسال الطلب')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
