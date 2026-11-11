import { assertInputSize } from '@/lib/limits'

export type UrlComponent = 'full' | 'path' | 'query' | 'component' | 'none'

/**
 * Percent-encodes text. `mode` picks the reserved-character set:
 * - `component` — encodeURIComponent (strict, breaks URLs apart)
 * - `full`      — encodeURI (keeps :/?#&= reserved syntax intact)
 */
export function urlEncode(text: string, mode: 'component' | 'full' = 'component'): string {
  assertInputSize(text, 'text to encode')
  return mode === 'component' ? encodeURIComponent(text) : encodeURI(text)
}

/** Decodes percent-escapes. Tolerates `+` as space when `plusAsSpace` (form encoding). */
export function urlDecode(text: string, plusAsSpace = false): string {
  assertInputSize(text, 'text to decode')
  const prepared = plusAsSpace ? text.replaceAll('+', ' ') : text
  return decodeURIComponent(prepared.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))
}

export type ParsedUrl = {
  ok: boolean
  error: string | null
  href: string
  protocol: string
  username: string
  password: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
  params: { key: string; value: string }[]
}

/**
 * Splits a URL into parts plus decoded query parameters.
 * `URL` needs a base for relative inputs, so bare paths are tried against a
 * dummy origin and reported by their pathname only.
 */
export function parseUrl(input: string): ParsedUrl {
  const empty: ParsedUrl = {
    ok: false,
    error: null,
    href: '',
    protocol: '',
    username: '',
    password: '',
    hostname: '',
    port: '',
    pathname: '',
    search: '',
    hash: '',
    params: [],
  }
  const trimmed = input.trim()
  if (!trimmed) return { ...empty, error: 'Input is empty.' }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    try {
      url = new URL(trimmed, 'https://example.invalid')
      if (trimmed.includes('://')) return { ...empty, error: 'Not a parseable absolute URL.' }
    } catch {
      return { ...empty, error: 'Not a parseable URL.' }
    }
  }
  const params: { key: string; value: string }[] = []
  url.searchParams.forEach((value, key) => params.push({ key, value }))
  return {
    ok: true,
    error: null,
    href: trimmed.includes('://') ? url.href : url.pathname + url.search + url.hash,
    protocol: url.protocol,
    username: url.username,
    password: url.password,
    hostname: url.hostname,
    port: url.port,
    pathname: url.pathname,
    search: url.search,
    hash: url.hash,
    params,
  }
}
