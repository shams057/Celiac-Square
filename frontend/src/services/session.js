import axios from 'axios';

/**
 * The signed-in session: { accessToken, refreshToken, expiresAt, user }.
 * Kept in localStorage so people stay signed in; every /api request carries the
 * access token, and an expired one is refreshed once before giving up.
 */
const SESSION_KEY = 'celiac-square-session';
export const SESSION_EVENT = 'celiac-square-session';

let session = null;
try {
  session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
} catch {
  session = null;
}

export const getSession = () => session;

export const setSession = (next) => {
  session = next;
  try {
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable: the session lasts until the page closes
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
};

/** Stores a session returned by /auth/login, /auth/signup or /auth/refresh */
export const saveAuthResponse = (data) => setSession({ ...data.session, user: data.user });

// Several requests can expire at once; they share one refresh
let refreshing = null;
const refresh = () => {
  if (!refreshing) {
    const refreshToken = session?.refreshToken;
    refreshing = axios
      .post('/api/auth/refresh', { refreshToken }, { skipAuth: true })
      .then((res) => {
        saveAuthResponse(res.data);
        return true;
      })
      .catch(() => {
        setSession(null);
        return false;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
};

const isApi = (config) => config.url?.startsWith('/api') && !config.skipAuth;

axios.interceptors.request.use(async (config) => {
  if (!isApi(config) || !session) return config;
  // Refresh a minute early rather than wait for a 401
  if (session.expiresAt && session.expiresAt * 1000 - Date.now() < 60_000) await refresh();
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
