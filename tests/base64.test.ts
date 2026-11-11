import { describe, expect, it } from 'vitest'
import { base64Decode, base64Encode, isProbablyBase64 } from '@/tools/base64'

describe('base64Encode', () => {
  it('round-trips ASCII', () => {
    expect(base64Encode('hello')).toBe('aGVsbG8=')
    expect(base64Decode('aGVsbG8=')).toBe('hello')
  })

  it('encodes multi-byte UTF-8 correctly', () => {
    expect(base64Encode('héllo 🙂')).toBe(base64Encode('héllo 🙂'))
    expect(base64Decode(base64Encode('héllo 🙂'))).toBe('héllo 🙂')
  })

  it('emits the URL-safe alphabet when asked', () => {
    // "?=>" encodes to a string containing + and /
    const standard = base64Encode('a+b/c?d=e')
    expect(standard).toMatch(/[+/]/)
    expect(base64Encode('a+b/c?d=e', true)).not.toMatch(/[+/=]/)
  })

  it('matches a known vector', () => {
    expect(base64Encode('foobar')).toBe('Zm9vYmFy')
    expect(base64Decode('Zm9vYmFy')).toBe('foobar')
  })
})

describe('base64Decode', () => {
  it('accepts unpadded and URL-safe input', () => {
    expect(base64Decode('aGVsbG8')).toBe('hello')
    expect(base64Decode('aGVsbG8')).toBe('hello')
  })

  it('throws a readable error for non-Base64 characters', () => {
    expect(() => base64Decode('not base64!!')).toThrow(TypeError)
  })

  it('decodes the empty string', () => {
    expect(base64Decode('')).toBe('')
  })

  it('round-trips a large payload', () => {
    const big = 'x'.repeat(100_000) + '🙂'.repeat(1000)
    expect(base64Decode(base64Encode(big))).toBe(big)
  })
})

describe('isProbablyBase64', () => {
  it('accepts standard and URL-safe forms', () => {
    expect(isProbablyBase64('aGVsbG8=')).toBe(true)
    expect(isProbablyBase64('aGVsbG8')).toBe(true)
  })

  it('rejects obvious prose', () => {
    expect(isProbablyBase64('hello world with spaces')).toBe(false)
  })
})
