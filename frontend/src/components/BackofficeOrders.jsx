import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, MessageCircle, Search, PhoneOff, PhoneForwarded, PhoneCall, Check, Undo2, X, RotateCcw, Truck, Store, StickyNote } from 'lucide-react';
import { fetchOrders, fetchOrder, updateOrder, logOrderCall, addOrderNote, setOrderStatus, sendOrderWhatsApp, errorMessage } from '../services/api';
import { t, Notice, EmptyState, Spinner, Modal, formatPrice } from './ui';
import { OrderStatusPill, ORDER_STATUS, ORDER_FLOW, orderTotals, when } from './orders';

/**
 * The team's order pipeline:
 *   Attente WhatsApp (customer asked to reply OUI, for 3 days) ─┐
 *   À appeler (no reply, other reply, phone chosen, price to fix) → (call, agree prices and delivery)
 *   → À transmettre → (send to the artisan)
 *   → Chez l'artisan → Prête → (hand to the carrier) → En livraison → Livrée
 */
const TABS = [
  { id: 'NEW', fr: 'À appeler', ar: 'للاتصال' },
  { id: 'WAITING', fr: 'Attente WhatsApp', ar: 'انتظار واتساب' },
  { id: 'CONFIRMED', fr: 'À transmettre', ar: 'للإرسال' },
  { id: 'PREPARING', fr: 'Chez l’artisan', ar: 'عند الحرفي' },
  { id: 'READY', fr: 'Prêtes', ar: 'جاهزة' },
  { id: 'SHIPPED', fr: 'En livraison', ar: 'قيد التوصيل' },
  { id: 'DELIVERED', fr: 'Livrées', ar: 'مسلّمة' },
  { id: 'CANCELLED', fr: 'Annulées', ar: 'ملغاة' },
  { id: 'ALL', fr: 'Toutes', ar: 'الكل' },
];

const CARRIERS = ['Livreur Celiac Square', 'Aramex', 'Rapid-Poste', 'FedEx', 'DHL', 'First Delivery', 'Retrait chez l’artisan'];

const digits = (phone) => String(phone || '').replace(/\D/g, '').replace(/^216(?=\d{8}$)/, '');
const telHref = (phone) => `tel:+216${digits(phone)}`;
const waHref = (phone, text) => `https://wa.me/216${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

/** What the artisan needs, and nothing about the customer: the team handles the delivery */
const artisanMessage = (o) =>
  [
    `Bonjour, nouvelle commande Celiac Square ${o.reference} :`,
    ...o.items.map((i) => `• ${i.quantity} × ${i.title}`),
    '',
    'Merci de nous confirmer que vous pouvez la préparer, et de nous prévenir quand elle est prête. Nous nous occupons de la livraison.',
  ].join('\n');

export default function BackofficeOrders({ lang, onCountChange }) {
  const tr = t(lang);
  const [tab, setTab] = useState('NEW');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [state, setState] = useState({ loading: true, error: '', unavailable: false });
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const res = await fetchOrders({ status: search ? 'ALL' : tab, q: search });
      setOrders(res.data || []);
      setCounts(res.counts || {});
      onCountChange?.(res.counts?.NEW ?? 0);
      setState({ loading: false, error: '', unavailable: false });
    } catch (err) {
      const unavailable = err?.response?.data?.code === 'FEATURE_UNAVAILABLE';
      setState({ loading: false, unavailable, error: unavailable ? '' : errorMessage(err, tr('Les commandes n’ont pas pu être chargées.', 'تعذر تحميل الطلبات.')) });
    }
  }, [tab, search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  // New orders come in while the team works: refresh the list every minute
  useEffect(() => {
    const id = setInterval(() => !openId && load(), 60000);
    return () => clearInterval(id);
  }, [load, openId]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{tr('Commandes', 'الطلبات')}</h1>
        <p className="mt-1 max-w-[75ch] text-sm text-ink-soft">
          {tr(
            'Appelez chaque nouvelle commande pour confirmer prix et livraison, transmettez-la à l’artisan, puis confiez-la au transporteur quand elle est prête. Paiement à la livraison.',
            'اتصل بكل طلب جديد لتأكيد السعر والتوصيل، أرسله إلى الحرفي، ثم سلّمه لشركة التوصيل عندما يكون جاهزا. الدفع عند الاستلام.'
          )}
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr('N° de commande, nom, téléphone, boutique, ville…', 'رقم الطلب، الاسم، الهاتف، المحل، المدينة…')}
          aria-label={tr('Chercher une commande', 'ابحث عن طلب')}
          className="field ps-10"
        />
      </div>

      {!search && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={tr('Étape', 'المرحلة')}>
          {TABS.map((f) => (
            <button key={f.id} type="button" className="chip shrink-0" aria-pressed={tab === f.id} onClick={() => setTab(f.id)}>
              {tr(f.fr, f.ar)}
              {counts[f.id] > 0 && <span className={`rounded-md px-1.5 text-xs tabular-nums ${f.id === 'NEW' ? 'bg-status-unsafe text-white' : 'bg-canvas-sunk'}`}>{counts[f.id]}</span>}
            </button>
          ))}
        </div>
      )}

      {state.loading && orders.length === 0 ? (
        <Spinner label={tr('Chargement…', 'جاري التحميل…')} />
      ) : state.unavailable ? (
        <Notice tone="warning" title={tr('Tables des commandes absentes', 'جداول الطلبات غير موجودة')}>
          {tr('Appliquez la migration supabase/migrations/20261108190000_orders.sql.', 'طبّق ترحيل قاعدة البيانات 20261108190000_orders.sql.')}
        </Notice>
      ) : state.error ? (
        <Notice tone="error" action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>}>
          {state.error}
        </Notice>
      ) : orders.length === 0 ? (
        <EmptyState title={search ? tr('Aucune commande trouvée', 'لم يتم العثور على طلب') : tr('Rien à traiter ici', 'لا شيء للمعالجة هنا')} />
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => {
            const totals = orderTotals(o.items, o.deliveryFee);
            const count = o.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <li key={o._id}>
                <button type="button" onClick={() => setOpenId(o._id)} className="panel flex w-full flex-col gap-1.5 p-4 text-start transition-colors hover:bg-canvas-paper sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2 sm:w-44 sm:flex-col sm:items-start sm:gap-1">
                    <span className="font-semibold tabular-nums" dir="ltr">{o.reference}</span>
                    <OrderStatusPill status={o.status} lang={lang} staff />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {o.customerName} <span className="font-normal tabular-nums text-ink-soft" dir="ltr">· {o.phone}</span>
                    </p>
                    <p className="truncate text-sm text-ink-soft">
                      {o.storeName} · {o.city} · {tr(`${count} article(s)`, `${count} منتج`)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm sm:flex-col sm:items-end sm:gap-0.5">
                    <span className="font-medium tabular-nums">{totals.complete ? formatPrice(totals.total, lang) : tr('Prix à confirmer', 'السعر يُؤكَّد')}</span>
                    {o.status === 'NEW' && <WhatsAppBadge lang={lang} order={o} />}
                    <span className="text-xs text-ink-faint">
                      {when(o.createdAt, lang)}
                      {o.status === 'NEW' && o.callAttempts > 0 && ` · ${tr(`${o.callAttempts} appel(s)`, `${o.callAttempts} اتصال`)}`}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <OrderDetail
        lang={lang}
        orderId={openId}
        onClose={() => setOpenId(null)}
        onChanged={load}
      />
    </div>
  );
}

/** One order: the next step to take, the customer, the items and prices, and the history */
function OrderDetail({ lang, orderId, onClose, onChanged }) {
  const tr = t(lang);
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState({ tone: 'info', text: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrder(null);
    setError('');
    setToast({ tone: 'info', text: '' });
    if (!orderId) return;
    fetchOrder(orderId)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(errorMessage(err, tr('Commande introuvable.', 'الطلب غير موجود.'))));
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Runs a change; the API answers with the updated order */
  const run = async (fn) => {
    setBusy(true);
    setToast({ tone: 'info', text: '' });
    try {
      const res = await fn();
      if (res?.data) setOrder(res.data);
      setToast({ tone: 'success', text: res?.message || '' });
      onChanged();
      return true;
    } catch (err) {
      setToast({ tone: 'error', text: errorMessage(err, tr('L’opération a échoué.', 'فشلت العملية.')) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const open = Boolean(orderId);
  const title = order ? `${order.reference} · ${order.storeName}` : tr('Commande', 'طلب');
  return (
    <Modal open={open} onClose={onClose} lang={lang} title={title} subtitle={order && <OrderStatusPill status={order.status} lang={lang} staff />} width="max-w-3xl">
      {error ? (
        <Notice tone="error">{error}</Notice>
      ) : !order ? (
        <Spinner label={tr('Chargement…', 'جاري التحميل…')} />
      ) : (
        <div className="space-y-6">
          {toast.text && <Notice tone={toast.tone}>{toast.text}</Notice>}
          <NextStep key={`n-${order._id}-${order.status}`} lang={lang} order={order} busy={busy} run={run} />
          <ItemsEditor key={`${order._id}-${order.updatedAt}`} lang={lang} order={order} busy={busy} run={run} />
          <CustomerCard key={`c-${order._id}-${order.updatedAt}`} lang={lang} order={order} busy={busy} run={run} />
          <ArtisanCard lang={lang} order={order} />
          <History key={`h-${order._id}`} lang={lang} order={order} busy={busy} run={run} />
          <OtherActions lang={lang} order={order} busy={busy} run={run} />
        </div>
      )}
    </Modal>
  );
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-ink-soft" aria-hidden="true" />}
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{title}</h3>
        {action && <div className="ms-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** The one thing to do now, with the buttons for it */
function NextStep({ lang, order: o, busy, run }) {
  const tr = t(lang);
  const [carrier, setCarrier] = useState(o.carrier || CARRIERS[0]);
  const [tracking, setTracking] = useState(o.trackingNumber || '');
  const [callNote, setCallNote] = useState('');
  const totals = orderTotals(o.items, o.deliveryFee);
  const move = (status, extra) => run(() => setOrderStatus(o._id, status, extra));
  const call = async (outcome) => {
    if (await run(() => logOrderCall(o._id, outcome, callNote))) setCallNote('');
  };

  const box = 'rounded-2xl border border-accent/50 bg-accent/10 p-4 space-y-3';
  switch (o.status) {
    case 'NEW':
      return (
        <div className={box}>
          <WhatsAppStatus lang={lang} order={o} busy={busy} run={run} complete={totals.complete} />
          <p className="font-medium">
            {o.awaitingWhatsApp
              ? tr('Ou appeler le client sans attendre', 'أو الاتصال بالعميل دون انتظار')
              : tr('1. Appeler le client pour confirmer', '1. الاتصال بالعميل للتأكيد')}
          </p>
          <p className="text-sm text-ink-soft">
            {tr(
              'Vérifiez les articles, convenez du prix de chaque article et des frais de livraison (à saisir plus bas), et rappelez que le paiement se fait à la livraison.',
              'تحقق من المنتجات، واتفق على سعر كل منتج ومصاريف التوصيل (أدخلها أسفله)، وذكّر بأن الدفع عند الاستلام.'
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <a className="btn-primary" href={telHref(o.phone)}>
              <Phone className="h-4 w-4" />
              <span dir="ltr">{o.phone}</span>
            </a>
            <a className="btn-quiet" href={waHref(o.phone)} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input className="field flex-1" value={callNote} onChange={(e) => setCallNote(e.target.value)} maxLength={500} placeholder={tr('Note d’appel (facultatif) : rappeler après 18 h…', 'ملاحظة الاتصال (اختياري)')} />
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => call('NO_ANSWER')}>
                <PhoneOff className="h-4 w-4" />
                {tr('Pas de réponse', 'لا رد')}
              </button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => call('CALL_BACK')}>
                <PhoneForwarded className="h-4 w-4" />
                {tr('À rappeler', 'يُعاد الاتصال')}
              </button>
            </div>
          </div>
          {o.callAttempts > 0 && (
            <p className="text-xs text-ink-soft">
              {tr(`${o.callAttempts} appel(s), dernier le ${when(o.lastCallAt, lang)}`, `${o.callAttempts} اتصال، آخرها ${when(o.lastCallAt, lang)}`)}
            </p>
          )}
          <div className="border-t border-accent/30 pt-3">
            {!totals.complete && (
              <p className="mb-2 text-sm text-status-unsafe-ink">
                {totals.missingPrices > 0
                  ? tr(`Il manque le prix de ${totals.missingPrices} article(s).`, `ينقص سعر ${totals.missingPrices} منتج.`)
                  : tr('Il manque les frais de livraison.', 'تنقص مصاريف التوصيل.')}
              </p>
            )}
            <button type="button" className="btn-primary" disabled={busy || !totals.complete} onClick={() => move('CONFIRMED', { note: callNote })}>
              <PhoneCall className="h-4 w-4" />
              {tr(`Client d’accord : confirmer (${formatPrice(totals.total, lang)})`, `العميل موافق: تأكيد (${formatPrice(totals.total, lang)})`)}
            </button>
          </div>
        </div>
      );
    case 'CONFIRMED':
      return (
        <div className={box}>
          <p className="font-medium">{tr('2. Transmettre la commande à l’artisan', '2. إرسال الطلب إلى الحرفي')}</p>
          <p className="text-sm text-ink-soft">{tr('Envoyez-lui la liste des articles (sans les coordonnées du client), puis notez qu’elle est transmise.', 'أرسل له قائمة المنتجات (دون بيانات العميل)، ثم سجّل أنه تم الإرسال.')}</p>
          <ArtisanButtons lang={lang} order={o} />
          <button type="button" className="btn-primary" disabled={busy} onClick={() => move('PREPARING')}>
            <Check className="h-4 w-4" />
            {tr('Transmise, l’artisan prépare', 'تم الإرسال، الحرفي يحضّر')}
          </button>
        </div>
      );
    case 'PREPARING':
      return (
        <div className={box}>
          <p className="font-medium">{tr('3. Attendre que l’artisan ait terminé', '3. انتظار انتهاء الحرفي')}</p>
          <p className="text-sm text-ink-soft">
            {tr(`Transmise le ${when(o.preparingAt, lang)}. Relancez l’artisan si besoin.`, `أُرسل في ${when(o.preparingAt, lang)}. ذكّر الحرفي عند الحاجة.`)}
          </p>
          <ArtisanButtons lang={lang} order={o} />
          <button type="button" className="btn-primary" disabled={busy} onClick={() => move('READY')}>
            <Check className="h-4 w-4" />
            {tr('La commande est prête', 'الطلب جاهز')}
          </button>
        </div>
      );
    case 'READY':
      return (
        <div className={box}>
          <p className="font-medium">{tr('4. Confier la commande au transporteur', '4. تسليم الطلب لشركة التوصيل')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="font-medium">{tr('Transporteur', 'شركة التوصيل')}</span>
              <input className="field mt-1" list="carriers" value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={60} />
              <datalist id="carriers">
                {CARRIERS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="text-sm">
              <span className="font-medium">{tr('N° de suivi (facultatif)', 'رقم التتبع (اختياري)')}</span>
              <input className="field mt-1" value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} dir="ltr" />
            </label>
          </div>
          <p className="text-sm text-ink-soft">
            {tr(`À encaisser à la livraison : ${formatPrice(totals.total, lang)}`, `المبلغ عند الاستلام: ${formatPrice(totals.total, lang)}`)}
          </p>
          <button type="button" className="btn-primary" disabled={busy || !carrier.trim()} onClick={() => move('SHIPPED', { carrier, trackingNumber: tracking })}>
            <Truck className="h-4 w-4" />
            {tr('Expédiée', 'تم الشحن')}
          </button>
        </div>
      );
    case 'SHIPPED':
      return (
        <div className={box}>
          <p className="font-medium">{tr('5. Confirmer la livraison', '5. تأكيد التسليم')}</p>
          <p className="text-sm text-ink-soft">
            {o.carrier}
            {o.trackingNumber && <span dir="ltr"> · {o.trackingNumber}</span>} · {tr(`expédiée le ${when(o.shippedAt, lang)}`, `شُحن في ${when(o.shippedAt, lang)}`)}
          </p>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => move('DELIVERED')}>
            <Check className="h-4 w-4" />
            {tr(`Livrée et payée (${formatPrice(totals.total, lang)})`, `سُلّم ودُفع (${formatPrice(totals.total, lang)})`)}
          </button>
        </div>
      );
    case 'DELIVERED':
      return <Notice tone="success" title={tr(`Livrée le ${when(o.deliveredAt, lang)}`, `سُلّم في ${when(o.deliveredAt, lang)}`)} />;
    default:
      return (
        <Notice
          tone="warning"
          title={tr(`Annulée le ${when(o.cancelledAt, lang)}`, `أُلغي في ${when(o.cancelledAt, lang)}`)}
          action={
            <button type="button" className="btn-quiet" disabled={busy} onClick={() => move('NEW')}>
              <RotateCcw className="h-4 w-4" />
              {tr('Rouvrir (nouvel appel)', 'إعادة الفتح (اتصال جديد)')}
            </button>
          }
        >
          {o.cancelReason}
        </Notice>
      );
  }
}

function ArtisanButtons({ lang, order: o }) {
  const tr = t(lang);
  if (!o.store?.phone) {
    return <p className="text-sm text-status-unsafe-ink">{tr('Pas de téléphone pour cette boutique : complétez sa fiche.', 'لا يوجد رقم لهذا المحل.')}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      <a className="btn-quiet" href={waHref(o.store.phone, artisanMessage(o))} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="h-4 w-4" />
        {tr('Envoyer par WhatsApp', 'إرسال عبر واتساب')}
      </a>
      <a className="btn-quiet" href={telHref(o.store.phone)}>
        <Phone className="h-4 w-4" />
        <span dir="ltr">{o.store.phone}</span>
      </a>
    </div>
  );
}

/** Items, agreed prices and delivery fee. Editable until the order is with the artisan. */
function ItemsEditor({ lang, order: o, busy, run }) {
  const tr = t(lang);
  const editable = o.status === 'NEW' || o.status === 'CONFIRMED';
  const [items, setItems] = useState(() => o.items.map((i) => ({ _id: i._id, unitPrice: i.unitPrice ?? '', quantity: i.quantity })));
  const [fee, setFee] = useState(o.deliveryFee ?? '');

  const draft = useMemo(
    () => o.items.map((i, n) => ({ ...i, unitPrice: items[n].unitPrice === '' ? null : Number(items[n].unitPrice), quantity: Number(items[n].quantity) || 1 })),
    [o.items, items]
  );
  const totals = orderTotals(draft, fee === '' ? null : Number(fee));
  const dirty = items.some((d, n) => String(d.unitPrice) !== String(o.items[n].unitPrice ?? '') || Number(d.quantity) !== o.items[n].quantity) || String(fee) !== String(o.deliveryFee ?? '');

  const save = () => run(() => updateOrder(o._id, { items, deliveryFee: fee }));
  const set = (n, key, value) => setItems((list) => list.map((d, i) => (i === n ? { ...d, [key]: value } : d)));

  return (
    <Section title={tr('Articles et prix', 'المنتجات والأسعار')}>
      <ul className="divide-y divide-canvas-line rounded-2xl border border-canvas-line bg-canvas-paper/60">
        {o.items.map((i, n) => (
          <li key={i._id} className="flex flex-wrap items-center gap-3 p-3">
            {i.image ? <img src={i.image} alt="" className="h-12 w-12 rounded-xl object-cover" /> : <span className="h-12 w-12 rounded-xl bg-canvas-sunk" />}
            <p dir="auto" className="min-w-[10rem] flex-1 text-start text-sm leading-snug">{i.title}</p>
            {editable ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="field w-16 text-center"
                  value={items[n].quantity}
                  onChange={(e) => set(n, 'quantity', e.target.value)}
                  aria-label={tr('Quantité', 'الكمية')}
                />
                <span className="text-ink-soft">×</span>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  className={`field w-28 text-end ${items[n].unitPrice === '' ? 'border-status-unsafe/60' : ''}`}
                  value={items[n].unitPrice}
                  onChange={(e) => set(n, 'unitPrice', e.target.value)}
                  placeholder={tr('Prix DT', 'السعر')}
                  aria-label={tr('Prix unitaire en dinars', 'سعر الوحدة بالدينار')}
                />
              </div>
            ) : (
              <span className="text-sm tabular-nums text-ink-soft">
                {i.quantity} × {formatPrice(i.unitPrice, lang)}
              </span>
            )}
          </li>
        ))}
        <li className="flex items-center gap-3 p-3">
          <p className="flex-1 text-sm">{tr('Frais de livraison', 'مصاريف التوصيل')}</p>
          {editable ? (
            <input
              type="number"
              min={0}
              step="0.001"
              className={`field w-28 text-end ${fee === '' ? 'border-status-unsafe/60' : ''}`}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="DT"
              aria-label={tr('Frais de livraison en dinars', 'مصاريف التوصيل بالدينار')}
            />
          ) : (
            <span className="text-sm tabular-nums text-ink-soft">{formatPrice(o.deliveryFee, lang)}</span>
          )}
        </li>
        <li className="flex items-center gap-3 p-3 font-semibold">
          <p className="flex-1">{tr('Total à encaisser', 'المجموع للاستلام')}</p>
          <span className="tabular-nums">{formatPrice(totals.total, lang)}</span>
        </li>
      </ul>
      {editable && dirty && (
        <button type="button" className="btn-primary" disabled={busy} onClick={save}>
          {tr('Enregistrer les prix', 'حفظ الأسعار')}
        </button>
      )}
      {!editable && o.status !== 'CANCELLED' && o.status !== 'DELIVERED' && (
        <p className="text-xs text-ink-faint">{tr('Les articles ne changent plus une fois la commande chez l’artisan.', 'لا تتغير المنتجات بعد إرسال الطلب إلى الحرفي.')}</p>
      )}
    </Section>
  );
}

function CustomerCard({ lang, order: o, busy, run }) {
  const tr = t(lang);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ customerName: o.customerName, phone: o.phone, city: o.city, address: o.address });
  const field = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) });

  return (
    <Section
      title={tr('Client et livraison', 'العميل والتوصيل')}
      icon={Phone}
      action={
        !editing && o.status !== 'DELIVERED' && (
          <button type="button" className="btn-ghost px-2 py-1 text-sm" onClick={() => setEditing(true)}>
            {tr('Modifier', 'تعديل')}
          </button>
        )
      }
    >
      {editing ? (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => updateOrder(o._id, form))) setEditing(false);
          }}
        >
          <input className="field" required maxLength={100} aria-label={tr('Nom', 'الاسم')} {...field('customerName')} />
          <input className="field" required maxLength={20} dir="ltr" aria-label={tr('Téléphone', 'الهاتف')} {...field('phone')} />
          <input className="field" required maxLength={80} aria-label={tr('Ville', 'المدينة')} {...field('city')} />
          <input className="field" required maxLength={200} aria-label={tr('Adresse', 'العنوان')} {...field('address')} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn-primary" disabled={busy}>{tr('Enregistrer', 'حفظ')}</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>{tr('Annuler', 'إلغاء')}</button>
          </div>
        </form>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{o.customerName}</p>
          <p>
            <a className="tabular-nums underline-offset-2 hover:underline" href={telHref(o.phone)} dir="ltr">{o.phone}</a>
            {o.customerEmail && <span className="text-ink-soft" dir="ltr"> · {o.customerEmail}</span>}
          </p>
          <p dir="auto" className="text-start">{o.address}, {o.city}</p>
          {o.customerNote && <p dir="auto" className="mt-2 whitespace-pre-line border-s-2 border-accent ps-3 text-start text-ink-soft">{o.customerNote}</p>}
        </div>
      )}
    </Section>
  );
}

function ArtisanCard({ lang, order: o }) {
  const tr = t(lang);
  return (
    <Section title={tr('Artisan', 'الحرفي')} icon={Store}>
      {o.store ? (
        <div className="text-sm">
          <p className="font-medium">{o.store.name}</p>
          <p className="text-ink-soft">
            {[o.store.address, o.store.city].filter(Boolean).join(', ') || tr('Adresse non renseignée', 'العنوان غير محدد')}
            {o.store.phone && (
              <>
                {' · '}
                <a className="tabular-nums hover:underline" href={telHref(o.store.phone)} dir="ltr">{o.store.phone}</a>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">{tr(`${o.storeName} (boutique supprimée)`, `${o.storeName} (محل محذوف)`)}</p>
      )}
    </Section>
  );
}

const EVENT_LABELS = {
  CREATED: ['Commande passée', 'تم الطلب'],
  WHATSAPP: ['WhatsApp', 'واتساب'],
  CALL: ['Appel', 'اتصال'],
  EDIT: ['Modification', 'تعديل'],
  NOTE: ['Note', 'ملاحظة'],
};

function History({ lang, order: o, busy, run }) {
  const tr = t(lang);
  const [note, setNote] = useState('');
  const [staffNotes, setStaffNotes] = useState(o.staffNotes || '');
  useEffect(() => setStaffNotes(o.staffNotes || ''), [o.staffNotes]);

  return (
    <Section title={tr('Suivi interne', 'المتابعة الداخلية')} icon={StickyNote}>
      <label className="block text-sm">
        <span className="font-medium">{tr('Notes internes (non visibles par le client)', 'ملاحظات داخلية (لا يراها العميل)')}</span>
        <textarea className="field mt-1 min-h-[70px]" maxLength={2000} value={staffNotes} onChange={(e) => setStaffNotes(e.target.value)} />
      </label>
      {staffNotes !== (o.staffNotes || '') && (
        <button type="button" className="btn-quiet" disabled={busy} onClick={() => run(() => updateOrder(o._id, { staffNotes }))}>
          {tr('Enregistrer les notes', 'حفظ الملاحظات')}
        </button>
      )}

      <ol className="space-y-2 border-s-2 border-canvas-line ps-4 text-sm">
        {(o.events || []).map((e) => {
          const label =
            e.kind === 'STATUS'
              ? `${tr(ORDER_STATUS[e.fromStatus]?.staffFr || '', ORDER_STATUS[e.fromStatus]?.staffAr || '')} → ${tr(ORDER_STATUS[e.toStatus]?.staffFr || '', ORDER_STATUS[e.toStatus]?.staffAr || '')}`
              : tr(...(EVENT_LABELS[e.kind] || EVENT_LABELS.NOTE));
          return (
            <li key={e._id}>
              <p>
                <span className="font-medium">{label}</span>
                {e.message && <span dir="auto" className="text-ink-soft"> — {e.message}</span>}
              </p>
              <p className="text-xs text-ink-faint">
                {when(e.createdAt, lang)}
                {e.actorEmail && <span dir="ltr"> · {e.actorEmail}</span>}
              </p>
            </li>
          );
        })}
      </ol>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (note.trim() && (await run(() => addOrderNote(o._id, note)))) setNote('');
        }}
      >
        <input className="field flex-1" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder={tr('Ajouter une note : l’artisan livre demain matin…', 'أضف ملاحظة…')} />
        <button type="submit" className="btn-quiet" disabled={busy || !note.trim()}>{tr('Ajouter', 'إضافة')}</button>
      </form>
    </Section>
  );
}

/** Go back one step, or cancel */
function OtherActions({ lang, order: o, busy, run }) {
  const tr = t(lang);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const i = ORDER_FLOW.indexOf(o.status);
  const previous = i > 0 ? ORDER_FLOW[i - 1] : null;
  if (o.status === 'DELIVERED' || o.status === 'CANCELLED') return null;

  return (
    <div className="space-y-3 border-t border-canvas-line pt-4">
      {cancelling ? (
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run(() => setOrderStatus(o._id, 'CANCELLED', { cancelReason: reason }))) setCancelling(false);
          }}
        >
          <label className="block text-sm">
            <span className="font-medium">{tr('Raison de l’annulation (visible par le client)', 'سبب الإلغاء (يراه العميل)')}</span>
            <input className="field mt-1" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr('Client injoignable après 3 appels, artisan indisponible…', 'العميل لا يرد، الحرفي غير متاح…')} />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary bg-status-unsafe" disabled={busy || !reason.trim()}>{tr('Annuler la commande', 'إلغاء الطلب')}</button>
            <button type="button" className="btn-ghost" onClick={() => setCancelling(false)}>{tr('Retour', 'رجوع')}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {previous && (
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => run(() => setOrderStatus(o._id, previous))}>
              <Undo2 className="h-4 w-4" />
              {tr(`Revenir à « ${ORDER_STATUS[previous].staffFr} »`, `الرجوع إلى «${ORDER_STATUS[previous].staffAr}»`)}
            </button>
          )}
          <button type="button" className="btn-ghost text-status-unsafe-ink" onClick={() => setCancelling(true)}>
            <X className="h-4 w-4" />
            {tr('Annuler la commande', 'إلغاء الطلب')}
          </button>
        </div>
      )}
    </div>
  );
}

/** Where the WhatsApp confirmation stands, on a NEW order (list row) */
function WhatsAppBadge({ lang, order: o }) {
  const tr = t(lang);
  const label = o.awaitingWhatsApp
    ? tr(`WhatsApp jusqu’au ${when(o.whatsappDeadline, lang)}`, `واتساب حتى ${when(o.whatsappDeadline, lang)}`)
    : o.whatsappStatus === 'SENT'
    ? tr('Pas de réponse WhatsApp', 'لا رد على واتساب')
    : o.whatsappStatus === 'REPLIED'
    ? tr('A répondu sur WhatsApp', 'ردّ على واتساب')
    : o.whatsappStatus === 'FAILED'
    ? tr('WhatsApp en échec', 'فشل واتساب')
    : o.confirmChannel === 'PHONE'
    ? tr('Préfère un appel', 'يفضّل مكالمة')
    : tr('Prix à fixer', 'سعر للتحديد');
  return <span className={`text-xs ${o.awaitingWhatsApp ? 'text-ink-soft' : 'font-medium text-status-unsafe-ink'}`}>{label}</span>;
}

/** WhatsApp confirmation: what was sent, the deadline, and (re)sending the request */
function WhatsAppStatus({ lang, order: o, busy, run, complete }) {
  const tr = t(lang);
  const text = o.awaitingWhatsApp
    ? tr(
        `Demande envoyée le ${when(o.whatsappSentAt, lang)}. Le client confirme en répondant OUI ; sans réponse, appelez-le à partir du ${when(o.whatsappDeadline, lang)}.`,
        `أُرسل الطلب في ${when(o.whatsappSentAt, lang)}. يؤكد العميل بالرد OUI؛ دون رد، اتصل به ابتداء من ${when(o.whatsappDeadline, lang)}.`
      )
    : o.whatsappStatus === 'SENT'
    ? tr(`Pas de réponse au message WhatsApp du ${when(o.whatsappSentAt, lang)} : appelez le client.`, `لا رد على رسالة واتساب: اتصل بالعميل.`)
    : o.whatsappStatus === 'REPLIED'
    ? tr('Le client a répondu autre chose que OUI sur WhatsApp (voir l’historique) : appelez-le.', 'ردّ العميل بشيء آخر غير OUI (انظر السجل): اتصل به.')
    : o.whatsappStatus === 'FAILED'
    ? tr('Le message WhatsApp n’a pas pu être envoyé : appelez le client.', 'تعذر إرسال رسالة واتساب: اتصل بالعميل.')
    : o.confirmChannel === 'PHONE'
    ? tr('Le client a choisi d’être appelé.', 'اختار العميل أن نتصل به.')
    : tr('Pas de demande WhatsApp : un prix ou les frais de livraison étaient à fixer.', 'لم يُرسل طلب واتساب: سعر أو مصاريف توصيل للتحديد.');
  return (
    <div className="flex flex-wrap items-start gap-3 border-b border-accent/30 pb-3">
      <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
      <p className="min-w-[14rem] flex-1 text-sm">{text}</p>
      {!o.awaitingWhatsApp && complete && (
        <button type="button" className="btn-quiet" disabled={busy} onClick={() => run(() => sendOrderWhatsApp(o._id))}>
          <MessageCircle className="h-4 w-4" />
          {o.whatsappStatus === 'NONE' ? tr('Envoyer la demande WhatsApp', 'إرسال طلب واتساب') : tr('Renvoyer sur WhatsApp', 'إعادة الإرسال عبر واتساب')}
        </button>
      )}
    </div>
  );
}
