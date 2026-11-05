/**
 * The Express app, without a listener: used by server.js locally and by api/index.js on Vercel.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { isDbConfigured, pingDb } from './config/db.js';
import mapRoutes from './routes/mapRoutes.js';
import productRoutes from './routes/productRoutes.js';
import visionRoutes from './routes/visionRoutes.js';
import atmcRoutes from './routes/atmcRoutes.js';
import authRoutes from './routes/authRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const app = express();


// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
// Marketplace bodies carry resized photos as data URLs. Must come before the default
// parser, which would reject them; a body parsed here is not parsed again.
app.use('/api/market', express.json({ limit: '8mb' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Every API route except /api/health needs the database
app.use('/api', async (req, res, next) => {
  if (req.path === '/health') return next();
  if (!isDbConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Base de données non configurée : définissez SUPABASE_URL et SUPABASE_SECRET_KEY.',
    });
  }
  return next();
});

// Routes
app.use('/api/map', mapRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/atmc', atmcRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/admin', adminRoutes);

// Health check: says what is configured (never the values) and whether MongoDB answers
app.get('/api/health', async (req, res) => {
  let database = 'not_configured';
  if (isDbConfigured()) {
    try {
      await pingDb();
      database = 'connected';
    } catch {
      database = 'unreachable';
    }
  }
  res.status(database === 'connected' ? 200 : 503).json({
    status: database === 'connected' ? 'online' : 'degraded',
    platform: 'Celiac Square Tunisia',
    database,
    config: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseSecretKey: Boolean(process.env.SUPABASE_SECRET_KEY),
      adminToken: Boolean(process.env.ADMIN_TOKEN),
      geminiApiKey: Boolean(process.env.GEMINI_API_KEY),
    },
    timestamp: new Date().toISOString(),
  });
});

// Root friendly endpoint
app.get('/', (req, res) => {
  res.send('Celiac Square Tunisia API is running smoothly.');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route non trouvée sur le serveur API.' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[Server Error] ${err.stack || err.message}`);
  // body-parser errors (too large, invalid JSON) carry their own 4xx status
  res.status(err.status || 500).json({
    success: false,
    message: err.status === 413 ? 'Les images envoyées sont trop lourdes.' : err.message || 'Erreur interne du serveur.',
  });
});

export default app;
