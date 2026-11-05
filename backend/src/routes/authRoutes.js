import express from 'express';
import { authClient, db } from '../config/db.js';
import { requireUser } from '../middleware/auth.js';
import { toProfile } from '../models/mappers.js';

const router = express.Router();

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

// The browser keeps the tokens; the API checks the access token on every request
const toSession = (session) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at,
});

const loadProfile = async (id) => {
  const { data, error } = await db().from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProfile(data) : null;
};

/**
 * POST /api/auth/signup
 * Body: { email, password, fullName }. New accounts are clients.
 * If the Supabase project asks for email confirmation, no session is returned yet.
 */
router.post('/signup', async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const fullName = clean(req.body.fullName);

    if (!EMAIL_RE.test(email)) return res.status(400).json({ success: false, message: 'Adresse e-mail invalide.' });
    if (password.length < MIN_PASSWORD) {
      return res.status(400).json({ success: false, message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.` });
    }
    if (!fullName) return res.status(400).json({ success: false, message: 'Indiquez votre nom.' });

    const { data, error } = await authClient().auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (error) {
      const taken = /already|registered|exists/i.test(error.message);
      return res.status(taken ? 409 : 400).json({
        success: false,
        message: taken ? 'Un compte existe déjà avec cette adresse e-mail.' : error.message,
      });
    }
    // Supabase answers an existing, confirmed address with a user that has no identities
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return res.status(409).json({ success: false, message: 'Un compte existe déjà avec cette adresse e-mail.' });
    }
    if (!data.session) {
      return res.status(201).json({
        success: true,
        needsConfirmation: true,
        message: 'Compte créé. Confirmez votre adresse e-mail, puis connectez-vous.',
      });
    }
    return res.status(201).json({ success: true, session: toSession(data.session), user: await loadProfile(data.user.id) });
  } catch (error) {
    console.error(`[Auth Routes] Signup error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Le compte n’a pas pu être créé.' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) return res.status(400).json({ success: false, message: 'Saisissez votre e-mail et votre mot de passe.' });

    const { data, error } = await authClient().auth.signInWithPassword({ email, password });
    if (error) {
      const unconfirmed = /confirm/i.test(error.message);
      return res.status(401).json({
        success: false,
        message: unconfirmed ? 'Confirmez d’abord votre adresse e-mail.' : 'E-mail ou mot de passe incorrect.',
      });
    }
    const user = await loadProfile(data.user.id);
    if (!user) return res.status(500).json({ success: false, message: 'Profil introuvable pour ce compte.' });
    return res.json({ success: true, session: toSession(data.session), user });
  } catch (error) {
    console.error(`[Auth Routes] Login error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'La connexion a échoué.' });
  }
});

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }. Returns a new session when the access token has expired.
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = clean(req.body.refreshToken);
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Jeton manquant.' });
    const { data, error } = await authClient().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ success: false, code: 'AUTH_REQUIRED', message: 'Session expirée.' });
    return res.json({ success: true, session: toSession(data.session), user: await loadProfile(data.user.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/auth/me
 * The signed-in account, with its role
 */
router.get('/me', requireUser, async (req, res) => {
  try {
    return res.json({ success: true, user: await loadProfile(req.user.id) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Revokes the refresh token; the browser forgets the session either way
 */
router.post('/logout', requireUser, async (req, res) => {
  try {
    const token = req.headers.authorization.slice(7).trim();
    // 'local': only this device; the account stays signed in elsewhere
    await db().auth.admin.signOut(token, 'local');
  } catch {
    // Best effort: an already expired session is fine
  }
  return res.json({ success: true });
});

export default router;
