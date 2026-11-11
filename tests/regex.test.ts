import { describe, expect, it } from 'vitest'
import { hasReDoSRisk, runRegex } from '@/tools/regex'

describe('runRegex', () => {
  it('finds matches with the g flag and reports indices', () => {
    const r = runRegex('\\d+', 'g', 'a 12 b 345', null)
    expect(r.ok).toBe(true)
    expect(r.matches.map((m) => m.text)).toEqual(['12', '345'])
    expect(r.matches[1]!.index).toBe(7)
    expect(r.matches[1]!.end).toBe(10)
  })

  it('returns a single match without g', () => {
    const r = runRegex('\\d+', '', 'a 12 b 345', null)
    expect(r.matches).toHaveLength(1)
  })

  it('captures named and positional groups', () => {
    const r = runRegex('(?<year>\\d{4})-(?<month>\\d{2})', '', '2024-06', null)
    const names = Object.fromEntries(r.matches[0]!.groups.map((g) => [g.name, g.value]))
    expect(names['year']).toBe('2024')
    expect(names['month']).toBe('06')
    expect(names['$1']).toBe('2024')
    expect(names['$2']).toBe('06')
  })

  it('reports invalid patterns as an error, not a throw', () => {
    const r = runRegex('(unclosed', '', 'x', null)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/Invalid regular expression|Unterminated|Unexpected/i)
  })

  it('requires a pattern', () => {
    expect(runRegex('', 'g', 'x', null).error).toBe('Enter a pattern.')
  })

  it('supports the m and s flags', () => {
    expect(runRegex('^b$', 'm', 'a\nb\nc', null).matches).toHaveLength(1)
    expect(runRegex('a.b', 's', 'a\nb', null).matches).toHaveLength(1)
    expect(runRegex('a.b', '', 'a\nb', null).matches).toHaveLength(0)
  })

  it('advances past zero-length matches instead of hanging', () => {
    const r = runRegex('x*', 'g', 'aaaa', null)
    expect(r.ok).toBe(true)
    expect(r.matches.length).toBeLessThanOrEqual(5000)
  })

  it('caps the number of matches', () => {
    const r = runRegex('a', 'g', 'a'.repeat(20_000), null)
    expect(r.truncated).toBe(true)
    expect(r.matches.length).toBeLessThanOrEqual(5000)
  })

  it('applies replacements including group references', () => {
    const r = runRegex('(\\w+)@(\\w+\\.com)', 'g', 'mail: bob@example.com', '<$1 at $2>')
    expect(r.replaced).toBe('mail: <bob at example.com>')
  })

  it('truncates enormous replace output instead of freezing the tab', () => {
    const r = runRegex('a', 'g', 'a'.repeat(50), 'x'.repeat(60_000), )
    expect(r.replacedTruncated).toBe(true)
  })
})

describe('hasReDoSRisk', () => {
  it('flags nested quantifiers', () => {
    expect(hasReDoSRisk('(a+)+')).toBe(true)
    expect(hasReDoSRisk('(a*)*')).toBe(true)
  })

  it('does not flag ordinary patterns', () => {
    expect(hasReDoSRisk('^\\d{3}-\\d{4}$')).toBe(false)
    expect(hasReDoSRisk('[a-z]+@[a-z]+\\.com')).toBe(false)
  })
})
