/**
 * Arbitrary-precision base conversion for integers, bases 2–36.
 * All arithmetic is BigInt, so values far beyond 2^53 round-trip exactly.
 * Non-integers are rejected explicitly rather than silently truncated.
 */

export const MIN_BASE = 2
export const MAX_BASE = 36

export class BaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BaseError'
  }
}

export function assertBase(base: number): void {
  if (!Number.isInteger(base) || base < MIN_BASE || base > MAX_BASE) {
    throw new BaseError(`Base must be an integer between ${MIN_BASE} and ${MAX_BASE}.`)
  }
}

/** Parses `input` written in `base` into a BigInt. Throws BaseError on bad shape. */
export function parseInBase(input: string, base: number): bigint {
  assertBase(base)
  const s = input.trim().toLowerCase().replace(/[\s_]/g, '')
  if (!s) throw new BaseError('Input is empty.')
  if (s.includes('.') || s.includes(',')) throw new BaseError('Only integers are supported; fractional values are rejected.')
  const negative = s.startsWith('-')
  const digits = negative ? s.slice(1) : s
  if (!digits) throw new BaseError('No digits found.')
  const radix = BigInt(base)
  let value = 0n
  for (const ch of digits) {
    const d = digitValue(ch)
    if (d === null || d >= base) throw new BaseError(`"${ch}" is not a valid base-${base} digit.`)
    value = value * radix + BigInt(d)
  }
  return negative ? -value : value
}

function digitValue(ch: string): number | null {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (ch >= 'a' && ch <= 'z') return ch.charCodeAt(0) - 87
  return null
}

/** Formats `value` in `base` with the canonical digit alphabet. */
export function formatBase(value: bigint, base: number, uppercase = false): string {
  assertBase(base)
  const out = value.toString(base)
  return uppercase ? out.toUpperCase() : out
}

export const COMMON_BASES = [2, 8, 10, 16] as const
export const BIT_WIDTHS = [8, 16, 32, 64] as const

/** Two's-complement representation of `value` at `bits` width, as base-16. */
export function twosComplement(value: bigint, bits: 8 | 16 | 32 | 64): string {
  const span = 1n << BigInt(bits)
  const min = -(span / 2n)
  const max = span / 2n - 1n
  if (value < min || value > max) {
    throw new BaseError(`${value} does not fit in a signed ${bits}-bit integer (${min}…${max}).`)
  }
  const wrapped = value >= 0n ? value : value + span
  return wrapped.toString(16).toUpperCase().padStart(bits / 4, '0')
}

/** Quick validation used for live typing: error message or null when valid. */
export function validateBaseInput(input: string, base: number): string | null {
  try {
    parseInBase(input, base)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}
