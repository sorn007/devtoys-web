import { describe, expect, it } from 'vitest'
import { describeCron, nextRuns, parseCron, CRON_MAX_SEARCH_STEPS } from '@/tools/cron'
import { claimViews, decodeJwt } from '@/tools/jwt'
import { runJsonPath } from '@/tools/jsonpath'
import { bytesToBase64, utf8Encode } from '@/lib/base64'

const STORE = JSON.stringify({
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
    ],
    bicycle: { color: 'red', price: 19.95 },
  },
})

describe('cron parsing', () => {
  it('accepts 5-field, 6-field and macro expressions', () => {
    expect(parseCron('*/15 9-17 * * 1-5').fields).toHaveLength(5)
    expect(parseCron('0 */2 * * * *').hasSeconds).toBe(true)
    expect(parseCron('@daily').macros).toBe('@daily')
    expect(parseCron('@daily').fields).toHaveLength(5)
  })

  it('rejects invalid expressions with specific errors', () => {
    expect(() => parseCron('61 * * * *')).toThrow(/out of range/)
    expect(() => parseCron('* 25 * * *')).toThrow(/out of range/)
    expect(() => parseCron('* * * 13 *')).toThrow(/out of range/)
    expect(() => parseCron('* * * * 8')).toThrow(/out of range/)
    expect(() => parseCron('*/0 * * * *')).toThrow(/step/)
    expect(() => parseCron('a * * * *')).toThrow(/not a valid value/)
    expect(() => parseCron('* * * * * * *')).toThrow(/5 or 6/)
    expect(() => parseCron('')).toThrow()
  })

  it('supports names, ranges, lists and steps', () => {
    const parsed = parseCron('0 0 1 JAN-MAR MON,FRI')
    expect(parsed.fields[3]!.allowed).toEqual(new Set([1, 2, 3]))
    expect(parsed.fields[4]!.allowed).toEqual(new Set([1, 5]))
    expect(parseCron('*/10 * * * *').fields[0]!.allowed.size).toBe(6)
  })

  it('describes fields in English', () => {
    const lines = describeCron(parseCron('30 8 * * MON-FRI'))
    expect(lines.join(' ')).toMatch(/minutes: only 30/)
    expect(lines.join(' ')).toMatch(/day of week: from monday to friday/)
    expect(describeCron(parseCron('* * * * *')).join(' ')).toContain('every')
  })
})

describe('cron next runs', () => {
  // Fixed instant so assertions are deterministic: 2026-11-10T09:07:30Z (a Tuesday).
  const FROM = Date.UTC(2026, 10, 10, 9, 7, 30)

  it('finds the next */15 run in UTC', () => {
    const r = nextRuns(parseCron('*/15 * * * *'), 3, 'UTC', FROM)
    expect(r.exhausted).toBe(false)
    expect(r.runs).toEqual(['2026-11-10T09:15:00.000Z', '2026-11-10T09:30:00.000Z', '2026-11-10T09:45:00.000Z'])
  })

  it('respects hours and weekdays', () => {
    // 09:07:30 on a Tuesday: today's 09:00 already passed, so the next weekday 09:00 is Wednesday.
    const r = nextRuns(parseCron('0 9 * * MON-FRI'), 1, 'UTC', FROM)
    expect(r.runs[0]).toBe('2026-11-11T09:00:00.000Z')
    const nextDay = nextRuns(parseCron('0 9 * * SAT'), 1, 'UTC', FROM)
    expect(nextDay.runs[0]).toBe('2026-11-14T09:00:00.000Z') // following Saturday
  })

  it('handles 6-field expressions with seconds', () => {
    // Every minute at :30 seconds: the next one after 09:07:30 is 09:08:30.
    const r = nextRuns(parseCron('30 */1 * * * *'), 2, 'UTC', FROM)
    expect(r.runs[0]).toBe('2026-11-10T09:08:30.000Z')
    expect(r.runs[1]).toBe('2026-11-10T09:09:30.000Z')
  })

  it('honours a non-UTC timezone', () => {
    // 09:07 UTC is 10:07 in Berlin (CET, +1); the next :00 Berlin minute is 10:00 UTC.
    const r = nextRuns(parseCron('0 * * * *'), 1, 'Europe/Berlin', FROM)
    expect(r.runs[0]).toBe('2026-11-10T10:00:00.000Z')
  })

  it('gives up within a bounded search instead of looping forever', () => {
    // February 30th never exists — impossible day-of-month.
    const r = nextRuns(parseCron('0 0 30 2 *'), 1, 'UTC', FROM)
    expect(r.exhausted).toBe(true)
    expect(r.runs).toEqual([])
    expect(CRON_MAX_SEARCH_STEPS).toBeLessThan(500_000)
  })

  it('ORs day-of-month and day-of-week when both are restricted (standard cron)', () => {
    // From Tue 2026-11-10: dom=15 or dow=MON → Mon 16th comes before the 15th? No: 15th (Sun) < 16th (Mon).
    const r = nextRuns(parseCron('0 0 15 * 1'), 1, 'UTC', FROM)
    expect(r.runs[0]).toBe('2026-11-15T00:00:00.000Z') // Sunday the 15th matches dow=MON? No — dom=15 matches.
  })
})

describe('jwt decode (never verifies)', () => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '')
  const payload = btoa(JSON.stringify({ sub: '12345', exp: 4102444800, iat: 1700000000 }))
    .replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '')

  it('decodes header and payload without touching the signature', () => {
    const d = decodeJwt(`${header}.${payload}.sig-not-checked`)
    expect(d.header.alg).toBe('HS256')
    expect(d.payload.sub).toBe('12345')
    expect(d.signaturePresent).toBe(true)
    expect(d.segments).toBe(3)
  })

  it('accepts a token without a signature segment but flags unsigned alg', () => {
    const none = btoa(JSON.stringify({ alg: 'none' })).replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '')
    const d = decodeJwt(`${none}.${payload}`)
    expect(d.signaturePresent).toBe(false)
    expect(d.warnings.join(' ')).toMatch(/alg is "none"/)
  })

  it('expands registered date claims and flags expiry', () => {
    const exp = btoa(JSON.stringify({ exp: 1000000000 })).replaceAll('+', '-').replaceAll('/', '_').replaceAll(/=+$/g, '')
    const d = decodeJwt(`${header}.${exp}.x`)
    const rows = claimViews(d.payload, 1700000000000)
    expect(rows[0]!.human).toBe('2001-09-09T01:46:40.000Z')
    expect(rows[0]!.state).toBe('expired')
    const future = claimViews({ nbf: 4102444800 }, 1700000000000)
    expect(future[0]!.state).toBe('not-yet')
  })

  it('rejects malformed tokens with specific errors', () => {
    expect(() => decodeJwt('')).toThrow()
    expect(() => decodeJwt('not-a-jwt')).toThrow(/2 or 3/)
    expect(() => decodeJwt('!!!.???')).toThrow(/base64url/)
  })

  it('contains no verification logic — decoding a tampered token still succeeds', () => {
    const d = decodeJwt(`${header}.${payload}.tampered`)
    expect(d.payload.sub).toBe('12345') // decode-only: we assert we did NOT "fail" it
  })
})

describe('jwt decode (UTF-8 payload)', () => {
  // Tokens are built with the shared UTF-8 → base64url pipeline: btoa() on a
  // JSON.stringify of non-ASCII text would only ever produce mojibake.
  const segment = (claims: Record<string, unknown>) => bytesToBase64(utf8Encode(JSON.stringify(claims)), true)
  const header = segment({ alg: 'HS256', typ: 'JWT' })
  const payload = segment({ name: 'สมชาย', e: '😀' })

  it('decodes Thai and emoji claims as real strings, not mojibake', () => {
    const d = decodeJwt(`${header}.${payload}.sig-not-checked`)
    expect(d.payload.name).toBe('สมชาย')
    expect(d.payload.e).toBe('😀')
    expect(d.payload.name).not.toContain('�') // and not 'à¸ª…' Latin-1 junk
  })

  it('shows Thai and emoji in claimViews raw strings', () => {
    const rows = claimViews(decodeJwt(`${header}.${payload}`).payload)
    expect(rows.find((r) => r.key === 'name')!.raw).toBe('สมชาย')
    expect(rows.find((r) => r.key === 'e')!.raw).toBe('😀')
  })

  it('keeps Thai inside nested claim objects intact', () => {
    const nested = segment({ user: { name: 'สมชาย', mood: '😀' } })
    const rows = claimViews(decodeJwt(`${header}.${nested}.x`).payload)
    const raw = rows.find((r) => r.key === 'user')!.raw
    expect(raw).toContain('สมชาย')
    expect(raw).toContain('😀')
  })

  it('still rejects invalid segments and non-JSON payloads with the same errors', () => {
    expect(() => decodeJwt(`${header}.!!!.?`)).toThrow(/base64url/)
    // Valid base64url of bytes that are not JSON (raw 0xff 0xfe).
    expect(() => decodeJwt(`${header}.__8.`)).toThrow(/does not contain JSON/)
    expect(() => decodeJwt(`${header}.WyJhcnJheSJd.x`)).toThrow(/not a JSON object/)
  })
})

describe('jsonpath (in-house safe engine)', () => {
  const paths = (q: string) => runJsonPath(q, STORE)
  /** Match values for a query that must succeed; throws (failing the test) if not. */
  const values = (q: string): unknown[] => {
    const r = runJsonPath(q, STORE)
    if (!r.ok) throw new Error(`Query ${q} unexpectedly failed: ${r.error}`)
    return r.matches.map((m) => m.value)
  }
  const one = (q: string): unknown => values(q)[0]

  it('resolves dot paths, wildcards and indexes', () => {
    expect(one('$.store.bicycle.color')).toBe('red')
    expect(one('$.store.book[2].title')).toBe('Moby Dick')
    expect(one('$.store.book[-1].title')).toBe('Moby Dick')
    expect(values('$.store.book[*].title')).toEqual(['Sayings of the Century', 'Sword of Honour', 'Moby Dick'])
    expect(values('$.store.*')).toHaveLength(2)
  })

  it('supports quoted names, unions and slices', () => {
    expect(one("$['store']['bicycle']['price']")).toBe(19.95)
    expect(values('$.store.book[0,2].title')).toEqual(['Sayings of the Century', 'Moby Dick'])
    expect(values('$.store.book[1:].title')).toEqual(['Sword of Honour', 'Moby Dick'])
    expect(values('$.store.book[::2].title')).toEqual(['Sayings of the Century', 'Moby Dick'])
  })

  it('supports descendant selectors', () => {
    expect(values('$..price')).toEqual([8.95, 12.99, 8.99, 19.95])
    expect(values('$..isbn')).toEqual(['0-553-21311-3'])
  })

  it('supports filters with comparisons, logic, regex and existence', () => {
    expect(values('$.store.book[?(@.price < 10)].title')).toEqual(['Sayings of the Century', 'Moby Dick'])
    expect(values('$.store.book[?(@.category == "fiction")].title')).toEqual(['Sword of Honour', 'Moby Dick'])
    expect(values('$.store.book[?(@.price > 8 && @.price < 12)].title')).toEqual(['Sayings of the Century', 'Moby Dick'])
    expect(values('$.store.book[?(@.isbn)].title')).toEqual(['Moby Dick'])
    expect(values('$.store.book[?(@.title =~ /of/i)].title')).toEqual(['Sayings of the Century', 'Sword of Honour'])
    expect(values('$.store.book[?(!@.isbn)].title')).toEqual(['Sayings of the Century', 'Sword of Honour'])
  })

  it('reports errors for unsupported or malformed queries instead of guessing', () => {
    expect(paths('book[0]').ok).toBe(false)
    expect(paths('$[(@.length-1)]').ok).toBe(false) // script expressions rejected by design
    expect(paths('$.store.book[?(@.price <)]').ok).toBe(false)
    expect(paths('$.store.book[99:0:0]').ok).toBe(false) // zero step slice
    expect(runJsonPath('', STORE).ok).toBe(false)
    // The `paths` helper always binds the valid fixture, so the bad-JSON case
    // calls the engine directly — the error must come from parsing the input.
    expect(runJsonPath('$', '{bad json').ok).toBe(false)
  })

  it('returns zero matches quietly for valid but unmatching queries', () => {
    const r = paths('$.store.car')
    if (!r.ok) throw new Error(r.error)
    expect(r.count).toBe(0)
  })

  it('caps results instead of rendering unbounded output', () => {
    const wide = JSON.stringify(Array.from({ length: 9_000 }, (_, i) => ({ i })))
    const r = runJsonPath('$[*]', wide)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.truncated).toBe(true)
      expect(r.count).toBe(5_000)
    }
  })
})
