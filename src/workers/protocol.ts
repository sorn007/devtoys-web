/**
 * Shared protocol for dedicated per-tool workers. Each tool gets its own worker
 * entry file (and therefore its own chunk graph), so a heavy dependency like
 * `yaml` or `sql-formatter` can never leak into the shared worker or the app
 * shell. Responses use the same id/ok shape as the main toolWorker.
 */

export type DedicatedRequest = {
  id: number
  kind: string
  payload: Record<string, unknown>
}

export type DedicatedResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }

export type Handler = (kind: string, payload: Record<string, unknown>) => Promise<unknown> | unknown

/** Installs the message listener; each worker file calls this with its handlers. */
export function serve(handler: Handler): void {
  self.addEventListener('message', (event: MessageEvent<DedicatedRequest>) => {
    const { id, kind, payload } = event.data
    void (async () => {
      try {
        const result = await handler(kind, payload)
        const response: DedicatedResponse = { id, ok: true, result }
        self.postMessage(response)
      } catch (err) {
        const response: DedicatedResponse = {
          id,
          ok: false,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        }
        self.postMessage(response)
      }
    })()
  })
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
