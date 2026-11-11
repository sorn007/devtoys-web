/**
 * Hard, centralised bounds. Every tool reads its caps from here so the RAM
 * story is auditable in one file. Exceeding a cap throws a typed error that the
 * UI turns into an actionable message — never a silent truncation.
 */

/** Characters past which a text payload is refused outright. ~2 MiB. */
export const MAX_INPUT_CHARS = 2_000_000

/** Inputs at or above this length are routed to a Web Worker instead of the main thread. */
export const WORKER_THRESHOLD_CHARS = 64_000

/** Upper bound on lines kept per side in the text diff before degrading to coarse mode. */
export const DIFF_MAX_LINES = 4_000

/** Upper bound on the Myers edit-distance search before degrading to coarse mode. */
export const DIFF_MAX_D = 400

/** Maximum number of UUIDs generated in one batch. */
export const UUID_MAX_BATCH = 500

/** Maximum regex matches rendered into the DOM. */
export const REGEX_MAX_MATCHES = 5_000

/** Max length of any string we persist to localStorage. */
export const PREF_MAX_VALUE_CHARS = 4_000

/** Maximum persisted keys overall (FIFO eviction beyond this). */
export const PREF_MAX_KEYS = 64

/**
 * Hard wall-clock budget for one worker job. A job that exceeds it terminates
 * its worker (freeing its heap/wasm memory immediately) and reports a timeout;
 * the next job spawns a fresh worker. Applies to every offloaded tool.
 */
export const WORKER_TIMEOUT_MS = 10_000

/** Maximum passwords generated per batch. */
export const PASSWORD_MAX_BATCH = 100

/** Password length bounds (characters). */
export const PASSWORD_MIN_LENGTH = 4
export const PASSWORD_MAX_LENGTH = 256

/** Maximum characters analysed by the text analyzer (it is O(n), but not free). */
export const ANALYZER_MAX_CHARS = 2_000_000

/** Row cap for any table rendered in the DOM. */
export const TABLE_MAX_ROWS = 1_000

/**
 * Hard ceiling on DECOMPRESSED output (GZIP). The input cap cannot stop a
 * compression bomb: a few kB of gzip can expand gigabytes, so the stream is
 * aborted the moment the decoded size passes this.
 */
export const GZIP_MAX_OUTPUT_BYTES = 32 * 1024 * 1024

/** Maximum decoded pixels (width × height) an image tool will process. */
export const IMAGE_MAX_PIXELS = 40_000_000

/** Maximum single dimension (px) an image tool will process. */
export const IMAGE_MAX_DIMENSION = 12_000

export class LimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LimitError'
  }
}

/** Throws {@link LimitError} when `text` exceeds the global input cap. */
export function assertInputSize(text: string, what = 'input'): void {
  if (text.length > MAX_INPUT_CHARS) {
    throw new LimitError(
      `${what} is ${text.length.toLocaleString()} characters; the limit is ${MAX_INPUT_CHARS.toLocaleString()}.`,
    )
  }
}
