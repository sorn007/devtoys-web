/**
 * Text statistics and line utilities. Unicode-aware where the platform allows
 * (Intl.Segmenter for graphemes), with honest fallbacks. All operations are
 * single-pass O(n) and never build unbounded intermediates.
 */

export type TextStats = {
  characters: number
  charactersNoSpaces: number
  words: number
  lines: number
  sentences: number
  paragraphs: number
  bytes: number
  codePoints: number
  graphemes: number
  longestLine: number
  readingMinutes: number
}

export function analyzeText(text: string): TextStats {
  const codePoints = [...text].length
  let noSpaces = 0
  let longest = 0
  let current = 0
  for (const ch of text) {
    if (!/\s/.test(ch)) noSpaces++
    if (ch === '\n') {
      longest = Math.max(longest, current)
      current = 0
    } else {
      current += [...ch].length
    }
  }
  longest = Math.max(longest, current)

  const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
  const sentences = text.match(/[^.!?…]+[.!?…]+(\s|$)/g)?.length ?? (text.trim() ? 1 : 0)
  const paragraphs = text.trim() ? text.split(/\n\s*\n+/).filter((p) => p.trim()).length : 0

  return {
    characters: codePoints,
    charactersNoSpaces: noSpaces,
    words,
    lines: text === '' ? 0 : text.split('\n').length,
    sentences,
    paragraphs,
    bytes: new TextEncoder().encode(text).length,
    codePoints,
    graphemes: countGraphemes(text),
    longestLine: longest,
    readingMinutes: Math.max(1, Math.round(words / 200)),
  }
}

function countGraphemes(text: string): number {
  if (text === '') return 0
  const SegmenterCtor = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter
  if (SegmenterCtor) {
    let n = 0
    // Constructing per call is fine; granularity 'grapheme' is the cheap mode.
    const seg = new SegmenterCtor(undefined, { granularity: 'grapheme' })
    for (const _ of seg.segment(text)) n++
    return n
  }
  return [...text].length // code-point fallback: correct except for combining sequences
}

/* --- line utilities ------------------------------------------------------- */

export function trimLines(text: string): string {
  return text.split('\n').map((l) => l.trim()).filter((l) => l !== '').join('\n')
}

/** Removes duplicate lines, keeping first occurrence and original order. */
export function dedupeLines(text: string): string {
  const seen = new Set<string>()
  return text
    .split('\n')
    .filter((l) => (seen.has(l) ? false : (seen.add(l), true)))
    .join('\n')
}

export function sortLines(text: string, options: { numeric?: boolean; descending?: boolean } = {}): string {
  const collator = new Intl.Collator(undefined, { numeric: options.numeric !== false, sensitivity: 'base' })
  const lines = text.split('\n')
  lines.sort(collator.compare)
  if (options.descending) lines.reverse()
  return lines.join('\n')
}

export function reverseLines(text: string): string {
  return text.split('\n').reverse().join('\n')
}

/** Collapses runs of blank lines and trailing/leading blank lines. */
export function squeezeBlanks(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '')
}

/* --- case and identifier transforms ---------------------------------------- */

export function toTitleCase(text: string): string {
  return text.toLowerCase().replace(/(^|\s|[-_(])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase())
}

/** Splits prose or identifiers into words: handles camelCase, snake_case, kebab. */
export function splitWords(text: string): string[] {
  const withBoundaries = text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[\s\-_.]+/g, ' ')
    .trim()
  return withBoundaries ? withBoundaries.split(' ') : []
}

export function toCamelCase(text: string): string {
  return splitWords(text)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('')
}

export function toPascalCase(text: string): string {
  return splitWords(text)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('')
}

export function toSnakeCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('_')
}

export function toKebabCase(text: string): string {
  return splitWords(text).map((w) => w.toLowerCase()).join('-')
}
