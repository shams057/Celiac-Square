import React, { useCallback, useEffect, useState } from 'react';
import { Truck, X } from 'lucide-react';
import { fetchMyOrders, cancelMyOrder, errorMessage } from '../services/api';
import { navigate, pathFor } from '../services/router';
import { useAuth } from './AuthContext';
import AuthPanel from './AuthPanel';
import { t, PageHead, Spinner, Notice, EmptyState, formatPrice } from './ui';
import { OrderStatusPill, ORDER_FLOW, orderTotals, when } from './orders';

const STEP_LABELS = {
  NEW: ['Reçue', 'استُلم'],
  CONFIRMED: ['Confirmée', 'مؤكد'],
  PREPARING: ['En préparation', 'قيد التحضير'],
  READY: ['Prête', 'جاهز'],
  SHIPPED: ['En livraison', 'قيد التوصيل'],
  DELIVERED: ['Livrée', 'تم التسليم'],
};

/** The customer's orders and where each one is */
export default function MyOrders({ lang }) {
  const tr = t(lang);
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [state, setState] = useState('loading'); // loading | ready | error | unavailable
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetchMyOrders();
      setOrders(res.data || []);
      setState('ready');
    } catch (err) {
      setState(err?.response?.data?.code === 'FEATURE_UNAVAILABLE' ? 'unavailable' : 'error');
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return <AuthPanel lang={lang} />;

  const cancel = async (order) => {
    if (!window.confirm(tr(`Annuler la commande ${order.reference} ?`, `إلغاء الطلب ${order.reference}؟`))) return;
    setBusy(order._id);
    setMessage('');
    try {
      const res = await cancelMyOrder(order._id);
      setOrders((list) => list.map((o) => (o._id === order._id ? res.data : o)));
      setMessage(res.message);
    } catch (err) {
      setMessage(errorMessage(err, tr('L’annulation a échoué.', 'فشل الإلغاء.')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHead
        title={tr('Mes commandes', 'طلباتي')}
        lede={tr('Notre équipe appelle pour confirmer chaque commande, la transmet à l’artisan puis organise la livraison. Paiement à la livraison.', 'يتصل فريقنا لتأكيد كل طلب، ثم يرسله إلى الحرفي وينظّم التوصيل. الدفع عند الاستلام.')}
      />
      {message && <Notice tone="info">{message}</Notice>}
      {state === 'loading' ? (
        <Spinner label={tr('Chargement…', 'جاري التحميل…')} />
      ) : state === 'unavailable' ? (
        <Notice tone="warning">{tr('Les commandes ne sont pas encore ouvertes.', 'الطلبات غير متاحة بعد.')}</Notice>
      ) : state === 'error' ? (
        <Notice tone="error" action={<button type="button" className="btn-quiet" onClick={load}>{tr('Réessayer', 'إعادة المحاولة')}</button>}>
          {tr('Vos commandes n’ont pas pu être chargées.', 'تعذر تحميل طلباتك.')}
        </Notice>
      ) : orders.length === 0 ? (
        <EmptyState
          title={tr('Aucune commande pour le moment', 'لا توجد طلبات بعد')}
          action={<button type="button" className="btn-primary" onClick={() => navigate(pathFor('market'))}>{tr('Aller au marché', 'الذهاب إلى السوق')}</button>}
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            const totals = orderTotals(o.items, o.deliveryFee);
            const reached = ORDER_FLOW.indexOf(o.status);
            return (
              <li key={o._id} className="panel space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold tabular-nums" dir="ltr">{o.reference}</span>
                  <OrderStatusPill status={o.status} lang={lang} />
                  <span className="ms-auto text-xs text-ink-faint">{when(o.createdAt, lang)}</span>
                </div>
                <p className="text-sm font-medium">{o.storeName}</p>
                {o.awaitingWhatsApp && (
                  <Notice tone="info" title={tr('Confirmez sur WhatsApp', 'أكّد عبر واتساب')}>
                    {tr(
                      `Répondez OUI au message que nous vous avons envoyé. Sans réponse d’ici le ${when(o.whatsappDeadline, lang)}, notre équipe vous appelle.`,
                      `أجب بـ OUI على الرسالة التي أرسلناها. دون رد قبل ${when(o.whatsappDeadline, lang)}، يتصل بك فريقنا.`
                    )}
                  </Notice>
                )}

                {o.status !== 'CANCELLED' && (
                  <ol className="grid grid-cols-6 gap-1" aria-label={tr('Avancement', 'التقدم')}>
                    {ORDER_FLOW.map((s, i) => (
                      <li key={s} className="space-y-1">
                        <span className={`block h-1.5 rounded-full ${i <= reached ? 'bg-status-safe' : 'bg-canvas-sunk'}`} />
                        <span className={`hidden text-[11px] sm:block ${i <= reached ? 'text-ink' : 'text-ink-faint'}`}>{tr(...STEP_LABELS[s])}</span>
                      </li>
                    ))}
                  </ol>
                )}

                <ul className="space-y-1.5 text-sm">
                  {o.items.map((i) => (
                    <li key={i._id} className="flex gap-3">
                      <span className="tabular-nums text-ink-soft">{i.quantity}×</span>
                      <span dir="auto" className="flex-1 text-start">{i.title}</span>
                      <span className="tabular-nums">{i.unitPrice != null ? formatPrice(i.unitPrice * i.quantity, lang) : tr('à confirmer', 'يُؤكَّد')}</span>
                    </li>
                  ))}
                  {o.deliveryFee != null && (
                    <li className="flex gap-3 text-ink-soft">
                      <span className="flex-1">{tr('Livraison', 'التوصيل')}</span>
                      <span className="tabular-nums">{formatPrice(o.deliveryFee, lang)}</span>
                    </li>
                  )}
                  <li className="flex gap-3 border-t border-canvas-line pt-1.5 font-medium">
                    <span className="flex-1">{totals.complete ? tr('Total à payer à la livraison', 'المجموع عند الاستلام') : tr('Total (prix à confirmer)', 'المجموع (يُؤكَّد)')}</span>
                    <span className="tabular-nums">{formatPrice(totals.total, lang)}</span>
                  </li>
                </ul>

                {o.status === 'SHIPPED' && (o.carrier || o.trackingNumber) && (
                  <p className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-ink-soft" />
                    {o.carrier}
                    {o.trackingNumber && <span className="tabular-nums text-ink-soft" dir="ltr">· {o.trackingNumber}</span>}
                  </p>
                )}
                {o.status === 'CANCELLED' && o.cancelReason && <p className="text-sm text-ink-soft">{o.cancelReason}</p>}
                <p className="text-xs text-ink-faint">
                  {tr('Livraison :', 'التوصيل:')} {o.customerName} · <span dir="ltr">{o.phone}</span> · {o.address}, {o.city}
                </p>
                {o.status === 'NEW' && (
                  <button type="button" className="btn-ghost -ms-3" disabled={busy === o._id} onClick={() => cancel(o)}>
                    <X className="h-4 w-4" />
                    {tr('Annuler la commande', 'إلغاء الطلب')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
