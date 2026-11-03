import axios from 'axios';

const API_BASE = '/api';

// If the API is not deployed, hosts serve index.html with status 200 for /api/* too.
// Treat that as an error so screens show "could not load" instead of empty results.
axios.interceptors.response.use((res) => {
  const type = res.headers?.['content-type'] || '';
  if (res.config.url?.startsWith(API_BASE) && type.includes('text/html')) {
    const err = new Error('API indisponible (réponse HTML reçue au lieu de JSON).');
    err.response = { status: 502, data: { message: err.message } };
    throw err;
  }
  return res;
});

// Backoffice admin token, kept for the browser session only
const ADMIN_TOKEN_KEY = 'celiac-square-admin-token';
export const ADMIN_LOGOUT_EVENT = 'celiac-square-admin-logout';

export const getAdminToken = () => {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
  } catch {
    return '';
  }
};

export const setAdminToken = (token) => {
  try {
    if (token) sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    else sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Storage unavailable: the token simply won't persist
  }
};

const adminRequest = async (config) => {
  try {
    const res = await axios({ ...config, headers: { Authorization: `Bearer ${getAdminToken()}` } });
    return res.data;
  } catch (err) {
    if (err.response?.status === 401) {
      setAdminToken('');
      window.dispatchEvent(new Event(ADMIN_LOGOUT_EVENT));
    }
    throw err;
  }
};

export const checkAdminToken = async (token) => {
  const res = await axios.get(`${API_BASE}/map/admin/check`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
};

export const fetchSpots = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.city && filters.city !== 'ALL') params.append('city', filters.city);
  if (filters.isVerified !== undefined && filters.isVerified !== '') params.append('isVerified', filters.isVerified);
  if (filters.q) params.append('q', filters.q);

  const res = await axios.get(`${API_BASE}/map/spots?${params.toString()}`);
  return res.data;
};

export const fetchCities = async () => {
  const res = await axios.get(`${API_BASE}/map/cities`);
  return res.data;
};

// Public suggestion: lands in the admin inbox, not on the map
export const submitSpot = async (spotData) => {
  const res = await axios.post(`${API_BASE}/map/proposals`, spotData);
  return res.data;
};

export const fetchProposals = (status = 'PENDING') =>
  adminRequest({ method: 'get', url: `${API_BASE}/map/proposals?status=${status}` });

export const approveProposal = (id, overrides = {}) =>
  adminRequest({ method: 'post', url: `${API_BASE}/map/proposals/${id}/approve`, data: overrides });

export const rejectProposal = (id) =>
  adminRequest({ method: 'post', url: `${API_BASE}/map/proposals/${id}/reject` });

export const createSpot = (spotData) =>
  adminRequest({ method: 'post', url: `${API_BASE}/map/spots`, data: spotData });

export const updateSpot = (id, spotData) =>
  adminRequest({ method: 'put', url: `${API_BASE}/map/spots/${id}`, data: spotData });

export const deleteSpot = (id) =>
  adminRequest({ method: 'delete', url: `${API_BASE}/map/spots/${id}` });

export const toggleSpotVerification = (id, isVerified) =>
  adminRequest({ method: 'patch', url: `${API_BASE}/map/spots/${id}/verify`, data: { isVerified } });

// sources: 'local' (MongoDB, instant), 'off' (Open Food Facts, slow and rate limited) or 'all'
export const searchProducts = async (query = '', sources = 'all') => {
  const res = await axios.get(`${API_BASE}/products/search?q=${encodeURIComponent(query)}&sources=${sources}`);
  return res.data;
};

export const fetchProductByBarcode = async (barcode) => {
  const res = await axios.get(`${API_BASE}/products/barcode/${encodeURIComponent(barcode)}`);
  return res.data;
};

// Product photo: the text is read in the browser (OCR) and only the text is sent
export const matchProductText = async (text) => {
  const res = await axios.post(`${API_BASE}/vision/match`, { text }, { timeout: 15000 });
  return res.data;
};

// Ingredients: the list is read in the browser (OCR) and only the text is analysed by Gemini
export const analyzeIngredients = async (text) => {
  const res = await axios.post(`${API_BASE}/vision/ingredients`, { text }, { timeout: 20000 });
  return res.data;
};

export const fetchAtmcProducts = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters.q) params.append('q', filters.q);

  const res = await axios.get(`${API_BASE}/atmc/products?${params.toString()}`);
  return res.data;
};

export const fetchAtmcCategories = async () => {
  const res = await axios.get(`${API_BASE}/atmc/categories`);
  return res.data;
};

export const fetchAtmcStats = async () => {
  const res = await axios.get(`${API_BASE}/atmc/stats`);
  return res.data;
};
