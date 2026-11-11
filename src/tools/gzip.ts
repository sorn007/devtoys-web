/**
 * GZIP via the native CompressionStream/DecompressionStream APIs, with pako
 * (MIT AND Zlib) dynamically imported only when the engine lacks them.
 *
 * Decompression is output-capped: a small gzipped payload can expand to
 * gigabytes (a "zip bomb"), so the stream is aborted as soon as the decoded
 * byte count exceeds the cap — the input-size limit alone cannot prevent that.
 */

import { GZIP_MAX_OUTPUT_BYTES } from '@/lib/limits'

export type GzipMode = 'gzip'

export function hasNativeStreams(): boolean {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
}

/** Compresses UTF-8 text into gzip bytes. */
export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  if (hasNativeStreams()) {
    return await streamThrough(new CompressionStream('gzip'), data)
  }
  const { gzip } = await import('pako')
  return gzip(data)
}

/**
 * Decompresses gzip bytes into UTF-8 text, aborting once the decompressed size
 * passes `maxOutputBytes`. Returns the byte length that was about to be
 * produced so the caller can explain the abort.
 */
export async function gzipDecompress(
  data: Uint8Array,
  maxOutputBytes: number = GZIP_MAX_OUTPUT_BYTES,
): Promise<Uint8Array> {
  if (!hasNativeStreams()) {
    // pako has no incremental-by-default mode here; inflate fully, but check
    // the cap against the reported output before handing it back so an
    // oversized result is never adopted.
    const { inflate } = await import('pako')
    let out: Uint8Array
    try {
      out = inflate(data)
    } catch (err) {
      throw new Error(`Decompression failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (out.byteLength > maxOutputBytes) {
      throw new Error(
        `Decompressed output exceeded the ${maxOutputBytes.toLocaleString()}-byte cap (a possible compression bomb) and was refused.`,
      )
    }
    return out
  }
  const stream = new DecompressionStream('gzip')
  const reader = stream.readable.getReader()
  const writer = stream.writable.getWriter()
  // Errors surface through the reader below; the write-side promises reject
  // when the stream is aborted (bomb guard) or fed corrupt input, and must not
  // become unhandled rejections.
  writer.write(data as unknown as BufferSource).catch(() => {})
  writer.close().catch(() => {})

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
    if (total > maxOutputBytes) {
      await reader.cancel()
      throw new Error(
        `Decompressed output exceeded the ${maxOutputBytes.toLocaleString()}-byte cap (a possible compression bomb) and was aborted.`,
      )
    }
  }
  return concat(chunks, total)
}

async function streamThrough(stream: CompressionStream, data: Uint8Array): Promise<Uint8Array> {
  const writer = stream.writable.getWriter()
  writer.write(data as unknown as BufferSource).catch(() => {})
  writer.close().catch(() => {})
  const reader = stream.readable.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.byteLength
  }
  return concat(chunks, total)
}

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}
