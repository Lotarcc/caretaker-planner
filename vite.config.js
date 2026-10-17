import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from GitHub Pages at /<repo>/. Override with BASE_PATH (e.g. "/" for a custom domain).
const base = process.env.BASE_PATH ?? '/caretaker-planner/';

export default defineConfig({
  root: 'client',
  base,
  plugins: [react()],
  // ooz-wasm and the HiGHS adapter use top-level await.
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  worker: { format: 'es' },
  server: { port: 5173 },
});
