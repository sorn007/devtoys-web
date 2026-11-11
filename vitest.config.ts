import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Vitest has its own config file (like playwright.config.ts) because vitest
 * 2.x augments a nested copy of vite's types: a `test` block inside
 * vite.config.ts is invisible to vue-tsc. Tests import only TypeScript from
 * src/, so the Vue/PWA plugins are not needed here — only the `@` alias.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Playwright e2e specs are NOT unit tests (they need a browser and a
    // built app); exclude them so `npm run test` stays a pure unit run.
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'test-results/**', 'playwright-report/**'],
  },
})
