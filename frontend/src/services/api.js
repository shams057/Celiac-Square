import axios from 'axios';
import './session';

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

// Admin routes use the signed-in admin's session, attached by services/session.js
const adminRequest = async (config) => (await axios(config)).data;

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

// sources: 'local' (the Tunisian guides, instant), 'off' (Open Food Facts, slow and rate limited) or 'all'
export const searchProducts = async (query = '', sources = 'all') => {
  const res = await axios.get(`${API_BASE}/products/search?q=${encodeURIComponent(query)}&sources=${sources}`);
  return res.data;
};

export const fetchProductByBarcode = async (barcode) => {
  const res = await axios.get(`${API_BASE}/products/barcode/${encodeURIComponent(barcode)}`);
  return res.data;
};

// Scanner. The photo (resized in the browser) is read by Gemini on the server; when the AI is
// unavailable, the browser reads the text itself (OCR) and sends only the text.
export const identifyProductPhoto = async (image) => {
  const res = await axios.post(`${API_BASE}/vision/identify`, { image }, { timeout: 45000 });
  return res.data;
};

export const matchProductText = async (text) => {
  const res = await axios.post(`${API_BASE}/vision/match`, { text }, { timeout: 15000 });
  return res.data;
};

/** payload: { image } (photo of the list) or { text } (OCR fallback) */
export const analyzeIngredients = async (payload) => {
  const res = await axios.post(`${API_BASE}/vision/ingredients`, payload, { timeout: 45000 });
  return res.data;
};

/** True when the AI could not answer and the on-device OCR should be tried instead */
export const isAiUnavailable = (err) => {
  const status = err?.response?.status;
  return !err?.response || err.code === 'ECONNABORTED' || status === 502 || status === 503 || status === 504 || status === 429;
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

// Accounts ------------------------------------------------------------------

export const signUp = async ({ email, password, fullName }) =>
  (await axios.post(`${API_BASE}/auth/signup`, { email, password, fullName }, { skipAuth: true })).data;

export const logIn = async ({ email, password }) =>
  (await axios.post(`${API_BASE}/auth/login`, { email, password }, { skipAuth: true })).data;

export const logOut = async () => (await axios.post(`${API_BASE}/auth/logout`)).data;

export const fetchMe = async () => (await axios.get(`${API_BASE}/auth/me`)).data;

export const requestPasswordReset = async (email) =>
  (await axios.post(`${API_BASE}/auth/forgot`, { email }, { skipAuth: true })).data;

export const resetPassword = async ({ accessToken, password }) =>
  (await axios.post(`${API_BASE}/auth/reset`, { accessToken, password }, { skipAuth: true })).data;

// Marketplace (signed-in accounts) ------------------------------------------

export const fetchStores = async (type = 'ALL') => (await axios.get(`${API_BASE}/market/stores`, { params: { type } })).data;

export const fetchStore = async (id) => (await axios.get(`${API_BASE}/market/stores/${id}`)).data;

export const fetchMarketProducts = async ({ q = '', type = 'ALL', store = '' } = {}) =>
  (await axios.get(`${API_BASE}/market/products`, { params: { q: q || undefined, type, store: store || undefined } })).data;

export const fetchMyStore = async () => (await axios.get(`${API_BASE}/market/me/store`)).data;

export const saveMyStore = async (store) => (await axios.put(`${API_BASE}/market/me/store`, store)).data;

export const createMyProduct = async (product) => (await axios.post(`${API_BASE}/market/me/products`, product)).data;

export const updateMyProduct = async (id, product) => (await axios.put(`${API_BASE}/market/me/products/${id}`, product)).data;

export const deleteMyProduct = async (id) => (await axios.delete(`${API_BASE}/market/me/products/${id}`)).data;

export const fetchMyApplications = async () => (await axios.get(`${API_BASE}/market/applications/mine`)).data;

export const submitSellerApplication = async (application) =>
  (await axios.post(`${API_BASE}/market/applications`, application)).data;

// Backoffice: sellers and accounts ------------------------------------------

export const fetchSellerApplications = (status = 'PENDING') =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/seller-applications?status=${status}` });

export const approveSellerApplication = (id) =>
  adminRequest({ method: 'post', url: `${API_BASE}/admin/seller-applications/${id}/approve` });

export const rejectSellerApplication = (id) =>
  adminRequest({ method: 'post', url: `${API_BASE}/admin/seller-applications/${id}/reject` });

export const fetchUsers = ({ q = '', role = '' } = {}) =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/users`, params: { q: q || undefined, role: role || undefined } });

export const setUserRole = (id, role) => adminRequest({ method: 'patch', url: `${API_BASE}/admin/users/${id}/role`, data: { role } });

export const fetchAdminStores = () => adminRequest({ method: 'get', url: `${API_BASE}/admin/stores` });

export const setStoreActive = (id, isActive) =>
  adminRequest({ method: 'patch', url: `${API_BASE}/admin/stores/${id}`, data: { isActive } });

export const fetchAuditLog = () => adminRequest({ method: 'get', url: `${API_BASE}/admin/audit-log` });

/** The message to show for a failed request: the API's own message for 4xx, a fallback otherwise */
export const errorMessage = (err, fallback) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;
  return status && status < 500 && typeof message === 'string' && message ? message : fallback;
};
