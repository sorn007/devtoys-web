import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Design notes (see PROJECT_BRIEF.md):
 * - Every tool is a dynamic import, so Vite emits one small chunk per tool and
 *   only the active tool's chunk is ever fetched/instantiated.
 * - The service worker precaches the app shell and nothing else: no runtime
 *   caching of user data, no offline analytics, no background sync.
 * - `nulls: 'all'` and explicit manualChunks keep the shared vendor chunk tiny.
 */
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DevToys-inspired Toolbox',
        short_name: 'Toolbox',
        description:
          'An original, offline-first collection of small developer utilities. Local-only processing. Not affiliated with DevToys.',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        background_color: '#10141c',
        theme_color: '#10141c',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. `navigateFallback` serves the shell for hash routes;
        // hashed asset URLs are revision-keyed so they never go stale.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\.map$/, /icon.*\.svg$/],
        globPatterns: ['**/*.{js,css,html,svg,webmanifest}'],
        // Heavy dependency chunks (yaml ≈105 kB, sql-formatter ≈293 kB, pako
        // ≈47 kB, jsQR ≈131 kB, and later the XSD wasm) are deliberately NOT precached: they
        // are fetched on the first visit to the tool that needs them, then kept
        // in the CacheFirst runtime cache below. This keeps the install payload
        // small while those tools stay offline-capable after one online use —
        // documented in README/FEATURE_PARITY. vite-plugin-pwa fails the build
        // if any globbed asset exceeds the cap and is not explicitly ignored,
        // so a NEW heavy dependency cannot silently bloat the precache.
        maximumFileSizeToCacheInBytes: 100 * 1024,
        globIgnores: [
          // Exact, stable vendor-chunk names (see manualChunks). Never a broad
          // pattern: a generic `browser-*.js` ignore once excluded the small
          // qrcode chunk by accident.
          'assets/vendor-yaml-*.js',
          'assets/vendor-sql-*.js',
          'assets/vendor-pako-*.js',
          'assets/vendor-jsqr-*.js',
        ],
        runtimeCaching: [
          {
            // Hashed filenames are immutable, so CacheFirst cannot serve stale
            // code. Only build assets are cached — never user data.
            urlPattern: ({ url }: { url: URL }) => url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tool-assets',
              expiration: { maxEntries: 80, purgeOnQuotaError: true },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Vitest: Playwright e2e specs are NOT unit tests (they need a browser and a
  // built app); exclude them so `npm run test` stays a pure unit run.
  test: {
    exclude: ['node_modules/**', 'dist/**', 'e2e/**', 'test-results/**', 'playwright-report/**'],
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        // The heavy libraries are imported from WORKER entries, and Vite builds
        // workers in a separate Rollup pass — the same manualChunks rule must be
        // repeated here or the chunks keep auto-generated names.
        manualChunks: vendorManualChunks,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        // Heavy libraries get STABLE chunk names so the PWA config can exclude
        // exactly those files from the precache by name. A previous version
        // ignored `assets/browser-*.js`, which also caught the (small) qrcode
        // chunk by accident — exact vendor names cannot do that.
        manualChunks: vendorManualChunks,
      },
    },
  },
})

/**
 * Stable names for the heavy libraries, so the PWA config can exclude exactly
 * those files from the precache (see workbox.globIgnores above).
 */
function vendorManualChunks(id: string): string | undefined {
  // Our QR decode module is pinned to the jsQR chunk so it can never be fused
  // with the qrcode library by Rollup's chunking (that once made the generate
  // path statically depend on the 131 kB decode library).
  if (id.includes('src/tools/qrdecode')) return 'vendor-jsqr'
  if (!id.includes('node_modules')) return undefined
  if (id.includes('yaml')) return 'vendor-yaml'
  if (id.includes('sql-formatter')) return 'vendor-sql'
  if (id.includes('pako')) return 'vendor-pako'
  if (id.includes('jsqr')) return 'vendor-jsqr'
  if (id.includes('qrcode')) return 'vendor-qrcode'
  return undefined
}
