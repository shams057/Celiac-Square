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
