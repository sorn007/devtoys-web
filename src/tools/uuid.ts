import { UUID_MAX_BATCH } from '@/lib/limits'

export { UUID_MAX_BATCH }

const HEX = '0123456789abcdef'

/** RFC 4122 version 4 UUID from `crypto.getRandomValues` (no Math.random fallback: fail loud). */
export function uuidv4(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // RFC 4122 variant
  let out = ''
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) out += '-'
    out += HEX[bytes[i]! >> 4]! + HEX[bytes[i]! & 0x0f]
  }
  return out
}

/** Version 7: millisecond timestamp prefix + random tail, same CSPRNG. */
export function uuidv7(timestamp = Date.now()): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  const ms = BigInt(timestamp)
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn)
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  let out = ''
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) out += '-'
    out += HEX[bytes[i]! >> 4]! + HEX[bytes[i]! & 0x0f]
  }
  return out
}

/** nil UUID, handy as a stable sentinel. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000'

export function uuidBatch(count: number, version: 4 | 7 = 4, uppercase = false, braces = false): string[] {
  const n = Math.max(0, Math.min(Math.floor(count) || 0, UUID_MAX_BATCH))
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const raw = version === 4 ? uuidv4() : uuidv7()
    out.push(wrap(uppercase ? raw.toUpperCase() : raw, braces))
  }
  return out
}

function wrap(id: string, braces: boolean): string {
  return braces ? `{${id}}` : id
}

/** Strict shape check used by the "validate an existing UUID" box. */
export function isUuid(input: string): boolean {
  const s = input.trim().replace(/^[{]|}$/g, '')
  if (s === NIL_UUID) return true
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s)) return false
  const version = Number(s[14])
  const variant = Number.parseInt(s[19]!, 16)
  return version >= 1 && version <= 8 && (variant & 0x8) !== 0
}
