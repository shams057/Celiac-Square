import crypto from 'crypto';
import { db } from '../config/db.js';
import { parseImageDataUrl, ImageError } from '../utils/images.js';

/**
 * Product and store photos live in the public "marketplace" Storage bucket, one folder
 * per owner: products/<storeId>/… and stores/<userId>/…
 * The browser sends new photos as data URLs (already resized); photos that are
 * already stored come back as their public URL and are kept as they are, but only
 * when they belong to the folder being edited, so one seller can never reuse or
 * delete another seller's files.
 */
const BUCKET = 'marketplace';
const MAX_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGES = 5;

const EXT = { jpeg: 'jpg', png: 'png', webp: 'webp' };
const FOLDER_RE = /^(products|stores)\/[0-9a-f-]{36}$/;
const FILE_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export { ImageError };

const publicPrefix = () => `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/`;

/**
 * Storage path of one of our public URLs inside `folder`, or null for anything else
 * (another folder, another site, "..", query strings…).
 */
export const pathIn = (url, folder) => {
  if (typeof url !== 'string' || !FOLDER_RE.test(folder) || !url.startsWith(publicPrefix())) return null;
  const path = url.slice(publicPrefix().length);
  const prefix = `${folder}/`;
  return path.startsWith(prefix) && FILE_RE.test(path.slice(prefix.length)) ? path : null;
};

const upload = async (dataUrl, folder) => {
  const { type, bytes } = parseImageDataUrl(dataUrl, MAX_BYTES);

  const path = `${folder}/${crypto.randomUUID()}.${EXT[type]}`;
  const { error } = await db().storage.from(BUCKET).upload(path, bytes, { contentType: `image/${type}`, upsert: false });
  if (error) throw new Error(`Envoi de l’image : ${error.message}`);
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
};

/**
 * Turns the images sent by the browser into stored public URLs, in the same order.
 * Throws ImageError for anything that is neither a new photo nor one of this folder's.
 */
export const saveImages = async (images, folder) => {
  if (images === undefined) return undefined;
  if (!Array.isArray(images)) throw new ImageError('Liste d’images invalide.');
  if (images.length > MAX_IMAGES) throw new ImageError(`${MAX_IMAGES} images au maximum.`);
  if (!FOLDER_RE.test(folder)) throw new Error(`Invalid image folder: ${folder}`);

  const saved = [];
  for (const image of images) {
    if (pathIn(image, folder)) saved.push(image);
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

/**
 * Deletes stored photos of `folder` that are no longer used. URLs outside the folder are
 * ignored. Never throws: a leftover file is harmless.
 */
export const removeImages = async (urls, folder) => {
  const paths = (urls || []).map((url) => pathIn(url, folder)).filter(Boolean);
  if (paths.length === 0) return;
  const { error } = await db().storage.from(BUCKET).remove(paths);
  if (error) console.error(`[Market Images] Cleanup failed: ${error.message}`);
};
