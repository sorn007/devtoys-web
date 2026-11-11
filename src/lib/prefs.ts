import { PREF_MAX_KEYS, PREF_MAX_VALUE_CHARS } from './limits'

/**
 * The only persistence layer in the app. Deliberately narrow:
 * - lightweight UI preferences only (never tool input, output or history)
 * - each value capped at PREF_MAX_VALUE_CHARS
 * - at most PREF_MAX_KEYS keys, oldest-insert evicted first (FIFO)
 * - failures (private mode, quota, disabled storage) degrade to in-memory
 *
 * Tool state is intentionally NOT persisted: it is the biggest RAM and storage
 * hazard in a utility app, and DevToys' own per-tool session memory is out of
 * scope for this slice.
 */

const STORE_KEY = 'toolbox.prefs.v1'
const memory = new Map<string, unknown>()

type Bag = Record<string, unknown>

function readBag(): Bag {
  if (memory.size > 0) return Object.fromEntries(memory)
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Bag) : {}
  } catch {
    return {}
  }
}

function writeBag(bag: Bag): void {
  // Drop oldest inserted keys when over the key budget.
  const keys = Object.keys(bag)
  for (let i = 0; i < keys.length - PREF_MAX_KEYS; i++) delete bag[keys[i]]
  memory.clear()
  for (const [k, v] of Object.entries(bag)) memory.set(k, v)
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(bag))
  } catch {
    /* private mode / quota — memory copy above keeps this session working */
  }
}

function truncate(value: string): string {
  return value.length <= PREF_MAX_VALUE_CHARS ? value : value.slice(0, PREF_MAX_VALUE_CHARS)
}

export const prefs = {
  getString(key: string, fallback = ''): string {
    const v = readBag()[key]
    return typeof v === 'string' ? v : fallback
  },
  setString(key: string, value: string): void {
    const bag = readBag()
    bag[key] = truncate(value)
    writeBag(bag)
  },
  getNumber(key: string, fallback: number): number {
    const v = readBag()[key]
    return typeof v === 'number' && Number.isFinite(v) ? v : fallback
  },
  setNumber(key: string, value: number): void {
    // Non-finite numbers are not persisted at all; readers keep their fallback.
    if (!Number.isFinite(value)) return
    const bag = readBag()
    bag[key] = value
    writeBag(bag)
  },
}
