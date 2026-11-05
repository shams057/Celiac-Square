/**
 * Small in-memory cache for read-mostly tables (the ATMC guide, cities…), per server instance.
 * Concurrent misses share one load.
 */
const entries = new Map();

export const cached = async (key, ttlMs, load) => {
  const hit = entries.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value ?? hit.pending;
  const pending = load().then(
    (value) => {
      entries.set(key, { at: Date.now(), value });
      return value;
    },
    (err) => {
      entries.delete(key);
      throw err;
    }
  );
  entries.set(key, { at: Date.now(), pending });
  return pending;
};

/** Drop cached entries whose key starts with the prefix (after a write) */
export const invalidate = (prefix) => {
  for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
};
