import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client. It uses the secret key, which bypasses row level security,
 * so it must never be sent to the browser.
 */
let client = null;

export const isDbConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

export const db = () => {
  if (!client) {
    if (!isDbConfigured()) throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be set.');
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};

/**
 * A throwaway client for sign-in, sign-up and token refresh. Signing in stores the user's
 * session on the client, so these calls must never run on the shared db() client,
 * whose queries would then run as that user instead of with the secret key.
 */
export const authClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

/** Cheap query used by the health check */
export const pingDb = async () => {
  const { error } = await db().from('atmc_products').select('id', { head: true, count: 'exact' }).limit(1);
  if (error) throw new Error(error.message);
};

/** Throws a regular Error for a failed Supabase call, otherwise returns its data */
export const unwrap = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};

/**
 * True when a Supabase error means the table does not exist yet (a migration not applied):
 * features built on newer tables answer "unavailable" instead of failing with a 500.
 */
export const isMissingTable = (error) =>
  Boolean(error) && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|could not find the table/i.test(error.message || ''));

export const FEATURE_UNAVAILABLE = {
  success: false,
  code: 'FEATURE_UNAVAILABLE',
  message: 'Cette fonction n’est pas encore disponible. Réessayez plus tard.',
};
