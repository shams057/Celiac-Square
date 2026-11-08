import { whatsappDeadline, isAwaitingWhatsApp } from '../services/orderFlow.js';
/**
 * Convert database rows (snake_case) to the JSON the frontend expects
 * (camelCase, `_id`, GeoJSON-like `location`), which predates the move to Postgres.
 */

export const toSpot = (r) => ({
  _id: r.id,
  name: r.name,
  category: r.category,
  // Main category first; rows written before categories existed only have `category`
  categories: Array.isArray(r.categories) && r.categories.length ? r.categories : [r.category],
  location: { type: 'Point', coordinates: [r.lng, r.lat] },
  city: r.city,
  address: r.address,
  phone: r.phone,
  isVerified: r.is_verified,
  speciality: r.speciality,
  hours: r.hours,
  // No review system yet: null until real reviews exist
  rating: r.rating == null ? null : Number(r.rating),
  reviewCount: r.review_count ?? 0,
  verifiedAt: r.verified_at ?? null,
  notes: r.notes,
  crossContaminationRisk: r.cross_contamination_risk ?? false,
  // Photos, menu pages and videos served from /spots/<slug>/ ({ type, src, kind?, poster?, alt, credit? })
  media: Array.isArray(r.media) ? r.media : [],
  links: Array.isArray(r.links) ? r.links : [],
  submittedBy: r.submitted_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toProposal = (r) => ({
  _id: r.id,
  name: r.name,
  category: r.category,
  city: r.city,
  address: r.address,
  coordinates: r.lng != null && r.lat != null ? [r.lng, r.lat] : undefined,
  phone: r.phone,
  speciality: r.speciality,
  hours: r.hours,
  notes: r.notes,
  submittedBy: r.submitted_by,
  status: r.status,
  reviewedAt: r.reviewed_at,
  spot: r.spot_id,
  createdAt: r.created_at,
});

export const toProfile = (r) => ({
  _id: r.id,
  email: r.email,
  fullName: r.full_name,
  phone: r.phone ?? '',
  role: r.role,
  createdAt: r.created_at,
});

export const toStore = (r) => ({
  _id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  type: r.type,
  city: r.city,
  address: r.address,
  phone: r.phone,
  description: r.description,
  logoUrl: r.logo_url,
  isActive: r.is_active,
  // Present when the query embeds the products' count: market_products(count)
  productCount: Array.isArray(r.market_products) ? r.market_products[0]?.count ?? 0 : undefined,
  createdAt: r.created_at,
});

/** A store as the public marketplace shows it: without its owner's account id */
export const toPublicStore = (r) => {
  const { ownerId, ...store } = toStore(r); // eslint-disable-line no-unused-vars
  return store;
};

export const toMarketProduct = (r) => ({
  _id: r.id,
  storeId: r.store_id,
  title: r.title,
  description: r.description,
  price: r.price == null ? null : Number(r.price),
  images: r.images,
  isAvailable: r.is_available,
  // Present when the query embeds the store: stores(id, name, type, city, logo_url)
  store: r.stores ? { _id: r.stores.id, name: r.stores.name, type: r.stores.type, city: r.stores.city, logoUrl: r.stores.logo_url } : undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toSellerApplication = (r) => ({
  _id: r.id,
  userId: r.user_id,
  businessName: r.business_name,
  type: r.type,
  city: r.city,
  address: r.address,
  phone: r.phone,
  description: r.description,
  status: r.status,
  reviewedAt: r.reviewed_at,
  storeId: r.store_id,
  // Present when the query embeds the applicant: profiles(email, full_name)
  applicant: r.profiles ? { email: r.profiles.email, fullName: r.profiles.full_name } : undefined,
  createdAt: r.created_at,
});

export const toAtmcProduct = (r) => ({
  _id: r.id,
  categoryFr: r.category_fr,
  categoryAr: r.category_ar,
  categorySlug: r.category_slug,
  status: r.status,
  statusLabelFr: r.status_label_fr,
  statusLabelAr: r.status_label_ar,
  name: r.name,
  nameFr: r.name_fr,
  brand: r.brand,
  items: r.items,
  rawText: r.raw_text,
  source: r.source,
  // Guide edition (first day of the publication month); rows loaded before the column existed are the Dec 2023 guide
  edition: r.edition ?? '2023-12-01',
});

export const toAssociationProduct = (r) => ({
  _id: r.id,
  productNameFr: r.product_name_fr,
  productNameAr: r.product_name_ar,
  category: r.category,
  isGlutenFree: r.is_gluten_free,
  status: r.status,
  brand: r.brand,
  barcode: r.barcode,
  notes: r.notes,
  notesAr: r.notes_ar,
  officialDocReference: r.official_doc_reference,
  keywords: r.keywords,
  updatedAt: r.updated_at ?? r.created_at ?? null,
});

export const toReport = (r) => ({
  _id: r.id,
  targetType: r.target_type,
  targetId: r.target_id,
  targetLabel: r.target_label,
  reason: r.reason,
  message: r.message,
  status: r.status,
  // Present when the query embeds the reporter: profiles!reports_reporter_id_fkey(email, full_name)
  reporter: r.reporter ? { email: r.reporter.email, fullName: r.reporter.full_name } : null,
  resolvedAt: r.resolved_at,
  createdAt: r.created_at,
});

const num = (v) => (v == null ? null : Number(v));

export const toOrderItem = (r) => ({
  _id: r.id,
  productId: r.product_id,
  title: r.title,
  image: r.image,
  unitPrice: num(r.unit_price),
  quantity: r.quantity,
});

export const toOrderEvent = (r) => ({
  _id: r.id,
  kind: r.kind,
  fromStatus: r.from_status,
  toStatus: r.to_status,
  message: r.message,
  actorEmail: r.actor_email,
  createdAt: r.created_at,
});

/**
 * An order for its customer. `staff` adds what only the team sees: internal notes,
 * call attempts, the artisan's contact details and the history.
 */
export const toOrder = (r, { staff = false } = {}) => {
  const order = {
    _id: r.id,
    number: Number(r.number),
    reference: `CS-${r.number}`,
    status: r.status,
    storeId: r.store_id,
    storeName: r.store_name,
    customerName: r.customer_name,
    phone: r.phone,
    city: r.city,
    address: r.address,
    customerNote: r.customer_note,
    deliveryFee: num(r.delivery_fee),
    carrier: r.carrier,
    trackingNumber: r.tracking_number,
    cancelReason: r.cancel_reason,
    confirmChannel: r.confirm_channel,
    whatsappStatus: r.whatsapp_status,
    whatsappSentAt: r.whatsapp_sent_at,
    // Until then the team waits for the WhatsApp reply; after it, they call
    whatsappDeadline: r.whatsapp_status === 'SENT' ? whatsappDeadline(r.whatsapp_sent_at) : null,
    awaitingWhatsApp: isAwaitingWhatsApp(r),
    items: Array.isArray(r.order_items) ? r.order_items.map(toOrderItem) : [],
    confirmedAt: r.confirmed_at,
    preparingAt: r.preparing_at,
    readyAt: r.ready_at,
    shippedAt: r.shipped_at,
    deliveredAt: r.delivered_at,
    cancelledAt: r.cancelled_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
  if (!staff) return order;
  return {
    ...order,
    staffNotes: r.staff_notes,
    callAttempts: r.call_attempts,
    lastCallAt: r.last_call_at,
    customerEmail: r.customer?.email ?? null,
    store: r.stores ? { name: r.stores.name, phone: r.stores.phone, city: r.stores.city, address: r.stores.address } : null,
    events: Array.isArray(r.order_events)
      ? r.order_events.map(toOrderEvent).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : undefined,
  };
};
