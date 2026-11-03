import dotenv from 'dotenv';
import { db } from '../config/db.js';
import { spotRows, associationProductRows, buildAtmcRows } from './data.js';

/**
 * Resets the catalogue tables in Supabase and loads the seed data.
 * Wipes spots and proposals too, so only run it on an empty or test database.
 *
 *   npm run seed           (uses SUPABASE_URL and SUPABASE_SECRET_KEY from backend/.env)
 */
dotenv.config();

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
