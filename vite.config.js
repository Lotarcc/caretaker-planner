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
  // The dev server pre-bundles dependencies with its own es2020 target, which rejects ooz-wasm's top-level
  // await and kills `npm run dev` on start.
  optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  worker: { format: 'es' },
  // 127.0.0.1, not "localhost": Node resolves that to ::1 only, and IPv4 clients are refused.
  server: { port: 5173, host: '127.0.0.1' },
  preview: { host: '127.0.0.1' },
});
