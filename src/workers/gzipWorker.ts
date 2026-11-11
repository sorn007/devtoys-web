/// <reference lib="webworker" />
/** Dedicated worker for GZIP so compression never blocks or bloats the UI thread. */
import { serve, str } from './protocol'
import { gzipCompress, gzipDecompress } from '@/tools/gzip'

serve(async (kind, payload) => {
  switch (kind) {
    case 'gzip-compress': {
      const bytes = payload.data as Uint8Array
      const out = await gzipCompress(bytes)
      return { data: out, bytes: out.byteLength }
    }
    case 'gzip-decompress': {
      const bytes = payload.data as Uint8Array
      const out = await gzipDecompress(bytes)
      const text = new TextDecoder('utf-8', { fatal: false }).decode(out)
      return { text, bytes: out.byteLength }
    }
    case 'gzip-has-native':
      return typeof CompressionStream !== 'undefined'
    default:
      throw new Error(`Unknown job kind: ${kind} (${str(payload)})`)
  }
})
