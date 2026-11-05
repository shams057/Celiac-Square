import { authClient, db } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { limits } from '../middleware/rateLimit.js';
import { allowedOrigins } from '../middleware/security.js';
import { toProfile } from '../models/mappers.js';
import { asyncRouter, clean, MAX_LEN, badRequest } from '../utils/http.js';

const router = asyncRouter();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** At least 10 characters, with a letter and a digit. Mirrored in the frontend (AuthPanel). */
export const passwordProblem = (password) => {
  if (typeof password !== 'string' || password.length < 10) return 'Le mot de passe doit contenir au moins 10 caractères.';
  if (password.length > 72) return 'Le mot de passe ne doit pas dépasser 72 caractères.';
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  return null;
};

// ---------------------------------------------------------------------------
// The refresh token lives in an httpOnly cookie, out of reach of page scripts.
// The access token (short-lived) is returned in the body and kept in memory by the browser.
// ---------------------------------------------------------------------------

const REFRESH_COOKIE = 'cs_refresh';
const REFRESH_MAX_AGE = 30 * 24 * 60 * 60; // seconds

const secureCookies = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

const setRefreshCookie = (res, token) => {
  const parts = [
    `${REFRESH_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/api/auth',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${token ? REFRESH_MAX_AGE : 0}`,
  ];
  if (secureCookies()) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
};

const readCookie = (req, name) => {
  for (const part of (req.headers.cookie || '').split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return '';
      }
    }
  }
  return '';
};

/** Sends the session: refresh token as a cookie, access token in the body */
const sendSession = (res, status, session, user) => {
  setRefreshCookie(res, session.refresh_token);
  return res.status(status).json({
    success: true,
    session: { accessToken: session.access_token, expiresAt: session.expires_at },
    user,
  });
};

const loadProfile = async (id) => {
  const { data, error } = await db().from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProfile(data) : null;
};

const CHECK_EMAIL = 'Si cette adresse peut être utilisée, un e-mail de confirmation vient d’être envoyé. Ouvrez-le, puis connectez-vous.';

/**
 * POST /api/auth/signup
 * Body: { email, password, fullName }. New accounts are clients.
 * An address that already has an account gets the same answer as a new one waiting for
 * confirmation, so the form cannot be used to find out who is registered.
 */
router.post('/signup', limits.auth, async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const fullName = clean(req.body.fullName);

  if (!EMAIL_RE.test(email) || email.length > MAX_LEN.email) return badRequest(res, 'Adresse e-mail invalide.');
  const weak = passwordProblem(password);
  if (weak) return badRequest(res, weak);
  if (!fullName) return badRequest(res, 'Indiquez votre nom.');
  if (fullName.length > MAX_LEN.fullName) return badRequest(res, `Le nom ne doit pas dépasser ${MAX_LEN.fullName} caractères.`);

  const { data, error } = await authClient().auth.signUp({ email, password, options: { data: { full_name: fullName } } });
  const taken =
    (error && /already|registered|exists/i.test(error.message)) ||
    (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
  if (taken) return res.status(201).json({ success: true, needsConfirmation: true, message: CHECK_EMAIL });
  if (error) {
    console.error(`[Auth] Signup refused: ${error.message}`);
    return badRequest(res, 'Le compte n’a pas pu être créé. Vérifiez les informations saisies.');
  }
  if (!data.session) return res.status(201).json({ success: true, needsConfirmation: true, message: CHECK_EMAIL });
  return sendSession(res, 201, data.session, await loadProfile(data.user.id));
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', limits.auth, async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) return badRequest(res, 'Saisissez votre e-mail et votre mot de passe.');

  const { data, error } = await authClient().auth.signInWithPassword({ email, password });
  if (error) {
    const unconfirmed = /confirm/i.test(error.message);
    return res.status(401).json({
      success: false,
      message: unconfirmed ? 'Confirmez d’abord votre adresse e-mail.' : 'E-mail ou mot de passe incorrect.',
    });
  }
  const user = await loadProfile(data.user.id);
  if (!user) throw new Error(`No profile for ${data.user.id}`);
  return sendSession(res, 200, data.session, user);
});

/**
 * POST /api/auth/refresh
 * Uses the refresh cookie. A refreshToken in the body is accepted once, so sessions
 * stored by older versions of the site move to the cookie without signing in again.
 */
router.post('/refresh', limits.refresh, async (req, res) => {
  const refreshToken = readCookie(req, REFRESH_COOKIE) || clean(req.body?.refreshToken);
  if (!refreshToken) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Session expirée.' });
  const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) {
    setRefreshCookie(res, '');
    return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Session expirée.' });
  }
  return sendSession(res, 200, data.session, await loadProfile(data.user.id));
});

/**
 * GET /api/auth/me
 * The signed-in account, with its role
 */
router.get('/me', requireUser, async (req, res) => res.json({ success: true, user: await loadProfile(req.user.id) }));

/**
 * POST /api/auth/logout
 * Revokes this device's session when the access token is still valid, and always clears the cookie
 */
router.post('/logout', async (req, res) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      await db().auth.admin.signOut(header.slice(7).trim(), 'local');
    } catch {
      // Best effort: an already expired session is fine
    }
  }
  setRefreshCookie(res, '');
  return res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

// Where the e-mail link sends people back: this site's reset page
const resetRedirect = (req) => {
  const origin = req.headers.origin;
  const base = process.env.SITE_URL || (origin && allowedOrigins().includes(origin) ? origin : allowedOrigins()[0]);
  return `${base.replace(/\/$/, '')}/compte/nouveau-mot-de-passe`;
};

/**
 * POST /api/auth/forgot
 * Body: { email }. Always answers the same way, whether the address has an account or not.
 */
router.post('/forgot', limits.passwordReset, async (req, res) => {
  const email = clean(req.body.email).toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > MAX_LEN.email) return badRequest(res, 'Adresse e-mail invalide.');
  const { error } = await authClient().auth.resetPasswordForEmail(email, { redirectTo: resetRedirect(req) });
  if (error) console.error(`[Auth] Password reset e-mail: ${error.message}`);
  return res.json({
    success: true,
    message: 'Si un compte existe pour cette adresse, un e-mail avec un lien de réinitialisation vient d’être envoyé.',
  });
});

/**
 * POST /api/auth/reset
 * Body: { accessToken, password }. accessToken comes from the link in the reset e-mail.
 */
router.post('/reset', limits.passwordReset, async (req, res) => {
  const accessToken = clean(req.body.accessToken);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const weak = passwordProblem(password);
  if (weak) return badRequest(res, weak);

  const { data, error } = accessToken ? await db().auth.getUser(accessToken) : { data: null, error: true };
  if (error || !data?.user) {
    return res.status(401).json({ success: false, message: 'Ce lien a expiré. Demandez un nouvel e-mail de réinitialisation.' });
  }
  const { error: updateError } = await db().auth.admin.updateUserById(data.user.id, { password });
  if (updateError) {
    console.error(`[Auth] Password update: ${updateError.message}`);
    return badRequest(res, 'Le mot de passe n’a pas pu être changé. Choisissez-en un autre.');
  }
  // Sign out the session opened by the e-mail link; the user signs in with the new password
  await db().auth.admin.signOut(accessToken, 'global').catch(() => {});
  return res.json({ success: true, message: 'Mot de passe changé. Connectez-vous avec le nouveau mot de passe.' });
});

export default router;
