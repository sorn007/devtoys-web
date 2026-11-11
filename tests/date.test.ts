import { describe, expect, it } from 'vitest'
import { describeDate, exceedsSafeInteger, parseDateInput } from '@/tools/date'
import { formatBase, parseInBase, twosComplement, validateBaseInput } from '@/tools/numberbase'

describe('parseDateInput', () => {
  it('detects 10-digit values as Unix seconds', () => {
    const r = parseDateInput('1700000000')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.kind).toBe('unix-seconds')
      expect(r.millis).toBe(1700000000000)
    }
  })

  it('detects 13-digit values as Unix milliseconds', () => {
    const r = parseDateInput('1700000000123')
    expect(r.ok && r.kind).toBe('unix-millis')
    expect(r.ok && r.millis).toBe(1700000000123)
  })

  it('keeps microsecond precision beyond 2^53 via BigInt', () => {
    const micros = 1700000000123456 // 16 digits > MAX_SAFE_INTEGER
    const r = parseDateInput(String(micros))
    expect(r.ok && r.kind).toBe('unix-micros')
    if (r.ok) {
      // The naive Number path would round: millis must stay exact and the
      // sub-millisecond remainder must survive.
      expect(r.millis).toBe(1700000000123)
      expect(r.microsRemainder).toBe(456)
      const f = describeDate(r.millis, r.microsRemainder)
      expect(f.unixMicros).toBe('1700000000123456')
    }
  })

  it('converts .NET ticks with the 0001-01-01 epoch offset', () => {
    const epoch = parseDateInput('621355968000000000') // 1970-01-01 in .NET ticks
    expect(epoch.ok && epoch.kind).toBe('dotnet-ticks')
    expect(epoch.ok && epoch.millis).toBe(0)
    const later = parseDateInput('638355968000000000') // 2023-11-14T22:13:20Z
    expect(later.ok && later.millis).toBe(1700000000000)
  })

  it('rejects invalid calendar dates', () => {
    expect(parseDateInput('2026-02-30').ok).toBe(false)
    expect(parseDateInput('not a date').ok).toBe(false)
    expect(parseDateInput('').ok).toBe(false)
  })

  it('rejects absurdly large numbers', () => {
    expect(parseDateInput('123456789012345678901234567890').ok).toBe(false)
  })

  it('flags values beyond the safe-integer range', () => {
    expect(exceedsSafeInteger('9007199254740993')).toBe(true)
    expect(exceedsSafeInteger('123456789012345678')).toBe(true)
    expect(exceedsSafeInteger('1700000000')).toBe(false)
    expect(exceedsSafeInteger('2026-11-10')).toBe(false)
  })
})

describe('describeDate', () => {
  it('round-trips every epoch representation through one value', () => {
    const f = describeDate(1700000000123)
    expect(f.isoUtc).toBe('2023-11-14T22:13:20.123Z')
    expect(f.unixSeconds).toBe('1700000000')
    expect(f.unixMillis).toBe('1700000000123')
    expect(f.unixMicros).toBe('1700000000123000')
    // .NET ticks = unix microseconds × 10, offset from 0001-01-01
    expect(BigInt(f.dotnetTicks) - 621355968000000000n).toBe(17000000001230000n)
  })

  it('formats a local ISO string without throwing', () => {
    expect(describeDate(0).isoLocal).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}$/)
  })
})

describe('number base', () => {
  it('round-trips every base 2–36 for a large BigInt', () => {
    const value = 2n ** 127n - 1n // far beyond 2^53
    for (let base = 2; base <= 36; base++) {
      expect(parseInBase(formatBase(value, base), base)).toBe(value)
    }
  })

  it('converts the documented example', () => {
    expect(formatBase(parseInBase('255', 10), 16)).toBe('ff')
    expect(formatBase(parseInBase('255', 10), 8)).toBe('377')
    expect(formatBase(parseInBase('255', 10), 2)).toBe('11111111')
  })

  it('parses hexadecimal and uppercase input case-insensitively', () => {
    expect(parseInBase('ff', 16)).toBe(255n)
    expect(parseInBase('FF', 16)).toBe(255n)
    expect(parseInBase('-1A', 16)).toBe(-26n)
  })

  it('rejects digits outside the base and non-integers', () => {
    expect(validateBaseInput('9', 8)).toMatch(/valid base-8/)
    expect(validateBaseInput('1.5', 10)).toMatch(/integer/i)
    expect(validateBaseInput('', 10)).toMatch(/empty/)
    expect(validateBaseInput('0x1', 10)).toMatch(/valid base-10/)
    expect(validateBaseInput('11', 2)).toBeNull()
  })

  it('computes two’s complement across widths', () => {
    expect(twosComplement(-1n, 8)).toBe('FF')
    expect(twosComplement(-1n, 32)).toBe('FFFFFFFF')
    expect(twosComplement(127n, 8)).toBe('7F')
    expect(() => twosComplement(128n, 8)).toThrow(/does not fit/)
    expect(() => twosComplement(2n ** 63n, 64)).toThrow(/does not fit/)
  })
})
