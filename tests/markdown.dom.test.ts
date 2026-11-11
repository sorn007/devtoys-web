// @vitest-environment jsdom
/**
 * Full-pipeline XSS tests, INCLUDING DOMPurify (layer 4 pre-iframe).
 * jsdom@27.0.0 (MIT, pinned devDependency) supplies the DOM that DOMPurify
 * needs; the per-file docblock above means only this file pays for it.
 */
import { describe, expect, it } from 'vitest'
import createDOMPurify from 'dompurify'
import { renderMarkdown } from '@/tools/markdown'

const purify = createDOMPurify(window)

/** The exact post-DOMPurify HTML the component feeds into the sandboxed iframe. */
async function fullPipeline(text: string, allowRemoteImages = false): Promise<string> {
  const r = await renderMarkdown(text, { allowRemoteImages })
  if (!r.ok) throw new Error(r.error)
  return purify.sanitize(r.html, {
    ALLOWED_ATTR: ['href', 'title', 'src', 'alt', 'align', 'class', 'colspan', 'rowspan'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style', 'link', 'meta', 'base'],
    ALLOW_DATA_ATTR: false,
  })
}

const CORPUS = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<iframe src="https://evil.example"></iframe>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="data:text/html,<script>alert(1)</script>">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '[link](javascript:alert(1))',
  '[link](data:text/html;base64,PHNjcmlwdD4=)',
  '[link](vbscript:whatever)',
  '![img](https://evil.example/pixel.gif)',
  '![img](javascript:alert(1))',
  '![img](data:image/svg+xml,<svg onload=alert(1)>)',
  '<form action="https://evil.example"><input type=submit></form>',
  '<body onload=alert(1)>',
  '<div style="background:url(javascript:alert(1))">styled</div>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
]

describe('DOMPurify full pipeline (jsdom)', () => {
  it('no corpus payload leaves a live script/handler/dangerous URL', async () => {
    for (const payload of CORPUS) {
      const html = await fullPipeline(`before\n\n${payload}\n\nafter`)
      expect(html, payload).not.toMatch(/<script[\s>]/i)
      expect(html, payload).not.toMatch(/<iframe[\s>]/i)
      expect(html, payload).not.toMatch(/<svg[\s>]/i)
      expect(html, payload).not.toMatch(/<form[\s>]/i)
      expect(html, payload).not.toMatch(/<input[\s>]/i)
      expect(html, payload).not.toMatch(/<[a-z][^>]*\son\w+\s*=/i)
      // Only dangerous URLs inside LIVE tags matter; escaped text mentioning
      // "href=javascript:" is inert (the DOM-node test below proves it).
      expect(html, payload).not.toMatch(/<[a-z][^>]*\shref=["']?\s*(javascript|vbscript|data):/i)
      expect(html, payload).not.toMatch(/<[a-z][^>]*\ssrc=["']?\s*(javascript|vbscript):/i)
    }
  })

  it('produces no DOM nodes DOMPurify considers executable', async () => {
    for (const payload of CORPUS) {
      const html = await fullPipeline(payload)
      const probe = document.createElement('div')
      probe.innerHTML = html
      expect(probe.querySelectorAll('script, iframe, object, embed, form, input, style, link, meta, base').length, payload).toBe(0)
      // No element may carry an inline event handler.
      const handlers = [...probe.querySelectorAll('*')].filter((el) =>
        [...el.attributes].some((a) => /^on/i.test(a.name)),
      )
      expect(handlers, payload).toHaveLength(0)
    }
  })

  it('still renders legitimate Markdown through the whole pipeline', async () => {
    const html = await fullPipeline('# Title\n\n[a](https://example.com) and `code`\n\n- list')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<li>')
  })

  it('keeps the angle-bracket autolink working (regression for the S6 pre-escape)', async () => {
    const html = await fullPipeline('<https://example.com>')
    expect(html).toContain('href="https://example.com"')
  })

  it('blocks remote images end-to-end and honours the session opt-in', async () => {
    const blocked = await fullPipeline('![p](https://cdn.example.com/i.png)')
    expect(blocked).toContain('md-img-blocked')
    expect(blocked).not.toMatch(/src="https:\/\/cdn/)
    const allowed = await fullPipeline('![p](https://cdn.example.com/i.png)', true)
    expect(allowed).toContain('src="https://cdn.example.com/i.png"')
  })
})
