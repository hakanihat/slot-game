import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    // In development the API runs separately; proxying keeps the client same-origin.
    proxy: { '/api': 'http://localhost:3000' },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1024,
  },
});
