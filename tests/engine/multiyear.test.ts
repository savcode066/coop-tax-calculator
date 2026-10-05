/**
 * Proves that supporting a new tax year is a data change only.
 *
 * The 2027 parameters below are SYNTHETIC test data, not real 2027 values:
 * they are the 2026 files with the tax year moved and the two 2027 changes
 * already announced (EI 1.64% up to $70,800, max $1,161.12; base CPP 4.75%).
 * Brackets, basic personal amounts and the YMPE are left at 2026 levels
 * because the CRA has not published them yet.
 */
import { describe, expect, it } from 'vitest'
import annual2026 from '../../params/annual/2026.json'
import jan2026 from '../../params/withholding/2026-01-01.json'
import jul2026 from '../../params/withholding/2026-07-01.json'
import { calculate, defaultTd1, type CalculatorInput, type WorkTermInput } from '../../src/engine/index.ts'
import { buildRegistry, editionForPayDate, supportedTaxYears } from '../../src/engine/params/select.ts'
import type { RawAnnualParams, RawWithholdingEdition } from '../../src/engine/params/types.ts'

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T
const SYN = 'SYNTHETIC TEST DATA'

function synthetic2027<T extends RawWithholdingEdition | RawAnnualParams>(base: T): T {
  const p = clone(base)
  p.taxYear = 2027
  p.cpp.baseRate = { value: '0.0475', source: SYN }
  p.cpp.totalRate = { value: '0.0575', source: SYN }
  p.cpp.maxBaseContribution = { value: '3377.25', source: SYN } // 0.0475 x 71,100
  p.cpp.maxContribution = { value: '4088.25', source: SYN } // 0.0575 x 71,100
  p.ei.rate = { value: '0.0164', source: SYN }
  p.ei.maxInsurableEarnings = { value: '70800.00', source: SYN }
  p.ei.maxPremium = { value: '1161.12', source: SYN }
  return p
}

const jan2027 = { ...synthetic2027(jan2026 as RawWithholdingEdition), edition: 'SYNTHETIC-2027', effectiveFrom: '2027-01-01' }
const annual2027 = synthetic2027(annual2026 as RawAnnualParams)
annual2027.cpp.actualBaseShare = { value: '0.826087', source: SYN } // 4.75 / 5.75
const registry = buildRegistry([jan2026, jul2026, jan2027], [annual2026, annual2027])

const term = (over: Partial<WorkTermInput> = {}): WorkTermInput => ({
  id: 'w',
  employer: 'Acme',
  start: '2027-01-04',
  end: '2027-04-23',
  frequency: 'biweekly',
  pay: { kind: 'hourly', rate: 2000, hoursPerWeek: 40 },
  td1: defaultTd1(2026),
  location: 'ontario',
  workType: 'employee',
  ...over,
})
const input = (taxYear: number, terms: WorkTermInput[]): CalculatorInput => ({
  taxYear,
  profile: { residence: 'ontario', age18to69: true },
  terms,
  otherEmployment: { gross: 0, cpp: 0, cpp2: 0, ei: 0, incomeTax: 0 },
  tuition: { currentYear: 0, carryforward: 0 },
})

describe('multi-year support', () => {
  it('lists years from the registry and picks the edition by pay date', () => {
    expect(supportedTaxYears(registry)).toEqual([2026, 2027])
    expect(editionForPayDate('2026-12-31', registry).taxYear).toBe(2026)
    expect(editionForPayDate('2027-01-15', registry).edition).toBe('SYNTHETIC-2027')
  })

  it('a 2027 term uses 2027 rates end to end', () => {
    const r = calculate(input(2027, [term({ td1: defaultTd1(2027, 0, registry) })]), registry)
    expect(r.issues).toEqual([])
    const s = r.terms[0]!.payroll.slips[0]!
    expect(s.gross).toBe(160000)
    expect(s.cpp).toBe(8426) // round(0.0575 x (1600 - 134.61)) = round(84.259925)
    expect(s.ei).toBe(2624) // 0.0164 x 1600
    expect(r.annual!.taxYear).toBe(2027)
    expect(r.editionsUsed).toEqual(['SYNTHETIC-2027'])
  })

  it('tells the student to switch years when a term is in another supported year', () => {
    const r = calculate(input(2026, [term()]), registry)
    expect(r.issues.find((i) => i.code === 'term-outside-tax-year')?.message).toMatch(/Switch the tax year to 2027/)
  })

  it('without 2027 data, a 2027 term says the rates are not published yet', () => {
    const r = calculate(input(2026, [term()]))
    expect(r.issues.find((i) => i.code === 'term-outside-tax-year')?.message).toMatch(/2027 payroll and tax rates aren't published yet/)
    const y = calculate(input(2027, [term()]))
    expect(y.issues.find((i) => i.code === 'unsupported-tax-year')?.message).toMatch(/aren't published yet/)
  })

  it('asks for a term that crosses New Year to be split', () => {
    const r = calculate(input(2026, [term({ start: '2026-09-08', end: '2027-01-08' })]))
    expect(r.issues.find((i) => i.code === 'term-outside-tax-year')?.message).toMatch(/split it into two terms/)
  })
})
