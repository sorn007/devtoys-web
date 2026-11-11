/// <reference lib="webworker" />
/** Dedicated worker for the JSONPath tester, with the standard 10 s timeout. */
import { serve, str } from './protocol'
import { runJsonPath } from '@/tools/jsonpath'

serve((kind, payload) => {
  switch (kind) {
    case 'jsonpath-run':
      return runJsonPath(str(payload.query), str(payload.input))
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
