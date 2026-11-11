/**
 * Cron expression parser and "next N runs" calculator, written in-house.
 *
 * Supports 5-field (min hour dom month dow) and 6-field (sec min hour dom
 * month dow) expressions plus the @daily/@hourly/@weekly/@monthly/@yearly
 * macros, names (JAN…, SUN…), ranges, lists and steps. Evaluation is strictly
 * bounded: the search walks the selected timezone minute-by-minute (second-by-
 * second for 6-field) and gives up after MAX_SEARCH_STEPS, reporting a
 * visible "no occurrence within the search window" instead of looping forever.
 * No dependency, no eval.
 */

export const CRON_MAX_RUNS = 20
export const CRON_MAX_SEARCH_STEPS = 200_000

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type CronField = { label: string; min: number; max: number; allowed: Set<number>; raw: string }

export type ParsedCron = {
  fields: CronField[]
  hasSeconds: boolean
  macros?: string | null
}

export const MACROS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
}

export function parseCron(input: string): ParsedCron {
  const raw = input.trim().toLowerCase()
  if (!raw) throw new Error('Enter a cron expression.')
  const macro = MACROS[raw]
  const source = macro ?? raw
  const parts = source.split(/\s+/)
  if (parts.length !== 5 && parts.length !== 6) {
    throw new Error(`Expected 5 or 6 space-separated fields, got ${parts.length}.`)
  }
  const specs: { label: string; min: number; max: number; names?: string[] }[] = parts.length === 6
    ? [
        { label: 'seconds', min: 0, max: 59 },
        { label: 'minutes', min: 0, max: 59 },
        { label: 'hours', min: 0, max: 23 },
        { label: 'day of month', min: 1, max: 31 },
        { label: 'month', min: 1, max: 12, names: MONTHS },
        { label: 'day of week', min: 0, max: 6, names: DAYS },
      ]
    : [
        { label: 'minutes', min: 0, max: 59 },
        { label: 'hours', min: 0, max: 23 },
        { label: 'day of month', min: 1, max: 31 },
        { label: 'month', min: 1, max: 12, names: MONTHS },
        { label: 'day of week', min: 0, max: 6, names: DAYS },
      ]

  const fields = parts.map((part, index) => ({
    ...specs[index]!,
    allowed: parseField(part, specs[index]!),
    raw: part,
  }))
  return { fields, hasSeconds: parts.length === 6, macros: macro ? raw : null }
}

function parseField(
  part: string,
  spec: { label: string; min: number; max: number; names?: string[] },
): Set<number> {
  const allowed = new Set<number>()
  for (const chunk of part.split(',')) {
    const [rangePart, stepPart] = chunk.split('/')
    const step = stepPart === undefined ? 1 : Number.parseInt(stepPart, 10)
    if (!Number.isInteger(step) || step <= 0) throw new Error(`Invalid step "${stepPart}" in the ${spec.label} field.`)
    let lo: number
    let hi: number
    if (rangePart === '*') {
      lo = spec.min
      hi = spec.max
    } else if (rangePart.includes('-')) {
      const [a, b] = rangePart.split('-')
      lo = parseValue(a!, spec)
      hi = parseValue(b!, spec)
      if (lo > hi) throw new Error(`Range ${rangePart} is backwards in the ${spec.label} field.`)
    } else {
      lo = parseValue(rangePart, spec)
      hi = lo
    }
    if (lo < spec.min || hi > spec.max) {
      throw new Error(`${rangePart} is out of range for ${spec.label} (${spec.min}–${spec.max}).`)
    }
    for (let v = lo; v <= hi; v += step) allowed.add(v)
  }
  if (allowed.size === 0) throw new Error(`The ${spec.label} field matches nothing.`)
  return allowed
}

function parseValue(token: string, spec: { names?: string[] }): number {
  if (/^\d+$/.test(token)) return Number.parseInt(token, 10)
  if (spec.names) {
    const index = spec.names.indexOf(token.toUpperCase())
    if (index >= 0) return index + (spec.names === MONTHS ? 1 : 0)
  }
  throw new Error(`"${token}" is not a valid value here.`)
}

/** Plain-English description of each field. */
export function describeCron(parsed: ParsedCron): string[] {
  return parsed.fields.map((field) => {
    const values = [...field.allowed]
    const all = values.length === field.max - field.min + 1
    const name = (v: number) =>
      field.label === 'month' ? MONTH_NAMES[v - 1]!.toLowerCase() : field.label === 'day of week' ? DAY_NAMES[v]!.toLowerCase() : String(v)
    if (all && field.raw === '*') return `${field.label}: every ${field.label.replace(/s$/, '')}`
    if (all) return `${field.label}: every ${field.label.replace(/s$/, '')} (${field.min}–${field.max})`
    if (values.length === 1) return `${field.label}: only ${name(values[0]!)}`
    const isRange = values.length > 2 && values.every((v, idx) => idx === 0 || v === values[idx - 1]! + 1)
    if (isRange) return `${field.label}: from ${name(values[0]!)} to ${name(values[values.length - 1]!)}`
    return `${field.label}: ${values.map(name).join(', ')}`
  })
}

export type NextRunsResult = { runs: string[]; exhausted: boolean }

/**
 * Finds the next N matches, stepping through wall-clock time in the given IANA
 * timezone. The step count is hard-capped; on exhaustion the caller is told so
 * the UI can say "no match within the search window" instead of hanging.
 */
export function nextRuns(
  parsed: ParsedCron,
  count: number,
  timeZone: string,
  fromMs: number,
): NextRunsResult {
  const n = Math.max(1, Math.min(Math.floor(count) || 1, CRON_MAX_RUNS))
  const [sec, minute, hour, dom, month, dow] = parsed.hasSeconds
    ? parsed.fields
    : [undefined, ...parsed.fields]
  const allowedSec = sec?.allowed ?? new Set([0])
  const allowedMin = minute!.allowed
  const allowedHour = hour!.allowed
  const allowedDom = dom!.allowed
  const allowedMonth = month!.allowed
  const allowedDow = dow!.allowed
  const domRestricted = dom!.raw !== '*'
  const dowRestricted = dow!.raw !== '*'

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const partsCache = new Map<number, { s: number; m: number; h: number; dom: number; mo: number; dow: number }>()

  function components(ms: number) {
    const bucket = parsed.hasSeconds ? ms : Math.floor(ms / 60_000)
    const cached = partsCache.get(bucket)
    if (cached) return cached
    const parts = formatter.formatToParts(new Date(ms))
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value)
    const date = new Date(ms)
    // Day-of-week in the target zone: cheapest correct route is the zone's own date.
    const zoneDate = new Date(`${get('year')}-${String(get('month')).padStart(2, '0')}-${String(get('day')).padStart(2, '0')}T12:00:00Z`)
    const value = {
      s: get('second') % 60,
      m: get('minute'),
      h: get('hour') % 24,
      dom: get('day'),
      mo: get('month'),
      dow: zoneDate.getUTCDay(),
    }
    partsCache.set(bucket, value)
    if (partsCache.size > 4096) partsCache.clear() // bound the cache
    void date
    return value
  }

  const stepMs = parsed.hasSeconds ? 1000 : 60_000
  // Start at the next whole step boundary strictly after `fromMs`.
  let t = Math.ceil((fromMs + 1) / stepMs) * stepMs
  const runs: string[] = []
  let steps = 0
  while (runs.length < n) {
    if (++steps > CRON_MAX_SEARCH_STEPS) return { runs, exhausted: true }
    const c = components(t)
    if (
      allowedSec.has(c.s) &&
      allowedMin.has(c.m) &&
      allowedHour.has(c.h) &&
      allowedMonth.has(c.mo) &&
      // Standard cron: DOM and DOW are OR-ed when both are restricted.
      (domRestricted && dowRestricted
        ? allowedDom.has(c.dom) || allowedDow.has(c.dow)
        : allowedDom.has(c.dom) && allowedDow.has(c.dow))
    ) {
      runs.push(new Date(t).toISOString())
    }
    t += stepMs
  }
  return { runs, exhausted: false }
}
