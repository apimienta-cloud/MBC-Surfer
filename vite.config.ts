import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// base relativa para poder deployar en GitHub Pages o Netlify sin tocar nada
export default defineConfig({
  base: './',
  resolve: {
    alias: { postprocessing: fileURLToPath(new URL('./src/fx/postprocessing-stub.ts', import.meta.url)) },
  },
  // Three.js solo ya pesa ~550 kB minificado; el límite por defecto (500) siempre avisaría
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
