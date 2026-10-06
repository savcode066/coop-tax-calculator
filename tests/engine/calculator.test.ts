import { describe, expect, it } from 'vitest'
import { calculate, defaultTd1, type CalculatorInput, type WorkTermInput } from '../../src/engine/index.ts'

const td1 = defaultTd1(2026)
const term = (over: Partial<WorkTermInput> = {}): WorkTermInput => ({
  id: 't1',
  employer: 'Acme',
  start: '2026-05-04',
  end: '2026-08-21',
  frequency: 'biweekly',
  pay: { kind: 'hourly', rate: 2000, hoursPerWeek: 40 },
  td1,
  location: 'ontario',
  workType: 'employee',
  ...over,
})
const base = (terms: WorkTermInput[], over: Partial<CalculatorInput> = {}): CalculatorInput => ({
  taxYear: 2026,
  profile: { residence: 'ontario', age18to69: true },
  terms,
  otherEmployment: { gross: 0, cpp: 0, cpp2: 0, ei: 0, incomeTax: 0 },
  tuition: { currentYear: 0, carryforward: 0 },
  ...over,
})

describe('calculator', () => {
  it('default TD1 is the 2026 basic personal amounts', () => {
    expect(td1).toEqual({ federalClaim: 1645200, ontarioClaim: 1298900, federalExempt: false, ontarioExempt: false })
    expect(defaultTd1(2026, 700000).federalClaim).toBe(2345200)
  })

  it('one summer term: 8 cheques of $1,600 and a refund', () => {
    const r = calculate(base([term()]))
    expect(r.issues).toEqual([])
    const t = r.terms[0]!
    expect(t.payroll.slips).toHaveLength(8)
    expect(t.payroll.slips[0]!.net).toBe(130810) // matches the hand-worked withholding case
    expect(r.annual!.employmentIncome).toBe(1280000)
    expect(r.annual!.refund).toBeGreaterThan(0)
    expect(r.editionsUsed.length).toBe(2) // May-Aug pay dates span both 2026 editions
  })

  it('same employer for two terms shares year-to-date maximums', () => {
    const big = { kind: 'hourly', rate: 6000, hoursPerWeek: 40 } as const
    const a = term({ id: 'a', start: '2026-01-05', end: '2026-04-24', pay: big })
    const b = term({ id: 'b', start: '2026-05-04', end: '2026-08-21', pay: big })
    const same = calculate(base([a, b]))
    const diff = calculate(base([a, { ...b, employer: 'Other Co' }]))
    const eiSame = same.terms.reduce((s, t) => s + t.payroll.totals.ei, 0)
    const eiDiff = diff.terms.reduce((s, t) => s + t.payroll.totals.ei, 0)
    // $60/hr x 40 x 32 weeks = $76,800: one employer stops at the EI max, two employers each deduct.
    expect(eiSame).toBe(112307)
    expect(eiDiff).toBeGreaterThan(112307)
    expect(diff.annual!.ei.refunded).toBe(eiDiff - 112307)
  })

  it('blocks out-of-scope situations instead of showing a number', () => {
    for (const [over, code] of [
      [{ location: 'outside-canada' }, 'work-outside-canada'],
      [{ location: 'quebec' }, 'work-quebec'],
      [{ location: 'other-province' }, 'work-other-province'],
      [{ workType: 'contractor' }, 'contractor'],
      [{ start: '2025-09-01', end: '2025-12-19' }, 'term-outside-tax-year'],
    ] as const) {
      const r = calculate(base([term(over)]))
      expect(r.issues.map((i) => i.code)).toContain(code)
      expect(r.annual).toBeNull()
    }
    for (const [profile, code] of [
      [{ residence: 'quebec', age18to69: true }, 'residence-quebec'],
      [{ residence: 'other-province', age18to69: true }, 'residence-other-province'],
      [{ residence: 'non-resident', age18to69: true }, 'non-resident'],
      [{ residence: 'ontario', age18to69: false }, 'age-outside-18-69'],
    ] as const) {
      const r = calculate(base([term()], { profile }))
      expect(r.issues.map((i) => i.code)).toContain(code)
      expect(r.annual).toBeNull()
    }
  })

  it('flags a paycheque that would land in the next year', () => {
    // The 9th biweekly cheque from Sep 22 lands on 2027-01-12.
    const r = calculate(base([term({ start: '2026-09-08', end: '2026-12-31', numberOfPays: 9 })]))
    expect(r.issues.map((i) => i.code)).toContain('pay-date-outside-tax-year')
  })

  it('flags overlapping jobs as a caution, still computing', () => {
    const r = calculate(base([term({ id: 'a' }), term({ id: 'b', employer: 'Night job', start: '2026-06-01', end: '2026-07-31' })]))
    expect(r.issues.find((i) => i.code === 'overlapping-jobs')?.severity).toBe('caution')
    expect(r.annual).not.toBeNull()
  })

  it('reports bad dates as an issue, not a crash', () => {
    const r = calculate(base([term({ start: '2026-08-21', end: '2026-05-04' })]))
    expect(r.issues.map((i) => i.code)).toContain('invalid-term')
  })

  it('TD1 helper: box reasonable only when the whole year stays under the claim', () => {
    const small = calculate(base([term({ pay: { kind: 'hourly', rate: 1700, hoursPerWeek: 20 } })]))
    // 17 x 20 x 16 = 5,440 for the year
    expect(small.td1.t1).toMatchObject({ yearIncome: 544000, federalBoxReasonable: true, ontarioBoxReasonable: true })
    const big = calculate(base([term()]))
    expect(big.td1.t1).toMatchObject({ yearIncome: 1280000, federalBoxReasonable: true, ontarioBoxReasonable: true })
    const two = calculate(base([term({ id: 't1' }), term({ id: 't2', employer: 'B', start: '2026-09-08', end: '2026-12-18' })]))
    expect(two.td1.t1!.federalBoxReasonable).toBe(false)
  })

  it('ticking the box with a second term later in the year leads to a balance owing', () => {
    const exempt = { ...td1, federalExempt: true, ontarioExempt: true }
    const r = calculate(
      base([
        term({ id: 'a', td1: exempt, pay: { kind: 'hourly', rate: 3000, hoursPerWeek: 40 } }),
        term({ id: 'b', employer: 'B', td1: exempt, start: '2026-09-08', end: '2026-12-18', pay: { kind: 'hourly', rate: 3000, hoursPerWeek: 40 } }),
      ]),
    )
    expect(r.annual!.refund).toBeLessThan(0)
  })

  it('works across a wide range of pay for every frequency without throwing', () => {
    for (const frequency of ['weekly', 'biweekly', 'semimonthly', 'monthly'] as const)
      for (let rate = 1700; rate <= 12000; rate += 350) {
        const r = calculate(base([term({ frequency, pay: { kind: 'hourly', rate, hoursPerWeek: 40 } })]))
        expect(r.annual).not.toBeNull()
        const a = r.annual!
        const t = r.terms[0]!.payroll.totals
        // Refund identity
        expect(a.refund).toBe(a.totalWithheld - a.totalTax + a.cpp.overpayment + a.ei.refunded)
        // A single 4-month term always over-withholds income tax relative to the year.
        expect(a.totalWithheld).toBeGreaterThanOrEqual(a.totalTax)
        expect(t.net + t.cpp + t.cpp2 + t.ei + t.federalTax + t.ontarioTax).toBe(t.gross)
      }
  })
})
