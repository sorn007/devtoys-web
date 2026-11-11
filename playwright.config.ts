import { defineConfig } from '@playwright/test'

/**
 * E2E runs against the PRODUCTION build, served by our own `vite preview` on
 * port 4174 — never `vite dev`, and never the executor's preview on 4173
 * (which we must not touch). Playwright starts and stops the 4174 server.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1, // sequential: the worker-timeout test must not contend for CPU
  reporter: [['list']],
  outputDir: 'test-results/',
  use: {
    baseURL: 'http://localhost:4174',
    headless: true,
  },
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
