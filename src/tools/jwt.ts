/**
 * JWT DECODER — decode only. It does NOT verify signatures, does not fetch
 * JWKS, and never transmits the token (there is no network code in this app).
 * The UI labels every output "NOT VERIFIED".
 */

import { base64ToBytes, utf8Decode } from '@/lib/base64'

export type JwtClaims = Record<string, unknown>

export type DecodedJwt = {
  header: JwtClaims
  payload: JwtClaims
  signaturePresent: boolean
  segments: number
  warnings: string[]
}

export function decodeJwt(token: string): DecodedJwt {
  const trimmed = token.trim()
  if (!trimmed) throw new Error('Paste a JWT (three dot-separated base64url segments).')
  const parts = trimmed.split('.')
  if (parts.length < 2 || parts.length > 3) {
    throw new Error(`A JWT has 2 or 3 dot-separated segments; this has ${parts.length}.`)
  }
  const [headerRaw, payloadRaw, signatureRaw] = parts
  const warnings: string[] = []
  const header = decodeSegment(headerRaw!, 'header')
  const payload = decodeSegment(payloadRaw!, 'payload')
  if (parts.length === 3 && !signatureRaw) warnings.push('The signature segment is empty.')
  if (header.alg === 'none') warnings.push('alg is "none": this token is unsigned by design.')
  if (typeof header.enc === 'string') warnings.push('This looks like a JWE (encrypted) token; only the header is readable.')
  return {
    header,
    payload,
    signaturePresent: Boolean(signatureRaw),
    segments: parts.length,
    warnings,
  }
}

function decodeSegment(segment: string, what: string): JwtClaims {
  const normalized = segment.replaceAll('-', '+').replaceAll('_', '/').replace(/=+$/g, '')
  if (!/^[A-Za-z0-9+/]*$/.test(normalized)) {
    throw new Error(`The ${what} segment contains characters that are not valid base64url.`)
  }
  let bytes: Uint8Array
  try {
    bytes = base64ToBytes(segment)
  } catch {
    throw new Error(`The ${what} segment is not valid base64url.`)
  }
  // Segments are UTF-8 JSON. atob() alone would hand us a Latin-1 binary
  // string and mojibake every multi-byte claim, so decode the bytes as UTF-8
  // first (invalid sequences become U+FFFD) and parse the resulting text.
  const text = utf8Decode(bytes)
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`The ${what} segment does not contain JSON.`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`The ${what} segment is not a JSON object.`)
  }
  return parsed as JwtClaims
}

const DATE_CLAIMS = new Set(['exp', 'iat', 'nbf', 'auth_time', 'updated_at'])

export type ClaimView = { key: string; raw: string; human: string | null; state: 'ok' | 'expired' | 'not-yet' | '' }

/** Flattens claims for display, expanding the registered date claims. */
export function claimViews(claims: JwtClaims, nowMs = Date.now()): ClaimView[] {
  return Object.entries(claims).map(([key, value]) => {
    const raw = typeof value === 'object' && value !== null ? JSON.stringify(value, null, 2) : String(value)
    if (DATE_CLAIMS.has(key) && typeof value === 'number') {
      const ms = value * 1000
      const human = new Date(ms).toISOString()
      if (key === 'exp' && ms < nowMs) return { key, raw, human, state: 'expired' }
      if (key === 'nbf' && ms > nowMs) return { key, raw, human, state: 'not-yet' }
      return { key, raw, human, state: 'ok' }
    }
    return { key, raw, human: null, state: '' }
  })
}
