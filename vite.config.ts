import { defineConfig } from 'vite';

// Yandex Games requires fully relative asset paths inside the uploaded zip.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'esbuild',
    assetsInlineLimit: 4096,
  },
  server: {
    host: true,
    port: 5173,
  },
});
