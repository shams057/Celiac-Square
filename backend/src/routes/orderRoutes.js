import { db, unwrap, isMissingTable, FEATURE_UNAVAILABLE } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { limits } from '../middleware/rateLimit.js';
import { toOrder } from '../models/mappers.js';
import { asyncRouter, clean, UUID_RE, MAX_LEN, tooLong, badRequest } from '../utils/http.js';
import { normalizePhone, defaultDeliveryFee, whatsappWaitDays } from '../services/orderFlow.js';
import { requestConfirmation } from '../services/orderConfirmation.js';
import { confirmWords } from '../services/whatsapp.js';

/**
 * Customer side of the orders: place an order, follow it, cancel it while the team
 * has not called yet. The team's side is in orderAdminRoutes.js.
 */
const router = asyncRouter();

router.use(requireUser);

const MAX_LINES = 30;
const MAX_QUANTITY = 50;
const ORDER_SELECT = '*, order_items(*)';

/**
 * POST /api/orders
 * Body: { items: [{ productId, quantity }], customerName, phone, city, address, note, confirmChannel }
 * Creates one order per store. Prices are copied from the products; a product without a
 * price is ordered "price to confirm" and the team agrees it with the customer on the phone.
 * confirmChannel WHATSAPP (default): when every price is known, one WhatsApp message asks the
 * customer to reply OUI; otherwise, or with PHONE, the order goes to the team's call list.
 */
router.post('/', limits.orders, async (req, res) => {
  const body = req.body || {};
  const customerName = clean(body.customerName);
  const city = clean(body.city);
  const address = clean(body.address);
  const note = clean(body.note);
  const phone = normalizePhone(body.phone);
  const confirmChannel = clean(body.confirmChannel).toUpperCase() === 'PHONE' ? 'PHONE' : 'WHATSAPP';

  if (!customerName || !city || !address) return badRequest(res, 'Nom, ville et adresse de livraison sont obligatoires.');
  if (!phone) return badRequest(res, 'Numéro de téléphone invalide : 8 chiffres, par exemple 22 123 456.');
  const long = tooLong({
    Nom: [customerName, MAX_LEN.fullName],
    Ville: [city, MAX_LEN.city],
    Adresse: [address, MAX_LEN.address],
    Remarque: [note, MAX_LEN.notes],
  });
  if (long) return badRequest(res, long);

  // Same product twice in the request: add the quantities
  const wanted = new Map();
  for (const line of Array.isArray(body.items) ? body.items : []) {
    const id = clean(line?.productId);
    const quantity = Number(line?.quantity);
    if (!UUID_RE.test(id) || !Number.isInteger(quantity) || quantity < 1) return badRequest(res, 'Panier invalide.');
    wanted.set(id, (wanted.get(id) || 0) + quantity);
  }
  if (wanted.size === 0) return badRequest(res, 'Votre panier est vide.');
  if (wanted.size > MAX_LINES) return badRequest(res, `${MAX_LINES} produits différents au maximum par commande.`);
  if ([...wanted.values()].some((q) => q > MAX_QUANTITY)) return badRequest(res, `${MAX_QUANTITY} exemplaires au maximum par produit.`);

  const products = unwrap(
    await db()
      .from('market_products')
      .select('id, title, price, images, is_available, store_id, stores!inner(id, name, is_active)')
      .in('id', [...wanted.keys()])
  );
  const sellable = products.filter((p) => p.is_available && p.stores.is_active);
  if (sellable.length !== wanted.size) {
    return res.status(409).json({
      success: false,
      code: 'PRODUCTS_UNAVAILABLE',
      message: 'Certains produits ne sont plus disponibles. Retirez-les du panier puis réessayez.',
      unavailable: [...wanted.keys()].filter((id) => !sellable.some((p) => p.id === id)),
    });
  }

  const byStore = new Map();
  for (const p of sellable) {
    if (!byStore.has(p.store_id)) byStore.set(p.store_id, { name: p.stores.name, products: [] });
    byStore.get(p.store_id).products.push(p);
  }

  const created = [];
  for (const [storeId, { name, products: items }] of byStore) {
    const { data, error } = await db()
      .from('orders')
      .insert({
        customer_id: req.user.id,
        store_id: storeId,
        store_name: name,
        customer_name: customerName,
        phone,
        city,
        address,
        customer_note: note,
        confirm_channel: confirmChannel,
        delivery_fee: defaultDeliveryFee(),
      })
      .select('id')
      .single();
    if (isMissingTable(error)) return res.status(503).json(FEATURE_UNAVAILABLE);
    if (error) throw new Error(error.message);

    const lines = items.map((p) => ({
      order_id: data.id,
      product_id: p.id,
      title: p.title,
      image: p.images?.[0] || '',
      unit_price: p.price,
      quantity: wanted.get(p.id),
    }));
    const inserted = await db().from('order_items').insert(lines);
    if (inserted.error) {
      await db().from('orders').delete().eq('id', data.id); // no empty order in the team's list
      throw new Error(inserted.error.message);
    }
    await db().from('order_events').insert({
      order_id: data.id,
      actor_id: req.user.id,
      actor_email: req.user.email,
      kind: 'CREATED',
      to_status: 'NEW',
      message: 'Commande passée par le client.',
    });
    created.push(data.id);
  }

  let rows = unwrap(await db().from('orders').select(ORDER_SELECT).in('id', created).order('number'));
  let whatsapp = { sent: false, reason: 'PHONE' };
  if (confirmChannel === 'WHATSAPP') {
    whatsapp = await requestConfirmation(rows);
    if (whatsapp.sent) rows = unwrap(await db().from('orders').select(ORDER_SELECT).in('id', created).order('number'));
  }
  const many = rows.length > 1;
  return res.status(201).json({
    success: true,
    whatsappSent: whatsapp.sent,
    confirmWord: confirmWords()[0],
    waitDays: whatsappWaitDays(),
    message: whatsapp.sent
      ? `${many ? `${rows.length} commandes envoyées (une par boutique).` : 'Commande envoyée.'} Répondez ${confirmWords()[0]} au message WhatsApp que nous venons de vous envoyer pour la confirmer.`
      : `${many ? `${rows.length} commandes envoyées (une par boutique).` : 'Commande envoyée.'} Notre équipe vous appelle pour confirmer les prix et la livraison.`,
    data: rows.map((r) => toOrder(r)),
  });
});

/**
 * GET /api/orders/mine
 * The customer's orders, newest first
 */
router.get('/mine', async (req, res) => {
  const { data, error } = await db()
    .from('orders')
    .select(ORDER_SELECT)
    .eq('customer_id', req.user.id)
    .order('created_at', { ascending: false })
    .limit(100);
  if (isMissingTable(error)) return res.status(503).json(FEATURE_UNAVAILABLE);
  if (error) throw new Error(error.message);
  return res.json({ success: true, data: data.map((r) => toOrder(r)) });
});

/**
 * POST /api/orders/:id/cancel
 * Only while the order is NEW: after the call, the customer asks the team instead.
 */
router.post('/:id/cancel', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ success: false, message: 'Commande introuvable.' });
  const [updated] = unwrap(
    await db()
      .from('orders')
      .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString(), cancel_reason: 'Annulée par le client.' })
      .eq('id', req.params.id)
      .eq('customer_id', req.user.id)
      .eq('status', 'NEW')
      .select('id')
  );
  if (!updated) {
    return res.status(409).json({
      success: false,
      message: 'Cette commande ne peut plus être annulée en ligne. Appelez-nous pour la modifier ou l’annuler.',
    });
  }
  await db().from('order_events').insert({
    order_id: updated.id,
    actor_id: req.user.id,
    actor_email: req.user.email,
    kind: 'STATUS',
    from_status: 'NEW',
    to_status: 'CANCELLED',
    message: 'Annulée par le client.',
  });
  const row = unwrap(await db().from('orders').select(ORDER_SELECT).eq('id', updated.id).single());
  return res.json({ success: true, message: 'Commande annulée.', data: toOrder(row) });
});

export default router;
