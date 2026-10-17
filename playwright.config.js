// Browser journeys: the built site, served the way GitHub Pages serves it (under BASE_PATH, as in vite.config.js).
// `npm run build` first; `npm run check` does both.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4179;
const BASE = process.env.BASE_PATH ?? '/caretaker-planner/';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}${BASE}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
  },
});
