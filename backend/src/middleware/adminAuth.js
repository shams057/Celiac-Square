import { getRequestUser } from './auth.js';

/**
 * Protects backoffice-only routes: a signed-in account with the ADMIN role.
 * (The static ADMIN_TOKEN was removed: it never expired and left no trace of who used it.
 * Scripts that need admin rights run with the secret key, e.g. npm run set-role.)
 */
export const requireAdmin = async (req, res, next) => {
  try {
    const user = await getRequestUser(req);
    if (user?.role === 'ADMIN') {
      req.user = user;
      return next();
    }
    // Signed in but not an admin: 403, so the browser does not try to refresh the session
    return res.status(user ? 403 : 401).json({ success: false, message: 'Accès administrateur requis.' });
  } catch (error) {
    return next(error);
  }
};

/** Back-office workers (STAFF) and admins: the order pipeline */
export const requireStaff = async (req, res, next) => {
  try {
    const user = await getRequestUser(req);
    if (user?.role === 'ADMIN' || user?.role === 'STAFF') {
      req.user = user;
      return next();
    }
    return res.status(user ? 403 : 401).json({ success: false, message: 'Accès réservé à l’équipe.' });
  } catch (error) {
    return next(error);
  }
};
