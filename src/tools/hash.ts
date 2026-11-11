import { assertInputSize } from '@/lib/limits'

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'

export const HASH_ALGORITHMS: readonly HashAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const

export type HashResult = {
  algorithm: HashAlgorithm
  hex: string
  base64: string
  bytes: number
}

/** Digests text (UTF-8) with WebCrypto. SHA-1 is kept for parity, flagged legacy in the UI. */
export async function hashText(text: string, algorithm: HashAlgorithm): Promise<HashResult> {
  assertInputSize(text, 'text to hash')
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest(algorithm, data as unknown as ArrayBuffer)
  return { algorithm, hex: toHex(digest), base64: bytesToBase64(new Uint8Array(digest)), bytes: data.length }
}

/** CRC-32 (IEEE 802.3), the one checksum WebCrypto does not provide. */
export function crc32(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]!
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

export function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i]!.toString(16).padStart(2, '0')
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
