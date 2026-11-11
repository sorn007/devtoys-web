/**
 * MD5 (RFC 1321) — added for compatibility only. MD5 is NOT collision
 * resistant and must never be used for security; the UI labels it
 * "legacy / insecure" everywhere it appears. Hand-written so no extra
 * dependency is added; WebCrypto deliberately does not offer MD5.
 */

const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21] as const
const K = new Uint32Array(64).map((_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32))

export function md5(message: string): string {
  const msg = new TextEncoder().encode(message)
  return md5Bytes(msg)
}

export function md5Bytes(msg: Uint8Array): string {
  // Pad to 56 bytes mod 64, then 8-byte little-endian bit length.
  const bitLen = BigInt(msg.length) * 8n
  const padded = new Uint8Array((((msg.length + 8) >> 6) + 1) << 6)
  padded.set(msg)
  padded[msg.length] = 0x80
  for (let i = 0; i < 8; i++) {
    padded[padded.length - 8 + i] = Number((bitLen >> BigInt(8 * i)) & 0xffn)
  }

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  for (let chunk = 0; chunk < padded.length; chunk += 64) {
    const M = new Uint32Array(16)
    for (let i = 0; i < 16; i++) {
      const o = chunk + i * 4
      M[i] = padded[o]! | (padded[o + 1]! << 8) | (padded[o + 2]! << 16) | (padded[o + 3]! << 24)
    }
    let A = a0
    let B = b0
    let C = c0
    let D = d0
    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i]! + M[g]!) >>> 0
      A = D
      D = C
      C = B
      const shift = S[(i >> 4) * 4 + (i % 4)]!
      B = (B + leftRotate(F, shift)) >>> 0
    }
    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  return [a0, b0, c0, d0]
    .flatMap((word) => [word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff])
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function leftRotate(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0
}
