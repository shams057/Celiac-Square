import { useEffect, useState } from 'react';

/**
 * Minimal history-based routing: every screen has its own URL, so pages can be
 * bookmarked and shared, a reload stays on the same page, and the Back button works.
 * (Vercel serves index.html for every path; see vercel.json.)
 */
export const ROUTES = {
  atmc: '/',
  vision: '/scanner',
  search: '/recherche',
  map: '/carte',
  market: '/marche',
  account: '/compte',
  'reset-password': '/compte/nouveau-mot-de-passe',
  seller: '/ma-boutique',
  'become-seller': '/devenir-vendeur',
  backoffice: '/admin',
  privacy: '/confidentialite',
};

const STORE_RE = /^\/marche\/boutique\/([0-9a-f-]{36})\/?$/i;

/** { tab, params, query } for a location */
export const parseLocation = (loc = window.location) => {
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(new URLSearchParams(loc.search));
  const store = STORE_RE.exec(path);
  if (store) return { tab: 'market', params: { storeId: store[1] }, query };
  const tab = Object.keys(ROUTES).find((key) => ROUTES[key] === path) || 'atmc';
  return { tab, params: {}, query };
};

export const pathFor = (tab, { storeId, query } = {}) => {
  const base = tab === 'market' && storeId ? `/marche/boutique/${storeId}` : ROUTES[tab] || '/';
  const qs = query && Object.keys(query).length ? `?${new URLSearchParams(query)}` : '';
  return base + qs;
};

const ROUTE_EVENT = 'celiac-square-route';

export const navigate = (path, { replace = false } = {}) => {
  if (path === window.location.pathname + window.location.search) return;
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
  window.dispatchEvent(new Event(ROUTE_EVENT));
};

/** The current route; re-renders on navigation and on Back/Forward */
export const useRoute = () => {
  const [route, setRoute] = useState(() => parseLocation());
  useEffect(() => {
    const update = () => setRoute(parseLocation());
    window.addEventListener('popstate', update);
    window.addEventListener(ROUTE_EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener(ROUTE_EVENT, update);
    };
  }, []);
  return route;
};
