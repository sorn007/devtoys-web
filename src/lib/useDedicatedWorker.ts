import { useToolWorker, type WorkerLike } from './workerClient'

/**
 * Binds a tool component to its own dedicated worker entry. The URL must be a
 * static `new URL(...)` expression so Vite can code-split the worker (and any
 * dependency it imports) into its own chunk graph, isolated from the shared
 * toolWorker and the app shell.
 */
export function useDedicatedWorker(factory: () => Worker) {
  return useToolWorker({
    spawn: (): WorkerLike => factory() as unknown as WorkerLike,
  })
}
