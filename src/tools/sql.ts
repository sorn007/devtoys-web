/**
 * SQL formatting via `sql-formatter`, dynamically imported so the library
 * lives in this tool's chunk. The dialect list is read from the library at
 * runtime rather than hardcoded, so it can never drift from what is actually
 * supported; anything the user picks is validated against it first.
 */

import { assertInputSize } from '@/lib/limits'

export type SqlFormatOptions = {
  dialect: string
  uppercaseKeywords?: boolean
  indent?: number
}

export type SqlResult =
  | { ok: true; output: string; dialects: string[] }
  | { ok: false; error: string; dialects: string[] }

/** Dialect ids supported by the installed sql-formatter (fetched, not hardcoded). */
export async function supportedDialects(): Promise<string[]> {
  const { supportedDialects } = await import('sql-formatter')
  return [...supportedDialects]
}

export async function formatSql(text: string, options: SqlFormatOptions): Promise<SqlResult> {
  assertInputSize(text, 'SQL input')
  const dialects = await supportedDialects()
  if (!text.trim()) return { ok: false, error: 'Input is empty.', dialects }
  if (!dialects.includes(options.dialect)) {
    return { ok: false, error: `Unknown dialect "${options.dialect}".`, dialects }
  }
  const { format } = await import('sql-formatter')
  try {
    const output = format(text, {
      language: options.dialect as never,
      keywordCase: options.uppercaseKeywords === false ? 'preserve' : 'upper',
      tabWidth: options.indent && options.indent > 0 ? options.indent : 2,
    })
    return { ok: true, output, dialects }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), dialects }
  }
}
