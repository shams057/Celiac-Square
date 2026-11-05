import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { identifyProductFromImage } from '../services/productVision.js';
import { analyzeIngredientsImage } from '../services/visionService.js';

/**
 * Runs the photo scanner on the test photos and checks each answer.
 * Calls Gemini once or twice per photo (needs GEMINI_API_KEY and the database), so it is not part of npm test.
 *
 *   npm run bench:scanner -- [folder]      (default: ../test_data next to the app)
 */
dotenv.config();

const folder = path.resolve(process.argv[2] || new URL('../../../../test_data', import.meta.url).pathname);

// Expected guide result per photo: match type, words of the entry, status shown
const EXPECTED = {
  'delice_yaourt_vanille.png': { matchType: 'exact', entry: /Délice Danone/, status: 'SAFE' },
  'lindor.jpg': { matchType: 'none' },
  'tropico.png': { matchType: 'category', entry: /Jus de fruits du commerce/, status: 'WARNING' },
  'off_sicam_concentre_tomate.jpg': { matchType: 'exact', entry: /SICAM/, status: 'WARNING' },
  'off_vitalait_yaourt_nature.jpg': { matchType: 'exact', entry: /Vitalait/, status: 'SAFE' },
  'off_saida_major.jpg': { status: 'UNSAFE' },
  'off_warda_couscous.jpg': { status: 'UNSAFE' },
  // An ingredients photo: flagged as such, and never judged gluten-free ("amidon" without its cereal)
  'danette_ingredient.png': { ingredients: ['MAY_CONTAIN', 'CONTAINS_GLUTEN'] },
};

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
let failures = 0;

for (const [file, expected] of Object.entries(EXPECTED)) {
  const full = path.join(folder, file);
  if (!fs.existsSync(full)) {
    console.log(`SKIP  ${file} (missing)`);
    continue;
  }
  const bytes = fs.readFileSync(full);
  const image = { mimeType: MIME[path.extname(file).toLowerCase()], base64: bytes.toString('base64'), bytes };
  const t0 = Date.now();
  try {
    const r = await identifyProductFromImage(image);
    const problems = [];
    if (expected.ingredients) {
      if (!r.looksLikeIngredients) problems.push('not flagged as an ingredients photo');
      const v = await analyzeIngredientsImage(image);
      if (!expected.ingredients.includes(v.verdict)) problems.push(`ingredients verdict ${v.verdict}`);
      r.summary = `ingredients: ${v.verdict}${v.adjusted ? ' (rules)' : ''}`;
    } else {
      if (expected.matchType && r.matchType !== expected.matchType) problems.push(`match ${r.matchType}`);
      if (expected.entry && !expected.entry.test(r.identifiedProduct || '')) problems.push(`entry "${r.identifiedProduct}"`);
      if (expected.status && r.glutenStatus !== expected.status) problems.push(`status ${r.glutenStatus}`);
      r.summary = `${r.productLabel} -> ${r.matchType} ${r.identifiedProduct ? `"${r.identifiedProduct.slice(0, 50)}"` : ''} ${r.glutenStatus}`;
    }
    if (problems.length) failures += 1;
    console.log(`${problems.length ? 'FAIL' : 'ok  '}  ${file.padEnd(32)} ${String(Date.now() - t0).padStart(6)} ms  ${r.summary}${problems.length ? `  <- ${problems.join(', ')}` : ''}`);
  } catch (err) {
    failures += 1;
    console.log(`FAIL  ${file.padEnd(32)} ${String(err.message).slice(0, 120)}`);
  }
}

console.log(failures ? `\n${failures} photo(s) failed.` : '\nAll photos passed.');
process.exitCode = failures ? 1 : 0;
