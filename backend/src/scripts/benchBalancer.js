import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { analyzeIngredientsImage } from '../services/visionService.js';
import { PROVIDERS, providerStatus } from '../services/aiBalancer.js';

/**
 * Live check of the AI load balancer: each ingredient photo in test_data/ goes through the consensus
 * verdict, then to every enabled provider alone, so you can see who agrees with whom.
 * Calls real APIs (free tiers): not part of npm test. Run: node src/scripts/benchBalancer.js
 */
const DIR = path.resolve(import.meta.dirname, '../../../../test_data');
// Accepted verdicts, from benchmark/bench_models.mjs
const EXPECTED = { danette_ingredient: ['MAY_CONTAIN', 'CONTAINS_GLUTEN'], off_saida_major_ingredients: ['CONTAINS_GLUTEN'], off_vitalait_ingredients_ar: ['GLUTEN_FREE'] };
const photos = fs.readdirSync(DIR).filter((f) => /ingredient/i.test(f));

for (const f of photos) {
  const bytes = fs.readFileSync(path.join(DIR, f));
  const image = { bytes, base64: bytes.toString('base64'), mimeType: f.endsWith('.png') ? 'image/png' : 'image/jpeg' };
  const t = Date.now();
  try {
    const r = await analyzeIngredientsImage(image);
    const ok = EXPECTED[path.parse(f).name]?.includes(r.verdict);
    console.log(`\n${ok ? 'RIGHT' : 'WRONG'} ${f}: ${r.verdict} (conf ${r.confidence.toFixed(2)}, ${Date.now() - t} ms, agreed=${r.consensus.agreed})`);
    for (const v of r.consensus.votes) console.log(`   vote ${v.provider.padEnd(8)} ${v.verdict}${v.modelVerdict !== v.verdict ? ` (model said ${v.modelVerdict}, rules corrected it)` : ''}`);
  } catch (err) {
    console.log(`\n${f}: FAILED ${err.message}`);
  }
}
console.log('\nProviders:', JSON.stringify(providerStatus(), null, 1));
console.log('Enabled:', PROVIDERS.filter((p) => p.enabled()).map((p) => p.name).join(', '));
