import { beforeEach, describe, expect, it } from 'vitest'
import { CATEGORIES, findTool, searchTools, TOOLS } from '@/tools/registry'
import { prefs } from '@/lib/prefs'
import { MAX_INPUT_CHARS, assertInputSize, LimitError, WORKER_THRESHOLD_CHARS } from '@/lib/limits'

describe('registry', () => {
  it('has unique ids', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length)
  })

  it('assigns every tool a known category', () => {
    for (const tool of TOOLS) expect(CATEGORIES).toContain(tool.category)
  })

  it('exposes only lazy loaders, never imported components', () => {
    for (const tool of TOOLS) expect(typeof tool.load).toBe('function')
  })

  it('finds tools by id', () => {
    expect(findTool('json')?.name).toMatch(/JSON/)
    expect(findTool('nope')).toBeUndefined()
  })
})

describe('searchTools', () => {
  it('returns everything for a blank query', () => {
    expect(searchTools('')).toHaveLength(TOOLS.length)
  })

  it('matches names, keywords and descriptions case-insensitively', () => {
    expect(searchTools('JSON').map((t) => t.id)).toContain('json')
    expect(searchTools('base64').map((t) => t.id)).toContain('base64')
    expect(searchTools('CHECKSUM').map((t) => t.id)).toContain('hash')
    expect(searchTools('regexp').map((t) => t.id)).toContain('regex')
  })

  it('ranks a name hit above a description hit', () => {
    const hits = searchTools('uuid')
    expect(hits[0]!.id).toBe('uuid')
  })

  it('returns nothing for a nonsense query', () => {
    expect(searchTools('zzzzqqq')).toEqual([])
  })

  it('ANDs multiple terms', () => {
    expect(searchTools('url decode').map((t) => t.id)).toContain('url')
    expect(searchTools('uuid decode').map((t) => t.id)).not.toContain('uuid')
  })
})

describe('prefs', () => {
  beforeEach(() => {
    // localStorage does not exist under the node test environment; prefs
    // degrades to an in-memory copy, which is exactly the path this exercises.
    try {
      localStorage.removeItem('toolbox.prefs.v1')
    } catch {
      /* not available in node — fine */
    }
  })

  it('round-trips strings and numbers with defaults', () => {
    expect(prefs.getString('test.a', 'dflt')).toBe('dflt')
    prefs.setString('test.a', 'value')
    expect(prefs.getString('test.a')).toBe('value')
    prefs.setNumber('test.num', 3)
    expect(prefs.getNumber('test.num', 0)).toBe(3)
  })

  it('never stores tool input larger than the cap', () => {
    prefs.setString('test.b', 'x'.repeat(50_000))
    expect(prefs.getString('test.b').length).toBeLessThanOrEqual(4_000)
  })

  it('drops non-finite numbers', () => {
    prefs.setNumber('test.nan', Number.NaN)
    expect(prefs.getNumber('test.nan', 42)).toBe(42)
  })
})

describe('limits', () => {
  it('refuses oversized input with a typed error', () => {
    expect(() => assertInputSize('x'.repeat(MAX_INPUT_CHARS + 1))).toThrow(LimitError)
    expect(() => assertInputSize('ok')).not.toThrow()
  })

  it('keeps the worker threshold below the hard cap', () => {
    expect(WORKER_THRESHOLD_CHARS).toBeLessThan(MAX_INPUT_CHARS)
  })
})
