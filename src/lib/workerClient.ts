import { onBeforeUnmount, ref, type Ref } from 'vue'
import type { WorkerRequest, WorkerResponse } from '@/workers/toolWorker'
import { WORKER_TIMEOUT_MS } from './limits'

/** Minimal shape the client needs; injectable so tests can supply a fake. */
export interface WorkerLike {
  postMessage(message: unknown): void
  terminate(): void
  addEventListener(type: 'message' | 'error', listener: (event: never) => void): void
}

export type SpawnWorker = () => WorkerLike

/** Set when the user cancels or the component unmounts mid-job. */
export class CancelledError extends Error {
  constructor(message = 'Cancelled.') {
    super(message)
    this.name = 'CancelledError'
  }
}

/**
 * Owns one worker per tool component, with a hard per-job timeout.
 *
 * - The worker is created lazily on first offload and reused for the
 *   component's lifetime; `dispose()` on unmount terminates it, which is what
 *   actually releases its heap (and any wasm linear memory), not GC of the ref.
 * - A job that runs past `timeoutMs` terminates the worker — freeing its
 *   memory immediately instead of letting a pathological input pin it — and
 *   rejects the caller with a timeout error. The next job spawns a fresh
 *   worker, so one bad input never poisons the component.
 * - `cancel()` does the same for a user-initiated abort: in-flight promises
 *   reject with CancelledError and the next job gets a fresh worker.
 *
 * `spawn` lets a tool point at its own dedicated worker entry (and therefore
 * its own dependency chunk) instead of the shared toolWorker.
 */
export function useToolWorker(options: { timeoutMs?: number; spawn?: SpawnWorker } = {}) {
  const { timeoutMs = WORKER_TIMEOUT_MS, spawn = defaultSpawn } = options
  const busy: Ref<boolean> = ref(false)
  let worker: WorkerLike | null = null
  let nextId = 1
  const pending = new Map<number, {
    resolve: (v: unknown) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }>()

  function ensure(): WorkerLike {
    if (!worker) {
      worker = spawn()
      worker.addEventListener('message', (event: { data: WorkerResponse }) => {
        const msg = event.data
        const entry = pending.get(msg.id)
        if (!entry) return
        clearTimeout(entry.timer)
        pending.delete(msg.id)
        if (pending.size === 0) busy.value = false
        if (msg.ok) entry.resolve(msg.result)
        else entry.reject(new Error(msg.error))
      })
      worker.addEventListener('error', (event: { message?: string }) => {
        failAll(new Error(event.message || 'Worker failed.'))
      })
    }
    return worker
  }

  async function run<T>(kind: WorkerRequest['kind'] | (string & {}), payload: Record<string, unknown>): Promise<T> {
    busy.value = true
    const w = ensure()
    const id = nextId++
    const promise = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Kill the worker rather than wait: frees its heap/wasm memory now.
        pending.delete(id)
        w.terminate()
        if (worker === w) worker = null
        if (pending.size === 0) busy.value = false
        reject(new Error(`Job "${kind}" timed out after ${timeoutMs} ms and its worker was terminated.`))
      }, timeoutMs)
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
    })
    w.postMessage({ id, kind, payload })
    return promise
  }

  /** User-facing abort: terminate, reject in-flight work, respawn next time. */
  function cancel(): void {
    if (worker) {
      worker.terminate()
      worker = null
    }
    failAll(new CancelledError())
  }

  function failAll(error: Error): void {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    busy.value = false
  }

  function dispose(): void {
    if (worker) {
      worker.terminate() // rejects nothing by itself; in-flight promises below get the error
      worker = null
    }
    failAll(new CancelledError('Worker was disposed.'))
  }

  onBeforeUnmount(dispose)

  return { run, busy, cancel, dispose }
}

function defaultSpawn(): WorkerLike {
  const w = new Worker(new URL('../workers/toolWorker.ts', import.meta.url), { type: 'module' })
  return w as unknown as WorkerLike
}
