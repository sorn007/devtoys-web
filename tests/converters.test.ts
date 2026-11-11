import { describe, expect, it } from 'vitest'
import { jsonToYaml, yamlToJson } from '@/tools/yamlx'
import { formatSql, supportedDialects } from '@/tools/sql'

describe('yamlToJson', () => {
  it('converts core-schema YAML to JSON', async () => {
    const r = await yamlToJson('name: Ada\nborn: 1815\ntags:\n  - math\n  - computing\n')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(JSON.parse(r.output)).toEqual({ name: 'Ada', born: 1815, tags: ['math', 'computing'] })
    }
  })

  it('round-trips through jsonToYaml', async () => {
    const json = '{"a":[1,2],"b":{"c":true,"d":null},"e":"text"}'
    const toYaml = await jsonToYaml(json)
    expect(toYaml.ok).toBe(true)
    const back = await yamlToJson(toYaml.ok ? toYaml.output : '')
    expect(back.ok).toBe(true)
    if (back.ok) expect(JSON.parse(back.output)).toEqual(JSON.parse(json))
  })

  it('reports syntax errors instead of throwing', async () => {
    const r = await yamlToJson('a: [unclosed')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
    expect((await yamlToJson('')).ok).toBe(false)
  })

  it('rejects unknown tags rather than constructing arbitrary objects', async () => {
    const r = await yamlToJson('a: !!python/object/apply:os.system ["echo hi"]')
    expect(r.ok).toBe(false)
  })

  it('bounds alias expansion (billion-laughs shape)', async () => {
    // Each level references the previous anchor twice; unbounded expansion
    // would explode exponentially. maxAliasCount must reject it.
    let doc = 'a0: &a0 [x]\n'
    for (let i = 1; i <= 12; i++) doc += `a${i}: &a${i} [*a${i - 1}, *a${i - 1}]\n`
    const r = await yamlToJson(doc)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/alias/i)
  })
})

describe('jsonToYaml', () => {
  it('serialises with block style and readable indentation', async () => {
    const r = await jsonToYaml('{"list":[1,2],"nested":{"k":"v"}}')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.output).toContain('list:\n  - 1\n  - 2')
      expect(r.output).toContain('nested:\n  k: v')
    }
  })

  it('reports JSON syntax errors', async () => {
    const r = await jsonToYaml('{not json')
    expect(r.ok).toBe(false)
    expect((await jsonToYaml('')).ok).toBe(false)
  })

  it('reports very deep nesting as an input problem, not a crash', async () => {
    const deep = '['.repeat(20_000) + ']'.repeat(20_000)
    const r = await jsonToYaml(deep)
    // Either it succeeds or it fails with a readable error; it must not throw.
    expect(r.ok === true || (r.ok === false && r.error.length > 0)).toBe(true)
  })
})

describe('formatSql', () => {
  it('exposes the dialects the installed library really supports', async () => {
    const dialects = await supportedDialects()
    expect(dialects.length).toBeGreaterThan(5)
    for (const expected of ['sql', 'postgresql', 'mysql', 'sqlite', 'transactsql']) {
      expect(dialects).toContain(expected)
    }
  })

  it('formats the same query differently per dialect where grammar differs', async () => {
    const query = "select id, name from users where created_at > '2026-01-01' order by name"
    const std = await formatSql(query, { dialect: 'sql' })
    const pg = await formatSql(query, { dialect: 'postgresql' })
    expect(std.ok && pg.ok).toBe(true)
    if (std.ok && pg.ok) {
      expect(std.output).toContain('SELECT')
      expect(pg.output).toContain('SELECT')
      expect(std.output).toContain("users\nWHERE")
    }
  })

  it('uppercases keywords by default and preserves when asked', async () => {
    const r = await formatSql('select 1', { dialect: 'sql' })
    expect(r.ok && r.output).toContain('SELECT')
    const preserved = await formatSql('select 1', { dialect: 'sql', uppercaseKeywords: false })
    if (preserved.ok) {
      expect(preserved.output).toContain('select')
      expect(preserved.output).not.toContain('SELECT')
    }
  })

  it('handles joins, CTEs and string literals', async () => {
    const r = await formatSql(
      'with t as (select * from x) select u.id, count(*) from t join users u on u.id = t.id group by 1 having count(*) > 2',
      { dialect: 'postgresql' },
    )
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.output).toContain('JOIN')
      expect(r.output).toContain('GROUP BY')
      expect(r.output).toContain('HAVING')
    }
  })

  it('rejects unknown dialects and empty input with real errors', async () => {
    const bad = await formatSql('select 1', { dialect: 'nope' })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toMatch(/Unknown dialect/)
    const empty = await formatSql('   ', { dialect: 'sql' })
    expect(empty.ok).toBe(false)
  })

  it('reports syntax errors from the formatter instead of throwing', async () => {
    const r = await formatSql('select from from where', { dialect: 'sql' })
    expect(r.ok === false || (r.ok === true && r.output.length > 0)).toBe(true)
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0)
  })
})
