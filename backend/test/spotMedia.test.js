import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://example.supabase.co';
const { normalizeMedia, normalizeLinks, storagePath, MediaError } = await import('../src/services/spotMedia.js');

const uploaded = 'https://example.supabase.co/storage/v1/object/public/spot-media/spots/0f8e2b6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b.mp4';

test('media from uploads and site files are kept', () => {
  const out = normalizeMedia([
    { type: 'video', src: uploaded, poster: '/spots/gluten-free-serenity/video-poster.jpg', alt: ' Visite ', credit: '' },
    { type: 'image', src: '/spots/gluten-free-serenity/facade.webp', alt: 'Devanture', credit: 'Google Maps' },
    { type: 'image', src: uploaded.replace('.mp4', '.jpg'), kind: 'menu', alt: 'Menu', extra: 'dropped' },
  ]);
  assert.deepEqual(out, [
    { type: 'video', src: uploaded, poster: '/spots/gluten-free-serenity/video-poster.jpg', alt: 'Visite' },
    { type: 'image', src: '/spots/gluten-free-serenity/facade.webp', alt: 'Devanture', credit: 'Google Maps' },
    { type: 'image', src: uploaded.replace('.mp4', '.jpg'), alt: 'Menu', kind: 'menu' },
  ]);
});

test('unsafe or malformed media are refused', () => {
  for (const bad of [
    [{ type: 'image', src: 'javascript:alert(1)' }],
    [{ type: 'image', src: 'http://insecure.example.com/a.jpg' }],
    [{ type: 'image', src: 'https://elsewhere.example.com/a.jpg' }],
    [{ type: 'image', src: '/spots/../../etc/passwd' }],
    [{ type: 'audio', src: uploaded }],
    [{ type: 'video', src: uploaded, poster: 'data:image/png;base64,AAAA' }],
    'not a list',
  ]) {
    assert.throws(() => normalizeMedia(bad), MediaError);
  }
});

test('links need an http(s) URL; unknown types become "other"', () => {
  assert.deepEqual(normalizeLinks([{ type: 'instagram', url: 'https://instagram.com/x' }, { type: 'tiktok', url: 'https://tiktok.com/@x', label: 'TikTok' }]), [
    { type: 'instagram', url: 'https://instagram.com/x' },
    { type: 'other', url: 'https://tiktok.com/@x', label: 'TikTok' },
  ]);
  assert.throws(() => normalizeLinks([{ type: 'website', url: 'javascript:alert(1)' }]), MediaError);
});

test('only our own uploads map to a storage path', () => {
  assert.equal(storagePath(uploaded), 'spots/0f8e2b6a-1c2d-4e5f-8a9b-0c1d2e3f4a5b.mp4');
  assert.equal(storagePath('https://example.supabase.co/storage/v1/object/public/marketplace/products/x.jpg'), null);
  assert.equal(storagePath('/spots/a/b.webp'), null);
});
