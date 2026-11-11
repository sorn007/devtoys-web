/**
 * Markdown preview, hardened by construction:
 *
 * 1. Raw HTML in the source is disabled by OVERRIDING marked's `html` token
 *    renderer (block and inline) to emit the raw markup as escaped TEXT.
 *    (marked 18.2.0 passes inline HTML through even with its `html: false`
 *    option — probed directly — so we never rely on that option; the override
 *    also leaves `<https://…>` autolinks working, which blanket `<`-escaping
 *    broke.)
 * 2. Every URL in the rendered HTML is checked against `isSafeUrl`: only
 *    http/https/mailto pass; javascript:, data:, vbscript: and anything else
 *    scheme-less-or-odd is dropped.
 * 3. Remote images are replaced with a visible placeholder unless the user
 *    opted in FOR THIS SESSION (never a persisted "always allow").
 * 4. DOMPurify sanitises the result (browser only — it needs a DOM), and the
 *    component renders inside a sandboxed iframe (`sandbox=""`), so even a bug
 *    in layers 1–3 could not execute script.
 *
 * Layers 1–3 are pure and unit-tested in Node; layer 4 is defence-in-depth in
 * the browser and cannot be exercised by the Node test runner (no DOM).
 */

import { assertInputSize } from '@/lib/limits'

export const MARKDOWN_MAX_CHARS = 500_000

export type UrlVerdict = 'ok' | 'blocked' | 'remote-image'

/** Classifies a URL: safe allowed link, blocked scheme, or remote image source. */
export function classifyUrl(rawUrl: string): UrlVerdict {
  const url = rawUrl.trim()
  // Scheme-relative and relative URLs stay (same-origin only once rendered in
  // the sandboxed iframe), but any explicit scheme must be in the allowlist.
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url)
  if (scheme) {
    const proto = scheme[1]!.toLowerCase()
    if (proto === 'http' || proto === 'https') return 'ok'
    if (proto === 'mailto') return 'ok'
    return 'blocked' // javascript:, data:, vbscript:, file:, blob:, anything else
  }
  return 'ok' // relative / fragment / scheme-less
}

export function isRemoteImageSrc(src: string): boolean {
  const v = classifyUrl(src)
  if (v === 'blocked') return true // treat blocked image sources as remote-and-blocked
  return /^\/\//.test(src.trim()) || /^https?:\/\//i.test(src.trim())
}

/** Placeholder shown instead of a remote image the user has not allowed. */
export const IMAGE_PLACEHOLDER_HTML =
  '<span class="md-img-blocked" data-blocked-src="1">🖼 remote image blocked (session opt-in required)</span>'

export type RenderOptions = {
  /** Allow http(s) images to load. Session-only; never persisted. */
  allowRemoteImages?: boolean
  /** Render GFM tables/strikethrough (default true). */
  gfm?: boolean
}

export type RenderResult = { ok: true; html: string } | { ok: false; error: string }

/** Renders Markdown to HTML with raw HTML escaped and the URL/image policy applied. */
export async function renderMarkdown(text: string, options: RenderOptions = {}): Promise<RenderResult> {
  assertInputSize(text, 'Markdown input')
  if (text.length > MARKDOWN_MAX_CHARS) {
    return { ok: false, error: `Markdown is capped at ${MARKDOWN_MAX_CHARS.toLocaleString()} characters.` }
  }
  const { Marked } = await import('marked')
  const instance = new Marked()
  // marked 18.2.0 emits raw HTML through even with `html:false` (probed), so
  // the html token renderer is replaced: any raw HTML block/inline token is
  // rendered as escaped text. Every other token type uses the stock renderer,
  // which keeps autolinks like <https://…> working.
  instance.use({
    renderer: {
      html(token: { text?: string; raw?: string }) {
        return escapeHtml(token.text ?? token.raw ?? '')
      },
    },
  })
  let raw: string
  try {
    raw = await instance.parse(text, {
      gfm: options.gfm !== false,
      breaks: false,
      async: true,
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Layer 2/3: walk the rendered HTML's URLs. A light, conservative regex pass
  // over href/src attributes (marked emits well-formed attributes), followed by
  // DOMPurify in the browser which re-checks every attribute it keeps.
  let html = rewriteLinks(raw)
  html = rewriteImages(html, options.allowRemoteImages === true)
  return { ok: true, html }
}

/** Drops unsafe link schemes and hardens external links. */
function rewriteLinks(html: string): string {
  return html.replace(/<a\s([^>]*?)href="([^"]*)"([^>]*)>/gi, (_whole, pre: string, href: string, post: string) => {
    if (classifyUrl(decodeQuotes(href)) === 'blocked') {
      // Keep the text, drop the link entirely.
      return '<a>'
    }
    const safe = pre.replace(/\s*(target|rel)="[^"]*"/gi, '') + post.replace(/\s*(target|rel)="[^"]*"/gi, '')
    return `<a ${safe.trim()} href="${href}" target="_blank" rel="noopener noreferrer">`.replace(' <a', '<a').replace('<a  ', '<a ')
  })
}

/** Blocks remote images unless opted in; data:/javascript: images never pass. */
function rewriteImages(html: string, allowRemote: boolean): string {
  return html.replace(/<img\s([^>]*?)src="([^"]*)"([^>]*)>/gi, (whole: string, _pre: string, src: string, _post: string) => {
    if (classifyUrl(decodeQuotes(src)) === 'blocked') return IMAGE_PLACEHOLDER_HTML
    if (!allowRemote && isRemoteImageSrc(src)) return IMAGE_PLACEHOLDER_HTML
    return whole
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function decodeQuotes(value: string): string {
  return value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&amp;', '&')
}
