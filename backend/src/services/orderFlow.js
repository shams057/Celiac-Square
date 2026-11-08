/**
 * The order pipeline, without the database: which step can follow which, what a
 * step needs before it can happen, and the order's total. Used by the order routes
 * and covered by test/orderFlow.test.js.
 *
 *   NEW → CONFIRMED → PREPARING → READY → SHIPPED → DELIVERED
 *   any step before DELIVERED → CANCELLED
 * Each step can also go back one step, to undo a wrong click.
 */
export const ORDER_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const FORWARD = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'];

/** The column stamped when an order reaches a status */
export const STATUS_TIMESTAMP = {
  CONFIRMED: 'confirmed_at',
  PREPARING: 'preparing_at',
  READY: 'ready_at',
  SHIPPED: 'shipped_at',
  DELIVERED: 'delivered_at',
  CANCELLED: 'cancelled_at',
};

export const nextStatus = (status) => {
  const i = FORWARD.indexOf(status);
  return i >= 0 && i < FORWARD.length - 1 ? FORWARD[i + 1] : null;
};

export const previousStatus = (status) => {
  const i = FORWARD.indexOf(status);
  return i > 0 ? FORWARD[i - 1] : null;
};

export const canMove = (from, to) => {
  if (!ORDER_STATUSES.includes(from) || !ORDER_STATUSES.includes(to) || from === to) return false;
  if (to === 'CANCELLED') return from !== 'DELIVERED';
  if (from === 'CANCELLED') return to === 'NEW'; // reopen a cancelled order: it starts over with a new call
  return to === nextStatus(from) || to === previousStatus(from);
};

/**
 * Why `order` (with its `items`) cannot move to `to`, or null when it can.
 * Messages are shown to the team as they are.
 */
export const blockReason = (order, items, to, { cancelReason = '', carrier = '' } = {}) => {
  if (!canMove(order.status, to)) return 'Cette étape ne peut pas suivre l’étape actuelle.';
  if (to === 'CONFIRMED' && order.status === 'NEW') {
    if (!items.length) return 'La commande n’a aucun article.';
    if (items.some((i) => i.unit_price == null)) return 'Indiquez le prix de chaque article, convenu avec le client, avant de confirmer.';
    if (order.delivery_fee == null) return 'Indiquez les frais de livraison (0 si gratuite) avant de confirmer.';
  }
  if (to === 'SHIPPED' && !(carrier || order.carrier).trim()) return 'Indiquez le transporteur avant l’expédition.';
  if (to === 'CANCELLED' && !cancelReason.trim()) return 'Indiquez la raison de l’annulation.';
  return null;
};

/** Sum of the items with a price, plus the delivery fee; complete is false while a price is missing */
export const orderTotal = (items, deliveryFee) => {
  const priced = items.filter((i) => i.unit_price != null);
  const subtotal = priced.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0);
  const total = subtotal + (deliveryFee == null ? 0 : Number(deliveryFee));
  const round = (n) => Math.round(n * 1000) / 1000;
  return { subtotal: round(subtotal), total: round(total), complete: priced.length === items.length && deliveryFee != null };
};

/** Tunisian phone number: 8 digits, optionally with +216 / 00216; spaces, dots and dashes allowed */
export const normalizePhone = (value) => {
  const digits = String(value ?? '').replace(/[\s.\-()]/g, '');
  const m = /^(?:\+216|00216)?(\d{8})$/.exec(digits);
  return m ? `${m[1].slice(0, 2)} ${m[1].slice(2, 5)} ${m[1].slice(5)}` : null;
};

/** Days the team waits for a WhatsApp confirmation before calling (ORDER_WHATSAPP_WAIT_DAYS, default 3) */
export const whatsappWaitDays = () => {
  const n = Number(process.env.ORDER_WHATSAPP_WAIT_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 3;
};

/** When the team stops waiting for the reply and calls: sent + wait days */
export const whatsappDeadline = (sentAt) =>
  sentAt ? new Date(new Date(sentAt).getTime() + whatsappWaitDays() * 24 * 3600 * 1000).toISOString() : null;

/** A NEW order whose WhatsApp request is still within the waiting time: nobody calls it yet */
export const isAwaitingWhatsApp = (order, now = Date.now()) =>
  order.status === 'NEW' && order.whatsapp_status === 'SENT' && Boolean(order.whatsapp_sent_at) && new Date(whatsappDeadline(order.whatsapp_sent_at)).getTime() > now;

/** Delivery fee set on new orders (ORDER_DELIVERY_FEE, in dinars), or null when the team agrees it on the phone */
export const defaultDeliveryFee = () => {
  const raw = process.env.ORDER_DELIVERY_FEE;
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 1000) / 1000 : null;
};
