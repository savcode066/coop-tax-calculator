import { describe, expect, it } from 'vitest'
import { weekdaysInclusive } from '../../src/engine/schedule/dates.ts'
import { buildTermSchedule, payDates, ScheduleError } from '../../src/engine/schedule/paydates.ts'

describe('weekdays', () => {
  it('counts Monday-Friday inclusive', () => {
    expect(weekdaysInclusive('2026-05-04', '2026-05-08')).toBe(5) // Mon-Fri
    expect(weekdaysInclusive('2026-05-04', '2026-05-10')).toBe(5) // Mon-Sun
    expect(weekdaysInclusive('2026-05-09', '2026-05-10')).toBe(0) // weekend
    expect(weekdaysInclusive('2026-05-04', '2026-08-21')).toBe(80) // 16 weeks
  })
})

describe('pay dates', () => {
  it('biweekly: first cheque two weeks after start, 16-week term -> 8 cheques', () => {
    const d = payDates({ start: '2026-05-04', end: '2026-08-21', frequency: 'biweekly' })
    expect(d).toHaveLength(8)
    expect(d[0]).toBe('2026-05-18')
    expect(d[7]).toBe('2026-08-24')
  })
  it('weekly: 16 cheques', () => {
    expect(payDates({ start: '2026-05-04', end: '2026-08-21', frequency: 'weekly' })).toHaveLength(16)
  })
  it('semi-monthly: 15th and month-end', () => {
    const d = payDates({ start: '2026-05-01', end: '2026-08-31', frequency: 'semimonthly' })
    expect(d).toEqual(['2026-05-15', '2026-05-31', '2026-06-15', '2026-06-30', '2026-07-15', '2026-07-31', '2026-08-15', '2026-08-31'])
  })
  it('monthly: month-ends, 4-month term -> 4 cheques', () => {
    const d = payDates({ start: '2026-01-05', end: '2026-04-24', frequency: 'monthly' })
    expect(d).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'])
  })
  it('honours overrides', () => {
    const d = payDates({ start: '2026-05-04', end: '2026-08-21', frequency: 'biweekly', firstPayDate: '2026-05-15', numberOfPays: 9 })
    expect(d).toHaveLength(9)
    expect(d[0]).toBe('2026-05-15')
    expect(d[1]).toBe('2026-05-29')
  })
  it('rejects bad input', () => {
    expect(() => payDates({ start: '2026-08-01', end: '2026-05-01', frequency: 'weekly' })).toThrow(ScheduleError)
    expect(() => payDates({ start: '2026-02-30', end: '2026-05-01', frequency: 'weekly' })).toThrow()
  })
})

describe('term gross and cheques', () => {
  it('$20/hr x 40 h for 16 weeks biweekly = 8 x $1,600', () => {
    const s = buildTermSchedule({
      start: '2026-05-04',
      end: '2026-08-21',
      frequency: 'biweekly',
      pay: { kind: 'hourly', rate: 2000, hoursPerWeek: 40 },
    })
    expect(s.termGross).toBe(1280000)
    expect(s.cheques).toEqual(Array(8).fill(160000))
  })
  it('handles 37.5 h/week and 4% vacation pay exactly', () => {
    // 27.35 x 37.5 = 1025.625 / wk x 16 wk = 16,410.00; x 1.04 = 17,066.40
    const s = buildTermSchedule({
      start: '2026-05-04',
      end: '2026-08-21',
      frequency: 'biweekly',
      pay: { kind: 'hourly', rate: 2735, hoursPerWeek: '37.5' },
      vacationPayPercent: 4,
    })
    expect(s.termGross).toBe(1706640)
    expect(s.cheques.reduce((a, b) => a + b, 0)).toBe(1706640)
    expect(s.cheques[0]).toBe(213330)
  })
  it('monthly offer of $4,000 over a 16-week term', () => {
    // 4000 x 12/52 = 923.0769.../wk x 16 = 14,769.23
    const s = buildTermSchedule({
      start: '2026-01-05',
      end: '2026-04-24',
      frequency: 'monthly',
      pay: { kind: 'monthly', amount: 400000 },
    })
    expect(s.termGross).toBe(1476923)
    expect(s.cheques).toEqual([369231, 369231, 369231, 369230])
  })
  it('biweekly offer amount', () => {
    const s = buildTermSchedule({ start: '2026-05-04', end: '2026-08-21', frequency: 'biweekly', pay: { kind: 'biweekly', amount: 250000 } })
    expect(s.cheques).toEqual(Array(8).fill(250000))
  })
})
