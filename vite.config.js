import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
