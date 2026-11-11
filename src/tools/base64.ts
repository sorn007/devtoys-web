import { assertInputSize } from '@/lib/limits'
import { base64ToBytes, bytesToBase64, utf8Decode, utf8Encode } from '@/lib/base64'

/** Encodes text as UTF-8 then Base64 (standard alphabet, with padding). */
export function base64Encode(text: string, urlSafe = false): string {
  assertInputSize(text, 'text to encode')
  return bytesToBase64(utf8Encode(text), urlSafe)
}

/**
 * Decodes Base64 (standard or URL-safe, padding optional) back to text.
 * Throws TypeError with a readable message on invalid input.
 */
export function base64Decode(input: string): string {
  assertInputSize(input, 'Base64 to decode')
  // Replaces lone surrogates instead of throwing, so byte-level junk still decodes.
  return utf8Decode(base64ToBytes(input))
}

export function isProbablyBase64(input: string): boolean {
  const s = input.trim()
  if (s.length < 4 || s.length % 4 === 1) return false
  return /^[A-Za-z0-9+/\-_]*={0,2}$/.test(s)
}
