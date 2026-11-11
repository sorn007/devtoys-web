# Review summary — S9: automated browser verification (e2e), FINAL (2026-11-10, eleventh slice)

Scope: convert the gated browser checks (XSD, worker timeout, CSP, offline, RAM) into automated
headless-Chromium Playwright tests, per explicit instruction. **All e2e tests pass, including
real XSD validation — the honest count is now 30 of 30 default tools.** Still an original web
reimplementation, not official DevToys. The executor's preview on :4173 was never touched;
Playwright starts and stops its own preview on :4174.

## Setup

- `@playwright/test@1.62.0` (**Apache-2.0**, registry-checked) as a pinned devDependency;
  Chromium only (`npx playwright install chromium` — headless shell downloaded, no sudo needed,
  no missing system libraries). New `npm run e2e` script; `playwright.config.ts` serves the
  **production build** via `vite preview --port 4174 --strictPort` (never `vite dev`, never 4173),
  sequential workers. Artifacts: `test-results/` (failure contexts; empty on green runs) — both
  it and `playwright-report/` added to `.gitignore`.

## Two real product bugs the e2e work surfaced and fixed

1. **The inline theme bootstrap violated our own CSP.** `script-src 'self'` forbids inline
   scripts, so the no-flash theme `<script>` in `index.html` was being blocked (and would have
   failed the "no unexpected violations" test). Moved to external `public/theme-init.js`.
2. **Pathological regexes ran on the UI thread.** `useToolRunner` offloaded only inputs ≥ 64k
   chars — but regex cost is in the *pattern*, not the input size, so `(a+)+$` would have frozen
   the page. Regex jobs are now **always** offloaded to the disposable worker (with its 10 s
   timeout). Third real bug found while testing: **XsdTool never rendered `ok:false` results**
   (the DOCTYPE-rejection path was silently invisible) — display fixed.

## e2e results — 7 passed (15–22 s), each mapping to a VERIFY_IN_BROWSER.md section

| Test (file) | What it proves |
|---|---|
| `xsd.spec.ts` ×3 — **§1** | Real libxml2-wasm validation in the browser: valid sample → `valid`, 0 errors, "document satisfies the schema"; invalid `<a>not-a-number</a>` → `invalid` with the schema error naming the problem; `<!DOCTYPE root []>` → rejected by our guard **before** libxml2, with no valid/invalid verdict. |
| `workertimeout.spec.ts` — **§2** | `(a+)+$` over 31 a's + `b`: the 10 s timeout fires (~10.9 s total test time, error >5 s after start), the page stays responsive (typing in another field during the spin succeeds), and `a+`/`aaa` afterwards matches — proving the worker was terminated and recreated. |
| `csp.spec.ts` — **§3** | Policy is exactly `script-src 'self' 'wasm-unsafe-eval'` (token-split assertion — no bare `unsafe-eval`); **zero** CSP violations and zero console errors across normal use of 4 tools; inline-script injection is blocked (flag never set, violation event recorded). **Honest finding, asserted as observed:** `page.evaluate` runs over CDP, which Chrome **exempts from page CSP** (as with the DevTools console) — `eval('2+2')` succeeds there. The test asserts that behaviour and documents it; enforcement is proven via the inline-script probe instead. |
| `offline.spec.ts` — **§4** | After SW activation, with the network off: the app reloads and serves from the precache (reload lands on the Certificate tool because the hash is preserved); the precached Certificate tool still produces results offline; and the **XSD tool degrades gracefully offline** in a context that never fetched the wasm — the tool loads, Validate shows an error, no page crash, navigation still works. |
| `ram.spec.ts` — **§5** | CDP `Performance.getMetrics` JSHeapUsedSize, written to **RAM_MEASUREMENTS.md**: home cold **2.5 MiB**, home after cycling 5 tools (returning home between each) **3.0 MiB**, XSD tool open (wasm not loaded in this run) **3.1 MiB**. Header states the caveats: single headless run, JSHeapUsedSize only, no forced GC, wasm memory excluded — **no performance conclusions drawn**. |

## Test-fixture corrections during this run (test-side, each explained)

- Offline reload preserves the location hash, so the app lands on the Certificate tool, not
  home — the first assertion targeted the wrong page (the saved snapshot proved the app had
  actually loaded offline).
- The CSP eval probe initially asserted CDP-eval would be blocked; observed Chrome behaviour
  differs (CDP is exempt), so the assertion was changed to the honest observed outcome plus the
  inline-script enforcement probe.
- CDP requires `Performance.enable` before `getMetrics` (first run returned −1; no numbers were
  written from that failed run).

## Commands and actual results

| Command | Result |
|---|---|
| `npm run e2e` | **7 passed** (first run: 3 failed → 2 real product bugs + 1 UI bug + test fixes above; second run green) |
| `./node_modules/.bin/vitest run --pool=forks --poolOptions.forks.singleFork` | **20 files / 253 tests passed** (unchanged; vitest now excludes `e2e/**` after it briefly picked up the Playwright specs — fixed in `vite.config.ts` `test.exclude`) |
| `npm run typecheck` | exit 0 |
| `npm run build` | ✓ ~2 s; precache 69 entries / 417.56 KiB (theme-init.js added) |

## Count and docs

**FEATURE_PARITY.md: 30 of 30 default tools, "(verified by e2e)"** — the XML/XSD row is now ✅
with the three e2e outcomes cited; the "not implemented" table lists 0 tools and restates the
out-of-scope items (Smart Detection, extension ecosystem). README updated likewise, with the
new honest-gaps list (single headless RAM sample; CDP CSP exemption; Chromium-headless coverage
only). RAM_MEASUREMENTS.md created with raw numbers and caveats.

## Remaining known gaps (final)

- RAM: one headless sample only — not a benchmark; wasm memory not measured.
- e2e: Chromium headless only; no Firefox/Safari, headed, or mobile coverage.
- Heap-after-unmount claims are still not made (only tool-cycling was measured).
- No permission denials this run; no commits/pushes; 4173 untouched, 4174 stopped by Playwright.
