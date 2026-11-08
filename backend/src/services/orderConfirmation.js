import { db, unwrap } from '../config/db.js';
import { formatTnd } from './money.js';
import { orderTotal, whatsappWaitDays } from './orderFlow.js';
import { isWhatsAppConfigured, sendConfirmationRequest, sendText, isConfirmation, fromWhatsAppId, confirmWords } from './whatsapp.js';

/**
 * Order confirmation by WhatsApp:
 *   1. requestConfirmation: one message for the orders of a checkout (one per store), with the total.
 *   2. handleReply: the customer answers. The keyword (OUI, any case) confirms every order
 *      waiting for that number; anything else is kept for the team, who calls.
 *   3. No answer within whatsappWaitDays(): the order shows up in the team's call list
 *      (a query on whatsapp_sent_at, so nothing has to run on a schedule).
 */

const event = (orderId, fields) =>
  db()
    .from('order_events')
    .insert({ order_id: orderId, actor_id: null, actor_email: 'WhatsApp', ...fields })
    .then(({ error }) => error && console.error(`[WhatsApp] event ${orderId}: ${error.message}`));

const references = (orders) => orders.map((o) => `CS-${o.number}`).join(', ');

/** Why these orders cannot be confirmed by WhatsApp, or null when they can */
export const whatsappBlocker = (orders) => {
  if (!isWhatsAppConfigured()) return 'WhatsApp n’est pas configuré sur le serveur.';
  for (const o of orders) {
    if (o.status !== 'NEW') return `La commande CS-${o.number} n’est plus à confirmer.`;
    if (!orderTotal(o.order_items, o.delivery_fee).complete) return `La commande CS-${o.number} a un prix ou des frais de livraison à fixer.`;
  }
  return null;
};

/**
 * Sends the confirmation request for `orders` (rows with order_items, same customer and phone).
 * Never throws: on failure the orders are marked FAILED and go to the call list.
 * Returns { sent: boolean, reason }.
 */
export const requestConfirmation = async (orders) => {
  if (!orders.length) return { sent: false, reason: 'Aucune commande.' };
  const blocked = whatsappBlocker(orders);
  if (blocked) return { sent: false, reason: blocked };

  const ids = orders.map((o) => o.id);
  const items = orders.flatMap((o) => o.order_items.map((i) => `${i.quantity} × ${i.title}`)).join(', ');
  const total = orders.reduce((sum, o) => sum + orderTotal(o.order_items, o.delivery_fee).total, 0);
  const first = orders[0];

  try {
    const messageId = await sendConfirmationRequest(first.phone, {
      name: first.customer_name,
      references: references(orders),
      items,
      total: formatTnd(total),
    });
    unwrap(
      await db()
        .from('orders')
        .update({ whatsapp_status: 'SENT', whatsapp_sent_at: new Date().toISOString(), whatsapp_message_id: messageId })
        .in('id', ids)
        .select('id')
    );
    const words = confirmWords().join(' / ');
    await Promise.all(ids.map((id) => event(id, { kind: 'WHATSAPP', message: `Demande de confirmation envoyée (réponse attendue : ${words}, sous ${whatsappWaitDays()} jours).` })));
    return { sent: true, reason: '' };
  } catch (err) {
    console.error(`[WhatsApp] ${references(orders)}: ${err.message}`);
    await db().from('orders').update({ whatsapp_status: 'FAILED' }).in('id', ids);
    await Promise.all(ids.map((id) => event(id, { kind: 'WHATSAPP', message: `Échec de l’envoi WhatsApp (${err.message.slice(0, 200)}) : à appeler.` })));
    return { sent: false, reason: 'WhatsApp a refusé le message : appelez le client.' };
  }
};

/**
 * A message from a customer. Returns what was done, for the logs and tests:
 * 'confirmed' | 'replied' | 'ignored'.
 */
export const handleReply = async ({ from, text }) => {
  const phone = fromWhatsAppId(from);
  if (!phone) return 'ignored';

  const waiting = unwrap(
    await db()
      .from('orders')
      .select('id, number, status, whatsapp_status')
      .eq('phone', phone)
      .eq('status', 'NEW')
      .in('whatsapp_status', ['SENT', 'REPLIED'])
      .order('number')
  );
  if (!waiting.length) return 'ignored';

  const quoted = String(text).slice(0, 300);
  if (isConfirmation(text)) {
    const confirmed = [];
    for (const o of waiting) {
      // Only from NEW: if a worker moved it meanwhile, their change wins
      const { data } = await db()
        .from('orders')
        .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString(), whatsapp_status: 'CONFIRMED' })
        .eq('id', o.id)
        .eq('status', 'NEW')
        .select('id');
      if (!data?.length) continue;
      confirmed.push(o);
      await event(o.id, { kind: 'STATUS', from_status: 'NEW', to_status: 'CONFIRMED', message: `Confirmée par le client sur WhatsApp : « ${quoted} »` });
    }
    if (confirmed.length) {
      await sendText(
        from,
        `Merci ! ${confirmed.length > 1 ? 'Vos commandes' : 'Votre commande'} ${references(confirmed)} ${confirmed.length > 1 ? 'sont confirmées' : 'est confirmée'}. Nous la transmettons à l’artisan et vous prévenons à l’expédition. Paiement à la livraison.`
      ).catch((err) => console.error(`[WhatsApp] thank-you to ${from}: ${err.message}`));
    }
    return confirmed.length ? 'confirmed' : 'ignored';
  }

  await db().from('orders').update({ whatsapp_status: 'REPLIED' }).in('id', waiting.map((o) => o.id));
  await Promise.all(waiting.map((o) => event(o.id, { kind: 'WHATSAPP', message: `Réponse du client : « ${quoted} » — à rappeler.` })));
  await sendText(
    from,
    `Merci pour votre message. Pour confirmer ${references(waiting)}, répondez simplement ${confirmWords()[0]}. Sinon, notre équipe vous appelle très vite.`
  ).catch((err) => console.error(`[WhatsApp] answer to ${from}: ${err.message}`));
  return 'replied';
};
