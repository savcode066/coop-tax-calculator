/**
 * Turn a work term (dates + pay) into a list of paycheques.
 *
 * Model (agreed for v1):
 *  - Term gross = weekly pay x (weekdays in the term / 5), plus vacation pay.
 *  - The first pay date is one pay period after the start date; later pay
 *    dates follow the frequency's cadence.
 *  - The number of paycheques is the term length in pay periods, rounded.
 *  - Every paycheque is equal; the last one absorbs any leftover cent.
 *  - The student can override the first pay date and the number of cheques.
 */
import { add, div, mul, parseDecimal, q, toCents, type Cents, type Q } from '../money.ts'
import type { IsoDate } from '../params/select.ts'
import { PERIODS_PER_YEAR, type PayFrequency } from '../withholding/types.ts'
import { addDays, daysBetween, lastDayOfMonth, toUtc, weekdaysInclusive, yearOf } from './dates.ts'

/** How the offer quotes pay. Amounts in cents. Annual salaries are deliberately not supported. */
export type PayRate =
  | { kind: 'hourly'; rate: Cents; hoursPerWeek: number | string }
  | { kind: 'weekly'; amount: Cents }
  | { kind: 'biweekly'; amount: Cents }
  | { kind: 'monthly'; amount: Cents }

export interface TermScheduleInput {
  start: IsoDate
  end: IsoDate
  frequency: PayFrequency
  pay: PayRate
  /** Vacation pay as a percent of gross, paid on every cheque. Default 0. */
  vacationPayPercent?: number | string
  firstPayDate?: IsoDate
  numberOfPays?: number
}

export interface TermSchedule {
  weekdays: number
  /** Gross for the whole term including vacation pay, cents. */
  termGross: Cents
  payDates: IsoDate[]
  /** Gross for each paycheque, cents; sums to termGross. */
  cheques: Cents[]
}

export class ScheduleError extends Error {}

const dec = (x: number | string): Q => parseDecimal(String(x))

/** Pay per week, exact. */
export function weeklyPay(pay: PayRate): Q {
  switch (pay.kind) {
    case 'hourly':
      return mul(q(pay.rate), dec(pay.hoursPerWeek))
    case 'weekly':
      return q(pay.amount)
    case 'biweekly':
      return div(q(pay.amount), q(2))
    case 'monthly':
      return mul(q(pay.amount), q(12, 52))
  }
}

const PERIOD_DAYS: Partial<Record<PayFrequency, number>> = { weekly: 7, biweekly: 14 }

/** Next semi-monthly (15th / month-end) or monthly (month-end) pay date on or after `from`. */
function nextCalendarPayDate(from: IsoDate, frequency: 'semimonthly' | 'monthly'): IsoDate {
  let y = yearOf(from)
  let m = Number(from.slice(5, 7)) - 1
  for (;;) {
    const candidates = frequency === 'semimonthly' ? [`${y}-${String(m + 1).padStart(2, '0')}-15`, lastDayOfMonth(y, m)] : [lastDayOfMonth(y, m)]
    for (const c of candidates) if (c >= from) return c
    m++
    if (m === 12) {
      m = 0
      y++
    }
  }
}

export function payDates(input: Pick<TermScheduleInput, 'start' | 'end' | 'frequency' | 'firstPayDate' | 'numberOfPays'>): IsoDate[] {
  const { start, end, frequency } = input
  toUtc(start)
  toUtc(end)
  if (end < start) throw new ScheduleError('The term ends before it starts.')
  const P = PERIODS_PER_YEAR[frequency]
  const days = daysBetween(start, end) + 1
  const n = input.numberOfPays ?? Math.max(1, Math.round((days / 7) * (P / 52)))
  if (!Number.isInteger(n) || n < 1 || n > 60) throw new ScheduleError('Number of paycheques must be between 1 and 60.')

  const dates: IsoDate[] = []
  const stepDays = PERIOD_DAYS[frequency]
  if (stepDays) {
    let d = input.firstPayDate ?? addDays(start, stepDays)
    for (let i = 0; i < n; i++) {
      dates.push(d)
      d = addDays(d, stepDays)
    }
  } else {
    const cal = frequency as 'semimonthly' | 'monthly'
    let d = input.firstPayDate ?? nextCalendarPayDate(addDays(start, 14), cal)
    for (let i = 0; i < n; i++) {
      dates.push(d)
      d = nextCalendarPayDate(addDays(d, 1), cal)
    }
  }
  return dates
}

export function buildTermSchedule(input: TermScheduleInput): TermSchedule {
  const dates = payDates(input)
  const weekdays = weekdaysInclusive(input.start, input.end)
  const vac = dec(input.vacationPayPercent ?? 0)
  const gross = mul(weeklyPay(input.pay), q(weekdays, 5), add(q(1), div(vac, q(100))))
  const termGross = toCents(gross)
  const n = dates.length
  const each = toCents(div(q(termGross), q(n)))
  const cheques = dates.map((_, i) => (i < n - 1 ? each : termGross - each * (n - 1)))
  return { weekdays, termGross, payDates: dates, cheques }
}
