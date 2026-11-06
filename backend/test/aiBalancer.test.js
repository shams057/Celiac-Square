import { test } from 'node:test';
import assert from 'node:assert/strict';

// Only two fake OpenAI-compatible providers: no network, fetch is mocked below
for (const k of ['OLLAMA_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY', 'GORQ_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY']) delete process.env[k];
process.env.GROQ_API_KEY = 'test';
process.env.MISTRAL_API_KEY = 'test';

const { callBalanced, callConsensus, providerStatus } = await import('../src/services/aiBalancer.js');
const { mergeVerdicts } = await import('../src/services/visionService.js');

const providerOf = (url) => (url.includes('groq') ? 'groq' : 'mistral');
const reply = (json) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(json) } }] }), { status: 200 });
const mockFetch = (handler) => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(providerOf(String(url)));
    return handler(providerOf(String(url)));
  };
  return calls;
};

test('calls rotate between the providers', async () => {
  const calls = mockFetch((p) => reply({ from: p }));
  const a = await callBalanced({ parts: [{ text: 'hi' }] });
  const b = await callBalanced({ parts: [{ text: 'hi' }] });
  assert.notEqual(a.provider, b.provider);
  assert.equal(calls.length, 2);
});

test('a rate-limited provider is skipped and rests', async () => {
  const calls = mockFetch((p) => (p === 'groq' ? new Response('{"error":{"message":"rate limit"}}', { status: 429, headers: { 'retry-after': '30' } }) : reply({ from: p })));
  for (let i = 0; i < 4; i += 1) assert.equal((await callBalanced({ parts: [{ text: 'hi' }] })).provider, 'mistral');
  assert.equal(calls.filter((c) => c === 'groq').length, 1, 'groq is not asked again while cooling down');
  assert.ok(providerStatus().find((s) => s.name === 'groq').coolingDownS > 0);
});

test('consensus: disagreeing models give the strictest verdict', async () => {
  mockFetch((p) => reply({ verdict: p === 'groq' ? 'GLUTEN_FREE' : 'MAY_CONTAIN', confidence: 0.9 }));
  // groq is resting from the previous test: both are still asked, the resting one last
  const result = await callConsensus({ parts: [{ text: 'x' }], vote: (j) => j.verdict });
  assert.equal(result.answers.length, 2);
  assert.equal(result.agreed, false);
  const merged = mergeVerdicts(result);
  assert.equal(merged.verdict, 'MAY_CONTAIN');
  assert.ok(merged.confidence <= 0.5);
  assert.equal(merged.consensus.agreed, false);
});

test('consensus: a lone GLUTEN_FREE answer is not trusted fully', () => {
  const merged = mergeVerdicts({ answers: [{ json: { verdict: 'GLUTEN_FREE', confidence: 0.99, ingredientsText: 'sucre, lait' }, model: 'm', provider: 'groq' }], agreed: false });
  assert.equal(merged.verdict, 'GLUTEN_FREE');
  assert.equal(merged.confidence, 0.7);
});

test('consensus: the rules safety net still overrides every model', () => {
  const answers = ['groq', 'mistral'].map((provider) => ({ json: { verdict: 'GLUTEN_FREE', confidence: 0.95, ingredientsText: 'farine de blé, sucre' }, model: 'm', provider }));
  assert.equal(mergeVerdicts({ answers, agreed: true }).verdict, 'CONTAINS_GLUTEN');
});
