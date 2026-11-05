/**
 * Fixed-window rate limiter keyed by client IP, kept in memory.
 *
 * On Vercel each warm function instance has its own counters, so this slows abuse
 * down rather than giving an exact global limit. For hard limits, add a Vercel
 * Firewall rate-limit rule (or a shared store such as Upstash Redis) in front.
 */
export const rateLimit = ({ name, windowMs, max, message }) => {
  const hits = new Map();
  let lastSweep = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    // Forget finished windows now and then so the map cannot grow without bound
    if (now - lastSweep > windowMs) {
      for (const [key, entry] of hits) if (now - entry.start >= windowMs) hits.delete(key);
      lastSweep = now;
    }

    const key = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(key);
    if (!entry || now - entry.start >= windowMs) {
      entry = { start: now, count: 0 };
      hits.set(key, entry);
    }
    entry.count += 1;

    res.setHeader('RateLimit-Policy', `${max};w=${Math.round(windowMs / 1000)};name="${name}"`);
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.start + windowMs - now) / 1000)));
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: message || 'Trop de requêtes. Patientez un moment puis réessayez.',
      });
    }
    return next();
  };
};

const MINUTE = 60 * 1000;

export const limits = {
  // Everything under /api except the vision scanner
  api: rateLimit({ name: 'api', windowMs: MINUTE, max: 300 }),
  // Sign-in and sign-up: slows credential stuffing and mass account creation
  auth: rateLimit({
    name: 'auth',
    windowMs: 15 * MINUTE,
    max: 10,
    message: 'Trop de tentatives. Réessayez dans quelques minutes.',
  }),
  refresh: rateLimit({ name: 'refresh', windowMs: 15 * MINUTE, max: 60 }),
  passwordReset: rateLimit({
    name: 'password-reset',
    windowMs: 60 * MINUTE,
    max: 5,
    message: 'Trop de demandes. Réessayez dans une heure.',
  }),
  // Public forms that land in an admin inbox
  submissions: rateLimit({
    name: 'submissions',
    windowMs: 60 * MINUTE,
    max: 5,
    message: 'Vous avez déjà envoyé plusieurs demandes. Réessayez plus tard.',
  }),
  // Proxied to Open Food Facts, which rate-limits our server's IP
  productSearch: rateLimit({ name: 'product-search', windowMs: MINUTE, max: 60 }),
};
