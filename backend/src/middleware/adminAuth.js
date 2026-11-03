import crypto from 'crypto';

/**
 * True when the request carries "Authorization: Bearer <ADMIN_TOKEN>"
 */
export const isAdminRequest = (req) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Protects backoffice-only routes (edit, delete, verify)
 */
export const requireAdmin = (req, res, next) => {
  if (!process.env.ADMIN_TOKEN) {
    return res.status(503).json({
      success: false,
      message: "Backoffice désactivé : ADMIN_TOKEN n'est pas configuré dans backend/.env.",
    });
  }
  if (!isAdminRequest(req)) {
    return res.status(401).json({ success: false, message: 'Accès administrateur requis.' });
  }
  return next();
};
