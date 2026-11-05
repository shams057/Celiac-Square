import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeGlutenSafety } from '../src/services/glutenAnalysis.js';

const status = (ingredients, extra = {}) => analyzeGlutenSafety({ ingredients_text: ingredients, ...extra }).status;

test('gluten cereals in the ingredients are UNSAFE, in French, English and Arabic', () => {
  for (const text of [
    'farine de blé, sucre, sel',
    'Farine de BLÉ, sucre',
    'épeautre, eau, levure',
    'wheat flour, sugar',
    'semoule de blé dur',
    'couscous, eau',
    "extrait de malt d'orge, riz",
    'sugar, barley malt',
    'flocons d’avoine, miel',
    'rye, water',
    'seigle complet',
    'chapelure, oeufs',
    'دقيق القمح، سكر',
    'سميد، ماء، ملح',
    'gluten de blé, eau',
    'lait, sucre, malté',
  ]) {
    assert.equal(status(text), 'UNSAFE', text);
  }
});

test('"sans gluten" claims are not read as gluten', () => {
  assert.notEqual(status('riz, sucre (sans gluten)'), 'UNSAFE');
  assert.notEqual(status('rice flour, sugar. Gluten-free.'), 'UNSAFE');
});

test('EU-exempt wheat derivatives are not gluten', () => {
  assert.notEqual(status('sucre, sirop de glucose de blé, cacao'), 'UNSAFE');
  assert.notEqual(status('maltodextrine, dextrose, sel'), 'UNSAFE');
});

test('words that merely contain a cereal name do not match', () => {
  // "comestible", "orgeat"-like words, "maltodextrine"
  assert.notEqual(status('huile comestible, sel, maltodextrine'), 'UNSAFE');
});

test('traces give CROSS_CONTAMINATION_RISK', () => {
  assert.equal(status('riz, sucre. Peut contenir des traces de blé.'), 'CROSS_CONTAMINATION_RISK');
  assert.equal(status('cacao, sucre. Traces éventuelles de gluten.'), 'CROSS_CONTAMINATION_RISK');
  assert.equal(status('cacao, sucre', { traces_tags: ['en:gluten'] }), 'CROSS_CONTAMINATION_RISK');
});

test('allergen tags win over a gluten-free label', () => {
  assert.equal(status('', { allergens_tags: ['en:gluten'], labels_tags: ['en:gluten-free'] }), 'UNSAFE');
  assert.equal(status('farine de blé', { labels_tags: ['en:gluten-free'] }), 'UNSAFE');
});

test('a gluten-free certification with clean ingredients is SAFE', () => {
  const result = analyzeGlutenSafety({ ingredients_text: 'farine de riz, sucre', labels_tags: ['en:gluten-free'] });
  assert.equal(result.status, 'SAFE');
  assert.equal(result.isGlutenFree, true);
});

test('ingredients with nothing found are never SAFE', () => {
  const result = analyzeGlutenSafety({ ingredients_text: 'tomates, sel, huile d’olive' });
  assert.equal(result.status, 'WARNING');
  assert.equal(result.isGlutenFree, false);
});

test('flour or starch without its cereal is WARNING', () => {
  assert.equal(status('farine, sucre, oeufs'), 'WARNING');
  assert.match(analyzeGlutenSafety({ ingredients_text: 'amidon modifié, sucre' }).reason, /amidon/);
});

test('no ingredients at all is UNKNOWN', () => {
  assert.equal(status(''), 'UNKNOWN');
});
