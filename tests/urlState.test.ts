import { describe, expect, it } from 'vitest'
import { parseMoney, formatMoney, formatRate } from '../src/ui/format.ts'
import { defaultState, newTerm, toCalculatorInput } from '../src/ui/state/model.ts'
import { decodeState, encodeState, hashFor, readStateFromLocation } from '../src/ui/state/urlState.ts'

const strip = (s: ReturnType<typeof defaultState>) => ({ ...s, terms: s.terms.map(({ id: _id, ...t }) => t) })

describe('URL state', () => {
  it('round-trips through the fragment, including unicode employer names', () => {
    const s = defaultState()
    s.terms = [newTerm({ employer: 'Québec Ünïcode Co ✓', amount: '31.25', frequency: 'monthly', exempt: true }), newTerm({ start: '2026-01-05', end: '2026-04-24' })]
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
    const bad = Buffer.from(JSON.stringify({ v: 1, terms: [{ frequency: 'hourly??', amount: 42, exempt: 'yes', location: 'mars' }] })).toString('base64url')
    const s = decodeState(bad)!
    expect(s.terms[0]).toMatchObject({ frequency: 'biweekly', amount: '', exempt: false, location: 'ontario' })
    expect(readStateFromLocation('#other')).toBeNull()
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
    expect(input.terms[0]!.td1).toEqual({ federalClaim: 1645200 + 700000, ontarioClaim: 1298900, exempt: false })
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
