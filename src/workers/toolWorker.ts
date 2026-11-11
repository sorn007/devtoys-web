/// <reference lib="webworker" />
/**
 * Disposable compute worker. One instance per tool component; the component
 * terminates it on unmount (see lib/workerClient.ts). Large inputs are routed
 * here (see WORKER_THRESHOLD_CHARS) so parsing, hashing and diffing never block
 * or bloat the main-thread heap.
 */
import { formatJson, minifyJson } from '@/tools/json'
import { base64Decode, base64Encode } from '@/tools/base64'
import { urlDecode, urlEncode } from '@/tools/url'
import { hashText, crc32, type HashAlgorithm } from '@/tools/hash'
import { diffLines } from '@/tools/diff'
import { runRegex } from '@/tools/regex'
import { analyzeText } from '@/tools/analyzer'

export type WorkerRequest = {
  id: number
  kind:
    | 'json-format'
    | 'json-minify'
    | 'base64-encode'
    | 'base64-decode'
    | 'url-encode'
    | 'url-decode'
    | 'hash'
    | 'diff'
    | 'regex'
    | 'analyzer-stats'
  payload: Record<string, unknown>
}

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }

self.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const { id, kind, payload } = event.data
  void (async () => {
    try {
      const result = await handle(kind, payload)
      const response: WorkerResponse = { id, ok: true, result }
      self.postMessage(response)
    } catch (err) {
      const response: WorkerResponse = { id, ok: false, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
      self.postMessage(response)
    }
  })()
})

async function handle(kind: WorkerRequest['kind'], payload: Record<string, unknown>): Promise<unknown> {
  switch (kind) {
    case 'json-format':
      return formatJson(str(payload.input), num(payload.indent, 2), payload.sortKeys === true)
    case 'json-minify':
      return minifyJson(str(payload.input))
    case 'base64-encode':
      return base64Encode(str(payload.input), bool(payload.urlSafe))
    case 'base64-decode':
      return base64Decode(str(payload.input))
    case 'url-encode':
      return urlEncode(str(payload.input), payload.mode === 'full' ? 'full' : 'component')
    case 'url-decode':
      return urlDecode(str(payload.input), bool(payload.plusAsSpace))
    case 'hash':
      return payload.algorithm === 'CRC-32'
        ? { algorithm: 'CRC-32', hex: crc32(str(payload.input)), base64: '', bytes: 0 }
        : await hashText(str(payload.input), (payload.algorithm as HashAlgorithm) ?? 'SHA-256')
    case 'diff':
      return diffLines(str(payload.left), str(payload.right), { ignoreWhitespace: payload.ignoreWhitespace === true, ignoreCase: payload.ignoreCase === true })
    case 'regex':
      return runRegex(str(payload.pattern), str(payload.flags), str(payload.text), payload.replacement == null ? null : str(payload.replacement))
    case 'analyzer-stats':
      return analyzeText(str(payload.input))
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function num(v: unknown, dflt: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : dflt
}
function bool(v: unknown): boolean {
  return v === true
}
