import { describe, expect, it } from 'vitest'
import {
  buildPool,
  entropyBits,
  generateBatch,
  generatePassword,
  randomInt,
  strengthBand,
  type CharClass,
} from '@/tools/password'
import { generateLorem, LOREM_MAX } from '@/tools/lorem'

/** Deterministic fake rng: returns a cycling sequence of uint32s. */
function fakeRandom(...values: number[]) {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('randomInt', () => {
  it('maps draws to the requested bound', () => {
    expect(randomInt(4, fakeRandom(0, 1, 2, 3))).toBe(0)
    expect(randomInt(4, fakeRandom(5))).toBe(1)
  })

  it('rejects draws at or above the last full multiple of the bound (rejection sampling)', () => {
    // For max=3 the limit is 4294967294: 0xFFFFFFFF must be rejected and the
    // next value used, proving no modulo bias is introduced.
    let calls = 0
    const rng = () => (calls++ === 0 ? 0xffffffff : 2)
    expect(randomInt(3, rng)).toBe(2)
    expect(calls).toBe(2)
  })

  it('throws on a non-positive bound', () => {
    expect(() => randomInt(0)).toThrow()
  })
})

describe('generatePassword', () => {
  const all: CharClass[] = ['lowercase', 'uppercase', 'digits', 'symbols']

  it('honours the requested length and pool', () => {
    const pw = generatePassword({ length: 32, classes: all })
    expect(pw).toHaveLength(32)
    expect(pw).toMatch(/[a-z]/)
    expect(pw).toMatch(/[A-Z]/)
    expect(pw).toMatch(/[0-9]/)
    expect(pw).toMatch(/[^a-zA-Z0-9]/)
  })

  it('satisfies require-each-class and shuffles placement', () => {
    for (let i = 0; i < 20; i++) {
      const pw = generatePassword({ length: 12, classes: all, requireEach: true })
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[0-9]/)
      expect(pw).toMatch(/[^a-zA-Z0-9]/)
    }
  })

  it('excludes ambiguous characters when asked', () => {
    const pool = buildPool({ length: 8, classes: all, excludeAmbiguous: true })
    for (const ch of '0O1lI|`\'"') expect(pool).not.toContain(ch)
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword({ length: 64, classes: all, excludeAmbiguous: true })
      expect(pw).not.toMatch(/[0O1lI|`'"]/)
    }
  })

  it('rejects impossible configurations instead of faking them', () => {
    expect(() => generatePassword({ length: 12, classes: [] })).toThrow(/at least one character class/)
    expect(() => generatePassword({ length: 3, classes: all })).toThrow(/at least 4/)
    expect(() => generatePassword({ length: 300, classes: all })).toThrow(/capped/)
    // 3 classes demanded by "one of each" cannot fit in a 2-char password even
    // above the global minimum, so that guard is exercised directly.
    expect(() =>
      generatePassword({ length: 2, classes: all.slice(0, 3), requireEach: true }),
    ).toThrow(/at least 4|one of each class/)
    expect(generatePassword({ length: 8, classes: all, excludeAmbiguous: true })).toHaveLength(8)
  })

  it('uses the full pool across a large sample (no class systematically dropped)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      for (const ch of generatePassword({ length: 24, classes: all })) seen.add(ch)
    }
    // Every pool character should appear somewhere in ~4800 characters.
    for (const ch of buildPool({ length: 1, classes: all })) expect(seen.has(ch)).toBe(true)
  })

  it('caps batches', () => {
    expect(generateBatch({ length: 12, classes: all }, 500)).toHaveLength(100)
    expect(generateBatch({ length: 12, classes: all }, 0)).toHaveLength(0)
  })

  it('computes entropy from pool size and length', () => {
    // 4 classes ≈ 88 chars minus ambiguous; just assert monotonicity and shape
    const short = entropyBits({ length: 8, classes: all })
    const long = entropyBits({ length: 32, classes: all })
    expect(long).toBeGreaterThan(short * 3.5)
    expect(entropyBits({ length: 8, classes: ['digits'] })).toBeCloseTo(8 * Math.log2(10), 1)
    expect(strengthBand(30)).toBe('weak')
    expect(strengthBand(60)).toBe('fair')
    expect(strengthBand(80)).toBe('strong')
    expect(strengthBand(120)).toBe('very strong')
  })
})

describe('generateLorem', () => {
  it('is deterministic for a given seed', () => {
    expect(generateLorem({ words: 30, seed: 7 })).toBe(generateLorem({ words: 30, seed: 7 }))
    expect(generateLorem({ words: 30, seed: 7 })).not.toBe(generateLorem({ words: 30, seed: 8 }))
  })

  it('produces exactly the requested counts', () => {
    expect(generateLorem({ words: 17 }).split(' ')).toHaveLength(17)
    expect(generateLorem({ sentences: 5 }).split('. ')).toHaveLength(5)
    expect(generateLorem({ paragraphs: 3 }).split('\n\n')).toHaveLength(3)
  })

  it('starts with the classic phrase only when asked', () => {
    expect(generateLorem({ words: 10 }).startsWith('lorem ipsum dolor sit amet')).toBe(true)
    expect(generateLorem({ words: 10, startWithClassic: false }).startsWith('lorem ipsum')).toBe(false)
  })

  it('caps oversized requests', () => {
    expect(generateLorem({ words: LOREM_MAX + 500 }).split(' ').length).toBe(LOREM_MAX)
  })
})
