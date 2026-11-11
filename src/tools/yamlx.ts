/**
 * JSON ⇄ YAML. Both directions go through the `yaml` package with the
 * YAML 1.2 **core** schema: no JS-specific tags, no arbitrary object
 * construction — unresolvable tags are rejected, and alias expansion is
 * bounded by `maxAliasCount`, which defeats "billion laughs" style documents.
 * The dependency is dynamically imported inside these functions so it lands in
 * this tool's chunk, never the app shell.
 */

import { assertInputSize } from '@/lib/limits'

/** Alias expansions allowed while parsing (the yaml lib's own guard). */
const MAX_ALIAS_COUNT = 100

export type ConvertResult = { ok: true; output: string } | { ok: false; error: string }

/**
 * Tag shorthands the YAML 1.2 core schema actually defines. Anything else is
 * rejected outright: the `yaml` package resolves unknown tags to null with a
 * warning, but a converter should refuse a document it cannot represent
 * faithfully rather than silently drop values.
 */
const SAFE_TAGS = new Set([
  'str', 'int', 'float', 'bool', 'null', 'seq', 'map', 'timestamp', 'binary',
  'merge', 'value', 'set', 'omap', 'pairs',
])

/** Rejects unknown explicit tags (e.g. !!python/…, !!js/function, custom !tags). */
function assertKnownTags(text: string): string | null {
  for (const match of text.matchAll(/!!([a-zA-Z0-9][\w.+-]*)/g)) {
    const tag = match[1]!.split('.').pop()!.toLowerCase()
    if (!SAFE_TAGS.has(tag)) {
      return `Unknown YAML tag "!!${match[1]}" is not supported; only core-schema tags are accepted.`
    }
  }
  if (/!<[^\s>]+>/.test(text)) return 'Verbatim YAML tags are not supported.'
  if (/(?<!&)!(?![!?\s>])[A-Za-z]/.test(text)) {
    return 'Custom YAML tags are not supported; only core-schema tags are accepted.'
  }
  return null
}

export async function yamlToJson(text: string): Promise<ConvertResult> {
  assertInputSize(text, 'YAML input')
  if (!text.trim()) return { ok: false, error: 'Input is empty.' }
  const tagError = assertKnownTags(text)
  if (tagError) return { ok: false, error: tagError }
  const YAML = await import('yaml')
  try {
    // strict: true turns "unresolved tag" warnings into errors, so documents
    // carrying unknown/JS tags are rejected instead of being parsed loosely.
    const value: unknown = YAML.parse(text, {
      schema: 'core',
      maxAliasCount: MAX_ALIAS_COUNT,
      strict: true,
    })
    if (value === undefined) return { ok: false, error: 'YAML document is empty.' }
    return { ok: true, output: JSON.stringify(value, null, 2) }
  } catch (err) {
    return { ok: false, error: friendly(err) }
  }
}

export async function jsonToYaml(text: string, indent = 2): Promise<ConvertResult> {
  assertInputSize(text, 'JSON input')
  if (!text.trim()) return { ok: false, error: 'Input is empty.' }
  const YAML = await import('yaml')
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
  try {
    return { ok: true, output: YAML.stringify(value, { indent, lineWidth: 100 }) }
  } catch (err) {
    return { ok: false, error: friendly(err) }
  }
}

/**
 * Stack-overflow from pathologically deep nesting arrives as a RangeError;
 * report it as an input problem instead of letting it surface as a crash.
 */
function friendly(err: unknown): string {
  const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
  if (err instanceof RangeError) {
    return `${message} — the document nests too deeply for this tool.`
  }
  return message
}
