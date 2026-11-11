/**
 * Lorem-ipsum generator with a seeded PRNG so output is reproducible (and
 * testable). The default seed varies per call only when the caller passes one.
 */

const WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do',
  'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore', 'magna', 'aliqua', 'enim',
  'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi',
  'aliquip', 'ex', 'ea', 'commodo', 'consequat', 'duis', 'aute', 'irure', 'in', 'reprehenderit',
  'voluptate', 'velit', 'esse', 'cillum', 'eu', 'fugiat', 'nulla', 'pariatur', 'excepteur',
  'sint', 'occaecat', 'cupidatat', 'non', 'proident', 'sunt', 'culpa', 'qui', 'officia',
  'deserunt', 'mollit', 'anim', 'id', 'est', 'laborum',
]

const CLASSIC = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit'

/** mulberry32: tiny, fast, deterministic; not cryptographic (fine for filler text). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type LoremOptions = {
  words?: number
  sentences?: number
  paragraphs?: number
  startWithClassic?: boolean
  seed?: number
}

export const LOREM_MAX = 500

/**
 * Generates filler text. Exactly one of words/sentences/paragraphs drives the
 * output; all are capped at LOREM_MAX so a typo cannot generate a novel.
 */
export function generateLorem(options: LoremOptions = {}): string {
  const seed = options.seed ?? 42
  const rand = mulberry32(seed)
  const word = () => WORDS[Math.floor(rand() * WORDS.length)]!
  const classic = options.startWithClassic !== false

  if (options.paragraphs) {
    const n = clamp(options.paragraphs)
    return range(n)
      .map((i) => sentenceList(rand, 4 + Math.floor(rand() * 3), classic && i === 0))
      .join('\n\n')
  }
  if (options.sentences) {
    return sentenceList(rand, clamp(options.sentences), classic)
  }
  const count = clamp(options.words ?? 24)
  const list = range(count).map(word)
  if (classic && count >= 5) {
    const head = CLASSIC.split(' ')
    for (let i = 0; i < head.length; i++) list[i] = head[i]!.toLowerCase()
  }
  return list.join(' ')
}

function sentenceList(rand: () => number, count: number, classic: boolean): string {
  const sentences: string[] = []
  for (let i = 0; i < count; i++) {
    const len = 6 + Math.floor(rand() * 10)
    const words: string[] = []
    for (let j = 0; j < len; j++) words.push(WORDS[Math.floor(rand() * WORDS.length)]!)
    if (classic && i === 0) {
      const head = CLASSIC.toLowerCase().replace(/,$/, '').split(' ')
      for (let j = 0; j < head.length && j < words.length; j++) words[j] = head[j]!
    }
    sentences.push(capitalize(words.join(' ')) + '.')
  }
  return sentences.join(' ')
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function clamp(n: number): number {
  return Math.max(1, Math.min(Math.floor(n) || 1, LOREM_MAX))
}

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i)
}
