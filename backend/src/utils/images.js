/**
 * Validation of images sent by the browser as data URLs (marketplace photos, scanner photos).
 * The declared type must match the file's first bytes.
 */
const DATA_URL_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;

const MAGIC = {
  jpeg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  png: (b) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  webp: (b) => b.length > 12 && b.subarray(0, 4).toString('ascii') === 'RIFF' && b.subarray(8, 12).toString('ascii') === 'WEBP',
};

export class ImageError extends Error {}

/**
 * { type: 'jpeg'|'png'|'webp', mimeType, base64, bytes } for a valid data URL.
 * Throws ImageError otherwise.
 */
export const parseImageDataUrl = (dataUrl, maxBytes) => {
  const match = typeof dataUrl === 'string' ? DATA_URL_RE.exec(dataUrl) : null;
  if (!match) throw new ImageError('Format d’image non pris en charge (JPEG, PNG ou WebP).');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > maxBytes) throw new ImageError(`L’image dépasse ${Math.round(maxBytes / 1024 / 1024)} Mo.`);
  if (!MAGIC[match[1]](bytes)) throw new ImageError('Ce fichier n’est pas une image valide.');
  return { type: match[1], mimeType: `image/${match[1]}`, base64: match[2], bytes };
};
