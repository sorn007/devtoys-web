import { describe, expect, it } from 'vitest'
import { classifyUrl, isRemoteImageSrc, renderMarkdown } from '@/tools/markdown'

describe('URL policy (layer 2)', () => {
  it('allows only http, https and mailto schemes', () => {
    expect(classifyUrl('https://example.com')).toBe('ok')
    expect(classifyUrl('http://example.com')).toBe('ok')
    expect(classifyUrl('mailto:a@b.c')).toBe('ok')
    expect(classifyUrl('/relative/path')).toBe('ok')
    expect(classifyUrl('#fragment')).toBe('ok')
  })

  it('blocks dangerous schemes', () => {
    expect(classifyUrl('javascript:alert(1)')).toBe('blocked')
    expect(classifyUrl('JAVASCRIPT:alert(1)')).toBe('blocked')
    expect(classifyUrl(' data:text/html,<script>')).toBe('blocked')
    expect(classifyUrl('vbscript:msgbox')).toBe('blocked')
    expect(classifyUrl('file:///etc/passwd')).toBe('blocked')
    expect(classifyUrl('blob:https://x')).toBe('blocked')
  })

  it('detects remote image sources', () => {
    expect(isRemoteImageSrc('https://cdn.example.com/a.png')).toBe(true)
    expect(isRemoteImageSrc('//cdn.example.com/a.png')).toBe(true)
    expect(isRemoteImageSrc('http://a/b.png')).toBe(true)
    expect(isRemoteImageSrc('javascript:alert(1)')).toBe(true) // blocked = treated as blocked
    expect(isRemoteImageSrc('/local.png')).toBe(false)
    expect(isRemoteImageSrc('pic.png')).toBe(false)
  })
})

describe('XSS payload corpus (layers 1–3: pre-escape + URL/image policy)', () => {
  const PAYLOADS = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">click</a>',
    '<a href="JAVASCRIPT:alert(1)">click</a>',
    '<a href="data:text/html,<script>alert(1)</script>">data link</a>',
    '<a href="vbscript:msgbox(1)">vbs</a>',
    '[link](javascript:alert(1))',
    '[link](data:text/html;base64,PHNjcmlwdD4=)',
    '![img](https://evil.example/pixel.gif)',
    '![img](javascript:alert(1))',
    '<iframe src="https://evil.example"></iframe>',
    '<svg onload=alert(1)></svg>',
    '<body onload=alert(1)>',
    '<form action="https://evil.example"><input type=submit></form>',
    '![remote](//evil.example/x.png)',
  ]

  it('renders none of the payloads as executable markup', async () => {
    for (const payload of PAYLOADS) {
      const r = await renderMarkdown(`before\n\n${payload}\n\nafter`, { allowRemoteImages: false })
      expect(r.ok, `render failed for ${payload}`).toBe(true)
      if (!r.ok) continue
      const html = r.html
      // Raw script/iframe/svg-object bodies and event handlers must never survive
      // as live markup (html:false escapes them into text).
      expect(html, payload).not.toMatch(/<script[\s>]/i)
      expect(html, payload).not.toMatch(/<iframe[\s>]/i)
      expect(html, payload).not.toMatch(/<svg[\s>]/i)
      expect(html, payload).not.toMatch(/<form[\s>]/i)
      expect(html, payload).not.toMatch(/<body[\s>]/i)
      // Event handlers matter only inside a live tag opener, not in escaped text.
      expect(html, payload).not.toMatch(/<[a-z][^>]*\son\w+\s*=/i)
      expect(html, payload).not.toMatch(/href=["']?\s*(javascript|vbscript|data):/i)
    }
  })

  it('keeps the payload visible as inert text, not silently dropped', async () => {
    const r = await renderMarkdown('<script>alert(1)</script>')
    expect(r.ok).toBe(true)
    // The pre-pass escapes "<"; marked then escapes the ">" of the inert text too.
    if (r.ok) expect(r.html).toContain('&lt;script&gt;')
  })

  it('replaces remote images with a placeholder unless allowed per session', async () => {
    const blocked = await renderMarkdown('![pic](https://cdn.example.com/p.png)')
    expect(blocked.ok && blocked.html).toContain('md-img-blocked')
    expect(blocked.ok && blocked.html).not.toMatch(/src="https:\/\/cdn/)

    const allowed = await renderMarkdown('![pic](https://cdn.example.com/p.png)', { allowRemoteImages: true })
    expect(allowed.ok && allowed.html).toContain('src="https://cdn.example.com/p.png"')

    // A blocked-scheme image is blocked even with the session opt-in.
    const evilAllowed = await renderMarkdown('![x](javascript:alert(1))', { allowRemoteImages: true })
    expect(evilAllowed.ok && evilAllowed.html).toContain('md-img-blocked')
  })

  it('hardens safe external links with rel and target', async () => {
    const r = await renderMarkdown('[site](https://example.com)')
    expect(r.ok && r.html).toContain('rel="noopener noreferrer"')
    expect(r.ok && r.html).toContain('target="_blank"')
  })

  it('keeps mailto links working', async () => {
    const r = await renderMarkdown('[mail](mailto:a@b.c)')
    expect(r.ok && r.html).toContain('href="mailto:a@b.c"')
  })

  it('renders ordinary Markdown correctly (headings, GFM tables, code)', async () => {
    const r = await renderMarkdown('# Title\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n`code`')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.html).toContain('<h1>Title</h1>')
      expect(r.html).toContain('<table>')
      expect(r.html).toContain('<code>code</code>')
    }
  })

  it('caps the input size', async () => {
    const r = await renderMarkdown('x'.repeat(600_000))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/capped/)
  })
})
