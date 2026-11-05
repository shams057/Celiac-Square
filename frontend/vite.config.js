import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// API_URL points the dev proxy at another API, e.g. a second backend on another port
const apiUrl = process.env.API_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
      },
      '/uploads': {
        target: apiUrl,
        changeOrigin: true,
      },
    },
  },
});
