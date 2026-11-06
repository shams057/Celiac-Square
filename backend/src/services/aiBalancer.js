import { GoogleGenAI } from '@google/genai';

/**
 * Load balancer over the free AI providers the scanner can use.
 *
 * - Rotation: each call starts at the next provider (round robin), skipping any that are cooling down.
 * - Failover: when a provider fails, the same call moves on to the next one.
 * - Cooldown: a 429 rests a provider for its Retry-After (or 60 s), a 5xx or timeout for 30 s,
 *   and a rejected key (401/403) for an hour, so one bad provider does not slow every scan.
 * - Consensus (callConsensus): the same question goes to several providers at once and the votes are
 *   compared. No AI is 100 % accurate; asking two or three independent models and keeping the strictest
 *   answer when they disagree is what cuts the dangerous "safe when it is not" mistakes.
 *
 * A provider is used only when its key is set in .env. All of them have a free tier.
 * `parts` is Gemini-style: [{ text }, { inlineData: { mimeType, data } }].
 */

const TIMEOUT_MS = 15000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const env = (name) => process.env[name]?.trim() || '';

export const parseJson = (raw) => {
  const s = String(raw || '').replace(/```json|```/g, '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  try {
    return JSON.parse(s);
  } catch {
    // Some models wrap the JSON in a sentence: keep the outermost object
    const m = s.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Not JSON: ${s.slice(0, 120)}`);
  }
};

class ProviderError extends Error {
  constructor(message, status, retryAfterS) {
    super(message);
    this.status = status;
    this.retryAfterS = retryAfterS;
  }
}

const texts = (parts) => parts.filter((p) => p.text).map((p) => p.text).join('\n\n');
const images = (parts) => parts.filter((p) => p.inlineData).map((p) => p.inlineData);

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

/** Google Gemini (free tier). Tries the lite models in turn. */
const gemini = {
  name: 'gemini',
  vision: true,
  enabled: () => Boolean(env('GEMINI_API_KEY')),
  async call({ parts }) {
    const ai = new GoogleGenAI({ apiKey: env('GEMINI_API_KEY'), httpOptions: { timeout: TIMEOUT_MS } });
    const models = [...new Set([env('GEMINI_MODEL'), 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest'].filter(Boolean))];
    let lastError;
    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: { responseMimeType: 'application/json', temperature: 0 },
        });
        return { json: parseJson(response.text), model };
      } catch (err) {
        lastError = err;
        const status = Number(err.status || String(err.message).match(/\b(4\d\d|5\d\d)\b/)?.[1]) || 0;
        // A model that is missing or overloaded: the next model. Anything else: give up on Gemini.
        if (![404, 429, 500, 503].includes(status) && !/timed? ?out|UNAVAILABLE/i.test(err.message)) {
          throw new ProviderError(err.message, status);
        }
        lastError = new ProviderError(err.message, status);
      }
    }
    throw lastError;
  },
};

/** Ollama Cloud (Gemma 4 31B by default): native API, images as raw base64 */
const ollamaCloud = {
  name: 'ollama',
  vision: true,
  enabled: () => Boolean(env('OLLAMA_API_KEY')),
  async call({ parts }) {
    const model = env('OLLAMA_MODEL') || 'gemma4:31b';
    const imgs = images(parts).map((i) => i.data);
    const res = await fetch('https://ollama.com/api/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('OLLAMA_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        think: 'low',
        format: 'json',
        options: { temperature: 0 },
        messages: [{ role: 'user', content: texts(parts), ...(imgs.length ? { images: imgs } : {}) }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      throw new ProviderError(`${res.status} ${String(body.error || res.statusText).slice(0, 200)}`, res.status, Number(res.headers.get('retry-after')) || 0);
    }
    return { json: parseJson(body.message?.content), model };
  },
};

/**
 * Any OpenAI-compatible chat endpoint (Groq, OpenRouter, Mistral, Cerebras).
 * Model and vision support can be changed in .env, since free model lists change often.
 */
const openAiCompatible = ({ name, url, keyEnv, modelEnv, defaultModel, vision, extra = {}, jsonMode = true }) => ({
  name,
  get vision() {
    const v = env(`${name.toUpperCase().replace(/-/g, '_')}_VISION`);
    return v ? v === 'true' : vision;
  },
  enabled: () => Boolean(env(keyEnv) && (env(modelEnv) || defaultModel)),
  async call({ parts }) {
    const model = env(modelEnv) || defaultModel;
    const imgs = images(parts);
    const content = imgs.length
      ? [
          ...imgs.map((i) => ({ type: 'image_url', image_url: { url: `data:${i.mimeType};base64,${i.data}` } })),
          { type: 'text', text: texts(parts) },
        ]
      : texts(parts);
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env(keyEnv)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: 'user', content }],
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...extra,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      const msg = body.error?.message || body.error || res.statusText;
      throw new ProviderError(`${res.status} ${String(msg).slice(0, 200)}`, res.status, Number(res.headers.get('retry-after')) || 0);
    }
    return { json: parseJson(body.choices?.[0]?.message?.content), model };
  },
});

const groq = openAiCompatible({
  name: 'groq',
  url: 'https://api.groq.com/openai/v1/chat/completions',
  keyEnv: process.env.GROQ_API_KEY ? 'GROQ_API_KEY' : 'GORQ_API_KEY',
  modelEnv: 'GROQ_MODEL',
  defaultModel: 'qwen/qwen3.8-27b', // reads images; checked against Groq's model list on 6 Nov 2026
  vision: true,
  extra: { reasoning_effort: 'none' },
});

// Free tiers that need their own key. Free model names change often: set the model in .env.
const openrouter = openAiCompatible({
  name: 'openrouter',
  url: 'https://openrouter.ai/api/v1/chat/completions',
  keyEnv: 'OPENROUTER_API_KEY',
  modelEnv: 'OPENROUTER_MODEL', // a model id ending in ":free", from https://openrouter.ai/models?max_price=0
  vision: false,
});
const mistral = openAiCompatible({
  name: 'mistral',
  url: 'https://api.mistral.ai/v1/chat/completions',
  keyEnv: 'MISTRAL_API_KEY',
  modelEnv: 'MISTRAL_MODEL',
  defaultModel: 'mistral-small-latest',
  vision: true,
});
const cerebras = openAiCompatible({
  name: 'cerebras',
  url: 'https://api.cerebras.ai/v1/chat/completions',
  keyEnv: 'CEREBRAS_API_KEY',
  modelEnv: 'CEREBRAS_MODEL',
  vision: false,
});
export const PROVIDERS = [ollamaCloud, gemini, groq, mistral, openrouter, cerebras];

// ---------------------------------------------------------------------------
// Health and rotation
// ---------------------------------------------------------------------------

const health = new Map(); // name -> { cooldownUntil, ok, failed, lastError }
const stateOf = (name) => {
  if (!health.has(name)) health.set(name, { cooldownUntil: 0, ok: 0, failed: 0, lastError: '' });
  return health.get(name);
};

const cooldownFor = (err) => {
  const status = err?.status || Number(String(err?.message).match(/\b([45]\d\d)\b/)?.[1]) || 0;
  if (status === 401 || status === 403) return 60 * 60 * 1000;
  if (status === 429) return (err.retryAfterS || 60) * 1000;
  if (status >= 500 || /timed? ?out|abort|fetch failed|ECONN/i.test(String(err?.message))) return 30 * 1000;
  return 0; // a bad answer (e.g. not JSON) is not the provider's fault for the next call
};

const markOk = (p) => {
  const s = stateOf(p.name);
  s.ok += 1;
  s.cooldownUntil = 0;
};
const markFailed = (p, err) => {
  const s = stateOf(p.name);
  s.failed += 1;
  s.lastError = String(err?.message || err).slice(0, 200);
  s.cooldownUntil = Date.now() + cooldownFor(err);
  console.warn(`[AI] ${p.name} failed: ${s.lastError}`);
};

let cursor = 0;

/** Enabled providers that can take this request, rotated so each call starts one further along */
export const pickProviders = ({ needsVision }) => {
  const usable = PROVIDERS.filter((p) => p.enabled() && (!needsVision || p.vision));
  const now = Date.now();
  const ready = usable.filter((p) => stateOf(p.name).cooldownUntil <= now);
  const resting = usable.filter((p) => stateOf(p.name).cooldownUntil > now);
  const start = ready.length ? cursor++ % ready.length : 0;
  // Resting providers stay last: better a slow answer than none when everything is rate-limited
  return [...ready.slice(start), ...ready.slice(0, start), ...resting];
};

export const isAnyProviderConfigured = () => PROVIDERS.some((p) => p.enabled());

export const providerStatus = () =>
  PROVIDERS.filter((p) => p.enabled()).map((p) => {
    const s = stateOf(p.name);
    return { name: p.name, vision: p.vision, ok: s.ok, failed: s.failed, coolingDownS: Math.max(0, Math.round((s.cooldownUntil - Date.now()) / 1000)), lastError: s.lastError };
  });

const tryProvider = async (p, parts) => {
  // One quick retry for a blip (overload, timeout); a 429 or bad key goes straight to the next provider
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const answer = await p.call({ parts });
      markOk(p);
      return { ...answer, provider: p.name };
    } catch (err) {
      const status = err?.status || 0;
      if (attempt === 0 && (status >= 500 || /timed? ?out|abort/i.test(String(err?.message)))) {
        await sleep(600 + Math.random() * 400);
        continue;
      }
      markFailed(p, err);
      throw err;
    }
  }
  throw new Error('unreachable');
};

/** One answer: rotation with failover. Returns { json, model, provider }. */
export const callBalanced = async ({ parts }) => {
  const needsVision = parts.some((p) => p.inlineData);
  const order = pickProviders({ needsVision });
  if (!order.length) throw new Error(needsVision ? 'No AI provider that reads images is configured' : 'No AI provider configured');
  let lastError;
  for (const p of order) {
    try {
      return await tryProvider(p, parts);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

/**
 * Several independent answers to the same question.
 * Asks `min` providers at once; when their votes differ, asks up to `max` in total.
 * `vote(json)` turns an answer into a comparable value (e.g. the verdict).
 * Returns { answers: [{ json, model, provider, vote }], agreed } (agreed is false with fewer than 2 answers).
 */
export const callConsensus = async ({ parts, vote, min = 2, max = 3 }) => {
  const needsVision = parts.some((p) => p.inlineData);
  const queue = pickProviders({ needsVision });
  if (!queue.length) throw new Error('No AI provider configured');

  const answers = [];
  let lastError;
  const ask = async (n) => {
    const batch = queue.splice(0, n);
    const results = await Promise.allSettled(batch.map((p) => tryProvider(p, parts)));
    for (const r of results) {
      if (r.status === 'fulfilled') answers.push({ ...r.value, vote: vote(r.value.json) });
      else lastError = r.reason;
    }
  };

  await ask(min);
  // Fill in for providers that failed, so we still get `min` answers when possible
  while (answers.length < min && queue.length) await ask(min - answers.length);
  const agreed = () => answers.length >= 2 && answers.every((a) => a.vote === answers[0].vote);
  // Disagreement: a tie-breaker
  while (answers.length >= 2 && !agreed() && answers.length < max && queue.length) await ask(1);

  if (!answers.length) throw lastError || new Error('Every AI provider failed');
  return { answers, agreed: agreed() };
};
