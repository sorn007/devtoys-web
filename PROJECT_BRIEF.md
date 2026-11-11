# Project brief

## What this is

An original reimplementation of the *idea* of DevToys — a compact, offline developer toolbox —
as a browser SPA/PWA built with Vue 3 + TypeScript + Vite. It is explicitly **not** a port: no
DevToys code, assets, or branding are used. The upstream project served only as a public
feature inventory (read from its README and website).

## Goals, in priority order

1. **Low RAM.** Every design decision below is subordinated to resident memory.
2. **Real tools.** No fake buttons, no fake output. Every action performs the work it names.
3. **Offline-first, privacy-first.** Installs as a PWA; all processing is local.
4. **Original UI.** DevToys-inspired *behaviour*, original look and wording.

## Non-goals for this slice

- Parity with all ~30 DevToys tools (see FEATURE_PARITY.md).
- Mobile-native packaging, Electron, or desktop integration.
- Persistent tool sessions — deliberately rejected (see "Persistence").

## Architecture decisions and their reasons

| Decision | Alternative rejected | Why |
|---|---|---|
| Hand-written ~50-line hash router | `vue-router` | Two routes, no guards, no nesting. Keeps vendor bundle to exactly one runtime dependency (Vue) and works from `file://` and any static host. Swap-in is documented in `src/router.ts`. |
| `defineAsyncComponent` per tool from a registry | mounting all tools behind tabs | Vite emits one chunk per tool; only the opened tool is fetched and instantiated. |
| **No `<KeepAlive>`** | keep tools alive for instant return | Tool input/output state is the dominant heap cost. Freeing it on exit is worth the re-fetch. |
| Plain `<textarea>` | Monaco / CodeMirror | Both add megabytes of heap and parse time. For a utility app, a monospace textarea is the right tool. Documented, not accidental. |
| Threshold-based worker offload (≥ 64k chars) | always use a worker | Worker startup costs more than small work. Above the threshold, workers keep parse/hash/diff allocations off the main heap and are terminated on unmount. |
| Myers O(ND) diff with caps + coarse fallback | LCS DP matrix, or unbounded Myers | DP is O(n·m) memory — a non-starter. Myers trace is capped at D=400 and lines at 4,000; beyond that the result is an honest, labelled coarse (set-membership) diff. |
| One tiny capped prefs store | persisting tool state/history | Histories of user input are the classic bloat and privacy hazard in utility apps. Only UI preferences persist: ≤64 keys × ≤4k chars, FIFO-evicted. |
| Workbox `generateSW` precache | hand-written service worker | Generating a correct revision-keyed precache manifest for hashed assets is exactly the fiddly part; Workbox does it at build time. `runtimeCaching` is left empty on purpose. |

## Bounds (all in `src/lib/limits.ts`)

| Bound | Value |
|---|---|
| Maximum input size (any tool) | 2,000,000 characters |
| Worker offload threshold | 64,000 characters |
| Diff lines per side (exact mode) | 4,000 |
| Diff edit-distance search (D) | 400 |
| UUID batch size | 500 |
| Regex matches rendered / cached | 5,000 |
| Regex replace output | 1,000,000 chars (then truncated, labelled) |
| Prefs: keys / value length | 64 keys / 4,000 chars |

Exceeding a bound raises `LimitError`, which surfaces as a readable message in the UI. The diff's
coarse fallback and the regex match cap are labelled in the UI rather than silently applied.

## Verification in this slice

- `npm run test` — 87 unit tests over tool logic, search, prefs and limits (vitest).
- `npm run build` — `vue-tsc --noEmit` + Vite build; emits per-tool chunks, service worker,
  precache manifest.
- `npm run typecheck` — strict TS (`noUnusedLocals`, `noUncheckedSideEffectImports`, …).
- Headless HTTP smoke check against `vite preview`: `/`, `/manifest.webmanifest`, `/sw.js`, and
  a lazily-loaded tool chunk all returned 200. **No browser was launched from the shell.**

## What was deliberately *not* verified

- Real browser heap numbers — see RAM_BUDGET.md. Not measured in this environment; no estimate
  is reported as a measurement.
- Screen-reader and full keyboard workflows (beyond focus-on-search and `/` shortcut).
- Safari/Firefox PWA install flows.
