import crypto from 'crypto';
import { db } from '../config/db.js';

/**
 * Photos, menu pages and videos of map spots, managed from the back-office.
 *
 * Files live in the public "spot-media" Storage bucket. The browser asks the API for a
 * signed upload URL and sends the file straight to Storage, so videos never pass through
 * the API (whose request bodies are capped). A spot's `media` column then lists the files:
 *   { type: 'image'|'video', src, poster?, kind?: 'menu', alt, credit? }
 * Entries may also point at files shipped with the site (/spots/<slug>/…, the seed data).
 * Other sites are refused: the Content-Security-Policy (vercel.json) would block them anyway.
 */
export const BUCKET = 'spot-media';

const TYPES = {
  'image/jpeg': ['jpg', 'image', 8 * 1024 * 1024],
  'image/png': ['png', 'image', 8 * 1024 * 1024],
  'image/webp': ['webp', 'image', 8 * 1024 * 1024],
  'video/mp4': ['mp4', 'video', 50 * 1024 * 1024],
  'video/webm': ['webm', 'video', 50 * 1024 * 1024],
  'video/quicktime': ['mov', 'video', 50 * 1024 * 1024],
};

export const MAX_MEDIA = 30;
export const MAX_LINKS = 10;
export const LINK_TYPES = ['website', 'facebook', 'instagram', 'menu', 'other'];

export class MediaError extends Error {}

const FILE_RE = /^spots\/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm|mov)$/;
// Files bundled with the frontend (public/spots/<slug>/<file>)
const SITE_FILE_RE = /^\/spots\/[a-z0-9-]+\/[a-z0-9._-]+$/i;

const publicPrefix = () => `${(process.env.SUPABASE_URL || '').replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;

/** Storage path of one of our uploaded files, or null for anything else */
export const storagePath = (url) => {
  if (typeof url !== 'string' || !url.startsWith(publicPrefix())) return null;
  const path = url.slice(publicPrefix().length);
  return FILE_RE.test(path) ? path : null;
};

const isMediaSource = (v) => typeof v === 'string' && (storagePath(v) !== null || SITE_FILE_RE.test(v));

/**
 * POST body { contentType, size } -> where to send the file and the URL it will have.
 * Throws MediaError for a type or size we do not take.
 */
export const createUploadUrl = async ({ contentType, size } = {}) => {
  const spec = TYPES[contentType];
  if (!spec) throw new MediaError('Format non pris en charge : JPEG, PNG, WebP, MP4, WebM ou MOV.');
  const [ext, kind, max] = spec;
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) throw new MediaError('Fichier vide.');
  if (bytes > max) throw new MediaError(`${kind === 'video' ? 'La vidéo' : 'L’image'} dépasse ${Math.round(max / 1024 / 1024)} Mo.`);

  const path = `spots/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) throw new Error(`Signed upload URL: ${error.message}`);
  return {
    uploadUrl: data.signedUrl,
    publicUrl: db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    type: kind,
  };
};

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** The media list sent by the back-office, checked and trimmed. Throws MediaError. */
export const normalizeMedia = (list) => {
  if (!Array.isArray(list)) throw new MediaError('Liste de médias invalide.');
  if (list.length > MAX_MEDIA) throw new MediaError(`${MAX_MEDIA} photos et vidéos au maximum.`);
  return list.map((item, i) => {
    const n = i + 1;
    if (!item || typeof item !== 'object') throw new MediaError(`Média n° ${n} invalide.`);
    const type = item.type === 'video' ? 'video' : item.type === 'image' ? 'image' : null;
    if (!type) throw new MediaError(`Média n° ${n} : type inconnu.`);
    if (!isMediaSource(item.src)) throw new MediaError(`Média n° ${n} : fichier invalide : ajoutez-le depuis le back-office.`);
    const out = { type, src: item.src, alt: text(item.alt, 200) };
    if (item.poster) {
      if (!isMediaSource(item.poster)) throw new MediaError(`Média n° ${n} : image d’aperçu invalide.`);
      out.poster = item.poster;
    }
    if (type === 'image' && item.kind === 'menu') out.kind = 'menu';
    const credit = text(item.credit, 100);
    if (credit) out.credit = credit;
    return out;
  });
};

/** Website and social links. Throws MediaError. */
export const normalizeLinks = (list) => {
  if (!Array.isArray(list)) throw new MediaError('Liste de liens invalide.');
  if (list.length > MAX_LINKS) throw new MediaError(`${MAX_LINKS} liens au maximum.`);
  return list.map((item, i) => {
    const url = text(item?.url, 1000);
    let ok = false;
    try {
      ok = ['https:', 'http:'].includes(new URL(url).protocol);
    } catch {
      ok = false;
    }
    if (!ok) throw new MediaError(`Lien n° ${i + 1} : adresse invalide (https://…).`);
    const type = LINK_TYPES.includes(item.type) ? item.type : 'other';
    const out = { type, url };
    const label = text(item.label, 60);
    if (label) out.label = label;
    return out;
  });
};

const pathsOf = (media) => (media || []).flatMap((m) => [m?.src, m?.poster]).map(storagePath).filter(Boolean);

/** Deletes uploaded files that `before` used and `after` no longer does. Never throws. */
export const removeUnusedMedia = async (before, after = []) => {
  const kept = new Set(pathsOf(after));
  const paths = [...new Set(pathsOf(before))].filter((p) => !kept.has(p));
  if (paths.length === 0) return;
  const { error } = await db().storage.from(BUCKET).remove(paths);
  if (error) console.error(`[Spot Media] Cleanup failed: ${error.message}`);
};
