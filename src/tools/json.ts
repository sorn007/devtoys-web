import { assertInputSize, LimitError } from '@/lib/limits'

export type JsonFormatResult = {
  ok: boolean
  output: string
  error: string | null
  line: number | null
  column: number | null
  byteLength: number
  charLength: number
}

export type JsonMinifyResult = Omit<JsonFormatResult, 'output'> & { output: string }

/** Formats (pretty-prints) JSON with a 2-space indent. Throws LimitError above the input cap. */
export function formatJson(input: string, indent = 2, sortKeys = false): JsonFormatResult {
  assertInputSize(input, 'JSON input')
  const trimmed = input.trim()
  if (!trimmed) {
    return emptyJsonResult(input)
  }
  try {
    const value: unknown = JSON.parse(trimmed)
    const output = JSON.stringify(sortKeys ? sortValue(value) : value, null, indent)
    return describe(input, { ok: true, output, error: null, line: null, column: null })
  } catch (err) {
    return describe(input, {
      ok: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
      ...locate(trimmed),
    })
  }
}

/** Minifies JSON (strips insignificant whitespace). */
export function minifyJson(input: string): JsonMinifyResult {
  assertInputSize(input, 'JSON input')
  const trimmed = input.trim()
  if (!trimmed) return emptyJsonResult(input)
  try {
    const value: unknown = JSON.parse(trimmed)
    return describe(input, { ok: true, output: JSON.stringify(value), error: null, line: null, column: null })
  } catch (err) {
    return describe(input, {
      ok: false,
      output: '',
      error: err instanceof Error ? err.message : String(err),
      ...locate(trimmed),
    })
  }
}

/** Validates without producing output; used by the "Validate" action. */
export function validateJson(input: string): { ok: boolean; error: string | null; line: number | null; column: number | null } {
  assertInputSize(input, 'JSON input')
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Input is empty.', line: null, column: null }
  try {
    JSON.parse(trimmed)
    return { ok: true, error: null, line: null, column: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), ...locate(trimmed) }
  }
}

/** Recursively sorts object keys (arrays keep order); used by the sort-keys toggle. */
export function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort((a, b) => a.localeCompare(b))
        .map((k) => [k, sortValue((value as Record<string, unknown>)[k]!)]),
    )
  }
  return value
}

function emptyJsonResult(input: string): JsonFormatResult {
  return {
    ok: false,
    output: '',
    error: 'Input is empty.',
    line: null,
    column: null,
    byteLength: byteSize(input),
    charLength: input.length,
  }
}

function describe(input: string, r: { ok: boolean; output: string; error: string | null; line: number | null; column: number | null }): JsonFormatResult {
  return { ...r, byteLength: byteSize(input), charLength: input.length }
}

/**
 * Derives a 1-based line/column from a JSON.parse error message.
 * Engines differ: V8 usually reports neither, SpiderMonkey reports
 * "line N column M", and some builds report "position N". When the message
 * carries neither, we report null rather than guessing a location.
 */
function locate(text: string): { line: number | null; column: number | null } {
  const pos = /position (\d+)/.exec(text)
  if (pos) {
    const offset = Number(pos[1])
    if (Number.isFinite(offset)) {
      const upto = text.slice(0, Math.min(offset, text.length))
      const lines = upto.split('\n')
      return { line: lines.length, column: lines[lines.length - 1]!.length + 1 }
    }
  }
  const lc = /line (\d+) column (\d+)/.exec(text)
  if (lc) return { line: Number(lc[1]), column: Number(lc[2]) }
  return { line: null, column: null }
}

/** UTF-8 byte size, used for the "how big is this really" readout. */
export function byteSize(text: string): number {
  return new TextEncoder().encode(text).length
}

export { LimitError }
