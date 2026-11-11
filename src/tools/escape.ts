/**
 * Escape/unescape for string literals and markup — pure string
 * transformations only. Nothing here evaluates JavaScript (no eval, no
 * Function, no implicit coercion of untrusted text), so unescaping attacker
 * input produces inert text, never executable code.
 */

export type EscapeTarget = 'json' | 'xml' | 'javascript'

export const ESCAPE_TARGETS: readonly { id: EscapeTarget; label: string }[] = [
  { id: 'json', label: 'JSON string' },
  { id: 'xml', label: 'XML / HTML' },
  { id: 'javascript', label: 'JavaScript / TypeScript string' },
]

export function escapeText(text: string, target: EscapeTarget, escapeNonAscii = false): string {
  let out = ''
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    out += mapEscape(ch, cp, target, escapeNonAscii)
  }
  return out
}

function mapEscape(ch: string, cp: number, target: EscapeTarget, nonAscii: boolean): string {
  if (nonAscii && cp > 0x7e) return escapeUnicode(cp)
  switch (target) {
    case 'json':
      if (ch === '"') return '\\"'
      if (ch === '\\') return '\\\\'
      return controlEscape(ch, cp, 'json')
    case 'xml':
      if (ch === '&') return '&amp;'
      if (ch === '<') return '&lt;'
      if (ch === '>') return '&gt;'
      if (ch === '"') return '&quot;'
      if (ch === "'") return '&#39;'
      return ch
    case 'javascript':
      if (ch === "'") return "\\'"
      if (ch === '"') return '\\"'
      if (ch === '\\') return '\\\\'
      if (ch === '`') return '\\`'
      if (ch === '$') return '\\$'
      return controlEscape(ch, cp, 'javascript')
  }
}

/** \u escapes are exactly 4 hex digits, so astral planes become surrogate pairs. */
function escapeUnicode(cp: number): string {
  if (cp <= 0xffff) return `\\u${cp.toString(16).padStart(4, '0')}`
  const hi = Math.floor((cp - 0x10000) / 0x400) + 0xd800
  const lo = ((cp - 0x10000) % 0x400) + 0xdc00
  return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`
}

function controlEscape(ch: string, cp: number, target: EscapeTarget): string {
  const named: Record<string, string> =
    target === 'json'
      ? { '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' }
      : { '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\v': '\\v', '\0': '\\0' }
  if (named[ch]) return named[ch]!
  if (cp < 0x20) return `\\u${cp.toString(16).padStart(4, '0')}`
  return ch
}

export function unescapeText(text: string, target: EscapeTarget): string {
  if (target === 'xml') return unescapeXml(text)
  return unescapeBackslash(text)
}

const XML_NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function unescapeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x') || body.startsWith('#X')) {
      const cp = Number.parseInt(body.slice(2), 16)
      return safeCodePoint(cp)
    }
    if (body.startsWith('#')) {
      const cp = Number.parseInt(body.slice(1), 10)
      return safeCodePoint(cp)
    }
    return XML_NAMED[body] ?? whole // unknown entity stays literal — never dropped
  })
}

function safeCodePoint(cp: number): string {
  if (!Number.isInteger(cp) || cp < 0 || cp > 0x10ffff) return ''
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ''
  }
}

/**
 * Decodes backslash escapes. Implemented as a hand-written scanner: the
 * untrusted input is never passed to eval/Function, and unknown escapes are
 * kept literally (e.g. `\q` stays `\q`) so information is not destroyed.
 */
function unescapeBackslash(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (ch !== '\\' || i === text.length - 1) {
      out += ch
      continue
    }
    const next = text[++i]!
    switch (next) {
      case 'n': out += '\n'; break
      case 'r': out += '\r'; break
      case 't': out += '\t'; break
      case 'b': out += '\b'; break
      case 'f': out += '\f'; break
      case 'v': out += '\v'; break
      case '0': out += '\0'; break
      case 'u': {
        const hex = text.slice(i + 1, i + 5)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCodePoint(Number.parseInt(hex, 16))
          i += 4
        } else {
          out += '\\u'
        }
        break
      }
      case 'x': {
        const hex = text.slice(i + 1, i + 3)
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          out += String.fromCodePoint(Number.parseInt(hex, 16))
          i += 2
        } else {
          out += '\\x'
        }
        break
      }
      // Escaped quote/backslash/dollar/backtick and any other punctuation.
      case '"': case "'": case '\\': case '`': case '$': case '/':
        out += next
        break
      default:
        out += '\\' + next
    }
  }
  return out
}
