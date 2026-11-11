import { describe, expect, it } from 'vitest'
import { parseUrl, urlDecode, urlEncode } from '@/tools/url'

describe('urlEncode', () => {
  it('percent-encodes reserved characters in component mode', () => {
    expect(urlEncode('a b&c=d/e')).toBe('a%20b%26c%3Dd%2Fe')
  })

  it('keeps URL structure intact in full mode', () => {
    expect(urlEncode('https://example.com/a b?c=d', 'full')).toBe('https://example.com/a%20b?c=d')
  })

  it('encodes non-ASCII as UTF-8 percent escapes', () => {
    expect(urlEncode('é')).toBe('%C3%A9')
  })
})

describe('urlDecode', () => {
  it('decodes percent escapes', () => {
    expect(urlDecode('a%20b%26c')).toBe('a b&c')
  })

  it('maps + to space only in form mode', () => {
    expect(urlDecode('a+b')).toBe('a+b')
    expect(urlDecode('a+b', true)).toBe('a b')
  })

  it('tolerates a stray percent sign instead of throwing', () => {
    expect(urlDecode('100%')).toBe('100%')
  })

  it('round-trips arbitrary text', () => {
    const sample = 'héllo 🙂 & ?=/#'
    expect(urlDecode(urlEncode(sample))).toBe(sample)
  })
})

describe('parseUrl', () => {
  it('splits an absolute URL into parts', () => {
    const p = parseUrl('https://user:pw@example.com:8443/a/b?x=1&y=hello%20world#frag')
    expect(p.ok).toBe(true)
    expect(p.protocol).toBe('https:')
    expect(p.hostname).toBe('example.com')
    expect(p.port).toBe('8443')
    expect(p.pathname).toBe('/a/b')
    expect(p.params).toEqual([
      { key: 'x', value: '1' },
      { key: 'y', value: 'hello world' },
    ])
    expect(p.hash).toBe('#frag')
  })

  it('reports an explicit error for a malformed absolute URL', () => {
    expect(parseUrl('http://').ok).toBe(false)
  })

  it('is lenient with relative paths, as the URL spec is', () => {
    const p = parseUrl('not a url at all ::')
    expect(p.ok).toBe(true)
    expect(p.pathname.startsWith('/not%20a%20url')).toBe(true)
  })

  it('returns an error for empty input', () => {
    expect(parseUrl('  ').error).toBe('Input is empty.')
  })
})
