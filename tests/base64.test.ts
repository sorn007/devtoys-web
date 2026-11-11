import { describe, expect, it } from 'vitest'
import { base64Decode, base64Encode, isProbablyBase64 } from '@/tools/base64'
import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from '@/lib/base64'

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

describe('shared base64/UTF-8 utility', () => {
  it('encodes Thai and emoji as UTF-8 bytes and decodes them back', () => {
    const text = 'สวัสดี😀'
    const bytes = utf8Encode(text)
    // 6 Thai code points × 3 bytes + one 4-byte emoji = 22 bytes.
    expect(bytes).toHaveLength(22)
    expect(bytes[0]).toBe(0xe0)
    expect(bytes[18]).toBe(0xf0)
    expect(utf8Decode(bytes)).toBe(text)
  })

  it('round-trips bytes through standard and URL-safe Base64', () => {
    // Verified against `node -e "Buffer.from('สวัสดี😀').toString('base64')"`.
    expect(bytesToBase64(utf8Encode('สวัสดี😀'))).toBe('4Liq4Lin4Lix4Liq4LiU4Li18J+YgA==')
    const urlSafe = bytesToBase64(utf8Encode('สวัสดี😀'), true)
    expect(urlSafe).toBe('4Liq4Lin4Lix4Liq4LiU4Li18J-YgA')
    expect(urlSafe).not.toMatch(/[+/=]/)
    expect(utf8Decode(base64ToBytes(urlSafe))).toBe('สวัสดี😀')
  })

  it('decodes standard, URL-safe, padded and unpadded input to the same bytes', () => {
    const expected = new Uint8Array([104, 101, 108, 108, 111]) // "hello"
    expect(base64ToBytes('aGVsbG8=')).toEqual(expected)
    expect(base64ToBytes('aGVsbG8')).toEqual(expected)
    expect(base64ToBytes('  aGVsbG8=\n')).toEqual(expected)
    expect(base64ToBytes('')).toEqual(new Uint8Array(0))
  })

  it('throws a readable TypeError on invalid input', () => {
    expect(() => base64ToBytes('not base64!!')).toThrow(TypeError)
    expect(() => base64ToBytes('abcde')).toThrow(TypeError) // length % 4 === 1
  })

  it('replaces invalid UTF-8 sequences instead of throwing unless fatal', () => {
    expect(utf8Decode(Uint8Array.of(0xff, 0xfe))).toBe('��')
    expect(() => utf8Decode(Uint8Array.of(0xff), true)).toThrow()
  })
})
