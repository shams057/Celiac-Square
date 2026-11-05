import dotenv from 'dotenv';
import { db } from '../config/db.js';
import { spotRows, associationProductRows, buildAtmcRows } from './data.js';

/**
 * Resets the catalogue tables in Supabase and loads the seed data.
 * Wipes spots and proposals too, so only run it on an empty or test database.
 *
 *   npm run seed -- --yes-wipe-database      (uses SUPABASE_URL and SUPABASE_SECRET_KEY from backend/.env)
 *
 * Refuses to run without that flag, and refuses when NODE_ENV is "production"
 * unless SEED_ALLOW_PRODUCTION=true is set as well.
 */
dotenv.config();

if (!process.argv.includes('--yes-wipe-database')) {
  console.error(
    `[Seed] This deletes every spot, proposal and guide product in ${process.env.SUPABASE_URL || 'the database'}.\n` +
      '       Run it again with --yes-wipe-database to confirm:  npm run seed -- --yes-wipe-database'
  );
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  console.error('[Seed] NODE_ENV is "production": refusing to wipe it. Set SEED_ALLOW_PRODUCTION=true if you really mean it.');
  process.exit(1);
}

const reset = async (table) => {
  // PostgREST refuses unfiltered deletes; every row has an id
  const { error } = await db().from(table).delete().not('id', 'is', null);
  if (error) throw new Error(`${table}: ${error.message}`);
};

const insert = async (table, rows) => {
  const { error } = await db().from(table).insert(rows);
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`[Seed] ${table}: ${rows.length} rows`);
};

try {
  for (const table of ['spot_proposals', 'spots', 'association_products', 'atmc_products']) await reset(table);
  await insert('spots', spotRows());
  await insert('association_products', associationProductRows());
  await insert('atmc_products', buildAtmcRows());
  console.log('[Seed] Done.');
} catch (err) {
  console.error(`[Seed Error] ${err.message}`);
  process.exitCode = 1;
}
