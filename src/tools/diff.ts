import { DIFF_MAX_D, DIFF_MAX_LINES } from '@/lib/limits'

export type DiffOp = 'equal' | 'added' | 'removed'
export type DiffRow = { op: DiffOp; text: string; leftNo: number | null; rightNo: number | null }

export type DiffResult = {
  rows: DiffRow[]
  mode: 'exact' | 'coarse' | 'identical'
  added: number
  removed: number
  unchanged: number
  truncated: boolean
}

/**
 * Line diff. Exact mode is Myers' O(ND) algorithm; inputs that blow past the
 * line/edit-distance caps fall back to `coarse` mode, which reports set
 * membership (present only on the left / only on the right) without pairwise
 * alignment. Coarse mode is lossless about *which* lines are unique to a side,
 * it just does not pair neighbouring edits, and the UI says so.
 */
export type DiffOptions = {
  /** Compare lines after trimming trailing/leading whitespace. */
  ignoreWhitespace?: boolean
  /** Compare lines case-insensitively (output keeps original casing). */
  ignoreCase?: boolean
}

export function diffLines(leftText: string, rightText: string, options: DiffOptions = {}): DiffResult {
  const left = splitLines(leftText)
  const right = splitLines(rightText)

  // Cheap win first: identical inputs never allocate an edit script.
  if (leftText === rightText) {
    return { rows: numbered(left, 'equal', 0), mode: 'identical', added: 0, removed: 0, unchanged: left.length, truncated: false }
  }

  // Normalise for COMPARISON only; the displayed text stays original.
  const key = (line: string): string => {
    // Without the option, comparison is byte-exact per line.
    let out = options.ignoreWhitespace ? line.trim() : line
    if (options.ignoreCase) out = out.toLowerCase()
    return out
  }
  const l = left.map(key)
  const r = right.map(key)

  const { left: l2, right: r2, prefix, suffix } = trimCommonKeys(l, r)

  if (l.length + r.length === 0) {
    const rows = numbered(left, 'equal', 0)
    return { rows, mode: 'identical', added: 0, removed: 0, unchanged: left.length, truncated: false }
  }

  if (l.length > DIFF_MAX_LINES || r.length > DIFF_MAX_LINES) {
    return coarseKeyed(left, l, right, r, true)
  }

  const script = myers(l2, r2)
  if (!script) return coarseKeyed(left, l, right, r, true)

  const rows: DiffRow[] = numbered(prefix.map((_, i) => left[i]!), 'equal', 0)
  let li = prefix.length
  let ri = prefix.length
  for (const op of script) {
    if (op === 'equal') {
      rows.push({ op: 'equal', text: left[li]!, leftNo: li + 1, rightNo: ri + 1 })
      li++
      ri++
    } else if (op === 'removed') {
      rows.push({ op: 'removed', text: left[li]!, leftNo: li + 1, rightNo: null })
      li++
    } else {
      rows.push({ op: 'added', text: right[ri]!, leftNo: null, rightNo: ri + 1 })
      ri++
    }
  }
  const suffixStart = li
  for (let i = 0; i < suffix.length; i++) {
    rows.push({ op: 'equal', text: left[li + i]!, leftNo: suffixStart + i + 1, rightNo: suffixStart + i + 1 })
  }
  const result = summarize(rows, 'exact', false)
  if (result.added === 0 && result.removed === 0) return { ...result, mode: 'identical' }
  return result
}

/** Splits keeping empty lines meaningful; a trailing newline does not create a phantom line. */
function splitLines(text: string): string[] {
  if (text === '') return []
  const lines = text.split('\n')
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/** Like trimCommon but over normalised keys, returning key slices + lengths. */
function trimCommonKeys(l: string[], r: string[]) {
  const t = trimCommon(l, r)
  return { left: t.left, right: t.right, prefix: t.prefix, suffix: t.suffix }
}

function trimCommon(left: string[], right: string[]) {
  let p = 0
  while (p < left.length && p < right.length && left[p] === right[p]) p++
  let s = 0
  while (
    s < left.length - p &&
    s < right.length - p &&
    left[left.length - 1 - s] === right[right.length - 1 - s]
  ) {
    s++
  }
  return {
    prefix: left.slice(0, p),
    suffix: left.slice(left.length - s),
    left: left.slice(p, left.length - s),
    right: right.slice(p, right.length - s),
  }
}

/**
 * Myers greedy LCS with a trace of V-array snapshots, bounded by DIFF_MAX_D.
 * Returns the edit script, or null when the edit distance exceeds the cap.
 */
function myers(a: readonly string[], b: readonly string[]): DiffOp[] | null {
  const n = a.length
  const m = b.length
  if (n + m === 0) return []
  // V is indexed by k + max so that k ∈ [-max, max] never goes negative.
  // Transient memory: at most (D+1) snapshots × (2·max+1) int32 entries; with
  // the caps above that is bounded and it is released as soon as we return.
  const max = n + m
  const offset = max
  const width = 2 * max + 1
  let v = new Int32Array(width).fill(-1)
  // Seed the k=+1 slot so that the d=0 "down" move starts at x=0 (Myers' V[1]=0).
  v[offset + 1] = 0
  const trace: Int32Array[] = []
  let foundD = -1

  for (let d = 0; d <= Math.min(max, DIFF_MAX_D); d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
        x = v[offset + k + 1]!
      } else {
        x = v[offset + k - 1]! + 1
      }
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x
      if (x >= n && y >= m) {
        foundD = d
        break
      }
    }
    if (foundD >= 0) break
    // Early exit: no possible path remains within this d.
    if (d >= max) break
  }
  if (foundD < 0) return null

  // Backtrack from (n, m) to (0, 0), reading the snapshot taken before each d.
  const script: DiffOp[] = []
  let x = n
  let y = m
  for (let d = foundD; d > 0; d--) {
    const snap = trace[d]!
    const k = x - y
    let prevK: number
    if (k === -d || (k !== d && snap[offset + k - 1]! < snap[offset + k + 1]!)) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = snap[offset + prevK]!
    const prevY = prevX - prevK
    while (x > prevX && y > prevY) {
      script.push('equal')
      x--
      y--
    }
    if (x === prevX) {
      script.push('added')
      y--
    } else {
      script.push('removed')
      x--
    }
  }
  while (x > 0 && y > 0) {
    script.push('equal')
    x--
    y--
  }
  script.reverse()
  return script
}

/** Coarse fallback over normalised keys (counts by key), displaying original text. */
function coarseKeyed(origLeft: string[], keyLeft: string[], origRight: string[], keyRight: string[], truncated: boolean): DiffResult {
  const counts = new Map<string, { l: number; r: number }>()
  for (const k of keyLeft) bump(counts, k, 'l')
  for (const k of keyRight) bump(counts, k, 'r')
  const rows: DiffRow[] = []
  keyLeft.forEach((k, i) => {
    const c = counts.get(k)!
    const unique = c.l > c.r
    rows.push({ op: unique ? 'removed' : 'equal', text: origLeft[i]!, leftNo: i + 1, rightNo: unique ? null : i + 1 })
  })
  keyRight.forEach((k, i) => {
    const c = counts.get(k)!
    if (c.r > c.l) rows.push({ op: 'added', text: origRight[i]!, leftNo: null, rightNo: i + 1 })
  })
  return summarize(rows, 'coarse', truncated)
}

function bump(map: Map<string, { l: number; r: number }>, line: string, side: 'l' | 'r') {
  const entry = map.get(line) ?? { l: 0, r: 0 }
  entry[side]++
  map.set(line, entry)
}

function numbered(lines: readonly string[], op: DiffOp, _: number): DiffRow[] {
  return lines.map((text, i) => ({ op, text, leftNo: i + 1, rightNo: i + 1 }))
}

function summarize(rows: DiffRow[], mode: DiffResult['mode'], truncated: boolean): DiffResult {
  let added = 0
  let removed = 0
  let unchanged = 0
  for (const row of rows) {
    if (row.op === 'added') added++
    else if (row.op === 'removed') removed++
    else unchanged++
  }
  return { rows, mode, added, removed, unchanged, truncated }
}
