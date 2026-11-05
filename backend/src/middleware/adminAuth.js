import crypto from 'crypto';
import { getRequestUser } from './auth.js';

/**
 * True when the request carries "Authorization: Bearer <ADMIN_TOKEN>"
 * (kept for scripts and curl; the backoffice signs in with an admin account)
 */
export const isAdminTokenRequest = (req) => {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const header = req.headers.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** The ADMIN_TOKEN, or a signed-in account with the ADMIN role */
export const isAdminRequest = async (req) => {
  if (isAdminTokenRequest(req)) return true;
  const user = await getRequestUser(req);
  return user?.role === 'ADMIN';
};

/**
 * Protects backoffice-only routes (edit, delete, verify, approve)
 */
export const requireAdmin = async (req, res, next) => {
  try {
    if (await isAdminRequest(req)) return next();
    // Signed in but not an admin: 403, so the browser does not try to refresh the session
    const status = (await getRequestUser(req)) ? 403 : 401;
    return res.status(status).json({ success: false, message: 'Accès administrateur requis.' });
  } catch (error) {
    return next(error);
  }
};
