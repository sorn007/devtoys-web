/**
 * List comparison as set operations over lines. Duplicates collapse to set
 * membership (first occurrence keeps its position), and every result preserves
 * the left list's order followed by unseen right-list items — deterministic
 * output, never a hash-order artifact.
 */

export type CompareOptions = {
  /** Trim whitespace around each line before comparing. */
  trim?: boolean
  /** Compare case-insensitively; output keeps the first-seen spelling. */
  ignoreCase?: boolean
}

export type ListCompareResult = {
  leftCount: number
  rightCount: number
  leftUnique: number
  rightUnique: number
  intersection: string[]
  onlyLeft: string[]
  onlyRight: string[]
  symmetricDiff: string[]
  union: string[]
}

function prepare(text: string, options: CompareOptions): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (let raw of text.split('\n')) {
    if (options.trim) raw = raw.trim()
    if (raw === '') continue // blank lines are not list items
    const key = options.ignoreCase ? raw.toLowerCase() : raw
    if (seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

export function compareLists(leftText: string, rightText: string, options: CompareOptions = {}): ListCompareResult {
  const left = prepare(leftText, options)
  const right = prepare(rightText, options)
  const leftKeys = new Set(left.map((l) => keyOf(l, options)))
  const rightKeys = new Set(right.map((r) => keyOf(r, options)))

  const intersection: string[] = []
  const onlyLeft: string[] = []
  for (const line of left) (rightKeys.has(keyOf(line, options)) ? intersection : onlyLeft).push(line)
  const onlyRight = right.filter((line) => !leftKeys.has(keyOf(line, options)))

  const symmetricDiff = [...onlyLeft, ...onlyRight]
  const union = [...left, ...onlyRight]

  return {
    leftCount: left.length,
    rightCount: right.length,
    leftUnique: onlyLeft.length,
    rightUnique: onlyRight.length,
    intersection,
    onlyLeft,
    onlyRight,
    symmetricDiff,
    union,
  }
}

function keyOf(line: string, options: CompareOptions): string {
  return options.ignoreCase ? line.toLowerCase() : line
}
