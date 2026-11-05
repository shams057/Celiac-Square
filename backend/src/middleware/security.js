import cors from 'cors';

// The frontend calls the API from the same origin; only these other origins may call it from a browser
const DEFAULT_ORIGINS = [
  'https://celiac-square.vercel.app',
  'http://localhost:3000',
  'http://localhost:3010',
  'http://localhost:4173',
];

export const allowedOrigins = () =>
  (process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : DEFAULT_ORIGINS).map((o) => o.trim()).filter(Boolean);

export const corsMiddleware = () =>
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins().includes(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

/** Response headers for the JSON API (the static frontend gets its own in vercel.json) */
export const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  if (req.secure || process.env.VERCEL) {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
};
