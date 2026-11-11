/**
 * JSON array → table + CSV/TSV. Cells are always plain text: the component
 * renders them as Vue text nodes (never v-html), and the CSV writer applies
 * RFC 4180 quoting. Spreadsheet formula injection is mitigated by an explicit
 * "safe export" transform that is ON by default and can be turned off for a
 * byte-faithful export.
 */

import { assertInputSize } from '@/lib/limits'
import { TABLE_MAX_ROWS } from '@/lib/limits'

export const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'] as const

export type Table = {
  headers: string[]
  rows: string[][]
  totalRows: number
  truncated: boolean
}

export type TableError = { error: string }

/** Flattens a JSON document into a table. Accepts an array, or one object. */
export function jsonToTable(input: string): Table {
  assertInputSize(input, 'JSON input')
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Input is empty.')
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err))
  }
  const records: unknown[] = Array.isArray(value) ? value : [value]
  if (records.length === 0) return { headers: [], rows: [], totalRows: 0, truncated: false }
  if (records.some((r) => r === null || typeof r !== 'object' || Array.isArray(r))) {
    throw new Error('Expected an array of objects (or a single object). Scalar or array cells are not tabular.')
  }

  const headers: string[] = []
  const seen = new Set<string>()
  for (const record of records as Record<string, unknown>[]) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key)
        headers.push(key)
      }
    }
  }

  const totalRows = records.length
  const truncated = totalRows > TABLE_MAX_ROWS
  const limited = truncated ? (records as Record<string, unknown>[]).slice(0, TABLE_MAX_ROWS) : (records as Record<string, unknown>[])
  const rows = limited.map((record) => headers.map((h) => cellText(record[h])))

  return { headers, rows, totalRows, truncated }
}

function cellText(value: unknown): string {
  if (value === undefined) return ''
  if (value === null) return 'null'
  if (typeof value === 'string') return value
  // Numbers, booleans and nested structures: nested become compact JSON so the
  // cell stays a single, lossless scalar.
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

export type CsvOptions = {
  delimiter?: ',' | '\t' | ';'
  /** RFC 4180 specifies CRLF; ON by default so Excel opens files cleanly. */
  crlf?: boolean
  /** Prefix cells that spreadsheets would execute as formulas. ON by default. */
  safeExport?: boolean
}

/** Serialises a table as RFC 4180 CSV (or TSV/SV when another delimiter is set). */
export function tableToCsv(table: Table, options: CsvOptions = {}): string {
  const delimiter = options.delimiter ?? ','
  const eol = options.crlf === false ? '\n' : '\r\n'
  const safe = options.safeExport !== false
  const lines = [table.headers.map((h) => field(h, delimiter, safe)).join(delimiter)]
  for (const row of table.rows) {
    lines.push(row.map((cell) => field(cell, delimiter, safe)).join(delimiter))
  }
  return lines.join(eol) + eol
}

function field(value: string, delimiter: string, safe: boolean): string {
  let text = value
  if (safe && FORMULA_PREFIXES.some((p) => text.startsWith(p))) {
    // Neutralise spreadsheet formula execution (=cmd|' / DDE, +, -, @) while
    // keeping the original text visible in the exported cell.
    text = `'${text}`
  }
  const needsQuote =
    text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r')
  if (!needsQuote) return text
  return `"${text.replaceAll('"', '""')}"`
}

/**
 * Minimal RFC 4180 parser used to prove exports round-trip byte-faithfully
 * (and handy for pasting CSV back in). Not exposed as a tool of its own.
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += ch
      }
      continue
    }
    if (ch === '"') {
      quoted = true
    } else if (ch === delimiter) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (ch === '\r') {
      // handled by the following \n in CRLF
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
