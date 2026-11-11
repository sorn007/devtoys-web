# VERIFY_IN_BROWSER.md — manual verification checklist

These checks cannot be automated from the build environment (no browser may be launched there).
Run them in any desktop Chromium/Firefox/Safari. Start with:

```bash
npm run build && npm run preview   # or serve dist/ with any static server
```

Each section lists exact steps, sample input and the expected observation. Record results —
several doc claims are explicitly gated on these checks (marked **GATED**).

---

## 1. XSD validation actually runs — GATED (blocks counting XML/XSD as complete)

Open **XML / XSD Tester**. The first Validate click downloads the 778 kB wasm once
(DevTools → Network shows `xmllint-*.wasm`); later validations must not re-download it.

**Valid sample** (expect `valid`, 0 errors):

XML:
```xml
<root>
  <a>1</a>
</root>
```

XSD:
```xml
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="root">
    <xs:complexType><xs:sequence>
      <xs:element name="a" type="xs:integer"/>
    </xs:sequence></xs:complexType>
  </xs:element>
</xs:schema>
```

**Invalid sample** (expect `invalid` with a facet error naming the element):
same XSD, but XML `<root><a>not-a-number</a></root>`.

Also verify the DTD guard: paste `<!DOCTYPE root []><root/>` as the XML — the tool must refuse
with the DOCTYPE-rejection message **before** libxml2 runs.

**Pass criterion:** one valid and one invalid result observed, produced by the wasm in the
worker (not a thrown error). Then `FEATURE_PARITY.md` may count XML/XSD as complete (30/30).

## 2. Worker 10-second timeout: terminate-and-recreate — GATED (S1 debt)

Open **Regex Tester** and paste a catastrophic-backtracking pattern over a long subject:

- Pattern: `(a+)+$`
- Flags: (none)
- Test text: `a`.repeat(30) + `b` → e.g. `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaab` (31 a's then b)

Expected: after ~10 s the tool shows a timeout error naming the job and the terminated worker;
the tab stays responsive throughout. Then run a trivial regex (`a+` on `aaa`) — it must succeed,
proving a **fresh worker was recreated**. Repeat once on **JSONPath Tester** with
`$..*` over ~100 kB of nested JSON if you want a second data point.

## 3. CSP: no unexpected violations, no unsafe-eval

Open DevTools console on the app shell and again inside a tool.

- **Expected:** no `Content-Security-Policy` violation reports for same-origin scripts,
  styles, workers or the wasm fetch.
- Confirm the policy in DevTools → Application → Content Security Policy (or `document.head`
  meta): `script-src 'self' 'wasm-unsafe-eval'` — `wasm-unsafe-eval` is present **only** as the
  narrow WASM allowance; the string `unsafe-eval` must never appear without the `wasm-` prefix.
- GATED follow-up for the XSD check in §1: while validating, there must be no CSP error about
  WebAssembly instantiation (that would mean the policy needs adjusting).
- Markdown preview: open it once — the sandboxed iframe must render normal Markdown with no CSP
  noise about `srcdoc`/`frame-src`.

## 4. Offline after install

Install the PWA (or in a normal tab: DevTools → Application → Service Worker → skipNetworking
by going offline with DevTools → Network → "Offline"), then reload and open tools:

**Must work immediately (precached):** JSON Formatter, Base64 Text, URL, UUID, Hash (incl.
MD5), Text Diff, Regex, Date, Number Base, Lorem, Password, Escape/Unescape, Analyzer,
List Comparer, JSON→Table/CSV, Cron, JWT, JSONPath, Base64 Image, HTML, QR **generation**,
Colour Blindness Simulator, Image Converter, Markdown Preview, XML Formatter,
**Certificate Decoder**, XML/XSD's *UI*.

**Need ONE online visit first** (their heavy chunks are excluded from the precache and then
runtime-cached via `tool-assets`): JSON<>YAML, SQL Formatter, GZIP *on engines without native
`CompressionStream`*, QR **decoding**, XML/XSD **validation** (wasm).

Check: with the network off, a tool from the first list must open and produce output. For a
tool from the second list, the first visit online caches it; going offline *afterwards* must
keep it working (reload the tool offline).

## 5. Quick regression sweep (2 minutes)

- Search (`/`), open 3–4 tools, confirm the previous tool unmounts (DevTools → Memory →
  Take snapshot before/after if you want evidence; not a claim we make from the build).
- Theme toggle persists across reload; update prompt appears after a redeploy
  (`controllerchange` → "Update installed — reload").
- Hash → MD5 shows the "legacy" warning. JWT shows "NOT VERIFIED". Certificate shows
  "trust NOT evaluated".
