/** Calendar helpers on ISO dates ("YYYY-MM-DD"), all in UTC so time zones never shift a day. */
import type { IsoDate } from '../params/select.ts'

const DAY_MS = 86_400_000

export const isIsoDate = (s: string): s is IsoDate => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export const toUtc = (d: IsoDate): number => {
  if (!isIsoDate(d)) throw new RangeError(`Invalid date: ${d}`)
  return Date.parse(`${d}T00:00:00Z`)
}

export const fromUtc = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10)

export const addDays = (d: IsoDate, n: number): IsoDate => fromUtc(toUtc(d) + n * DAY_MS)

/** Whole days from a to b (b - a). */
export const daysBetween = (a: IsoDate, b: IsoDate): number => Math.round((toUtc(b) - toUtc(a)) / DAY_MS)

export const lastDayOfMonth = (year: number, month0: number): IsoDate => fromUtc(Date.UTC(year, month0 + 1, 0))

/** Monday-Friday days in [start, end], inclusive. */
export function weekdaysInclusive(start: IsoDate, end: IsoDate): number {
  const n = daysBetween(start, end) + 1
  if (n <= 0) return 0
  const startDow = new Date(toUtc(start)).getUTCDay() // 0 = Sunday
  let count = Math.floor(n / 7) * 5
  for (let i = 0; i < n % 7; i++) {
    const dow = (startDow + i) % 7
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}

export const yearOf = (d: IsoDate): number => Number(d.slice(0, 4))
