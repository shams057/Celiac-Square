import axios from 'axios';

/**
 * The signed-in session.
 *
 * - The refresh token is an httpOnly cookie set by the API: page scripts cannot read it.
 * - The access token (valid about an hour) lives in memory only, never in storage.
 * - localStorage keeps a non-secret hint ({ user }) so the header shows the account right
 *   away and the page knows a session cookie is worth trying after a reload.
 *
 * Every /api request carries the access token; an expired one is refreshed once
 * (one refresh at a time across tabs) before giving up.
 */
const HINT_KEY = 'celiac-square-account';
const LEGACY_KEY = 'celiac-square-session'; // older versions stored the tokens themselves
export const SESSION_EVENT = 'celiac-square-session';

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage unavailable: the session lasts until the page closes
    }
  },
};

const readHint = () => {
  try {
    return JSON.parse(storage.get(HINT_KEY) || 'null');
  } catch {
    return null;
  }
};

// Tokens saved by older versions: their refresh token is exchanged once for the cookie, then deleted
let legacyRefreshToken = null;
try {
  const legacy = JSON.parse(storage.get(LEGACY_KEY) || 'null');
  if (legacy?.refreshToken) legacyRefreshToken = legacy.refreshToken;
  if (legacy?.user && !readHint()) storage.set(HINT_KEY, JSON.stringify({ user: legacy.user }));
} catch {
  // ignore a corrupt entry
}
storage.set(LEGACY_KEY, null);

let session = null; // { accessToken, expiresAt, user }
let hint = readHint();

const notify = () => window.dispatchEvent(new Event(SESSION_EVENT));

/** The account shown in the UI: the live session's, or the remembered one while it reloads */
export const getUser = () => session?.user || hint?.user || null;
export const hasSession = () => Boolean(session || hint);

export const setSession = (next) => {
  session = next;
  hint = next ? { user: next.user } : null;
  storage.set(HINT_KEY, hint ? JSON.stringify(hint) : null);
  notify();
};

/** Stores a session returned by /auth/login, /auth/signup or /auth/refresh */
export const saveAuthResponse = (data) => setSession({ ...data.session, user: data.user });

/** Updates the account details (e.g. a new role) without touching the tokens */
export const updateUser = (user) => {
  if (session) setSession({ ...session, user });
};

// Another tab signed in or out: follow it
window.addEventListener('storage', (e) => {
  if (e.key !== HINT_KEY) return;
  hint = readHint();
  if (!hint) session = null;
  notify();
});

// Serialise refreshes across tabs: the refresh token rotates, so two tabs refreshing
// at the same moment would make one of them look signed out
const withLock = (fn) => (navigator.locks?.request ? navigator.locks.request('celiac-square-refresh', fn) : fn());

let refreshing = null;
export const refresh = () => {
  if (!refreshing) {
    refreshing = withLock(async () => {
      try {
        const body = legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {};
        const res = await axios.post('/api/auth/refresh', body, { skipAuth: true });
        legacyRefreshToken = null;
        saveAuthResponse(res.data);
        return true;
      } catch (err) {
        // Only a refused session signs the user out; a network error keeps the hint for later
        if (err.response?.status === 401) {
          legacyRefreshToken = null;
          setSession(null);
        }
        return false;
      }
    }).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
};

const isApi = (config) => config.url?.startsWith('/api') && !config.skipAuth;

axios.interceptors.request.use(async (config) => {
  if (!isApi(config) || !hasSession()) return config;
  // No access token yet (page just loaded) or about to expire: refresh first
  if (!session || (session.expiresAt && session.expiresAt * 1000 - Date.now() < 60_000)) await refresh();
  if (session && !config.headers.Authorization) config.headers.Authorization = `Bearer ${session.accessToken}`;
  return config;
});

axios.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  if (response?.status === 401 && config && isApi(config) && session && !config.retried) {
    if (await refresh()) {
      config.retried = true;
      config.headers.Authorization = `Bearer ${session.accessToken}`;
      return axios(config);
    }
  }
  throw error;
});
