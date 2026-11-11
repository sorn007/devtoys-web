/// <reference lib="webworker" />
/** Dedicated worker for the cron tool: timezone-aware next-run scanning is the heavy part. */
import { serve, str } from './protocol'
import { describeCron, nextRuns, parseCron } from '@/tools/cron'

serve((kind, payload) => {
  switch (kind) {
    case 'cron-evaluate': {
      const parsed = parseCron(str(payload.expression))
      const runs = nextRuns(parsed, Number(payload.count ?? 5), str(payload.timeZone) || 'UTC', Date.now())
      return { fields: describeCron(parsed), hasSeconds: parsed.hasSeconds, macro: parsed.macros ?? null, ...runs }
    }
    default:
      throw new Error(`Unknown job kind: ${kind}`)
  }
})
