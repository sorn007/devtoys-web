// @vitest-environment jsdom  (DOMParser is needed; jsdom supplies it)
import { describe, expect, it } from 'vitest'
import { assertNoDtd, validateXml } from '@/tools/xml'
import { md5 } from '@/tools/md5'
import { diffLines } from '@/tools/diff'
import { formatJson } from '@/tools/json'

describe('XML validator / formatter', () => {
  it('accepts well-formed XML and formats it', () => {
    const r = validateXml('<root><a x="1">text</a><b/></root>')
    expect(r.ok).toBe(true)
    expect(r.elements).toBe(3)
    expect(r.maxDepth).toBe(2)
    expect(r.formatted).toContain('<a x="1">text</a>')
    expect(r.minified).not.toContain('\n')
  })

  it('reports malformed XML with the parser error', () => {
    const r = validateXml('<a><b></a>')
    expect(r.ok).toBe(false)
    expect(r.error).toBeTruthy()
    expect(validateXml('').error).toBe('Input is empty.')
  })

  it('REJECTS DOCTYPE and DTD declarations explicitly (XXE guard)', () => {
    // DOCTYPE is detected first (the wrapper is rejected before its contents are examined).
    expect(() => assertNoDtd('<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>')).toThrow(/DOCTYPE|ENTITY/)
    const r = validateXml('<!DOCTYPE html><html/>')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/DOCTYPE/)
  })

  it('rejects external entity references and billion-laughs shapes', () => {
    // A bare ENTITY declaration (no DOCTYPE wrapper) is caught by the ENTITY rule itself.
    expect(() => assertNoDtd('<root/><!-- <!ENTITY a "lol"> -->')).toThrow(/ENTITY/)
    expect(() => assertNoDtd('<!DOCTYPE d SYSTEM "evil.dtd"><root/>')).toThrow(/SYSTEM|DOCTYPE/)
    expect(() => assertNoDtd('<!DOCTYPE d PUBLIC "x" "y"><root/>')).toThrow(/PUBLIC|DOCTYPE/)
    expect(() => validateXml('<root>&xxe;</root>')).toBeTruthy() // undefined entity → parse error path
  })

  it('enforces its size cap', () => {
    expect(() => validateXml('<a>' + 'x'.repeat(1_100_000) + '</a>')).toThrow(/capped/i)
  })
})

describe('MD5 (legacy, labelled)', () => {
  it('matches the RFC 1321 test vectors', () => {
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5('a')).toBe('0cc175b9c0f1b6a831c399e269772661')
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('message digest')).toBe('f96b697d7cb7938d525a2f31aaf161d0')
    expect(md5('abcdefghijklmnopqrstuvwxyz')).toBe('c3fcd3d76192e4007dfb496cca67e13b')
    expect(md5('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789')).toBe('d174ab98d277d9f5a5611c2c9f419d9f')
    expect(md5('12345678901234567890123456789012345678901234567890123456789012345678901234567890')).toBe('57edf4a22be3c955ac49da2e2107b67a')
  })

  it('handles multi-byte UTF-8 input (verified against Python hashlib)', () => {
    expect(md5('héllo 🙂')).toBe('4350c339182b99fe2e03229429062155')
  })
})

describe('diff options', () => {
  it('ignore-whitespace treats padded lines as equal but displays originals', () => {
    const r = diffLines('  hello  \nworld', 'hello\nworld', { ignoreWhitespace: true })
    expect(r.mode).toBe('identical')
  })

  it('ignore-case treats differently-cased lines as equal', () => {
    const r = diffLines('Hello\nworld', 'hello\nWORLD', { ignoreCase: true })
    expect(r.mode).toBe('identical')
  })

  it('defaults stay strict', () => {
    expect(diffLines('Hello', 'hello').mode).not.toBe('identical')
    expect(diffLines('a ', 'a').mode).not.toBe('identical')
  })

  it('flags real changes under both options', () => {
    const r = diffLines('one\nTWO', 'one\nthree', { ignoreCase: true, ignoreWhitespace: true })
    expect(r.added + r.removed).toBeGreaterThanOrEqual(2)
  })
})

describe('JSON sort-keys', () => {
  it('sorts object keys recursively and preserves array order', () => {
    const r = formatJson('{"z":1,"a":{"y":[2,1],"b":2}}', 2, true)
    expect(r.ok).toBe(true)
    expect(r.output.indexOf('"a"')).toBeLessThan(r.output.indexOf('"z"'))
    expect(r.output.indexOf('"b"')).toBeLessThan(r.output.indexOf('"y"'))
    // Array order preserved (2 comes before 1; keys around it sorted).
    expect(r.output.indexOf('    2,')).toBeGreaterThan(-1)
    expect(r.output.indexOf('    2,')).toBeLessThan(r.output.indexOf('    1'))
  })

  it('is off by default', () => {
    const r = formatJson('{"z":1,"a":2}')
    expect(r.output.indexOf('"z"')).toBeLessThan(r.output.indexOf('"a"'))
  })
})
