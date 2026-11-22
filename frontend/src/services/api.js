import axios from 'axios';
import { SESSION_EVENT } from './session';

const API_BASE = '/api';

// ---------------------------------------------------------------------------------------------
// Cache of public reads
// ---------------------------------------------------------------------------------------------
// Pages ask again for what they showed a moment ago (the map's places, the guide, the marketplace…).
// A read made recently enough is answered from memory, without the network; a failed read is never kept.
// What an account changes (a place, a store, a product) clears the matching entries, and so does signing
// in or out (the marketplace answers members only). The forum keeps its own copies (components/Forum.jsx).

const MINUTE = 60 * 1000;
const cache = new Map(); // key -> { at, promise }

const remember = (key, ttl, load) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = load().catch((err) => {
    if (cache.get(key)?.promise === promise) cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
};

/** Forgets the cached reads whose key starts with `prefix` (all of them without one) */
export const forgetCached = (prefix = '') => {
  for (const key of [...cache.keys()]) if (key.startsWith(prefix)) cache.delete(key);
};

/** After a successful change: forgets the reads it makes stale, and passes the response on */
const forgets = (prefix) => (res) => {
  forgetCached(prefix);
  return res;
};

window.addEventListener(SESSION_EVENT, () => forgetCached());

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

/**
 * The response body, plus `offlineCopy`: the date of the saved copy when the service worker
 * answered offline (see src/sw.js), otherwise null.
 */
const withOfflineInfo = (res) => ({ ...res.data, offlineCopy: res.headers?.['x-offline-copy'] || null });

const fetchSpotsLive = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.city && filters.city !== 'ALL') params.append('city', filters.city);
  if (filters.isVerified !== undefined && filters.isVerified !== '') params.append('isVerified', filters.isVerified);
  if (filters.q) params.append('q', filters.q);

  const res = await axios.get(`${API_BASE}/map/spots?${params.toString()}`);
  return withOfflineInfo(res);
};

const fetchCitiesLive = async () => {
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

const approveProposalLive = (id, overrides = {}) =>
  adminRequest({ method: 'post', url: `${API_BASE}/map/proposals/${id}/approve`, data: overrides });

export const rejectProposal = (id) =>
  adminRequest({ method: 'post', url: `${API_BASE}/map/proposals/${id}/reject` });

const createSpotLive = (spotData) =>
  adminRequest({ method: 'post', url: `${API_BASE}/map/spots`, data: spotData });

const updateSpotLive = (id, spotData) =>
  adminRequest({ method: 'put', url: `${API_BASE}/map/spots/${id}`, data: spotData });

const deleteSpotLive = (id) =>
  adminRequest({ method: 'delete', url: `${API_BASE}/map/spots/${id}` });

const toggleSpotVerificationLive = (id, isVerified) =>
  adminRequest({ method: 'patch', url: `${API_BASE}/map/spots/${id}/verify`, data: { isVerified } });

// sources: 'local' (the Tunisian guides, instant), 'off' (Open Food Facts, slow and rate limited) or 'all'
const searchProductsLive = async (query = '', sources = 'all') => {
  const res = await axios.get(`${API_BASE}/products/search?q=${encodeURIComponent(query)}&sources=${sources}`);
  return res.data;
};

const fetchProductByBarcodeLive = async (barcode) => {
  const res = await axios.get(`${API_BASE}/products/barcode/${encodeURIComponent(barcode)}`);
  return res.data;
};

// Scanner. The photo (resized in the browser) is read by the AI (Ollama Cloud) on the server; when the AI is
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

const fetchAtmcProductsLive = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
  if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
  if (filters.q) params.append('q', filters.q);

  const res = await axios.get(`${API_BASE}/atmc/products?${params.toString()}`);
  return withOfflineInfo(res);
};

const fetchAtmcCategoriesLive = async () => {
  const res = await axios.get(`${API_BASE}/atmc/categories`);
  return res.data;
};

const fetchAtmcStatsLive = async () => {
  const res = await axios.get(`${API_BASE}/atmc/stats`);
  return res.data;
};

// Accounts ------------------------------------------------------------------

export const signUp = async ({ email, password, fullName, phone }) =>
  (await axios.post(`${API_BASE}/auth/signup`, { email, password, fullName, phone }, { skipAuth: true })).data;

export const logIn = async ({ email, password }) =>
  (await axios.post(`${API_BASE}/auth/login`, { email, password }, { skipAuth: true })).data;

export const logOut = async () => (await axios.post(`${API_BASE}/auth/logout`)).data;

export const fetchMe = async () => (await axios.get(`${API_BASE}/auth/me`)).data;

/** changes: { fullName?, phone? } */
export const updateProfile = async (changes) => (await axios.patch(`${API_BASE}/auth/me`, changes)).data;

export const requestPasswordReset = async (email) =>
  (await axios.post(`${API_BASE}/auth/forgot`, { email }, { skipAuth: true })).data;

export const resetPassword = async ({ accessToken, password }) =>
  (await axios.post(`${API_BASE}/auth/reset`, { accessToken, password }, { skipAuth: true })).data;

// Marketplace (signed-in accounts) ------------------------------------------

const fetchStoresLive = async (type = 'ALL') => (await axios.get(`${API_BASE}/market/stores`, { params: { type } })).data;

const fetchStoreLive = async (id) => (await axios.get(`${API_BASE}/market/stores/${id}`)).data;

const fetchMarketProductsLive = async ({ q = '', type = 'ALL', store = '' } = {}) =>
  (await axios.get(`${API_BASE}/market/products`, { params: { q: q || undefined, type, store: store || undefined } })).data;

export const fetchMyStore = async () => (await axios.get(`${API_BASE}/market/me/store`)).data;

const saveMyStoreLive = async (store) => (await axios.put(`${API_BASE}/market/me/store`, store)).data;

const createMyProductLive = async (product) => (await axios.post(`${API_BASE}/market/me/products`, product)).data;

const updateMyProductLive = async (id, product) => (await axios.put(`${API_BASE}/market/me/products/${id}`, product)).data;

const deleteMyProductLive = async (id) => (await axios.delete(`${API_BASE}/market/me/products/${id}`)).data;

export const fetchMyApplications = async () => (await axios.get(`${API_BASE}/market/applications/mine`)).data;

export const submitSellerApplication = async (application) =>
  (await axios.post(`${API_BASE}/market/applications`, application)).data;

// Backoffice: sellers and accounts ------------------------------------------

export const fetchSellerApplications = (status = 'PENDING') =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/seller-applications?status=${status}` });

const approveSellerApplicationLive = (id) =>
  adminRequest({ method: 'post', url: `${API_BASE}/admin/seller-applications/${id}/approve` });

export const rejectSellerApplication = (id) =>
  adminRequest({ method: 'post', url: `${API_BASE}/admin/seller-applications/${id}/reject` });

export const fetchUsers = ({ q = '', role = '' } = {}) =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/users`, params: { q: q || undefined, role: role || undefined } });

export const setUserRole = (id, role) => adminRequest({ method: 'patch', url: `${API_BASE}/admin/users/${id}/role`, data: { role } });

export const fetchAdminStores = () => adminRequest({ method: 'get', url: `${API_BASE}/admin/stores` });

const setStoreActiveLive = (id, isActive) =>
  adminRequest({ method: 'patch', url: `${API_BASE}/admin/stores/${id}`, data: { isActive } });

export const fetchReports = (status = 'OPEN') => adminRequest({ method: 'get', url: `${API_BASE}/admin/reports`, params: { status } });

export const setReportStatus = (id, status) => adminRequest({ method: 'patch', url: `${API_BASE}/admin/reports/${id}`, data: { status } });

export const fetchAuditLog = () => adminRequest({ method: 'get', url: `${API_BASE}/admin/audit-log` });

// Orders --------------------------------------------------------------------

/** order: { items: [{ productId, quantity }], customerName, phone, city, address, note, confirmChannel: 'WHATSAPP' | 'PHONE' } */
const placeOrderLive = async (order) => (await axios.post(`${API_BASE}/orders`, order)).data;

export const fetchMyOrders = async () => (await axios.get(`${API_BASE}/orders/mine`)).data;

export const cancelMyOrder = async (id) => (await axios.post(`${API_BASE}/orders/${id}/cancel`)).data;

// Back-office: dashboard (team and admins; admins also get the platform figures)

export const fetchDashboard = (days = 30) => adminRequest({ method: 'get', url: `${API_BASE}/admin/dashboard`, params: { days } });

// Back-office: orders (team and admins)

export const fetchOrders = ({ status = 'ACTIVE', q = '' } = {}) =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/orders`, params: { status, q: q || undefined } });

export const fetchOrder = (id) => adminRequest({ method: 'get', url: `${API_BASE}/admin/orders/${id}` });

export const updateOrder = (id, changes) => adminRequest({ method: 'patch', url: `${API_BASE}/admin/orders/${id}`, data: changes });

/** outcome: REACHED | NO_ANSWER | CALL_BACK */
export const logOrderCall = (id, outcome, note = '') =>
  adminRequest({ method: 'post', url: `${API_BASE}/admin/orders/${id}/calls`, data: { outcome, note } });

export const sendOrderWhatsApp = (id) => adminRequest({ method: 'post', url: `${API_BASE}/admin/orders/${id}/whatsapp` });

export const addOrderNote = (id, note) => adminRequest({ method: 'post', url: `${API_BASE}/admin/orders/${id}/notes`, data: { note } });

/** extra: { note, cancelReason, carrier, trackingNumber } */
export const setOrderStatus = (id, status, extra = {}) =>
  adminRequest({ method: 'post', url: `${API_BASE}/admin/orders/${id}/status`, data: { status, ...extra } });

// Community ---------------------------------------------------------------

/** report: { targetType, targetId?, targetLabel?, reason, message?, website? (honeypot) } */
export const sendReport = async (report) => (await axios.post(`${API_BASE}/reports`, report)).data;

export const fetchSaved = async () => (await axios.get(`${API_BASE}/me/saved`)).data;

export const saveProduct = async (key, snapshot) => (await axios.put(`${API_BASE}/me/saved/${encodeURIComponent(key)}`, snapshot)).data;

export const unsaveProduct = async (key) => (await axios.delete(`${API_BASE}/me/saved/${encodeURIComponent(key)}`)).data;

export const fetchMySpotFeedback = async (spotId) => (await axios.get(`${API_BASE}/map/spots/${spotId}/feedback/mine`)).data;

/** answers: { reacted, dedicatedKitchen, staffAware }, each true, false or null */
const sendSpotFeedbackLive = async (spotId, answers) => (await axios.put(`${API_BASE}/map/spots/${spotId}/feedback`, answers)).data;

// Forum ------------------------------------------------------------------

/** filters: { category, sort: 'recent' | 'popular' | 'unanswered', q, view: 'all' | 'saved' | 'mine' | 'answered', page } */
export const fetchForumThreads = async ({ category, sort, q, view, page } = {}) =>
  (
    await axios.get(`${API_BASE}/forum/threads`, {
      params: {
        category: category && category !== 'ALL' ? category : undefined,
        sort: sort && sort !== 'recent' ? sort : undefined,
        q: q || undefined,
        view: view && view !== 'all' ? view : undefined,
        page: page > 1 ? page : undefined,
      },
    })
  ).data;

// A random id kept on this device, so a visitor who is not signed in counts once in a question's views.
// It says nothing about the person; without storage, the read is simply not counted.
const READER_KEY = 'celiac-square-forum-reader';
const readerId = () => {
  try {
    let id = localStorage.getItem(READER_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(READER_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
};

/** The question with its answers (and one more reader, the first time this person opens it) */
export const fetchForumThread = async (id) => {
  const reader = readerId();
  return (await axios.get(`${API_BASE}/forum/threads/${id}`, { headers: reader ? { 'X-Forum-Reader': reader } : {} })).data;
};

/** thread: { title, body, category, lang } */
export const createForumThread = async (thread) => (await axios.post(`${API_BASE}/forum/threads`, thread)).data;

/** changes: { title?, body?, category? }; the team can also send { isPinned, isLocked } */
export const updateForumThread = async (id, changes) => (await axios.patch(`${API_BASE}/forum/threads/${id}`, changes)).data;

export const deleteForumThread = async (id) => (await axios.delete(`${API_BASE}/forum/threads/${id}`)).data;

export const createForumReply = async (threadId, body, parentId = null) =>
  (await axios.post(`${API_BASE}/forum/threads/${threadId}/replies`, { body, parentId })).data;

export const updateForumReply = async (id, body) => (await axios.patch(`${API_BASE}/forum/replies/${id}`, { body })).data;

export const deleteForumReply = async (id) => (await axios.delete(`${API_BASE}/forum/replies/${id}`)).data;

/** replyId: the answer that solved the question, or null to unmark it */
export const acceptForumReply = async (threadId, replyId) => (await axios.put(`${API_BASE}/forum/threads/${threadId}/accepted`, { replyId })).data;

/** kind: 'threads' | 'replies'; mark: 'like' | 'save' (save is for threads only) */
export const setForumMark = async (kind, id, mark, on) => (await axios({ method: on ? 'put' : 'delete', url: `${API_BASE}/forum/${kind}/${id}/${mark}` })).data;

// Back-office: forum moderation (team and admins)

export const fetchForumOverview = () => adminRequest({ method: 'get', url: `${API_BASE}/admin/forum/overview` });

export const fetchForumReports = (status = 'OPEN') => adminRequest({ method: 'get', url: `${API_BASE}/admin/forum/reports`, params: { status } });

export const setForumReportStatus = (id, status) => adminRequest({ method: 'patch', url: `${API_BASE}/admin/forum/reports/${id}`, data: { status } });

/** filter: 'all' | 'pinned' | 'locked' | 'unanswered'; author: an account id */
export const fetchAdminForumThreads = ({ q = '', filter = 'all', author = '', page = 1 } = {}) =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/forum/threads`, params: { q: q || undefined, filter: filter === 'all' ? undefined : filter, author: author || undefined, page: page > 1 ? page : undefined } });

export const fetchAdminForumReplies = ({ q = '', author = '', page = 1 } = {}) =>
  adminRequest({ method: 'get', url: `${API_BASE}/admin/forum/replies`, params: { q: q || undefined, author: author || undefined, page: page > 1 ? page : undefined } });

/** With q: accounts matching a name or an e-mail. Without: the members blocked now. */
export const fetchForumMembers = (q = '') => adminRequest({ method: 'get', url: `${API_BASE}/admin/forum/members`, params: { q: q || undefined } });

/** days: 1, 7 or 30; null blocks until it is lifted */
export const blockForumMember = (userId, { reason = '', days = null } = {}) =>
  adminRequest({ method: 'put', url: `${API_BASE}/admin/forum/blocks/${userId}`, data: { reason, days } });

export const unblockForumMember = (userId) => adminRequest({ method: 'delete', url: `${API_BASE}/admin/forum/blocks/${userId}` });

/** Removes every question and answer the member wrote */
export const deleteForumMemberPosts = (userId) => adminRequest({ method: 'delete', url: `${API_BASE}/admin/forum/members/${userId}/posts` });

/** The message to show for a failed request: the API's own message for 4xx, a fallback otherwise */
export const errorMessage = (err, fallback) => {
  const status = err?.response?.status;
  const message = err?.response?.data?.message;
  return status && status < 500 && typeof message === 'string' && message ? message : fallback;
};

// Cached reads and the changes that clear them (see the top of this file)
export const fetchSpots = (...args) => remember(`map:fetchSpots:${JSON.stringify(args)}`, 5 * MINUTE, () => fetchSpotsLive(...args));
export const fetchCities = (...args) => remember(`map:fetchCities:${JSON.stringify(args)}`, 30 * MINUTE, () => fetchCitiesLive(...args));
export const searchProducts = (...args) => remember(`products:searchProducts:${JSON.stringify(args)}`, 10 * MINUTE, () => searchProductsLive(...args));
export const fetchProductByBarcode = (...args) => remember(`products:fetchProductByBarcode:${JSON.stringify(args)}`, 10 * MINUTE, () => fetchProductByBarcodeLive(...args));
export const fetchAtmcProducts = (...args) => remember(`atmc:fetchAtmcProducts:${JSON.stringify(args)}`, 30 * MINUTE, () => fetchAtmcProductsLive(...args));
export const fetchAtmcCategories = (...args) => remember(`atmc:fetchAtmcCategories:${JSON.stringify(args)}`, 30 * MINUTE, () => fetchAtmcCategoriesLive(...args));
export const fetchAtmcStats = (...args) => remember(`atmc:fetchAtmcStats:${JSON.stringify(args)}`, 30 * MINUTE, () => fetchAtmcStatsLive(...args));
export const fetchStores = (...args) => remember(`market:fetchStores:${JSON.stringify(args)}`, 3 * MINUTE, () => fetchStoresLive(...args));
export const fetchStore = (...args) => remember(`market:fetchStore:${JSON.stringify(args)}`, 3 * MINUTE, () => fetchStoreLive(...args));
export const fetchMarketProducts = (...args) => remember(`market:fetchMarketProducts:${JSON.stringify(args)}`, 3 * MINUTE, () => fetchMarketProductsLive(...args));
export const approveProposal = (...args) => approveProposalLive(...args).then(forgets('map:'));
export const createSpot = (...args) => createSpotLive(...args).then(forgets('map:'));
export const updateSpot = (...args) => updateSpotLive(...args).then(forgets('map:'));
export const deleteSpot = (...args) => deleteSpotLive(...args).then(forgets('map:'));
export const toggleSpotVerification = (...args) => toggleSpotVerificationLive(...args).then(forgets('map:'));
export const sendSpotFeedback = (...args) => sendSpotFeedbackLive(...args).then(forgets('map:'));
export const saveMyStore = (...args) => saveMyStoreLive(...args).then(forgets('market:'));
export const createMyProduct = (...args) => createMyProductLive(...args).then(forgets('market:'));
export const updateMyProduct = (...args) => updateMyProductLive(...args).then(forgets('market:'));
export const deleteMyProduct = (...args) => deleteMyProductLive(...args).then(forgets('market:'));
export const setStoreActive = (...args) => setStoreActiveLive(...args).then(forgets('market:'));
export const approveSellerApplication = (...args) => approveSellerApplicationLive(...args).then(forgets('market:'));
export const placeOrder = (...args) => placeOrderLive(...args).then(forgets('market:'));
