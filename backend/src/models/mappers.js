/**
 * Convert database rows (snake_case) to the JSON the frontend expects
 * (camelCase, `_id`, GeoJSON-like `location`), which predates the move to Postgres.
 */

export const toSpot = (r) => ({
  _id: r.id,
  name: r.name,
  category: r.category,
  location: { type: 'Point', coordinates: [r.lng, r.lat] },
  city: r.city,
  address: r.address,
  phone: r.phone,
  isVerified: r.is_verified,
  speciality: r.speciality,
  hours: r.hours,
  rating: Number(r.rating),
  reviewCount: r.review_count,
  notes: r.notes,
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
});
