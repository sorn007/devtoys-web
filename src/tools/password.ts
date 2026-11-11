/**
 * Password generator. Randomness comes exclusively from
 * crypto.getRandomValues with rejection sampling (no modulo bias), and the
 * shuffle is Fisher–Yates over the same source. No Math.random anywhere.
 *
 * Strength output is an entropy calculation only — it is not a promise that a
 * password is "strong", and the UI labels it as a heuristic.
 */

import { PASSWORD_MAX_BATCH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/lib/limits'

export type CharClass = 'lowercase' | 'uppercase' | 'digits' | 'symbols'

export const CHAR_CLASSES: readonly CharClass[] = ['lowercase', 'uppercase', 'digits', 'symbols'] as const

/** Characters that look alike and are dropped when "exclude ambiguous" is set. */
const AMBIGUOUS = new Set('0O1lI|`\'"iLoS5B8Z2G6q9'.split(''))

export const SETS: Record<CharClass, string> = {
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
}

export type PasswordOptions = {
  length: number
  classes: CharClass[]
  requireEach?: boolean
  excludeAmbiguous?: boolean
}

export class PasswordError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PasswordError'
  }
}

/** Unbiased integer in [0, max) from crypto.getRandomValues. */
export function randomInt(max: number, random32: () => number = defaultRandom32): number {
  if (!Number.isInteger(max) || max <= 0) throw new PasswordError('randomInt requires a positive integer bound.')
  const limit = Math.floor(0x100000000 / max) * max // largest multiple of max in uint32
  for (;;) {
    const x = random32()
    if (x < limit) return x % max
  }
}

function defaultRandom32(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]!
}

export function buildPool(options: PasswordOptions): string {
  const ambiguous = options.excludeAmbiguous === true
  const pool = new Set<string>()
  for (const cls of options.classes) {
    for (const ch of SETS[cls] ?? '') {
      if (ambiguous && AMBIGUOUS.has(ch)) continue
      pool.add(ch)
    }
  }
  return [...pool].join('')
}

function assertOptions(options: PasswordOptions, pool: string): void {
  if (options.classes.length === 0) throw new PasswordError('Select at least one character class.')
  if (pool.length === 0) {
    throw new PasswordError('The selected classes are empty after excluding ambiguous characters.')
  }
  if (!Number.isInteger(options.length)) throw new PasswordError('Length must be a whole number.')
  if (options.length < PASSWORD_MIN_LENGTH) {
    throw new PasswordError(`Length must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  }
  if (options.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordError(`Length is capped at ${PASSWORD_MAX_LENGTH} characters.`)
  }
  if (options.requireEach && options.length < options.classes.length) {
    throw new PasswordError(
      `Length ${options.length} cannot satisfy "one of each class" across ${options.classes.length} classes.`,
    )
  }
}

/** Generates one password. `random32` is injectable for deterministic tests. */
export function generatePassword(
  options: PasswordOptions,
  random32: () => number = defaultRandom32,
): string {
  const pool = buildPool(options)
  assertOptions(options, pool)

  const chars: string[] = []
  if (options.requireEach) {
    for (const cls of options.classes) {
      const set = (SETS[cls] ?? '')
        .split('')
        .filter((ch) => !(options.excludeAmbiguous && AMBIGUOUS.has(ch)))
      if (set.length === 0) continue
      chars.push(set[randomInt(set.length, random32)]!)
    }
  }
  while (chars.length < options.length) chars.push(pool[randomInt(pool.length, random32)]!)
  // Fisher–Yates with the same unbiased source so required characters are not
  // always clustered at the start.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, random32)
    ;[chars[i], chars[j]] = [chars[j]!, chars[i]!]
  }
  return chars.slice(0, options.length).join('')
}

/** Shannon entropy of a random draw from the pool, in bits. */
export function entropyBits(options: PasswordOptions): number {
  const pool = buildPool(options)
  return Math.round(options.length * Math.log2(Math.max(pool.length, 1)) * 10) / 10
}

/** Coarse strength band from entropy bits — a heuristic, labelled as such in the UI. */
export function strengthBand(bits: number): 'weak' | 'fair' | 'strong' | 'very strong' {
  if (bits < 45) return 'weak'
  if (bits < 70) return 'fair'
  if (bits < 100) return 'strong'
  return 'very strong'
}

export function generateBatch(
  options: PasswordOptions,
  count: number,
  random32: () => number = defaultRandom32,
): string[] {
  const n = Math.max(0, Math.min(Math.floor(count) || 0, PASSWORD_MAX_BATCH))
  return Array.from({ length: n }, () => generatePassword(options, random32))
}
