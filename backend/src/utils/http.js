import express from 'express';

/**
 * Express 4 does not catch errors thrown by async handlers: an unhandled rejection
 * would crash the process. Every route file builds its router with asyncRouter(),
 * which forwards both sync throws and rejected promises to the error handler.
 */
const wrap = (fn) => {
  if (typeof fn !== 'function' || fn.length === 4) return fn; // error handlers and non-functions pass through
  return function wrapped(req, res, next) {
    try {
      const result = fn(req, res, next);
      if (result && typeof result.then === 'function') result.catch(next);
    } catch (err) {
      next(err);
    }
  };
};

export const asyncRouter = () => {
  const router = express.Router();
  for (const method of ['use', 'get', 'post', 'put', 'patch', 'delete']) {
    const original = router[method].bind(router);
    router[method] = (...args) => original(...args.map(wrap));
  }
  return router;
};

/**
 * Query strings may repeat a key (?q=a&q=b gives an array). Every route expects
 * strings, so arrays keep their last value and anything else is dropped.
 */
export const normalizeQuery = (req, res, next) => {
  const out = {};
  for (const [key, value] of Object.entries(req.query || {})) {
    const v = Array.isArray(value) ? value[value.length - 1] : value;
    if (typeof v === 'string') out[key] = v;
  }
  req.query = out;
  next();
};

/** A trimmed string, or '' for anything that is not a string */
export const clean = (v) => (typeof v === 'string' ? v.trim() : '');

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Maximum lengths of free-text fields, shared by every route (the database enforces the same limits) */
export const MAX_LEN = {
  name: 120,
  title: 120,
  businessName: 120,
  fullName: 100,
  email: 254,
  city: 80,
  address: 200,
  phone: 30,
  speciality: 120,
  hours: 120,
  submittedBy: 80,
  notes: 1000,
  description: 2000,
};

/**
 * Returns a 400 message when one of the given fields is longer than allowed, otherwise null.
 * fields: { label: [value, maxLength] }
 */
export const tooLong = (fields) => {
  for (const [label, [value, max]] of Object.entries(fields)) {
    if (typeof value === 'string' && value.length > max) return `Le champ « ${label} » dépasse ${max} caractères.`;
  }
  return null;
};

/** 400 response helper */
export const badRequest = (res, message) => res.status(400).json({ success: false, message });
