/**
 * Shared text ↔ bytes ↔ Base64 conversions — the ONE place in the app that
 * touches TextEncoder/TextDecoder/atob/btoa. `atob` returns a Latin-1
 * "binary string", so any code that feeds it straight into JSON.parse (or
 * String.fromCharCode-style reassembly) mojibakes multi-byte UTF-8; every
 * caller here goes through Uint8Array instead.
 */

/** Encodes text as UTF-8 bytes. */
export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/**
 * Decodes UTF-8 bytes as text. With `fatal: false` (the default) invalid
 * sequences become U+FFFD instead of throwing, so byte-level junk still
 * decodes to something displayable.
 */
export function utf8Decode(bytes: Uint8Array, fatal = false): string {
  return new TextDecoder('utf-8', { fatal }).decode(bytes)
}

/** Encodes bytes as Base64 (standard alphabet, with padding; URL-safe when asked). */
export function bytesToBase64(bytes: Uint8Array, urlSafe = false): string {
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
 * Decodes Base64 to bytes. Accepts the standard or URL-safe alphabet, with or
 * without padding. Throws TypeError with a readable message on invalid input.
 */
export function base64ToBytes(input: string): Uint8Array {
  const normalized = input.trim().replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/g, '')
  if (!/^[A-Za-z0-9+/]*$/.test(normalized)) {
    throw new TypeError('Input contains characters that are not valid Base64.')
  }
  if (normalized.length % 4 === 1) {
    throw new TypeError('Input is not valid Base64: the length cannot form complete 4-character groups.')
  }
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
