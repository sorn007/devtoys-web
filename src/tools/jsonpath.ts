/**
 * A safe JSONPath evaluator, written in-house.
 *
 * Why not a library: `jsonpath-plus@11.3.0` (MIT) compiles filter expressions
 * with `new Function(...)` — grep of its ESM build, which is what a bundler
 * would ship, shows `new Function(...keys, code)(...values)` at
 * dist/index-browser-esm.js:2735 inside its SafeScript evaluator. Dynamically
 * generating code from user input is exactly what this app must not do, so the
 * package was uninstalled and this interpreter written instead. It contains no
 * `eval`, no `Function` constructor and no `with` — queries are parsed by a
 * recursive-descent parser into an AST and evaluated as closures.
 *
 * Supported syntax: `$`, `.name`, `['name']`, `..name` (descendant), `.*`,
 * `[*]`, `[2]`, `[-1]`, `[0,2]` (union), `[1:5:2]` (slice), and filters
 * `[?(<expr>)]` where <expr> supports @.path, literals, ==, !=, <, <=, >, >=,
 * =~ /regex/, &&, ||, ! and parentheses.
 * NOT supported (rejected with a clear error, never silently wrong):
 * script expressions like `[(@.length-1)]`, path unions `;`, and the extended
 * filter keywords (in/nin/size/subsetof…) of other implementations.
 */

import { assertInputSize } from '@/lib/limits'

export const JSONPATH_MAX_RESULTS = 5_000

export type Match = { path: string; value: unknown }

export type JsonPathResult =
  | { ok: true; matches: Match[]; truncated: boolean; count: number }
  | { ok: false; error: string }

type Segment =
  | { kind: 'child'; names: string[] }
  | { kind: 'wildcard' }
  | { kind: 'descendant' }
  | { kind: 'index'; indexes: number[] }
  | { kind: 'slice'; start?: number; end?: number; step?: number }
  | { kind: 'filter'; test: (node: unknown, root: unknown) => boolean }

export function runJsonPath(query: string, jsonText: string): JsonPathResult {
  if (!query.trim()) return { ok: false, error: 'Enter a JSONPath expression, e.g. $.store.book[0].title.' }
  assertInputSize(jsonText, 'JSON input')
  let root: unknown
  try {
    root = JSON.parse(jsonText)
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` }
  }
  let segments: Segment[]
  try {
    segments = parsePath(query)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  const matches: Match[] = []
  let truncated = false
  try {
    walk(root, root, '', segments, 0, (path, value) => {
      if (matches.length >= JSONPATH_MAX_RESULTS) {
        truncated = true
        return
      }
      matches.push({ path, value })
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  return { ok: true, matches, truncated, count: matches.length }
}

/* --- path parser --------------------------------------------------------- */

function parsePath(query: string): Segment[] {
  let i = 0
  const s = query.trim()
  if (s[0] !== '$') throw new Error('A JSONPath must start with $.')
  i = 1
  const segments: Segment[] = []

  const readName = (): string => {
    const start = i
    while (i < s.length && /[ $\w.\-À-￿]/.test(s[i]!) && s[i] !== '.' && s[i] !== '[') i++
    const name = s.slice(start, i)
    if (!name) throw new Error(`Expected a name at position ${i}.`)
    return name
  }

  while (i < s.length) {
    const ch = s[i]!
    if (ch === '.') {
      if (s[i + 1] === '.') {
        i += 2
        if (s[i] === '*' || s[i] === '[') {
          segments.push({ kind: 'descendant' })
          continue
        }
        segments.push({ kind: 'descendant' })
        segments.push({ kind: 'child', names: [readName()] })
        continue
      }
      i++
      if (s[i] === '*') {
        i++
        segments.push({ kind: 'wildcard' })
        continue
      }
      segments.push({ kind: 'child', names: [readName()] })
      continue
    }
    if (ch === '[') {
      i++
      if (s[i] === '\'' || s[i] === '"') {
        const quote = s[i]!
        i++
        const start = i
        while (i < s.length && s[i] !== quote) i++
        const name = s.slice(start, i)
        if (s[i] !== quote) throw new Error('Unterminated quoted name.')
        i++ // closing quote
        expect(s, i, ']')
        i++
        segments.push({ kind: 'child', names: [name] })
        continue
      }
      if (s[i] === '?') {
        i++
        expect(s, i, '(')
        i++
        const exprSrc = readBalanced(s, i, '(', ')')
        i += exprSrc.length // now pointing at the closing ")"
        expect(s, i, ')')
        i++
        expect(s, i, ']') // the filter's bracket must close here
        i++
        const test = compileFilter(exprSrc)
        segments.push({ kind: 'filter', test })
        continue
      }
      if (s[i] === '(') {
        throw new Error('Script expressions like [(@.length-1)] are not supported (they require evaluating code).')
      }
      // index, union or slice until ']'
      const start = i
      while (i < s.length && s[i] !== ']') i++
      const body = s.slice(start, i)
      expect(s, i, ']')
      i++
      segments.push(parseBracketBody(body))
      continue
    }
    throw new Error(`Unexpected "${ch}" at position ${i}.`)
  }
  return segments
}

function parseBracketBody(body: string): Segment {
  const trimmed = body.trim()
  if (trimmed === '*') return { kind: 'wildcard' }
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':').map((p) => (p.trim() === '' ? undefined : Number(p.trim())))
    if (parts.length > 3 || parts.some((p) => p !== undefined && !Number.isInteger(p))) {
      throw new Error(`Invalid slice "${trimmed}".`)
    }
    return { kind: 'slice', start: parts[0], end: parts[1], step: parts[2] }
  }
  if (trimmed.includes(',')) {
    const indexes = trimmed.split(',').map((p) => Number(p.trim()))
    if (indexes.some((n) => !Number.isInteger(n))) throw new Error(`Invalid index union "${trimmed}".`)
    return { kind: 'index', indexes }
  }
  const n = Number(trimmed)
  if (!Number.isInteger(n)) throw new Error(`Invalid index "${trimmed}".`)
  return { kind: 'index', indexes: [n] }
}

function expect(s: string, i: number, ch: string): void {
  if (s[i] !== ch) throw new Error(`Expected "${ch}" at position ${i}.`)
}

function readBalanced(s: string, i: number, open: string, close: string): string {
  let depth = 1
  const start = i
  while (i < s.length) {
    if (s[i] === open) depth++
    else if (s[i] === close) {
      depth--
      if (depth === 0) return s.slice(start, i)
    }
    i++
  }
  throw new Error('Unbalanced parentheses in filter expression.')
}

/* --- filter expression parser (recursive descent → closure) -------------- */

type Predicate = (node: unknown, root: unknown) => boolean

function compileFilter(src: string): Predicate {
  let i = 0
  const s = src

  const parseOr = (): Predicate => {
    let left = parseAnd()
    while (match('||')) {
      const right = parseAnd()
      const l = left
      left = (n, r) => l(n, r) || right(n, r)
    }
    return left
  }
  const parseAnd = (): Predicate => {
    let left = parseUnary()
    while (match('&&')) {
      const right = parseUnary()
      const l = left
      left = (n, r) => l(n, r) && right(n, r)
    }
    return left
  }
  const parseUnary = (): Predicate => {
    skip()
    if (s[i] === '!') {
      i++
      const inner = parseUnary()
      return (n, r) => !inner(n, r)
    }
    return parseComparison()
  }
  const parseComparison = (): Predicate => {
    skip()
    const left = parseOperand()
    skip()
    const op = readOperator()
    if (!op) {
      // Bare operand = existence test, evaluated per node: a path that resolves
      // to undefined (or a missing key) means "does not exist".
      return (node, root) => left.get(node, root) !== undefined
    }
    skip()
    const right = parseOperand()
    return (node, root) => compare(left.get(node, root), right.get(node, root), op)
  }

  type Operand = { get: (node: unknown, root: unknown) => unknown; exists: boolean }
  const parseOperand = (): Operand => {
    skip()
    if (s[i] === '@' || s[i] === '$') {
      const isRoot = s[i] === '$'
      i++
      const path: (string | number)[] = []
      while (i < s.length) {
        if (s[i] === '.') {
          i++
          const start = i
          while (i < s.length && /[\wÀ-￿]/.test(s[i]!)) i++
          path.push(s.slice(start, i))
        } else if (s[i] === '[') {
          i++
          const start = i
          while (i < s.length && s[i] !== ']') i++
          const key = s.slice(start, i).replace(/^['"]|['"]$/g, '')
          i++
          path.push(/^\d+$/.test(key) ? Number(key) : key)
        } else break
      }
      return {
        get: (node, root) => dive(isRoot ? root : node, path),
        exists: path.length > 0,
      }
    }
    if (s[i] === '\'' || s[i] === '"') {
      const quote = s[i]!
      i++
      const start = i
      while (i < s.length && s[i] !== quote) i++
      const value = s.slice(start, i)
      i++
      return { get: () => value, exists: true }
    }
    if (s[i] === '/') {
      // /regex/[flags] literal for =~
      i++
      const start = i
      while (i < s.length && s[i] !== '/') i++
      const source = s.slice(start, i)
      i++
      const flagStart = i
      while (i < s.length && /[a-z]/.test(s[i]!)) i++
      const re = new RegExp(source, s.slice(flagStart, i))
      return { get: () => re, exists: true }
    }
    if (s[i] === '(') {
      i++
      const inner = parseOr()
      skip()
      if (s[i] !== ')') throw new Error('Unbalanced parenthesis in filter.')
      i++
      return { get: () => inner, exists: true }
    }
    const start = i
    while (i < s.length && /[-+0-9.eEtruefalsnl]/.test(s[i]!)) i++
    const token = s.slice(start, i)
    if (token === 'true') return { get: () => true, exists: true }
    if (token === 'false') return { get: () => false, exists: true }
    if (token === 'null') return { get: () => null, exists: true }
    const num = Number(token)
    if (token !== '' && Number.isFinite(num)) return { get: () => num, exists: true }
    throw new Error(`Cannot understand filter operand "${token || (s[i] ?? '')}".`)
  }

  const readOperator = (): string | null => {
    for (const op of ['===', '==', '!==', '!=', '<=', '>=', '=~', '>', '<']) {
      if (s.startsWith(op, i)) {
        i += op.length
        return op === '===' ? '==' : op === '!==' ? '!=' : op
      }
    }
    return null
  }
  const skip = () => {
    while (i < s.length && /\s/.test(s[i]!)) i++
  }
  const match = (token: string): boolean => {
    skip()
    if (s.startsWith(token, i)) {
      i += token.length
      return true
    }
    return false
  }

  const predicate = parseOr()
  skip()
  if (i < s.length) throw new Error(`Unexpected "${s.slice(i, i + 8)}" in filter expression.`)
  return predicate
}

function compare(a: unknown, b: unknown, op: string): boolean {
  if (op === '=~') {
    if (b instanceof RegExp && typeof a === 'string') return b.test(a)
    if (b instanceof RegExp && a == null) return false
    return false
  }
  if (op === '==' ) return looseEq(a, b)
  if (op === '!=') return !looseEq(a, b)
  if (typeof a === 'number' && typeof b === 'number') {
    if (op === '<') return a < b
    if (op === '<=') return a <= b
    if (op === '>') return a > b
    if (op === '>=') return a >= b
  }
  // Comparing non-numbers with < > is ambiguous; refuse rather than guess.
  return false
}

function looseEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a == b
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b)
  if (typeof b === 'number' && typeof a === 'string') return b === Number(a)
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  return false
}

function dive(value: unknown, path: (string | number)[]): unknown {
  let current = value
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[key as string]
  }
  return current
}

/* --- evaluator ----------------------------------------------------------- */

function walk(
  node: unknown,
  root: unknown,
  path: string,
  segments: Segment[],
  at: number,
  emit: (path: string, value: unknown) => void,
): void {
  if (at === segments.length) {
    emit(path, node)
    return
  }
  const seg = segments[at]!
  switch (seg.kind) {
    case 'child':
      for (const name of seg.names) {
        if (node !== null && typeof node === 'object' && name in (node as Record<string, unknown>)) {
          walk((node as Record<string, unknown>)[name], root, `${path}.${name}`, segments, at + 1, emit)
        }
      }
      return
    case 'wildcard':
      if (Array.isArray(node)) {
        node.forEach((item, idx) => walk(item, root, `${path}[${idx}]`, segments, at + 1, emit))
      } else if (node !== null && typeof node === 'object') {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          walk(value, root, `${path}.${key}`, segments, at + 1, emit)
        }
      }
      return
    case 'descendant': {
      // '..' collects every object/array below (and the node itself) before the next segment.
      const collect = (current: unknown, currentPath: string): void => {
        if (Array.isArray(current)) {
          current.forEach((item, idx) => {
            // Array elements are candidate bases for the following segment too.
            walk(item, root, `${currentPath}[${idx}]`, segments, at + 1, emit)
            collect(item, `${currentPath}[${idx}]`)
          })
        } else if (current !== null && typeof current === 'object') {
          for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
            walk(value, root, `${currentPath}.${key}`, segments, at + 1, emit)
            collect(value, `${currentPath}.${key}`)
          }
        }
      }
      collect(node, path)
      return
    }
    case 'index':
      if (Array.isArray(node)) {
        for (const raw of seg.indexes) {
          const idx = raw < 0 ? node.length + raw : raw
          if (idx >= 0 && idx < node.length) walk(node[idx], root, `${path}[${idx}]`, segments, at + 1, emit)
        }
      }
      return
    case 'slice':
      if (Array.isArray(node)) {
        const len = node.length
        const step = seg.step === undefined ? 1 : seg.step
        if (step === 0) throw new Error('Slice step cannot be 0.')
        let start = seg.start === undefined ? (step > 0 ? 0 : len - 1) : seg.start < 0 ? len + seg.start : seg.start
        let end = seg.end === undefined ? (step > 0 ? len : -1) : seg.end < 0 ? len + seg.end : seg.end
        if (step > 0) {
          for (let k = Math.max(0, start); k < Math.min(end, len); k += step) {
            walk(node[k], root, `${path}[${k}]`, segments, at + 1, emit)
          }
        } else {
          for (let k = Math.min(len - 1, start); k > end; k += step) {
            walk(node[k], root, `${path}[${k}]`, segments, at + 1, emit)
          }
        }
      }
      return
    case 'filter':
      if (Array.isArray(node)) {
        node.forEach((item, idx) => {
          if (seg.test(item, root)) walk(item, root, `${path}[${idx}]`, segments, at + 1, emit)
        })
      } else if (node !== null && typeof node === 'object') {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
          if (seg.test(value, root)) walk(value, root, `${path}.${key}`, segments, at + 1, emit)
        }
      }
      return
  }
}
