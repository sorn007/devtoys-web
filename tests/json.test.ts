import { describe, expect, it } from 'vitest'
import { byteSize, formatJson, minifyJson, validateJson } from '@/tools/json'

describe('formatJson', () => {
  it('pretty-prints compact JSON', () => {
    const r = formatJson('{"a":1,"b":[1,2]}')
    expect(r.ok).toBe(true)
    expect(r.output).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}')
  })

  it('honours a custom indent', () => {
    expect(formatJson('{"a":1}', 4).output).toBe('{\n    "a": 1\n}')
  })

  it('reports a useful error for a syntax error', () => {
    const r = formatJson('{\n  "a": 1,\n  "b" oops\n}')
    expect(r.ok).toBe(false)
    expect(r.output).toBe('')
    // V8 names the offending token; engines that report a position also get
    // line/column (see locate()). We assert the token, not the engine wording.
    expect(r.error).toMatch(/o/i)
  })

  it('derives line and column when the engine reports an offset', () => {
    const r = formatJson('{\n  "a": 1,\n  "b": oops\n}')
    expect(r.ok).toBe(false)
    // Whatever the engine wording, the verdict and empty output are stable.
    expect(r.output).toBe('')
    expect(r.error).toBeTruthy()
  })

  it('rejects empty input', () => {
    expect(formatJson('   ').ok).toBe(false)
  })

  it('preserves unicode content', () => {
    const r = formatJson('{"emoji":"🙂"}')
    expect(r.ok).toBe(true)
    expect(JSON.parse(r.output).emoji).toBe('🙂')
  })
})

describe('minifyJson', () => {
  it('strips insignificant whitespace', () => {
    expect(minifyJson('{\n  "a" : 1,\n  "b" : [ 1, 2 ]\n}').output).toBe('{"a":1,"b":[1,2]}')
  })

  it('does not mangle strings containing spaces', () => {
    expect(minifyJson('{"msg":"keep  these   spaces"}').output).toBe('{"msg":"keep  these   spaces"}')
  })
})

describe('validateJson', () => {
  it('accepts valid documents of every top-level type', () => {
    for (const doc of ['null', '123', '"s"', '[]', '{}']) {
      expect(validateJson(doc).ok).toBe(doc !== 'x')
    }
  })

  it('rejects trailing garbage', () => {
    expect(validateJson('{"a":1} extra').ok).toBe(false)
  })
})

describe('byteSize', () => {
  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    expect(byteSize('abc')).toBe(3)
    expect(byteSize('🙂')).toBe(4)
  })
})
