# Toolbox — an offline, low-RAM developer-utilities web app

Crafted with Vue 3, TypeScript, and Vite, Toolbox brings the developer-utility
experience of [DevToys](https://github.com/DevToys-app/DevToys) to an offline-first
web app (SPA/PWA). DevToys inspired the tool selection, categories, and navigation;
this project is an independent implementation maintained separately from the
DevToys project.

Everything runs locally in your browser. No analytics, no telemetry, and no network calls after
the app shell (plus the disclosed optional heavy chunks below) have loaded — see
[Privacy](#privacy).

## Inspiration and attribution

Toolbox was crafted as an independent web implementation inspired by
[DevToys-app/DevToys](https://github.com/DevToys-app/DevToys), the original
developer toolbox that informed this project's tool selection, categories,
and navigation experience. Thanks to the DevToys authors and contributors
for the inspiration.

This repository is not an official DevToys release and is not affiliated with
or endorsed by the DevToys project. The original project's license is available
in [DevToys LICENSE.md](https://github.com/DevToys-app/DevToys/blob/main/LICENSE.md).

## License

This project's original code is licensed under the [MIT License](LICENSE).
Third-party dependencies and bundled components retain their respective
licenses; see [dependency licenses](#licenses-runtime-dependencies-exact-pinned-versions)
and the notices distributed with those components.

## Quick start

```bash
npm install
npm run dev        # dev server with HMR
npm run build      # typecheck (vue-tsc) then production build to dist/
npm run preview    # serve the production build locally
npm run test       # unit tests (vitest, one run)
npm run typecheck  # TypeScript only, no build
npm run e2e        # Playwright e2e against the built app (starts its own preview on :4174)
```

Node 20 or newer.

## Tools (all 30 official DevToys default tools complete, e2e-verified)

**Converters** — Cron Parser · Date · JSON Array→Table/CSV · JSON<>YAML · Number Base
**Encoders/Decoders** — Base64 Text · Base64 Image · Certificate · GZIP · HTML · JWT · QR Code · URL
**Formatters** — JSON (incl. sort-keys) · SQL · XML
**Generators** — Hash/Checksum (SHA-1/256/384/512, CRC-32, MD5-legacy) · Lorem Ipsum · Password · UUID
**Graphic** — Colour Blindness Simulator · Image Converter
**Testers** — JSONPath · Regular Expression · XML/XSD *(integrated; see honesty note)*
**Text** — Analyzer & Utilities · Escape/Unescape · List Comparer · Markdown Preview · Text Diff

**Verification**: `npm run e2e` runs automated headless-Chromium Playwright tests against the
production build (its own preview on port 4174): real XSD validation (valid / invalid / DOCTYPE
cases), the 10 s worker timeout with worker recreation, CSP enforcement and offline behaviour
(see `e2e/`).

## Offline honesty

| | Tools |
|---|---|
| **Work offline immediately** (precached at install) | All of the above except the five rows below |
| **Need ONE online visit**, then offline forever (heavy chunk excluded from the 100 KiB precache, runtime-cached by the service worker) | JSON<>YAML (yaml) · SQL Formatter (sql-formatter) · GZIP *only on engines without native CompressionStream* (pako) · QR **decoding** (jsQR) · XML/XSD **validation** (778 kB libxml2 wasm) |

QR **generation** is offline on a fresh install. Updates surface a "reload to pick it up"
prompt so old/new chunks never mix.

## Security notes

- **Local-only.** Tool input never leaves the browser; the service worker never caches user data.
- **JWT decode-only** — signatures are never verified and the UI says so.
- **Certificate decode-only** — no trust/chain/revocation evaluation, and the UI says so.
- **MD5 and SHA-1** are labelled legacy/broken for security.
- **JSONPath** is an in-house interpreter: no `eval` and no `Function` constructor (a library
  that used `new Function` was rejected for this reason).
- **Markdown** disables raw HTML via a renderer override, allowlists URL schemes
  (http/https/mailto), blocks remote images unless allowed per session, sanitises with DOMPurify
  and renders in a sandboxed iframe.
- **XML** rejects DOCTYPE/DTD/ENTITY/SYSTEM/PUBLIC before parsing (XXE guard); the XSD validator
  makes no network or filesystem IO by construction.
- **GZIP** caps decompressed output at 32 MiB (bomb guard). **Images** are capped at 40 M pixels
  / 12 000 px per side before decoding.
- **CSP**: `script-src 'self' 'wasm-unsafe-eval'` (the narrow WASM allowance only) — no remote
  origins, `object-src 'none'`.

## Known gaps (honest)

- **RAM/heap is a single headless sample only** (RAM_MEASUREMENTS.md): one run, JSHeapUsedSize
  only, no forced GC, wasm memory excluded — no performance conclusions may be drawn from it.
- CSP: `page.evaluate`/CDP is CSP-exempt by Chrome design (as is the DevTools console), so the
  e2e asserts enforcement via a real inline-script probe; see `e2e/csp.spec.ts` for the honest
  observation. Cross-browser (Firefox/Safari) CSP behaviour is not covered.
- e2e covers Chromium headless only; no headed/desktop, mobile or multi-browser matrix.
- Smart Detection and the DevToys extension ecosystem are out of scope by plan.

## Licenses (runtime dependencies, exact pinned versions)

| Package | Version | License | Used by |
|---|---|---|---|
| vue | ^3.5.13 | MIT | app framework |
| yaml | 2.9.1 | ISC | JSON<>YAML (worker chunk, not precached) |
| sql-formatter | 15.9.0 | MIT | SQL Formatter (worker chunk, not precached) |
| pako | 2.1.0 | MIT AND Zlib | GZIP fallback only (not precached) |
| qrcode | 1.5.4 | MIT | QR generation (precached) |
| jsqr | 1.4.0 | Apache-2.0 | QR decoding (not precached) |
| marked | 18.2.0 | MIT | Markdown Preview (precached) |
| dompurify | 3.4.17 | MPL-2.0 OR Apache-2.0 | Markdown sanitiser (precached) |
| xmllint-wasm | 5.3.0 | MIT (libxml2; COPYING shipped as `public/xmllint-wasm.COPYING`) | XSD validation (wasm not precached) |

Dev-only: `@types/node` (MIT), `@types/qrcode` 1.5.5 (MIT), `@vitejs/plugin-vue`, `vite`,
`vitest`, `vue-tsc`, `vite-plugin-pwa` (MIT/Apache-2.0), `jsdom` 27.0.0 (MIT, unit tests only),
`@playwright/test` 1.62.0 (Apache-2.0, e2e only).
Workbox (Apache-2.0) generates the service worker. Hand-written, dependency-free: Date, Number
Base, UUID, Cron, JWT, JSONPath, XML, Markdown policy, MD5, CRC-32, Certificate ASN.1 parser,
colour-blind matrices, password CSPRNG logic.

## Project layout

```
src/
  tools/            # pure, unit-tested tool logic (no Vue imports)
  components/tools/ # one lazy component per tool
  workers/          # shared toolWorker + dedicated per-tool workers
  lib/              # limits, prefs, worker client/runner, object URLs, clipboard, theme
tests/              # vitest suites incl. XSS corpus, XXE/DTD, MD5 vectors, QR round-trip
```

Design decisions live in [PROJECT_BRIEF.md](PROJECT_BRIEF.md); per-tool parity in
[FEATURE_PARITY.md](FEATURE_PARITY.md); browser verification steps in
[VERIFY_IN_BROWSER.md](VERIFY_IN_BROWSER.md).
