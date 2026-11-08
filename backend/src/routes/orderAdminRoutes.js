import { db, unwrap, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { requireStaff } from '../middleware/adminAuth.js';
import { toOrder } from '../models/mappers.js';
import { containsPattern } from '../utils/regex.js';
import { asyncRouter, clean, UUID_RE, MAX_LEN, tooLong, badRequest } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { ORDER_STATUSES, STATUS_TIMESTAMP, blockReason, normalizePhone, isAwaitingWhatsApp, whatsappWaitDays } from '../services/orderFlow.js';
import { requestConfirmation, whatsappBlocker } from '../services/orderConfirmation.js';

/**
 * Back-office side of the orders, for the team (STAFF) and admins:
 *   call the customer → confirm → pass to the artisan → ready → ship → delivered.
 * Every change is written to order_events (the order's history) and the audit log.
 */
const router = asyncRouter();

router.use(requireStaff);

const LIST_SELECT = '*, order_items(*)';
const DETAIL_SELECT = '*, order_items(*), order_events(*), stores(name, phone, city, address), customer:profiles!orders_customer_id_fkey(email)';
const notFound = (res) => res.status(404).json({ success: false, message: 'Commande introuvable.' });

const loadOrder = async (id) => {
  if (!UUID_RE.test(id)) return null;
  return unwrap(await db().from('orders').select(DETAIL_SELECT).eq('id', id).maybeSingle());
};

const logEvent = (req, orderId, event) =>
  db()
    .from('order_events')
    .insert({ order_id: orderId, actor_id: req.user.id, actor_email: req.user.email, ...event })
    .then(({ error }) => error && console.error(`[Orders] event ${orderId}: ${error.message}`));

/** '' or null clears; anything else must be a non-negative amount in dinars */
const parseAmount = (v) => {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 1000) / 1000 : NaN;
};

/**
 * GET /api/admin/orders?status=NEW|WAITING|CONFIRMED|…|ACTIVE|ALL&q=
 * NEW is the call list: new orders not waiting for a WhatsApp reply (never sent, failed,
 * answered with something else, or no reply after the waiting time). WAITING is the new
 * orders still within the WhatsApp waiting time. ACTIVE is everything in progress.
 * q searches the number, name, phone, store and city. Also returns the count per tab.
 */
router.get('/', async (req, res) => {
  const status = clean(req.query.status).toUpperCase() || 'ACTIVE';
  const cutoff = new Date(Date.now() - whatsappWaitDays() * 24 * 3600 * 1000).toISOString();
  let query = db()
    .from('orders')
    .select(LIST_SELECT)
    .order('created_at', { ascending: status === 'NEW' || status === 'WAITING' })
    .limit(300);
  if (status === 'WAITING') query = query.eq('status', 'NEW').eq('whatsapp_status', 'SENT').gt('whatsapp_sent_at', cutoff);
  else if (status === 'NEW') query = query.eq('status', 'NEW').or(`whatsapp_status.neq.SENT,whatsapp_sent_at.lte."${cutoff}"`);
  else if (ORDER_STATUSES.includes(status)) query = query.eq('status', status);
  else if (status === 'ACTIVE') query = query.not('status', 'in', '(DELIVERED,CANCELLED)');

  const q = clean(req.query.q).slice(0, 80);
  if (q) {
    const number = /^(?:cs-?)?(\d{1,9})$/i.exec(q.replace(/\s/g, ''));
    if (number) query = query.eq('number', Number(number[1]));
    else {
      const p = containsPattern(q);
      query = query.or(`customer_name.ilike.${p},phone.ilike.${p},store_name.ilike.${p},city.ilike.${p}`);
    }
  }

  const [rows, active] = await Promise.all([
    query,
    db().from('orders').select('status, whatsapp_status, whatsapp_sent_at').not('status', 'in', '(DELIVERED,CANCELLED)'),
  ]);
  if (isMissingTable(rows.error)) return res.status(503).json(FEATURE_UNAVAILABLE);
  const counts = Object.fromEntries([...ORDER_STATUSES, 'WAITING'].map((s) => [s, 0]));
  for (const r of unwrap(active)) counts[isAwaitingWhatsApp(r) ? 'WAITING' : r.status] += 1;
  return res.json({ success: true, counts, waitDays: whatsappWaitDays(), data: unwrap(rows).map((r) => toOrder(r, { staff: true })) });
});

/**
 * GET /api/admin/orders/:id
 * The order with its items, history, customer email and the artisan's contact details
 */
router.get('/:id', async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return notFound(res);
  return res.json({ success: true, data: toOrder(order, { staff: true }) });
});

/**
 * PATCH /api/admin/orders/:id
 * Body (all optional): { customerName, phone, city, address, deliveryFee, carrier, trackingNumber,
 *   staffNotes, items: [{ _id, unitPrice, quantity }] }
 * Prices and quantities are what was agreed with the customer on the phone. Items can no
 * longer change once the order is with the artisan.
 */
router.patch('/:id', async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return notFound(res);
  const b = req.body || {};
  const row = {};
  const changed = [];

  const text = { customerName: 'customer_name', city: 'city', address: 'address', carrier: 'carrier', trackingNumber: 'tracking_number', staffNotes: 'staff_notes' };
  for (const [key, column] of Object.entries(text)) {
    if (b[key] === undefined) continue;
    const value = clean(b[key]);
    if (value !== order[column]) {
      row[column] = value;
      if (key !== 'staffNotes') changed.push(key);
    }
  }
  if (b.phone !== undefined) {
    const phone = normalizePhone(b.phone);
    if (!phone) return badRequest(res, 'Numéro de téléphone invalide.');
    if (phone !== order.phone) {
      row.phone = phone;
      changed.push('phone');
    }
  }
  if ((row.customer_name === '' || row.city === '' || row.address === '')) return badRequest(res, 'Nom, ville et adresse ne peuvent pas être vides.');
  const long = tooLong({
    Nom: [row.customer_name, MAX_LEN.fullName],
    Ville: [row.city, MAX_LEN.city],
    Adresse: [row.address, MAX_LEN.address],
    Transporteur: [row.carrier, 60],
    'Numéro de suivi': [row.tracking_number, 80],
    'Notes internes': [row.staff_notes, MAX_LEN.description],
  });
  if (long) return badRequest(res, long);

  const fee = parseAmount(b.deliveryFee);
  if (Number.isNaN(fee)) return badRequest(res, 'Frais de livraison invalides.');
  if (fee !== undefined && fee !== (order.delivery_fee == null ? null : Number(order.delivery_fee))) {
    row.delivery_fee = fee;
    changed.push('deliveryFee');
  }

  const itemUpdates = [];
  if (Array.isArray(b.items)) {
    for (const it of b.items) {
      const current = order.order_items.find((i) => i.id === it?._id);
      if (!current) return badRequest(res, 'Article inconnu dans cette commande.');
      const update = {};
      const price = parseAmount(it.unitPrice);
      if (Number.isNaN(price)) return badRequest(res, `Prix invalide pour « ${current.title} ».`);
      if (price !== undefined && price !== (current.unit_price == null ? null : Number(current.unit_price))) update.unit_price = price;
      if (it.quantity !== undefined) {
        const q = Number(it.quantity);
        if (!Number.isInteger(q) || q < 1 || q > 50) return badRequest(res, `Quantité invalide pour « ${current.title} ».`);
        if (q !== current.quantity) update.quantity = q;
      }
      if (Object.keys(update).length) itemUpdates.push({ id: current.id, title: current.title, update });
    }
  }
  if (itemUpdates.length && !['NEW', 'CONFIRMED'].includes(order.status)) {
    return badRequest(res, 'Les articles ne peuvent plus changer : la commande est déjà chez l’artisan.');
  }

  // The WhatsApp message quoted the old total: the customer must not confirm a price that changed
  const staleRequest = order.status === 'NEW' && ['SENT', 'REPLIED'].includes(order.whatsapp_status) && (itemUpdates.length > 0 || row.delivery_fee !== undefined);
  if (staleRequest) row.whatsapp_status = 'NONE';
  if (Object.keys(row).length) unwrap(await db().from('orders').update(row).eq('id', order.id).select('id'));
  for (const { id, update } of itemUpdates) unwrap(await db().from('order_items').update(update).eq('id', id).select('id'));

  const labels = { customerName: 'nom', phone: 'téléphone', city: 'ville', address: 'adresse', deliveryFee: 'frais de livraison', carrier: 'transporteur', trackingNumber: 'numéro de suivi' };
  const summary = [...changed.map((k) => labels[k]), ...itemUpdates.map((i) => `« ${i.title} »`)];
  if (summary.length) {
    await logEvent(req, order.id, { kind: 'EDIT', message: `Modifié : ${summary.join(', ')}.`.slice(0, 1000) });
    if (staleRequest) await logEvent(req, order.id, { kind: 'WHATSAPP', message: 'Prix modifiés : la demande WhatsApp n’est plus valable. Renvoyez-la ou appelez le client.' });
    await audit(req, 'order.edit', order.id, { number: order.number, fields: summary });
  }
  const fresh = await loadOrder(order.id);
  return res.json({ success: true, message: 'Commande enregistrée.', data: toOrder(fresh, { staff: true }) });
});

/**
 * POST /api/admin/orders/:id/whatsapp
 * Sends (or sends again) the WhatsApp confirmation request, once prices and delivery fee are set.
 * The waiting time starts again from now.
 */
router.post('/:id/whatsapp', async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return notFound(res);
  const blocked = whatsappBlocker([order]);
  if (blocked) return res.status(409).json({ success: false, message: blocked });
  const result = await requestConfirmation([order]);
  await audit(req, 'order.whatsapp', order.id, { number: order.number, sent: result.sent });
  const fresh = await loadOrder(order.id);
  if (!result.sent) return res.status(502).json({ success: false, message: result.reason, data: toOrder(fresh, { staff: true }) });
  return res.json({ success: true, message: `Demande envoyée sur WhatsApp. Sans réponse sous ${whatsappWaitDays()} jours, la commande revient dans « À appeler ».`, data: toOrder(fresh, { staff: true }) });
});

/**
 * POST /api/admin/orders/:id/calls
 * Body: { outcome: 'REACHED' | 'NO_ANSWER' | 'CALL_BACK', note }
 * Logs a call to the customer. Reaching them does not confirm the order: that is a status change.
 */
const CALL_OUTCOMES = { REACHED: 'Client joint', NO_ANSWER: 'Pas de réponse', CALL_BACK: 'À rappeler' };
router.post('/:id/calls', async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return notFound(res);
  const outcome = clean(req.body?.outcome).toUpperCase();
  if (!CALL_OUTCOMES[outcome]) return badRequest(res, 'Résultat d’appel inconnu.');
  const note = clean(req.body?.note).slice(0, 500);

  unwrap(
    await db()
      .from('orders')
      .update({ call_attempts: order.call_attempts + 1, last_call_at: new Date().toISOString() })
      .eq('id', order.id)
      .select('id')
  );
  await logEvent(req, order.id, { kind: 'CALL', message: note ? `${CALL_OUTCOMES[outcome]} — ${note}` : CALL_OUTCOMES[outcome] });
  const fresh = await loadOrder(order.id);
  return res.json({ success: true, message: `Appel noté : ${CALL_OUTCOMES[outcome].toLowerCase()}.`, data: toOrder(fresh, { staff: true }) });
});

/**
 * POST /api/admin/orders/:id/notes
 * Body: { note } — a line in the order's history (what the artisan said, a delay…)
 */
router.post('/:id/notes', async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return notFound(res);
  const note = clean(req.body?.note);
  if (!note) return badRequest(res, 'La note est vide.');
  if (note.length > 1000) return badRequest(res, 'Note trop longue (1000 caractères au maximum).');
  await logEvent(req, order.id, { kind: 'NOTE', message: note });
  const fresh = await loadOrder(order.id);
  return res.json({ success: true, message: 'Note ajoutée.', data: toOrder(fresh, { staff: true }) });
});

/**
 * POST /api/admin/orders/:id/status
 * Body: { status, note, cancelReason, carrier, trackingNumber }
 * Moves the order one step forward or back, or cancels it (see services/orderFlow.js).
 */
const STATUS_MESSAGES = {
  NEW: 'Commande remise à confirmer.',
  CONFIRMED: 'Commande confirmée avec le client.',
  PREPARING: 'Commande transmise à l’artisan.',
  READY: 'Commande prête chez l’artisan.',
  SHIPPED: 'Commande expédiée.',
  DELIVERED: 'Commande livrée.',
  CANCELLED: 'Commande annulée.',
};
router.post('/:id/status', async (req, res) => {
  const order = await loadOrder(req.params.id);
  if (!order) return notFound(res);
  const b = req.body || {};
  const to = clean(b.status).toUpperCase();
  const cancelReason = clean(b.cancelReason).slice(0, 300);
  const carrier = clean(b.carrier).slice(0, 60);
  const trackingNumber = clean(b.trackingNumber).slice(0, 80);
  const note = clean(b.note).slice(0, 500);

  const blocked = blockReason(order, order.order_items, to, { cancelReason, carrier });
  if (blocked) return res.status(409).json({ success: false, message: blocked });

  const row = { status: to };
  if (STATUS_TIMESTAMP[to]) row[STATUS_TIMESTAMP[to]] = new Date().toISOString();
  if (to === 'CANCELLED') row.cancel_reason = cancelReason;
  if (order.status === 'CANCELLED') {
    row.cancel_reason = '';
    row.cancelled_at = null;
  }
  if (to === 'SHIPPED') {
    if (carrier) row.carrier = carrier;
    if (trackingNumber) row.tracking_number = trackingNumber;
  }

  // Only from the status we read: two workers clicking at once cannot both move it
  const [moved] = unwrap(await db().from('orders').update(row).eq('id', order.id).eq('status', order.status).select('id'));
  if (!moved) return res.status(409).json({ success: false, message: 'La commande vient d’être modifiée par quelqu’un d’autre. Rechargez-la.' });

  const detail = [to === 'CANCELLED' ? cancelReason : '', to === 'SHIPPED' ? [carrier || order.carrier, trackingNumber].filter(Boolean).join(' · ') : '', note]
    .filter(Boolean)
    .join(' — ');
  await logEvent(req, order.id, { kind: 'STATUS', from_status: order.status, to_status: to, message: detail.slice(0, 1000) });
  await audit(req, `order.${to.toLowerCase()}`, order.id, { number: order.number, from: order.status });

  const fresh = await loadOrder(order.id);
  return res.json({ success: true, message: STATUS_MESSAGES[to], data: toOrder(fresh, { staff: true }) });
});

export default router;
