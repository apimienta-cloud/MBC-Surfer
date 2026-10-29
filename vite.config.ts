import { defineConfig } from 'vite';

// base relativa para poder deployar en GitHub Pages o Netlify sin tocar nada
export default defineConfig({
  base: './',
  // Three.js solo ya pesa ~550 kB minificado; el límite por defecto (500) siempre avisaría
  build: { target: 'es2020', chunkSizeWarningLimit: 800 },
});
