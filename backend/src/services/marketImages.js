import crypto from 'crypto';
import { db } from '../config/db.js';

/**
 * Product and store photos live in the public "marketplace" Storage bucket.
 * The browser sends new photos as data URLs (already resized); photos that are
 * already stored come back as their public URL and are kept as they are.
 */
const BUCKET = 'marketplace';
const MAX_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGES = 5;

const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' };

export class ImageError extends Error {}

const publicPrefix = () => `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;

/** Storage path of one of our public URLs, or null for anything else */
const pathOf = (url) => (typeof url === 'string' && url.startsWith(publicPrefix()) ? url.slice(publicPrefix().length) : null);

const upload = async (dataUrl, folder) => {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new ImageError('Format d’image non pris en charge (JPEG, PNG ou WebP).');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > MAX_BYTES) throw new ImageError('Une image dépasse 3 Mo.');

  const path = `${folder}/${crypto.randomUUID()}.${EXT[match[1]]}`;
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType: `image/${match[1]}`, upsert: false });
  if (error) throw new Error(`Envoi de l’image : ${error.message}`);
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

/**
 * Turns the images sent by the browser into stored public URLs, in the same order.
 * Throws ImageError for anything that is neither a new photo nor one of ours.
 */
export const saveImages = async (images, folder) => {
  if (images === undefined) return undefined;
  if (!Array.isArray(images)) throw new ImageError('Liste d’images invalide.');
  if (images.length > MAX_IMAGES) throw new ImageError(`${MAX_IMAGES} images au maximum.`);

  const saved = [];
  for (const image of images) {
    if (pathOf(image)) saved.push(image);
    else if (typeof image === 'string' && image.startsWith('data:')) saved.push(await upload(image, folder));
    else throw new ImageError('Image invalide.');
  }
  return saved;
};

/** One image (store logo): '' clears it */
export const saveImage = async (image, folder) => {
  if (image === undefined) return undefined;
  if (image === '' || image === null) return '';
  const [url] = await saveImages([image], folder);
  return url;
};

/** Deletes stored photos that are no longer used. Never throws: a leftover file is harmless. */
export const removeImages = async (urls) => {
  const paths = (urls || []).map(pathOf).filter(Boolean);
  if (paths.length === 0) return;
  const { error } = await db().storage.from(BUCKET).remove(paths);
  if (error) console.error(`[Market Images] Cleanup failed: ${error.message}`);
};
