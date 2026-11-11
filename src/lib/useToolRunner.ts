import { useToolWorker } from './workerClient'
import { WORKER_THRESHOLD_CHARS } from './limits'

/**
 * Routes a job to the main thread or a worker by input size.
 *
 * Small inputs stay on the main thread: spawning a worker for a 200-byte
 * string costs more than the work. Inputs at or above
 * WORKER_THRESHOLD_CHARS go to a disposable worker so parsing, hashing and
 * diffing never block the UI or inflate the main heap.
 */
export function useToolRunner() {
  const worker = useToolWorker()

  async function run<T>(
    totalInputChars: number,
    kind: Parameters<typeof worker.run>[0],
    payload: Record<string, unknown>,
  ): Promise<T> {
    // Regex is ALWAYS offloaded: input size says nothing about the cost of a
    // user-supplied pattern, and a catastrophic-backtracking regex must freeze
    // a disposable worker (with its 10 s timeout), never the UI thread.
    if (totalInputChars >= WORKER_THRESHOLD_CHARS || kind === 'regex') {
      return worker.run<T>(kind, payload)
    }
    return mainThread(kind, payload) as Promise<T>
  }

  return { run, busy: worker.busy }
}

/** The same dispatch table as the worker, executed inline for small inputs. */
async function mainThread(kind: string, payload: Record<string, unknown>): Promise<unknown> {
  const { formatJson, minifyJson } = await import('@/tools/json')
  const { base64Decode, base64Encode } = await import('@/tools/base64')
  const { urlDecode, urlEncode } = await import('@/tools/url')
  const { hashText, crc32 } = await import('@/tools/hash')
  const { diffLines } = await import('@/tools/diff')
  const { runRegex } = await import('@/tools/regex')
  const { analyzeText } = await import('@/tools/analyzer')

  const s = (v: unknown): string => (typeof v === 'string' ? v : '')
  switch (kind) {
    case 'json-format':
      return formatJson(s(payload.input), (payload.indent as number) ?? 2)
    case 'json-minify':
      return minifyJson(s(payload.input))
    case 'base64-encode':
      return base64Encode(s(payload.input), payload.urlSafe === true)
    case 'base64-decode':
      return base64Decode(s(payload.input))
    case 'url-encode':
      return urlEncode(s(payload.input), payload.mode === 'full' ? 'full' : 'component')
    case 'url-decode':
      return urlDecode(s(payload.input), payload.plusAsSpace === true)
    case 'hash':
      return payload.algorithm === 'CRC-32'
        ? { algorithm: 'CRC-32', hex: crc32(s(payload.input)), base64: '', bytes: 0 }
        : hashText(s(payload.input), (payload.algorithm as 'SHA-256') ?? 'SHA-256')
    case 'diff':
      return diffLines(s(payload.left), s(payload.right))
    case 'regex':
      return runRegex(s(payload.pattern), s(payload.flags), s(payload.text), payload.replacement == null ? null : s(payload.replacement))
    case 'analyzer-stats':
      return analyzeText(s(payload.input))
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
}
