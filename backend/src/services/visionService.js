import { GoogleGenAI } from '@google/genai';

/**
 * Estimates whether a product contains gluten from its ingredients list.
 * The browser reads the photo with OCR and only the text is sent here, which keeps
 * requests small and fast; Gemini then judges the ingredients.
 */

// Fast "lite" models answer in ~1–2 s; the larger flash models took 20 s+ or timed out.
// Override with GEMINI_MODEL in .env.
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
const TIMEOUT_MS = 12000;

export const VERDICTS = ['CONTAINS_GLUTEN', 'MAY_CONTAIN', 'GLUTEN_FREE', 'UNREADABLE'];

const PROMPT = `You help people with celiac disease in Tunisia. Below is the ingredients list of a food product,
read from a photo by OCR: it may contain recognition errors (wrong letters, merged words, stray characters)
and may be in French, Arabic and/or English. Interpret it sensibly and decide whether the product is safe for a celiac.

Gluten sources: wheat (blé, froment, قمح), durum wheat / semolina (semoule, سميد), spelt (épeautre), kamut,
barley (orge, شعير), rye (seigle), triticale, oats (avoine, شوفان) unless certified gluten-free, malt and malt
extract (malt, extrait de malt, مالط), wheat starch (amidon de blé), wheat protein / seitan, bulgur, couscous,
breadcrumbs (chapelure), brewer's yeast. Glucose syrup, dextrose, maltodextrin and caramel made from wheat are
considered safe in the EU: do not count them as gluten.

Verdicts:
- CONTAINS_GLUTEN: at least one ingredient above is listed.
- MAY_CONTAIN: no gluten ingredient, but a "may contain / traces of" warning mentions gluten or a gluten cereal,
  or an ingredient is ambiguous (e.g. "amidon" or "farine" without the cereal).
- GLUTEN_FREE: the list is readable and nothing above appears.
- UNREADABLE: the text is not an ingredients list, or too garbled to judge.

"confidence" is your probability (0 to 1) that the verdict is right. Lower it when the text is garbled, cut off,
or ambiguous. Answer with JSON only:
{
  "verdict": "CONTAINS_GLUTEN" | "MAY_CONTAIN" | "GLUTEN_FREE" | "UNREADABLE",
  "confidence": number,
  "glutenIngredients": [string],
  "traces": [string],
  "explanationFr": string,
  "explanationAr": string
}
explanationFr / explanationAr: one short sentence (max ~25 words) saying why, in French and in Arabic.

Ingredients text (between the markers):
<<<
`;

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const strings = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim()) : []);

export const isIngredientsAiConfigured = () => Boolean(process.env.GEMINI_API_KEY?.trim());

export const analyzeIngredientsText = async (text) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: TIMEOUT_MS } });
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...DEFAULT_MODELS] : DEFAULT_MODELS;

  let lastError;
  for (const model of [...new Set(models)]) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: `${PROMPT}${text}\n>>>` }] }],
        config: { responseMimeType: 'application/json', temperature: 0 },
      });
      const parsed = JSON.parse((response.text || '').replace(/```json|```/g, '').trim());
      return {
        verdict: VERDICTS.includes(parsed.verdict) ? parsed.verdict : 'UNREADABLE',
        confidence: clamp01(Number(parsed.confidence)),
        glutenIngredients: strings(parsed.glutenIngredients),
        traces: strings(parsed.traces),
        explanationFr: typeof parsed.explanationFr === 'string' ? parsed.explanationFr : '',
        explanationAr: typeof parsed.explanationAr === 'string' ? parsed.explanationAr : '',
        model,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Ingredients AI] ${model} failed: ${err.message?.slice(0, 200)}`);
    }
  }
  throw lastError || new Error('Ingredients analysis failed');
};
