import { db } from '../config/db.js';

const bearer = (req) => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

// Supabase access tokens are JWTs; the legacy ADMIN_TOKEN is not, so it is never sent to Supabase Auth
const looksLikeJwt = (token) => token.split('.').length === 3;

/**
 * The signed-in user for this request ({ id, email, fullName, role }), or null.
 * Cached on the request, so several middlewares can ask without extra calls.
 */
export const getRequestUser = async (req) => {
  if (req.authUser !== undefined) return req.authUser;
  req.authUser = null;

  const token = bearer(req);
  if (!token || !looksLikeJwt(token)) return null;

  const { data, error } = await db().auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await db().from('profiles').select('*').eq('id', data.user.id).maybeSingle();
  if (!profile) return null;

  req.authUser = { id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role };
  return req.authUser;
};

const unauthorized = (res) =>
  res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Connectez-vous pour continuer.' });

/** Any signed-in account */
export const requireUser = async (req, res, next) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized(res);
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

/** A signed-in account with one of the given roles */
export const requireRole = (...roles) => async (req, res, next) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return unauthorized(res);
    if (!roles.includes(user.role)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'Votre compte n’a pas accès à cette page.' });
    }
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
};
