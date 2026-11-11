# RAM budget and measurement plan

## Status: heap **not measured** in this slice

No browser was launched from the shell in this environment (that testing happens separately), so
**there are no measured heap numbers below and none should be inferred from this document.** The
budget is a target and an accounting of what should contribute to resident memory; the build-size
figures *are* measured (they are on-disk artifacts, not runtime estimates).

## Measured: build artifacts (2026-11-10, `npm run build`)

| Artifact | Size | Gzip |
|---|---|---|
| App shell JS (`index-*.js`, includes Vue) | 78.6 kB | 31.3 kB |
| CSS | 5.4 kB | 1.7 kB |
| Largest tool chunk (`RegexTool-*.js`) | 5.0 kB | 2.2 kB |
| Worker chunk (`toolWorker-*.js`) | 7.6 kB | — |
| PWA precache total (28 entries) | 129.2 kB | — |

Per-tool chunks are 2.4–5.0 kB, so opening a tool adds roughly one network fetch and one module
evaluation to the shell.

## Budget (targets, not measurements)

| Component | Target | Rationale |
|---|---|---|
| App shell, cold, home screen | < 20 MB JS heap | Shell is Vue + registry + one list view; no tool is mounted. |
| One tool open, empty inputs | shell + < 5 MB | A tool component, its refs and its (not yet created) worker. |
| One tool open, ~1 MB text | < 3× input size | Input string + one output string + parse intermediates. The 2M-char cap bounds the worst case. |
| Worker (only while a large job runs) | job-dependent, released on terminate | Created lazily ≥ 64k chars, terminated on unmount. |
| localStorage | ≤ 256 kB (64 keys × 4k chars) | Enforced in `lib/prefs.ts`. |
| Diff, worst legal case | ~26 MB transient, freed on return | Myers trace: ≤ (D+1) snapshots × (2·(N+M)+1) int32; with D ≤ 400 and N+M ≤ 8,000 → ≈ 400 × 16,001 × 4 B ≈ 25.6 MB. Runs in the worker for large inputs. |
| Diff render | ≤ 3,000 DOM rows | Independently capped from the computed script (`DiffTool.vue`). |
| Regex | ≤ 5,000 match objects | Beyond that, matches are dropped and the UI says "capped". |

## How to measure (reproducible, any desktop)

1. `npm run build && npm run preview` (default port 4173).
2. Chrome → DevTools → Memory. Take a **heap snapshot** (not an allocation timeline) at each step:
   1. cold load of `/` before opening any tool;
   2. open each of the 7 tools in turn, returning to home between each — take a snapshot after each
      return and confirm the previous tool's component and worker are gone;
   3. paste a ~1 MB JSON document into the JSON tool, format it, return home, snapshot again.
3. Expected shape: a step up while a tool is open, back near the home baseline after returning.
   If the post-return snapshot keeps growing as you cycle tools, that is a leak — file it.
4. Worker check: DevTools → Application → (Background) Services / Performance, or
   `performance.measureUserAgentSpecificMemory()` if available, plus Task Manager (Shift+Esc) to
   watch the worker thread appear on a ≥ 64k-char input and disappear on unmount.
5. Storage check: Application → Storage → localStorage should contain only
   `toolbox.prefs.v1`, well under 256 kB; Cache Storage should list only precached shell assets.

## Known RAM-relevant behaviours to preserve in review

- No `<KeepAlive>` anywhere; leaving a tool must unmount it.
- Workers are created lazily and terminated on unmount — verify `dispose()` runs (it rejects
  in-flight promises rather than leaving them pending).
- Search state and tool inputs are never written to storage.
- The diff's `trace` array is the single largest intentional allocation in the app; it is
  released when `myers()` returns and never retained in component state.
