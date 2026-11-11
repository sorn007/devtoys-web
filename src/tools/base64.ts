import { assertInputSize } from '@/lib/limits'

/** Encodes text as UTF-8 then Base64 (standard alphabet, with padding). */
export function base64Encode(text: string, urlSafe = false): string {
  assertInputSize(text, 'text to encode')
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  // Chunked to stay under the ~512 MiB String.fromCharCode arg limit.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  const b64 = btoa(binary)
  return urlSafe ? b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '') : b64
}

/**
 * Decodes Base64 (standard or URL-safe, padding optional) back to text.
 * Throws TypeError with a readable message on invalid input.
 */
export function base64Decode(input: string): string {
  assertInputSize(input, 'Base64 to decode')
  const normalized = input.trim().replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/g, '')
  if (normalized.length === 0) return ''
  if (!/^[A-Za-z0-9+/]*$/.test(normalized)) {
    throw new TypeError('Input contains characters that are not valid Base64.')
  }
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  // Replaces lone surrogates instead of throwing, so byte-level junk still decodes.
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export function isProbablyBase64(input: string): boolean {
  const s = input.trim()
  if (s.length < 4 || s.length % 4 === 1) return false
  return /^[A-Za-z0-9+/\-_]*={0,2}$/.test(s)
}
