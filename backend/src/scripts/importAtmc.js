import path from 'node:path';
import dotenv from 'dotenv';
import { db, unwrap } from '../config/db.js';
import { buildAtmcRowsFromFile } from '../seed/data.js';

/**
 * Loads a new edition (or errata) of the ATMC guide into atmc_products, without touching anything else.
 *
 *   npm run atmc:import -- ../Data/ATMC2025.json                 dry run: prints what would change
 *   npm run atmc:import -- ../Data/ATMC2025.json --edition 2025-06 --apply
 *
 * The file has the same format as Data/ATMC2023.products.json (one entry per product, French and
 * Arabic names). The older grouped format (Data/ATMC2023.json + its sibling <name>.fr.json) still loads. --edition (YYYY-MM) overrides the file's publication_date.
 *
 * Entries are matched on (category, text): unchanged and re-classified entries keep their row id, so
 * products that users saved stay linked and show "status changed" when the guide re-classifies them.
 * New entries are inserted; entries missing from the new file are deleted.
 */
dotenv.config();

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const apply = args.includes('--apply');
// Only when the flag is there: indexOf(-1) + 1 would otherwise read the file path as the edition
const editionArg = args.includes('--edition') ? args[args.indexOf('--edition') + 1] : undefined;

if (!file) {
  console.error('Usage: npm run atmc:import -- <guide.json> [--edition YYYY-MM] [--apply]');
  process.exit(1);
}
if (args.includes('--edition') && !/^\d{4}-\d{2}$/.test(editionArg || '')) {
  console.error('[ATMC] --edition must look like 2025-06');
  process.exit(1);
}

const keyOf = (r) => `${r.category_slug}\u0000${r.raw_text}`;

try {
  const rows = buildAtmcRowsFromFile(path.resolve(file), { edition: editionArg ? `${editionArg}-01` : undefined });
  if (!rows.length) throw new Error('No entries found in the file: check its format.');

  const existing = unwrap(await db().from('atmc_products').select('id, category_slug, raw_text, status'));
  const byKey = new Map(existing.map((r) => [keyOf(r), r]));
  const incomingKeys = new Set(rows.map(keyOf));

  const added = rows.filter((r) => !byKey.has(keyOf(r)));
  const kept = rows.filter((r) => byKey.has(keyOf(r))).map((r) => ({ ...r, id: byKey.get(keyOf(r)).id }));
  const reclassified = kept.filter((r) => byKey.get(keyOf(r)).status !== r.status);
  const removed = existing.filter((r) => !incomingKeys.has(keyOf(r)));

  console.log(`[ATMC] ${path.basename(file)}: ${rows.length} entries, edition ${rows[0].edition}`);
  console.log(`[ATMC] new: ${added.length}, re-classified: ${reclassified.length}, unchanged: ${kept.length - reclassified.length}, removed: ${removed.length}`);
  for (const r of reclassified) console.log(`  ~ ${byKey.get(keyOf(r)).status} -> ${r.status}  ${r.raw_text.slice(0, 90)}`);
  for (const r of added.slice(0, 50)) console.log(`  + ${r.status}  ${r.raw_text.slice(0, 90)}`);
  for (const r of removed.slice(0, 50)) console.log(`  - ${r.status}  ${r.raw_text.slice(0, 90)}`);

  if (!apply) {
    console.log('[ATMC] Dry run: nothing was written. Add --apply to load it.');
  } else {
    for (let i = 0; i < kept.length; i += 200) unwrap(await db().from('atmc_products').upsert(kept.slice(i, i + 200)));
    if (added.length) unwrap(await db().from('atmc_products').insert(added));
    if (removed.length) unwrap(await db().from('atmc_products').delete().in('id', removed.map((r) => r.id)));
    console.log('[ATMC] Done. The API caches the guide for up to 10 minutes per instance.');
  }
} catch (err) {
  console.error(`[ATMC Import Error] ${err.message}`);
  process.exitCode = 1;
}
