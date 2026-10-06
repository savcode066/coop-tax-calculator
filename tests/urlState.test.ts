import { describe, expect, it } from 'vitest'
import { parseMoney, formatMoney, formatRate } from '../src/ui/format.ts'
import { DEFAULT_TAX_YEAR, defaultState, defaultTermDates, newTerm, TAX_YEARS, toCalculatorInput, withYear } from '../src/ui/state/model.ts'
import { decodeState, encodeState, hashFor, readStateFromLocation } from '../src/ui/state/urlState.ts'

const strip = (s: ReturnType<typeof defaultState>) => ({ ...s, terms: s.terms.map(({ id: _id, ...t }) => t) })

describe('URL state', () => {
  it('round-trips through the fragment, including unicode employer names', () => {
    const s = defaultState()
    s.terms = [newTerm({ employer: 'Québec Ünïcode Co ✓', amount: '31.25', frequency: 'monthly', federalExempt: true }), newTerm({ start: '2026-01-05', end: '2026-04-24' })]
    s.tuitionCurrent = '7400'
    s.age18to69 = false
    const back = readStateFromLocation(hashFor(s))
    expect(back && strip(back)).toEqual(strip(s))
  })

  it('keeps links short by omitting defaults', () => {
    expect(encodeState(defaultState()).length).toBeLessThan(40)
  })

  it('rejects garbage and unknown versions, and ignores bad field values', () => {
    expect(decodeState('not-base64!')).toBeNull()
    expect(decodeState(Buffer.from('{"v":99}').toString('base64url'))).toBeNull()
    const bad = Buffer.from(JSON.stringify({ v: 1, terms: [{ frequency: 'hourly??', amount: 42, federalExempt: 'yes', location: 'mars' }] })).toString('base64url')
    const s = decodeState(bad)!
    expect(s.terms[0]).toMatchObject({ frequency: 'biweekly', amount: '', federalExempt: false, location: 'ontario' })
    const legacy = Buffer.from(JSON.stringify({ v: 1, terms: [{ exempt: true }] })).toString('base64url')
    expect(decodeState(legacy)!.terms[0]).toMatchObject({ federalExempt: true, ontarioExempt: true })
    expect(readStateFromLocation('#other')).toBeNull()
  })
})

describe('tax year', () => {
  it('defaults to the newest year with data, and links to unsupported years fall back to it', () => {
    expect(DEFAULT_TAX_YEAR).toBe(TAX_YEARS.at(-1))
    const bad = Buffer.from(JSON.stringify({ v: 1, taxYear: 1999, terms: [] })).toString('base64url')
    expect(decodeState(bad)!.taxYear).toBe(DEFAULT_TAX_YEAR)
    expect(toCalculatorInput(defaultState()).input.taxYear).toBe(DEFAULT_TAX_YEAR)
  })
  it('moves dates between years and picks sensible default terms', () => {
    expect(withYear('2026-09-08', 2027)).toBe('2027-09-08')
    expect(withYear('2028-02-29', 2027)).toBe('2027-02-28')
    expect(withYear('', 2027)).toBe('')
    const now = new Date('2026-10-05T12:00:00Z')
    expect(defaultTermDates(2026, now)).toEqual({ start: '2026-09-08', end: '2026-12-18' })
    expect(defaultTermDates(2027, now)).toEqual({ start: '2027-01-04', end: '2027-04-23' })
  })
})

describe('form conversion', () => {
  it('marks a term without pay as incomplete instead of computing $0', () => {
    const c = toCalculatorInput(defaultState())
    expect(c.input.terms).toHaveLength(0)
    expect(c.incomplete.size).toBe(1)
  })

  it('converts a filled term with default TD1 claims and TD1 tuition', () => {
    const s = defaultState()
    s.terms = [newTerm({ amount: '$25.50', hoursPerWeek: '37.5', td1Tuition: '7,000' })]
    const { input, errors } = toCalculatorInput(s)
    expect(errors).toEqual({})
    expect(input.terms[0]!.pay).toEqual({ kind: 'hourly', rate: 2550, hoursPerWeek: '37.5' })
    expect(input.terms[0]!.td1).toEqual({ federalClaim: 1645200 + 700000, ontarioClaim: 1298900, federalExempt: false, ontarioExempt: false })
  })

  it('reports invalid fields', () => {
    const s = defaultState()
    const id = s.terms[0]!.id
    s.terms[0] = { ...s.terms[0]!, amount: 'abc', hoursPerWeek: '200', vacationPercent: '50', numberOfPays: '2.5' }
    s.tuitionCurrent = '12.345'
    const { errors, input } = toCalculatorInput(s)
    expect(Object.keys(errors).sort()).toEqual([`${id}.amount`, `${id}.hoursPerWeek`, `${id}.numberOfPays`, `${id}.vacationPercent`, 'tuitionCurrent'].sort())
    expect(input.terms).toHaveLength(0)
  })
})

describe('formatting', () => {
  it('parses and formats money without floats', () => {
    expect(parseMoney('$1,234.5')).toBe(123450)
    expect(parseMoney('0.07')).toBe(7)
    expect(parseMoney('1.234')).toBeNull()
    expect(formatMoney(123456789)).toBe('$1,234,567.89')
    expect(formatMoney(-5)).toBe('−$0.05')
    expect(formatMoney(150050, { cents: false })).toBe('$1,500')
    expect(formatRate(299232, 2000000)).toBe('15.0%')
    expect(formatRate(10349, 2000000)).toBe('0.5%')
  })
})
