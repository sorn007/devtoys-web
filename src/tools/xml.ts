/**
 * XML well-formedness validation and formatting via the browser DOMParser.
 *
 * DTDs, DOCTYPEs and entity declarations are REJECTED EXPLICITLY before
 * parsing — we do not merely rely on DOMParser defaults (browsers do not
 * resolve external entities today, but that is an implementation detail, not a
 * contract, and internal entity expansion attacks are still a thing).
 */

import { assertInputSize } from '@/lib/limits'

export const XML_MAX_CHARS = 1_000_000

export type XmlResult = {
  ok: boolean
  error: string | null
  formatted: string
  minified: string
  elements: number
  maxDepth: number
}

/** Rejects DOCTYPE / DTD / ENTITY declarations with specific errors. */
export function assertNoDtd(text: string): void {
  if (/<!DOCTYPE/i.test(text)) {
    throw new Error('DOCTYPE declarations are rejected: this tool validates well-formed XML only, without DTDs.')
  }
  if (/<!ENTITY/i.test(text)) {
    throw new Error('ENTITY declarations are rejected: entity expansion (XXE/billion-laughs) is not permitted.')
  }
  if (/SYSTEM\s+["']/i.test(text) || /PUBLIC\s+["']/i.test(text)) {
    throw new Error('External DTD references (SYSTEM/PUBLIC) are rejected.')
  }
}

export function validateXml(input: string): XmlResult {
  assertInputSize(input, 'XML input')
  if (input.length > XML_MAX_CHARS) {
    throw new Error(`XML is capped at ${XML_MAX_CHARS.toLocaleString()} characters.`)
  }
  const trimmed = input.trim()
  const empty: XmlResult = { ok: false, error: 'Input is empty.', formatted: '', minified: '', elements: 0, maxDepth: 0 }
  if (!trimmed) return empty
  try {
    assertNoDtd(trimmed)
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) }
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(trimmed, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    const message = parseError.textContent?.split('\n').find((l) => l.trim()) ?? 'XML is not well-formed.'
    return { ...empty, error: message.trim() }
  }
  const root = doc.documentElement
  return {
    ok: true,
    error: null,
    formatted: serialize(root, '  '),
    minified: serialize(root, ''),
    elements: countElements(root),
    maxDepth: depth(root),
  }
}

function serialize(root: Element, indent: string): string {
  const out = indent === '' ? new XMLSerializer().serializeToString(root) : pretty(root, indent, 0)
  return indent === '' ? out : `<?xml version="1.0" encoding="UTF-8"?>\n${out}`
}

function pretty(node: Element, indent: string, level: number): string {
  const pad = indent.repeat(level)
  const children = [...node.children]
  const open = `<${node.nodeName}${[...node.attributes].map((a) => ` ${a.name}="${escapeAttr(a.value)}"`).join('')}`
  if (children.length === 0) {
    const text = node.textContent?.trim() ?? ''
    return text ? `${pad}${open}>${text}</${node.nodeName}>` : `${pad}${open}/>`
  }
  const inner = children.map((c) => pretty(c, indent, level + 1)).join('\n')
  return `${pad}${open}>\n${inner}\n${pad}</${node.nodeName}>`
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
}

function countElements(root: Element): number {
  return root.querySelectorAll('*').length + 1
}

function depth(root: Element): number {
  const walk = (el: Element, d: number): number => {
    const kids = [...el.children]
    return kids.length === 0 ? d : Math.max(...kids.map((k) => walk(k, d + 1)))
  }
  return walk(root, 1)
}
