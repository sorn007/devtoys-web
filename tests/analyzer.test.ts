import { describe, expect, it } from 'vitest'
import {
  analyzeText,
  dedupeLines,
  reverseLines,
  sortLines,
  splitWords,
  squeezeBlanks,
  toCamelCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  toTitleCase,
  trimLines,
} from '@/tools/analyzer'
import { escapeText, unescapeText } from '@/tools/escape'

describe('analyzeText', () => {
  it('counts words, lines and paragraphs on a known fixture', () => {
    const s = analyzeText('Hello world.\n\nSecond paragraph here.')
    expect(s.words).toBe(5)
    expect(s.paragraphs).toBe(2)
    expect(s.lines).toBe(3)
    expect(s.sentences).toBe(2)
    expect(s.readingMinutes).toBe(1)
  })

  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    expect(analyzeText('🙂').bytes).toBe(4)
    expect(analyzeText('🙂').characters).toBe(1)
  })

  it('counts graphemes, not code points, when Segmenter is available', () => {
    // family emoji: 7 code points, 1 grapheme
    const family = '👨‍👩‍👧‍👦'
    const s = analyzeText(family)
    expect(s.codePoints).toBeGreaterThan(1)
    if ('Segmenter' in Intl) expect(s.graphemes).toBe(1)
  })

  it('handles empty input without inventing content', () => {
    const s = analyzeText('')
    expect(s.characters).toBe(0)
    expect(s.lines).toBe(0)
    expect(s.paragraphs).toBe(0)
    expect(s.words).toBe(0)
  })

  it('tracks the longest line', () => {
    expect(analyzeText('ab\nabcdef\nabc').longestLine).toBe(6)
  })
})

describe('line utilities', () => {
  it('trims and drops empty lines', () => {
    expect(trimLines('  a \n\n b \n')).toBe('a\nb')
  })

  it('dedupes keeping first occurrence and order', () => {
    expect(dedupeLines('b\na\nb\na\nc')).toBe('b\na\nc')
  })

  it('sorts naturally (numeric) by default', () => {
    expect(sortLines('10\n2\n1').split('\n')).toEqual(['1', '2', '10'])
    expect(sortLines('b\na\nc', { descending: true }).split('\n')).toEqual(['c', 'b', 'a'])
  })

  it('reverses line order and squeezes blanks', () => {
    expect(reverseLines('1\n2\n3')).toBe('3\n2\n1')
    expect(squeezeBlanks('\n\na\n\n\n\nb\n\n')).toBe('a\n\nb')
  })
})

describe('case and identifier transforms', () => {
  it('splits camel, snake and kebab identifiers into words', () => {
    expect(splitWords('fooBarBaz')).toEqual(['foo', 'Bar', 'Baz'])
    expect(splitWords('HTTP_STATUS_code')).toEqual(['HTTP', 'STATUS', 'code'])
    expect(splitWords('user-id-token')).toEqual(['user', 'id', 'token'])
  })

  it('converts between identifier conventions', () => {
    expect(toCamelCase('user ID token')).toBe('userIdToken')
    expect(toPascalCase('user id token')).toBe('UserIdToken')
    expect(toSnakeCase('userIdToken')).toBe('user_id_token')
    expect(toKebabCase('UserIdToken')).toBe('user_id_token'.replaceAll('_', '-'))
    expect(toTitleCase('the quick brown fox')).toBe('The Quick Brown Fox')
  })
})

describe('escape / unescape', () => {
  it('escapes and round-trips JSON strings', () => {
    const raw = 'line1\nline2 "quoted" \\ back \\u0041'
    const escaped = escapeText(raw, 'json')
    expect(escaped).toBe('line1\\nline2 \\"quoted\\" \\\\ back \\\\u0041')
    expect(unescapeText(escaped, 'json')).toBe(raw)
  })

  it('escapes all five XML characters and round-trips', () => {
    const raw = '<a href="x">&\'</a>'
    expect(escapeText(raw, 'xml')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
    expect(unescapeText(escapeText(raw, 'xml'), 'xml')).toBe(raw)
  })

  it('decodes numeric and hex character references', () => {
    expect(unescapeText('&#65;&#x42;', 'xml')).toBe('AB')
    expect(unescapeText('&nbsp;', 'xml')).toBe(' ')
    // Unknown entities stay literal rather than being dropped.
    expect(unescapeText('&bogus;', 'xml')).toBe('&bogus;')
  })

  it('escapes JavaScript string literals including template hazards', () => {
    const raw = '`template ${injection}` "q" \'a\''
    const escaped = escapeText(raw, 'javascript')
    expect(escaped).toBe('\\`template \\${injection}\\` \\"q\\" \\\'a\\\'')
    expect(unescapeText(escaped, 'javascript')).toBe(raw)
  })

  it('escapes non-ASCII as \\u sequences, using surrogate pairs beyond the BMP', () => {
    const escaped = escapeText('héllo 🙂', 'json', true)
    expect(escaped).toBe('h\\u00e9llo \\ud83d\\ude42')
    expect(unescapeText(escaped, 'json')).toBe('héllo 🙂')
  })

  it('decodes escaped markup into inert text, never into code', () => {
    // A payload that would run if unescaping were done with eval/Function.
    const hostile = String.raw`"<script>alert(1)</script>"`
    const decoded = unescapeText(hostile, 'javascript')
    expect(decoded).toBe('"<script>alert(1)</script>"')
    expect(typeof decoded).toBe('string')
    expect(unescapeText(String.raw`A`, 'json')).toBe('A')
  })

  it('keeps unknown escapes literal instead of destroying them', () => {
    expect(unescapeText(String.raw`a\qb`, 'javascript')).toBe(String.raw`a\qb`)
    expect(unescapeText(String.raw`a\u12`, 'javascript')).toBe(String.raw`a\u12`)
  })

  it('leaves a trailing lone backslash intact', () => {
    expect(unescapeText('abc\\', 'json')).toBe('abc\\')
  })
})
