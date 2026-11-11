import { describe, expect, it } from 'vitest'
import { gzipCompress, gzipDecompress, hasNativeStreams } from '@/tools/gzip'
import { assertImageWithinLimits, parseDataUrl } from '@/tools/base64image'
import { decodeHtml, encodeHtml, NAMED_ENTITIES } from '@/tools/html'

describe('gzip round-trip', () => {
  it('compresses and decompresses byte-identically', async () => {
    const text = 'hello gzip '.repeat(500) + 'unicode: héllo 🙂'
    const data = new TextEncoder().encode(text)
    const compressed = await gzipCompress(data)
    expect(compressed.byteLength).toBeGreaterThan(0)
    expect(compressed.byteLength).toBeLessThan(data.byteLength)
    const restored = await gzipDecompress(compressed)
    expect(new TextDecoder().decode(restored)).toBe(text)
  })

  it('round-trips an empty payload and awkward binary-ish content', async () => {
    const empty = await gzipDecompress(await gzipCompress(new Uint8Array(0)))
    expect(empty.byteLength).toBe(0)
    const awkward = new TextEncoder().encode(JSON.stringify({ a: '\n\t"\\', b: 0 }))
    expect(new TextDecoder().decode(await gzipDecompress(await gzipCompress(awkward)))).toBe(
      new TextDecoder().decode(awkward),
    )
  })

  it('reports the native-stream capability it will actually use', () => {
    expect(hasNativeStreams()).toBe(typeof CompressionStream !== 'undefined')
  })

  it('aborts a decompression that passes the output cap (bomb guard)', async () => {
    // A genuinely repetitive payload compresses hard; with a tiny cap the
    // decompressor must refuse rather than materialise the expansion.
    const bomb = await gzipCompress(new TextEncoder().encode('A'.repeat(400_000)))
    expect(bomb.byteLength).toBeLessThan(4_000)
    await expect(gzipDecompress(bomb, 1_000)).rejects.toThrow(/cap|bomb/i)
  })

  it('rejects corrupt gzip data with a real error', async () => {
    await expect(gzipDecompress(new Uint8Array([1, 2, 3, 4, 5]))).rejects.toThrow()
  })

  it('round-trips Thai and emoji through UTF-8 bytes', async () => {
    const text = 'สวัสดี สมชาย 😀 — héllo'
    const data = new TextEncoder().encode(text)
    const restored = await gzipDecompress(await gzipCompress(data))
    expect(new TextDecoder('utf-8').decode(restored)).toBe(text)
  })
})

describe('data URL parsing', () => {
  it('parses a well-formed base64 data URL into bytes', () => {
    const r = parseDataUrl('data:image/png;base64,aGVsbG8=')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.mime).toBe('image/png')
      expect(new TextDecoder().decode(r.bytes)).toBe('hello')
    }
  })

  it('rejects malformed input with specific errors', () => {
    expect(parseDataUrl('not a url').ok).toBe(false)
    expect(parseDataUrl('data:image/png,aGVsbG8=').ok).toBe(false) // not base64 form
    expect(parseDataUrl('data:image/png;base64,!!!not-base64!!!').ok).toBe(false)
    expect(parseDataUrl('').ok).toBe(false)
  })
})

describe('image limits', () => {
  it('allows normal images and refuses oversized ones before decoding', () => {
    expect(() => assertImageWithinLimits(1920, 1080)).not.toThrow()
    expect(() => assertImageWithinLimits(20_000, 20_000)).toThrow(/side is capped/i)
    expect(() => assertImageWithinLimits(10_000, 10_000)).toThrow(/pixels/i)
    expect(() => assertImageWithinLimits(0, 100)).toThrow(/dimensions/i)
    expect(() => assertImageWithinLimits(Number.NaN, 100)).toThrow(/dimensions/i)
  })
})

describe('HTML entities', () => {
  it('encodes exactly the five structural characters by default', () => {
    expect(encodeHtml('<a href="x" class=\'y\'>&amp; café')).toBe(
      '&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;amp; café',
    )
  })

  it('encodes non-ASCII as numeric references when asked, including astral characters', () => {
    expect(encodeHtml('café 🙂', true)).toBe('caf&#233; &#128578;')
  })

  it('round-trips Thai and emoji through numeric references', () => {
    const raw = 'สวัสดี 😀'
    // Thai code points U+0E2A U+0E27 U+0E31 U+0E2A U+0E14 U+0E35 (decimal
    // 3626 3623 3633 3626 3604 3637); emoji U+1F600 (decimal 128512).
    expect(encodeHtml(raw, true)).toBe('&#3626;&#3623;&#3633;&#3626;&#3604;&#3637; &#128512;')
    expect(decodeHtml(encodeHtml(raw, true))).toBe(raw)
    // Left unescaped, Thai and emoji pass through untouched (UTF-16 string).
    expect(encodeHtml(raw)).toBe(raw)
  })

  it('decodes named entities and both numeric forms', () => {
    expect(decodeHtml('&lt;&amp;&gt;&quot;&#39;&nbsp;')).toBe('<&>"\' ')
    expect(decodeHtml('&#65;&#x42;&#X43;')).toBe('ABC')
    expect(decodeHtml('&euro;&copy;&hellip;')).toBe('€©…')
  })

  it('decodes astral numeric references and leaves invalid ones literal', () => {
    expect(decodeHtml('&#128578;')).toBe('🙂')
    expect(decodeHtml('&#x1F642;')).toBe('🙂')
    expect(decodeHtml('&#2000000;')).toBe('&#2000000;') // beyond U+10FFFF
    expect(decodeHtml('&#xD800;')).toBe('&#xD800;') // lone surrogate
  })

  it('keeps unknown entities literal instead of dropping them', () => {
    expect(decodeHtml('&bogus;&colon;')).toBe('&bogus;&colon;')
  })

  it('round-trips every named entity it knows', () => {
    for (const [name, ch] of Object.entries(NAMED_ENTITIES)) {
      expect(decodeHtml(`&${name};`)).toBe(ch)
    }
  })

  it('never renders input: output of encode on hostile markup is inert text', () => {
    const hostile = '<script>alert(1)</script>'
    const encoded = encodeHtml(hostile)
    expect(encoded).not.toContain('<script')
    expect(decodeHtml(encoded)).toBe(hostile)
  })
})
