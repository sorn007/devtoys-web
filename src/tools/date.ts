/**
 * Date/time conversions. All epoch math that can exceed 2^53 is done in BigInt
 * before converting to milliseconds, because Number arithmetic silently loses
 * seconds at microsecond/tick magnitudes (MAX_SAFE_INTEGER ≈ 9.0e15, while
 * .NET ticks today are ≈ 6.4e17).
 */

export type DateInputKind = 'unix-seconds' | 'unix-millis' | 'unix-micros' | 'dotnet-ticks' | 'iso-8601' | 'unknown'

export type ParsedDate =
  | { ok: true; kind: DateInputKind; millis: number; microsRemainder: number; source: string }
  | { ok: false; kind: 'unknown'; error: string; source: string }

const DOTNET_EPOCH_OFFSET_TICKS = 621355968000000000n // 0001-01-01 → 1970-01-01 in ticks
const MICROS_PER_MILLI = 1000n
const TICKS_PER_MILLI = 10000n
const TICKS_PER_MICRO = 10n

/**
 * Detects the shape of a date input and converts it to epoch milliseconds.
 * Pure digit strings are classified by magnitude, never by assumption — the
 * detected kind is returned so the UI can show (and correct) it.
 */
export function parseDateInput(input: string, nowMillis = Date.now()): ParsedDate {
  const source = input.trim()
  if (!source) return { ok: false, kind: 'unknown', error: 'Input is empty.', source }

  if (/^-?\d+$/.test(source)) {
    const digits = source.replace('-', '')
    const value = BigInt(source)
    // Seconds: plausible range 1970..~5138 (10 digits); accept 1–10 digits
    // only when the magnitude actually lands in seconds.
    const secondsNow = BigInt(Math.floor(nowMillis / 1000))
    if (digits.length <= 10 && value > -secondsNow * 1000n && value < secondsNow * 1000n) {
      return ok(source, 'unix-seconds', value * 1000n, 0n)
    }
    if (digits.length <= 13) {
      return ok(source, 'unix-millis', value, 0n)
    }
    if (digits.length <= 16) {
      const micros = value
      return ok(source, 'unix-micros', micros / MICROS_PER_MILLI, micros % MICROS_PER_MILLI)
    }
    if (digits.length <= 19) {
      const ms = (value - DOTNET_EPOCH_OFFSET_TICKS) / TICKS_PER_MILLI
      return ok(source, 'dotnet-ticks', ms, 0n)
    }
    return { ok: false, kind: 'unknown', error: 'Number is too large for any supported epoch format.', source }
  }

  // ISO-shaped strings are validated strictly: engines roll invalid calendar
  // dates over (2026-02-30 → March 2) instead of rejecting them.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,6}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(source)
  if (iso) {
    const [, y, mo, d] = iso
    if (!validCalendar(Number(y), Number(mo), Number(d))) {
      return { ok: false, kind: 'unknown', error: `${y}-${mo}-${d} is not a real calendar date.`, source }
    }
    const parsed = new Date(source.includes('T') || source.includes(' ') ? source : `${source}T00:00:00`)
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, kind: 'unknown', error: 'Not a parseable ISO 8601 date.', source }
    }
    return ok(source, 'iso-8601', BigInt(parsed.getTime()), 0n)
  }

  const parsed = new Date(source)
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, kind: 'unknown', error: 'Not a recognised date (expected ISO 8601, RFC 2822, or an epoch number).', source }
  }
  return ok(source, 'iso-8601', BigInt(parsed.getTime()), 0n)
}

function validCalendar(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]!
  return day <= lengths[month - 1]!
}

function ok(source: string, kind: DateInputKind, millisBig: bigint, microsRemainderBig: bigint): ParsedDate {
  return {
    ok: true,
    kind,
    millis: Number(millisBig),
    microsRemainder: Number(microsRemainderBig),
    source,
  }
}

export type DateFacts = {
  millis: number
  microsRemainder: number
  isoUtc: string
  isoLocal: string
  rfc2822: string
  unixSeconds: string
  unixMillis: string
  unixMicros: string
  dotnetTicks: string
  javaEpochMillis: string
  weekday: string
  year: number
  month: number
  day: number
  hours: number
  minutes: number
  seconds: number
}

/** Renders every supported representation of an epoch-millisecond value. */
export function describeDate(millis: number, microsRemainder = 0): DateFacts {
  const d = new Date(millis)
  if (Number.isNaN(d.getTime())) throw new RangeError('Date value is out of range.')
  const micros = BigInt(Math.trunc(millis)) * MICROS_PER_MILLI + BigInt(microsRemainder)
  return {
    millis,
    microsRemainder,
    isoUtc: d.toISOString(),
    isoLocal: localIso(d),
    rfc2822: d.toUTCString(), // RFC 1123/2822 shape from the engine's own formatter
    unixSeconds: String(micros / MICROS_PER_MILLI / 1000n),
    unixMillis: String(micros / MICROS_PER_MILLI),
    unixMicros: String(micros),
    dotnetTicks: String(micros * TICKS_PER_MICRO + DOTNET_EPOCH_OFFSET_TICKS),
    javaEpochMillis: String(micros / MICROS_PER_MILLI),
    weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(d),
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
    seconds: d.getSeconds(),
  }
}

function localIso(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  )
}

/** True when the numeric input cannot be represented exactly as a JS number. */
export function exceedsSafeInteger(text: string): boolean {
  if (!/^-?\d+$/.test(text.trim())) return false
  try {
    const v = BigInt(text.trim())
    return v > BigInt(Number.MAX_SAFE_INTEGER) || v < BigInt(Number.MIN_SAFE_INTEGER)
  } catch {
    return false
  }
}
