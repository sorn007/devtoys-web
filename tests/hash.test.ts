import { describe, expect, it } from 'vitest'
import { crc32, hashText, toHex } from '@/tools/hash'

const VECTORS = [
  { algorithm: 'SHA-1' as const, input: 'abc', hex: 'a9993e364706816aba3e25717850c26c9cd0d89d' },
  { algorithm: 'SHA-256' as const, input: 'abc', hex: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' },
  {
    algorithm: 'SHA-384' as const,
    input: 'abc',
    hex: 'cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7',
  },
  {
    algorithm: 'SHA-512' as const,
    input: 'abc',
    hex: 'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
  },
]

describe('hashText', () => {
  it.each(VECTORS)('computes the NIST test vector for $algorithm', async ({ algorithm, input, hex }) => {
    const r = await hashText(input, algorithm)
    expect(r.hex).toBe(hex)
    expect(r.hex).toHaveLength(hex.length)
  })

  it('hashes UTF-8 multi-byte content, not UTF-16 code units', async () => {
    const r = await hashText('🙂', 'SHA-256')
    // SHA-256 of the 4 UTF-8 bytes f0 9f 99 82 (verified against Node crypto)
    expect(r.hex).toBe('d06f1525f791397809f9bc98682b5c13318eca4c3123433467fd4dffda44fd14')
    expect(r.bytes).toBe(4)
  })

  it('exposes a base64 form of the same digest', async () => {
    const r = await hashText('abc', 'SHA-256')
    // Verified against `openssl dgst -binary -sha256 | base64` for "abc".
    expect(r.base64).toBe('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=')
  })

  it('hashes Thai text as UTF-8 bytes (verified against node:crypto)', async () => {
    const r = await hashText('สวัสดี', 'SHA-256')
    expect(r.hex).toBe('4ad434bd60c467ad71c61029edf3a84f65dc5ec5742aa0c0dc2afaa1e226198a')
    expect(r.bytes).toBe(18) // 6 code points × 3 UTF-8 bytes
  })
})

describe('crc32', () => {
  it('computes known vectors', () => {
    expect(crc32('')).toBe('00000000')
    expect(crc32('a')).toBe('e8b7be43')
    expect(crc32('123456789')).toBe('cbf43926')
    expect(crc32('The quick brown fox jumps over the lazy dog')).toBe('414fa339')
  })

  it('checksums UTF-8 bytes of Thai and emoji (verified against node:zlib)', () => {
    expect(crc32('สวัสดี')).toBe('a7b5ab0d')
    expect(crc32('😀')).toBe('054db544')
  })
})

describe('toHex', () => {
  it('zero-pads each byte', () => {
    expect(toHex(new Uint8Array([0, 1, 255]).buffer)).toBe('0001ff')
  })
})
