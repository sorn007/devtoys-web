/// <reference lib="webworker" />
/** Dedicated worker for XSD validation: keeps the 760 kB wasm out of every other chunk. */
import { serve, str } from './protocol'
import { validateAgainstXsd } from '@/tools/xsd'

serve(async (kind, payload) => {
  switch (kind) {
    case 'xsd-validate':
      return validateAgainstXsd(
        str(payload.xml),
        str(payload.schema),
        Array.isArray(payload.preloads) ? (payload.preloads as string[]) : [],
      )
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
