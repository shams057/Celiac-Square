import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { db, unwrap } from '../config/db.js';

/**
 * Loads the artisans collected from the ATMC community group into the marketplace,
 * as stores without an owner (an admin links them to the seller's account later).
 *
 *   npm run artisans:import -- [file] [--active]
 *
 * file      defaults to backend/data/artisans/artisans.json; photo paths in it are
 *           relative to that file.
 * --active  publishes the stores right away. Without it they are created suspended
 *           and an admin turns each one on in Back-office → Vendeurs et comptes.
 *
 * Running it again updates the same stores (matched on import_key) and replaces their
 * products and photos; stores that a seller has claimed since are left alone.
 */
dotenv.config();

const BUCKET = 'marketplace';
const args = process.argv.slice(2);
const active = args.includes('--active');
const file = path.resolve(args.find((a) => !a.startsWith('--')) || new URL('../../data/artisans/artisans.json', import.meta.url).pathname);
const dir = path.dirname(file);
const { source, stores } = JSON.parse(fs.readFileSync(file, 'utf8'));

const uploadPhoto = async (rel, storeId) => {
  const bytes = fs.readFileSync(path.join(dir, rel));
  const storagePath = `products/${storeId}/${crypto.randomUUID()}.jpg`;
  const { error } = await db().storage.from(BUCKET).upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`${rel}: ${error.message}`);
  return db().storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl;
};

const clearPhotos = async (storeId) => {
  const folder = `products/${storeId}`;
  const { data } = await db().storage.from(BUCKET).list(folder, { limit: 1000 });
  if (data?.length) await db().storage.from(BUCKET).remove(data.map((f) => `${folder}/${f.name}`));
};

let created = 0;
let updated = 0;
let skipped = 0;
let photos = 0;

try {
  for (const s of stores) {
    const key = `atmc-group:${s.slug}`;
    const row = {
      name: s.name,
      type: s.type,
      city: s.city,
      address: s.address,
      phone: s.phone,
      description: s.description,
      source,
      import_key: key,
    };

    const existing = unwrap(await db().from('stores').select('id, owner_id').eq('import_key', key).maybeSingle());
    if (existing?.owner_id) {
      console.log(`[Artisans] ${s.name}: claimed by its seller, left as is`);
      skipped += 1;
      continue;
    }

    let storeId;
    if (existing) {
      storeId = existing.id;
      unwrap(await db().from('stores').update(row).eq('id', storeId).select('id'));
      unwrap(await db().from('market_products').delete().eq('store_id', storeId).select('id'));
      await clearPhotos(storeId);
      updated += 1;
    } else {
      [{ id: storeId }] = unwrap(await db().from('stores').insert({ ...row, owner_id: null, is_active: active }).select('id'));
      created += 1;
    }

    const products = [];
    for (const p of s.products) {
      const images = [];
      for (const rel of p.photos) images.push(await uploadPhoto(rel, storeId));
      photos += images.length;
      products.push({ store_id: storeId, title: p.title, description: p.description, images });
    }
    if (products.length) unwrap(await db().from('market_products').insert(products).select('id'));
    console.log(`[Artisans] ${s.name}: ${products.length} produits`);
  }
  console.log(`[Artisans] Done: ${created} created, ${updated} updated, ${skipped} skipped, ${photos} photos.`);
  if (!active && created) console.log('[Artisans] New stores are suspended: activate them in Back-office → Vendeurs et comptes.');
} catch (err) {
  console.error(`[Artisans Error] ${err.message}`);
  process.exitCode = 1;
}
