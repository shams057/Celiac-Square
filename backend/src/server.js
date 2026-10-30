import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/db.js';
import mapRoutes from './routes/mapRoutes.js';
import productRoutes from './routes/productRoutes.js';
import visionRoutes from './routes/visionRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(
  cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads if needed
app.use('/uploads', express.static(path.resolve('uploads')));

// Routes
app.use('/api/map', mapRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vision', visionRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'Celiac Square Tunisia',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
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
  res.status(500).json({
    success: false,
    message: err.message || 'Erreur interne du serveur.',
  });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Celiac Square Backend running on http://localhost:${PORT}`);
  console.log(`📍 Map endpoints:      http://localhost:${PORT}/api/map/spots`);
  console.log(`🔍 Product endpoints:  http://localhost:${PORT}/api/products/search`);
  console.log(`👁️ Vision endpoint:    http://localhost:${PORT}/api/vision/identify`);
  console.log(`=======================================================`);
});

export default app;
