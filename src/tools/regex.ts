import { REGEX_MAX_MATCHES } from '@/lib/limits'

export type RegexFlags =
  | 'g' | 'i' | 'm' | 's' | 'u' | 'y' | 'd' | 'v'

export const ALL_REGEX_FLAGS: readonly RegexFlags[] = ['g', 'i', 'm', 's', 'u', 'y', 'd', 'v'] as const

export type RegexMatch = {
  index: number
  end: number
  text: string
  groups: { name: string; value: string | undefined }[]
}

export type RegexResult = {
  ok: boolean
  error: string | null
  matches: RegexMatch[]
  truncated: boolean
  replaced: string | null
  replacedTruncated: boolean
  millis: number
}

/**
 * Runs a user pattern against sample text and collects matches plus named and
 * positional capture groups. Guarded:
 * - matches are capped at REGEX_MAX_MATCHES (rendering more only burns DOM/RAM)
 * - the 'g'/'y' loop is also capped by iteration count, so pathological
 *   zero-length-match patterns cannot spin forever
 */
export function runRegex(
  pattern: string,
  flags: string,
  text: string,
  replacement: string | null,
): RegexResult {
  const empty: RegexResult = { ok: false, error: null, matches: [], truncated: false, replaced: null, replacedTruncated: false, millis: 0 }
  if (!pattern) return { ...empty, error: 'Enter a pattern.' }
  let re: RegExp
  try {
    re = new RegExp(pattern, flags)
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) }
  }

  const started = now()
  const matches: RegexMatch[] = []
  let truncated = false
  let guard = 0

  if (re.global || re.sticky) {
    for (const m of text.matchAll(re)) {
      if (matches.length >= REGEX_MAX_MATCHES || ++guard > REGEX_MAX_MATCHES * 4) {
        truncated = true
        break
      }
      matches.push(toMatch(m))
      if (m.index === re.lastIndex) re.lastIndex++ // zero-length match: advance
    }
  } else {
    const m = re.exec(text)
    if (m) matches.push(toMatch(m))
  }

  let replaced: string | null = null
  let replacedTruncated = false
  if (replacement !== null) {
    try {
      replaced = text.replace(re.global || re.sticky ? new RegExp(pattern, flags) : new RegExp(pattern, flags), replacement)
      if (replaced.length > 1_000_000) {
        replaced = replaced.slice(0, 1_000_000)
        replacedTruncated = true
      }
    } catch {
      replaced = null
    }
  }

  return { ok: true, error: null, matches, truncated, replaced, replacedTruncated, millis: now() - started }
}

/** Cheap static hint about likely catastrophic backtracking (nested unbounded quantifiers). */
export function hasReDoSRisk(pattern: string): boolean {
  return /(\((?:\?:|\?)?[^(+*{}]*[+*]\)|\[[^\]]*[+*]\])[+*{]/.test(pattern) || /([+*])\s*([+*])/.test(pattern)
}

function toMatch(m: RegExpExecArray | RegExpMatchArray): RegexMatch {
  const groups: { name: string; value: string | undefined }[] = []
  const named = m.groups ?? {}
  for (const [name, value] of Object.entries(named)) groups.push({ name, value })
  for (let i = 1; i < m.length; i++) {
    const g = m[i]
    if (g !== undefined || i <= countPositional(m)) {
      groups.push({ name: `$${i}`, value: g })
    }
  }
  const index = m.index ?? 0
  return { index, end: index + m[0]!.length, text: m[0]!, groups }
}

/** Number of positional groups actually present (trailing undefined groups may be absent). */
function countPositional(m: RegExpExecArray | RegExpMatchArray): number {
  let n = 0
  for (let i = 1; i < m.length; i++) if (m[i] !== undefined) n = i
  return n
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}
