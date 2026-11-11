import { describe, expect, it } from 'vitest'
import { compareLists } from '@/tools/listcompare'
import { jsonToTable, parseCsv, tableToCsv } from '@/tools/jsontable'

describe('compareLists', () => {
  const left = 'apple\nbanana\ncherry\n;drop'
  const right = 'Banana\ncherry\ndate\n;drop'

  it('computes every set operation exactly', () => {
    const r = compareLists(left, right, { trim: true })
    expect(r.intersection).toEqual(['cherry', ';drop'])
    expect(r.onlyLeft).toEqual(['apple', 'banana'])
    expect(r.onlyRight).toEqual(['Banana', 'date'])
    expect(r.symmetricDiff).toEqual(['apple', 'banana', 'Banana', 'date'])
    expect(r.union).toEqual(['apple', 'banana', 'cherry', ';drop', 'Banana', 'date'])
    expect(r.leftUnique).toBe(2)
    expect(r.rightUnique).toBe(2)
  })

  it('is case-insensitive when asked, keeping first-seen spelling', () => {
    const r = compareLists(left, right, { trim: true, ignoreCase: true })
    expect(r.intersection).toEqual(['banana', 'cherry', ';drop'])
    expect(r.onlyLeft).toEqual(['apple'])
    expect(r.onlyRight).toEqual(['date'])
  })

  it('collapses duplicates but reports honest counts', () => {
    const r = compareLists('a\na\nb', 'a\na')
    expect(r.leftCount).toBe(2)
    expect(r.rightCount).toBe(1)
    expect(r.union).toEqual(['a', 'b'])
  })

  it('trims only when the toggle is on', () => {
    expect(compareLists('  a  ', 'a', {}).intersection).toEqual([])
    expect(compareLists('  a  ', 'a', { trim: true }).intersection).toEqual(['a'])
  })

  it('handles unicode text and empty sides', () => {
    const r = compareLists('héllo\n🙂', '')
    expect(r.onlyLeft).toEqual(['héllo', '🙂'])
    expect(compareLists('', '').union).toEqual([])
  })
})

describe('jsonToTable', () => {
  it('builds a table with a consistent column order across ragged rows', () => {
    const t = jsonToTable('[{"b":2,"a":1},{"a":3,"c":4}]')
    expect(t.headers).toEqual(['b', 'a', 'c'])
    expect(t.rows).toEqual([
      ['2', '1', ''],
      ['', '3', '4'],
    ])
  })

  it('accepts a single object and stringifies nested values losslessly', () => {
    const t = jsonToTable('{"name":"Ada","tags":["x","y"],"meta":{"k":1}}')
    expect(t.totalRows).toBe(1)
    expect(t.rows[0]).toEqual(['Ada', '["x","y"]', '{"k":1}'])
  })

  it('rejects non-tabular JSON with a real error', () => {
    expect(() => jsonToTable('[1,2,3]')).toThrow(/array of objects/i)
    expect(() => jsonToTable('"just a string"')).toThrow(/array of objects/i)
    expect(() => jsonToTable('{invalid')).toThrow()
    expect(() => jsonToTable('')).toThrow(/empty/i)
  })

  it('reports truncation instead of silently rendering everything', () => {
    const big = JSON.stringify(Array.from({ length: 1500 }, (_, i) => ({ i })))
    const t = jsonToTable(big)
    expect(t.truncated).toBe(true)
    expect(t.totalRows).toBe(1500)
    expect(t.rows).toHaveLength(1000)
  })

  it('renders null, missing and undefined cells distinctly and honestly', () => {
    const t = jsonToTable('[{"a":null,"b":1}]')
    expect(t.rows[0]![0]).toBe('null')
    const ragged = jsonToTable('[{"a":1},{"b":2}]')
    expect(ragged.rows).toEqual([['1', ''], ['', '2']])
  })
})

describe('tableToCsv (RFC 4180)', () => {
  const tricky = jsonToTable('[{"q":"say \\"hi\\"","c":"a,b","nl":"line1\\nline2","f":"=SUM(A1)"}]')

  it('quotes fields containing delimiters, quotes, CR and LF, doubling quotes', () => {
    const csv = tableToCsv(tricky, { safeExport: false })
    expect(csv).toBe('q,c,nl,f\r\n"say ""hi""","a,b","line1\nline2",=SUM(A1)\r\n')
    // Round-trip through the parser: values survive byte-faithfully.
    const parsed = parseCsv(csv)
    expect(parsed[0]).toEqual(['q', 'c', 'nl', 'f'])
    expect(parsed[1]).toEqual(['say "hi"', 'a,b', 'line1\nline2', '=SUM(A1)'])
  })

  it('neutralises formula-injection prefixes in safe mode (default ON)', () => {
    const safe = tableToCsv(tricky)
    expect(safe).toContain("'=SUM(A1)")
    const raw = tableToCsv(tricky, { safeExport: false })
    expect(raw).toContain('=SUM(A1)')
    // The safe transform must not corrupt ordinary values.
    expect(parseCsv(safe)[1]![0]).toBe('say "hi"')
  })

  it('prefixes every documented dangerous prefix character', () => {
    const t = jsonToTable('[{"a":"=cmd","b":"+1","c":"-2","d":"@x","e":"\\tz"}]')
    const csv = tableToCsv(t)
    expect(csv).toContain("'=cmd")
    expect(csv).toContain("'+1")
    expect(csv).toContain("'-2")
    expect(csv).toContain("'@x")
    expect(csv).toContain("'\tz")
  })

  it('supports LF-only endings, TSV and semicolon delimiters without quoting damage', () => {
    const t = jsonToTable('[{"a":"x,y","b":"z"}]')
    expect(tableToCsv(t, { crlf: false })).toBe('a,b\n"x,y",z\n')
    expect(tableToCsv(t, { delimiter: ';' })).toBe('a;b\r\nx,y;z\r\n')
    expect(tableToCsv(t, { delimiter: '\t', safeExport: false })).toBe('a\tb\r\nx,y\tz\r\n')
  })

  it('round-trips a larger generated table losslessly in raw mode', () => {
    const rows = Array.from({ length: 200 }, (_, i) => ({ id: i, note: `note,${i} "q"`, f: `=${i}` }))
    const t = jsonToTable(JSON.stringify(rows))
    const csv = tableToCsv(t, { safeExport: false })
    const parsed = parseCsv(csv)
    expect(parsed).toHaveLength(201)
    expect(parsed[200]).toEqual(['199', 'note,199 "q"', '=199'])
  })
})
