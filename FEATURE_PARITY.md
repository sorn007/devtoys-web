# Feature parity vs DevToys

Inventory source: DevToys' public README and website (read 2026-11-10), cross-checked against the
official `DevToys-app/DevToys.Tools` repository at SHA `de655a5…` (30 tool folders, verified via the
GitHub API on 2026-11-10 — matches the site inventory exactly). The DevToys README's "30 default
tools" line is abbreviated; the count is **not** verified against app-shell tag `v2.0.9.0`.
PNG/JPEG Compressor is third-party and excluded. Status is honest as of this build — **nothing is
marked done that is not wired, tested and producing real output**, and tool counts below reflect
partial status (e.g. if XSD is blocked, "XML/XSD" is not counted as complete).

## Implemented and complete — 30 of 30 default tools (verified by e2e)

| DevToys tool | Status | Notes / differences |
|---|---|---|
| Formatters → JSON | ✅ done (S7: +sort-keys) | Format, minify, validate, **sort-keys toggle** (recursive, arrays keep order). Error reporting limited to what the engine's message exposes (V8 names the token; line/column only when the engine reports an offset). |
| Encoders → Base64 Text | ✅ done | Text only. URL-safe alphabet both ways, unpadded input accepted. DevToys' Base64 *Image* is **not** included. |
| Encoders → URL | ✅ done | Plus a URL-parts/query inspector DevToys implements separately. |
| Generators → UUID | ✅ done | v4 + sortable v7, batch ≤ 500, validator. |
| Generators → Hash / Checksum | ✅ done (S7: +MD5) | SHA-1/256/384/512 (WebCrypto) + CRC-32 + **MD5** (hand-written RFC 1321 implementation, all 7 official test vectors green; UI labels it “legacy — broken for security; use only for compatibility”). No SHA-3. |
| Text → Text Comparer | ✅ done | Exact Myers alignment within caps; labelled coarse mode beyond them. **S7: ignore-whitespace and ignore-case toggles added** (comparison normalises, display keeps original text; defaults stay byte-exact). No word/inline diff yet. |
| Testers → Regular Expression | ✅ done | Flags, named + positional groups, highlight, replace preview, ReDoS warning, match/replace caps. |
| Converters → Date | ✅ done (S1) | Unix s/ms/µs, .NET ticks, ISO 8601 in/out, RFC 2822 readout; BigInt precision beyond 2^53; strict calendar validation (rejects 2026-02-30). No date arithmetic. |
| Converters → Number Base | ✅ done (S1) | Bases 2–36, arbitrary precision (BigInt), 8/16/32/64-bit two's-complement views. Integers only; no bases > 36. |
| Generators → Lorem Ipsum | ✅ done (S1) | Words/sentences/paragraphs, capped at 500, deterministic seed. No filler formats beyond plain text. |
| Generators → Password | ✅ done (S1) | CSPRNG with unbiased rejection sampling, 4 classes, exclude-ambiguous, require-each, batch ≤ 100; entropy shown as a heuristic. No passphrase mode. |
| Text → Escape / Unescape | ✅ done (S1) | JSON, XML/HTML, JavaScript targets; \u with surrogate pairs; unknown escapes preserved; pure transforms, nothing evaluated. Fewer targets than official. |
| Text → Analyzer & Utilities | ✅ done (S1) | Unicode-aware stats (bytes, code points, graphemes via Segmenter) + line/case utilities. No per-character map. |
| Text → List Comparer | ✅ done (S2) | Intersection / only-left / only-right / symmetric difference / union with counts; trim + ignore-case toggles; blank lines are not items; duplicates collapse to first occurrence; deterministic order. No fuzzy matching. |
| Converters → JSON Array → Table/CSV | ✅ done (S2) | Array-of-objects → on-screen table rendered as Vue text (never `v-html`); RFC-4180 CSV/TSV/semicolon export with CRLF, quote-doubling; spreadsheet formula-injection guard — prefixes cells starting with `=`, `+`, `-`, `@`, **TAB or CR** with an apostrophe — ON by default, toggleable for byte-faithful export; table view capped at 1,000 rows. |
| Converters → JSON ↔ YAML | ✅ done (S2) | Both directions via the `yaml` package (ISC), YAML 1.2 core schema; unknown/custom tags rejected outright (core-schema allowlist); alias expansion bounded (`maxAliasCount` 100); deep-nesting RangeErrors reported as input errors. |
| Formatters → SQL | ✅ done (S2) | `sql-formatter` (MIT), dialect list read from the library at runtime, keyword casing option, invalid SQL reported as errors. |
| Encoders → GZIP | ✅ done (S3) | Native `CompressionStream`/`DecompressionStream`, pako 2.1.0 (MIT AND Zlib) dynamically imported **only** when the engine lacks the native APIs; **decompression output-capped at 32 MiB** (input cap alone cannot stop a bomb) with stream abort; compress runs in a dedicated worker with the 10 s timeout + cancel; .gz download. Paste-to-decompress is not offered (gzip bytes are not text). |
| Encoders → Base64 Image | ✅ done (S3) | File → data URL (mime, dimensions, pixel count, byte size) and data URL → preview/download; **40 M-pixel and 12,000 px-per-side caps enforced before decode**; every object URL tracked and revoked on unmount; strict data-URL parsing with specific errors. |
| Encoders → HTML | ✅ done (S3) | Encodes the five structural characters (optionally all non-ASCII as numeric refs incl. astral planes); decodes the **HTML 4 named set (252 entities) plus all numeric refs**; HTML5-only aliases (e.g. `&colon;`) stay literal — stated in the UI. Pure transforms; input is never rendered. |
| Encoders → QR Code | ✅ done (S4) | Generate (text/URL, EC level L/M/Q/H, module size, PNG download) and decode from an uploaded image file. Both run in a dedicated worker; `qrcode` 1.5.4 (MIT) used in pure matrix form, decoding via `jsqr` 1.4.0 (Apache-2.0). **No camera access is used or requested.** Plain-text QR only — no WiFi/vCard/geolocation templates. |
| Graphic → Colour Blindness Simulator | ✅ done (S4) | Protan/deutan/tritan (Machado et al. 2009) + achromatopsia, severity slider 0–1, side-by-side original/simulated, PNG download. Applied to decoded pixels in a dedicated OffscreenCanvas worker; 40 M-pixel / 12,000 px caps enforced before decode; ImageBitmap closed; object URLs revoked on unmount. |
| Graphic → Image Converter | ✅ done (S4) | PNG/JPEG/WebP via OffscreenCanvas `convertToBlob` with a quality slider (lossy formats), batch converted **sequentially** to bound memory, per-file size delta table. Same pixel caps; bitmaps closed, URLs revoked. **Encode targets verified against the running browser at runtime** — a format the browser cannot encode is disabled in the picker; AVIF/HEIC/TIFF are not offered (see honest disclosure in the UI). |
| Converters → Cron Parser | ✅ done (S5) | 5-field and 6-field expressions plus @daily/@hourly/@weekly/@monthly/@yearly macros; names (JAN…, MON…), ranges, lists, steps; strict validation with specific errors; plain-English field descriptions; next N runs (≤ 20) in a selectable IANA timezone, computed in a dedicated worker; the search is hard-capped (200k steps) and reports "no occurrence within the search window" instead of looping. Standard cron DOM/DOW OR-rule honoured. No year field. |
| Encoders → JWT Decoder | ✅ done (S5) | **Decode-only**: splits and base64url-decodes header/payload, pretty JSON, human-readable exp/iat/nbf/auth_time with expired / not-yet-valid badges, alg=none and JWE-shape warnings. **Signatures are never verified (labelled "NOT VERIFIED" in the UI); no network code exists in the tool.** No JWK/JWKS fetching, no signature-verification claim. |
| Testers → JSONPath | ✅ done (S5) | **In-house safe engine — no library.** `jsonpath-plus` was rejected because its ESM build compiles filter expressions with `new Function` (dist/index-browser-esm.js:2735); the package is not installed. Supported: `$`, `.name`, `['name']`, `..name`, `.*`, `[*]`, indexes incl. negative, unions, slices, and filters with `== != < <= > >= =~ /re/ && || !` and existence. Script expressions `[(@.length-1)]` and path unions are rejected by design (they require evaluating code). Runs in a dedicated worker (10 s timeout); results capped at 5,000. |
| Text → Markdown Preview | ✅ done (S6) | Four layers: (1) **raw HTML disabled by escaping every `<` before parsing** — probed directly: marked 18.2.0 passes inline HTML through even with its `html:false` option; (2) URL allowlist (http/https/mailto only; `javascript:`/`data:`/`vbscript:`/`file:`/`blob:` dropped), safe external links forced to `rel="noopener noreferrer" target="_blank"`; (3) remote images replaced by a visible placeholder with a **session-only opt-in (never persisted)**, blocked-scheme images blocked even when opted in; (4) DOMPurify 3.4.17 (MPL-2.0 OR Apache-2.0) plus rendering in a **sandboxed iframe (`sandbox=""`)**. marked 18.2.0 (MIT) renders GFM. 15-payload XSS corpus unit-tested. Limitation: angle-bracket autolinks (`<https://…>`) render as text because every `<` is escaped; bare URLs still autolink. No mermaid/syntax highlighting. |
| Formatters → XML | ✅ done (S7) | Well-formedness via browser `DOMParser` with the parser error surfaced; pretty (2-space) and minified output; element/depth stats; 1 M-char cap. **DOCTYPE, DTD, ENTITY and SYSTEM/PUBLIC declarations are rejected explicitly before parsing** (jsdom-tested XXE/billion-laughs corpus) — not merely left to DOMParser defaults. No tree view, no XSLT. |
| Encoders → Certificate | ✅ done (S8) | **In-house, dependency-free ASN.1 DER decoder** (PEM, base64-DER and hex-DER input; strict TLV reader that rejects truncated data): subject, issuer, serial, signature algorithm, validity (UTCTime/GeneralizedTime), public-key algorithm + true key size (RSA modulus bit length), SAN (DNS/email/URI/IP), key usage + extended key usage, basicConstraints CA flag, version; **SHA-1/SHA-256 fingerprints via WebCrypto over the DER bytes**. 200k-char cap. **DECODE-ONLY — no chain, trust or revocation evaluation; UI states "trust NOT evaluated".** Multiple PEM blocks counted, first decoded (chain display out of scope). Tested against a real openssl-generated certificate with openssl-derived reference values, plus truncation/garbage/cap rejection. |
| Testers → XML / XSD | ✅ done (S7, **verified by e2e in S9**) | Dedicated `xsdWorker`, `xmllint-wasm@5.3.0` (MIT) with 256/512-page memory caps (16/32 MiB), no-network by construction, DTD/entity pre-rejection, `.wasm` (778.73 kB) excluded from the precache and runtime-cached — **needs one online visit, then offline**. Narrow `wasm-unsafe-eval` CSP. **Automated headless-Chromium e2e now proves real validation**: valid sample → `valid` with 0 errors; invalid sample → `invalid` with the schema error; DOCTYPE sample → rejected by our guard before libxml2 runs (`e2e/xsd.spec.ts`). XSD 1.1 assertions unsupported. |

## Not implemented — 0 of 30 default tools

All 30 official default tools are implemented and verified. Still out of scope by plan:
Smart Detection (clipboard probing), the NuGet extension ecosystem (PNG/JPEG Compressor etc.),
and desktop-only features. This is an ORIGINAL web reimplementation, not official DevToys.

## Approved plan notes carried forward (later slices)

- **S9 verification (headless Chromium e2e, `npm run e2e`)**: XSD valid/invalid/DOCTYPE all
  pass (real libxml2 wasm validation observed); the 10 s worker timeout fires on a
  catastrophic regex, the page stays responsive and a fresh worker is recreated; CSP verified
  enforced (policy exactly `script-src 'self' 'wasm-unsafe-eval'`, inline scripts blocked, zero
  unexpected violations/console errors; `page.evaluate`/CDP is CSP-exempt by Chrome design and
  the test asserts that honestly); offline-after-install confirmed (precached tool works with
  the network off; the XSD wasm path shows a graceful error instead of crashing). Raw
  single-run heap numbers in RAM_MEASUREMENTS.md.
- **XSD spike (S6) — decision: GO, integration deferred to S7.** `xmllint-wasm@5.3.0` (MIT,
  registry-verified) ships a single 760.5 kB `xmllint.wasm` + a ~5.6 kB browser ESM wrapper
  (tarball listing). It performs **no network or IO** — schema dependencies must be passed in via
  `preload`, so external entities/DTDs cannot be fetched by construction; memory is bounded via
  `initialMemoryPages`/`maxMemoryPages` (default 256 pages = 16 MiB). Browser support:
  Chrome/Edge/Safari out of the box; Firefox needs bundling (our Vite worker build provides that).
  Requirements for S7: run inside a dedicated worker, cap memory (256–512 pages) and input size,
  exclude the `.wasm` from the precache (it is 7.5× the 100 KiB cap → the XSD tool will need one
  online visit, documented), and add a narrow `script-src 'self' 'wasm-unsafe-eval'` CSP only when
  it ships. Not integrated into the UI in S6; the XML/XSD tool remains uncounted.
- **Security rules to implement in their slices:** JSONPath must run with eval/arbitrary-JS disabled
  plus time limits; Markdown preview must forbid remote images and unsafe URLs (content stays
  local-only); XML must explicitly reject DTD/external entities (not merely rely on DOMParser);
  GZIP must cap **output** bytes, not just input, to stop decompression bombs; image tools need
  decoded pixel/dimension caps and any WASM persistent memory must be freed on dispose.
- **CSP (not shipped in S1 — no need yet).** Intended policy for a later slice, to be verified
  against real worker behaviour, not just the build:
  `default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; connect-src 'self'; worker-src 'self' blob:`
  and, only when WASM ships (XSD slice), a narrow `script-src 'self' 'wasm-unsafe-eval'` — never a
  blanket `unsafe-eval`.
- **Offline honesty (verified against `dist/sw.js` of the current build, not assumed):** the four
  heavy libraries are emitted as stable vendor chunks and excluded from the precache by exact name
  — `vendor-yaml-*.js` (**104.62 kB**), `vendor-sql-*.js` (**293.35 kB**), `vendor-pako-*.js`
  (**47.09 kB**), `vendor-jsqr-*.js` (**130.73 kB**); `sw.js` contains exactly one vendor entry —
  `vendor-qrcode` (25.79 kB, under the cap) — and zero references to the other four. **Five tools need one online visit before they work fully offline: JSON<>YAML,
  SQL Formatter, GZIP (pako fallback only — engines with native streams never fetch it), QR
  decoding, and the XML/XSD Tester (its 778.73 kB `xmllint-*.wasm` is the one wasm asset in the
  build and is excluded from the precache, served via the `tool-assets` CacheFirst runtime cache
  after first use).** After that first visit they are served from the `tool-assets` CacheFirst runtime
  cache (hashed filenames are immutable, so CacheFirst cannot serve stale code). **QR generation
  is offline on a fresh install**: generation lives in a module with no jsQR reference at all
  (`src/tools/qr.ts`); only `src/tools/qrdecode.ts` imports jsqr. Every other tool is fully
  offline at install. vite-plugin-pwa **fails the build** if a new asset exceeds the 100 KiB cap
  without an explicit ignore, so heavy dependencies can never silently bloat the install payload.
  Updates surface a "reload to pick it up" prompt on `controllerchange` so users are not left on a
  mix of old shell and new tool chunks.
- **Runtime RAM remains unmeasured.** No heap claims are made from bundle sizes.

## Not implemented — platform features

| Feature | Status |
|---|---|
| Smart Detection (auto-pick tool from clipboard) | ❌ not started |
| Third-party extension ecosystem (NuGet-based) | ❌ out of scope for a static web build |
| Multiple windows / compact overlay window (desktop) | ❌ N/A on the web |
| Cross-tool clipboard pipeline | ❌ not started |

## Shell features

| Feature | Status |
|---|---|
| Searchable, categorized tool list | ✅ done (AND semantics across name/keywords/description) |
| Lazy per-tool loading, unmount on leave | ✅ done (per-tool chunks, no `<KeepAlive>`) — 26 tools each in their own chunk; yaml, sql-formatter, pako and jsQR live in stable `vendor-*` chunks referenced only by their tools' dedicated workers (grep-verified in this build's output) |
| Lightweight preference persistence | ✅ done (`lib/prefs.ts`, capped) |
| Offline-installable PWA (app shell precache) | ✅ done (Workbox `generateSW`, no runtime caching of user data) |
| Worker offload for large inputs | ✅ done (shared toolWorker ≥ 64k chars; **dedicated per-tool workers** for YAML, SQL, JSON→table/CSV and GZIP as of S3, each with the 10 s timeout, terminate-and-recreate, user-visible cancel, and terminate-on-unmount) |
| Bounded inputs/history/caches | ✅ done (`lib/limits.ts`, extended in S1 with password/analyzer/table caps) |
| Keyboard `/` to focus search | ✅ done |
| Dark + light themes | ✅ done |

## Honest gaps inside "done" tools

- **JSON validator** cannot report line/column on engines whose error message omits a position
  (current V8). The message and offending token are shown instead.
- **Diff** degrades to coarse mode above 4,000 lines/side or an edit distance above 400; coarse
  mode reports which lines are unique to each side without pairwise alignment, and says so.
- **Regex** caps rendered matches at 5,000 and replace output at 1M characters; both caps are
  labelled in the UI when hit.
- **Date** does no arithmetic (add/subtract); **Number Base** rejects non-integers explicitly
  rather than truncating.
