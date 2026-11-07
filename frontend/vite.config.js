import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_URL points the dev proxy at another API, e.g. a second backend on another port
const apiUrl = process.env.API_URL || 'http://localhost:5000';
const proxy = { '/api': { target: apiUrl, changeOrigin: true } };

// `vite preview` serves the production build with the same security headers as Vercel (vercel.json),
// so the Content-Security-Policy can be tested locally. The dev server does not use them: its
// hot reload injects inline scripts that the policy would block.
const vercelHeaders = () => {
  try {
    const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
    const all = (config.headers || []).find((h) => h.source === '/(.*)');
    const headers = Object.fromEntries((all?.headers || []).map(({ key, value }) => [key, value]));
    // Preview runs on plain http: no HSTS, and no upgrading of its own requests to https
    delete headers['Strict-Transport-Security'];
    if (headers['Content-Security-Policy']) {
      headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests/, '');
    }
    return headers;
  } catch {
    return {};
  }
};

// Files from public/ that the offline app needs (the spot photos and videos are cached when viewed)
const PUBLIC_PRECACHE = ['/manifest.webmanifest', '/favicon.svg', '/logo-mark.svg', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

/**
 * Builds /sw.js from src/sw.js: fills in the list of built files to cache at install and a version
 * that changes with them, so a new deploy replaces the old offline copy of the app.
 */
const serviceWorker = () => ({
  name: 'service-worker',
  apply: 'build',
  generateBundle(_options, bundle) {
    // The barcode reader's WebAssembly (about 1 MB) is left out: it loads on first use, and needs the network anyway
    const files = Object.keys(bundle)
      .filter((name) => !name.endsWith('.map') && !name.endsWith('.html') && !name.endsWith('.wasm'))
      .map((name) => `/${name}`);
    const precache = [...files, ...PUBLIC_PRECACHE];
    const version = createHash('sha256').update(precache.join('\n')).digest('hex').slice(0, 12);
    const source = readFileSync(new URL('./src/sw.js', import.meta.url), 'utf8')
      .replace("'__SW_VERSION__'", JSON.stringify(version))
      .replace('__SW_PRECACHE__', JSON.stringify(precache));
    this.emitFile({ type: 'asset', fileName: 'sw.js', source });
  },
});

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: { port: 3000, proxy },
  preview: { port: 4173, proxy, headers: vercelHeaders() },
});
