/**
 * The Express app, without a listener: used by server.js locally and by api/index.js on Vercel.
 */
import express from 'express';
import dotenv from 'dotenv';
import { isDbConfigured } from './config/db.js';
import { normalizeQuery } from './utils/http.js';
import { corsMiddleware, securityHeaders } from './middleware/security.js';
import { limits } from './middleware/rateLimit.js';
import mapRoutes from './routes/mapRoutes.js';
import productRoutes from './routes/productRoutes.js';
import visionRoutes from './routes/visionRoutes.js';
import atmcRoutes from './routes/atmcRoutes.js';
import authRoutes from './routes/authRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import meRoutes from './routes/meRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import orderAdminRoutes from './routes/orderAdminRoutes.js';
import whatsappRoutes from './routes/whatsappRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

dotenv.config();

const app = express();

app.disable('x-powered-by');
// Behind Vercel's proxy, req.ip must come from X-Forwarded-For (used by the rate limiter)
if (process.env.VERCEL || process.env.TRUST_PROXY) app.set('trust proxy', 1);
// No nested objects from the query string; repeated keys are flattened by normalizeQuery
app.set('query parser', 'simple');

app.use(securityHeaders);
app.use(corsMiddleware());
app.use(normalizeQuery);

// Body parsers. A body parsed by the first matching parser is not parsed again,
// so the route-specific limits must come before the default one.
// Marketplace photos travel as data URLs: only the routes that take images accept large bodies.
// The WhatsApp webhook needs the raw bytes to check Meta's signature
app.use('/api/whatsapp/webhook', express.raw({ type: '*/*', limit: '1mb' }));
app.use(['/api/market/me/store', '/api/market/me/products'], express.json({ limit: '8mb' }));
// Scanner photos (resized in the browser) go to /identify and /ingredients; OCR text to /match
app.use(['/api/vision/identify', '/api/vision/ingredients'], express.json({ limit: '3mb' }));
app.use('/api/vision', express.json({ limit: '50kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

// Health check: public, and says nothing about the configuration (see GET /api/admin/health)
app.get('/api/health', (req, res) => {
  res.status(isDbConfigured() ? 200 : 503).json({ status: isDbConfigured() ? 'online' : 'degraded' });
});

// Every other API route needs the database
app.use('/api', (req, res, next) => {
  if (!isDbConfigured()) {
    return res.status(503).json({ success: false, message: 'Service temporairement indisponible.' });
  }
  return next();
});

// Rate limits. The vision scanner (/api/vision) is deliberately left out.
app.use('/api', (req, res, next) => (req.path.startsWith('/vision') ? next() : limits.api(req, res, next)));

// Routes
app.use('/api/map', mapRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/atmc', atmcRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
// Before /api/admin: the order pipeline and the dashboard are open to the team (STAFF), the rest of /api/admin is not
app.use('/api/admin/orders', orderAdminRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/me', meRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/whatsapp', whatsappRoutes);

app.get('/', (req, res) => {
  res.send('Celiac Square Tunisia API is running smoothly.');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée sur le serveur API.' });
});

// Error handler: details go to the logs, never to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) console.error(`[Server Error] ${req.method} ${req.originalUrl}: ${err.stack || err.message}`);
  const messages = {
    413: 'Les données envoyées sont trop lourdes.',
    400: 'Requête invalide.',
  };
  res.status(status).json({ success: false, message: messages[status] || (status === 500 ? 'Erreur interne du serveur.' : 'Requête refusée.') });
});

export default app;
