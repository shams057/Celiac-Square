import { readFileSync } from 'node:fs';
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

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, proxy },
  preview: { port: 4173, proxy, headers: vercelHeaders() },
});
