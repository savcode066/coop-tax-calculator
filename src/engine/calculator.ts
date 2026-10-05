/**
 * The whole calculation the UI needs, in one pure function:
 * work terms -> paycheques (Engine 1) -> annual return (Engine 2),
 * plus scope issues and the TD1 helper.
 */
import { computeAnnual } from './annual/annual.ts'
import type { AnnualResult, EmploymentSlip } from './annual/types.ts'
import type { Cents } from './money.ts'
import { annualParamsFor, defaultRegistry, editionForPayDate, supportedTaxYears, type IsoDate, type ParamRegistry } from './params/select.ts'
import { buildTermSchedule, type PayRate, type TermSchedule } from './schedule/paydates.ts'
import { isBlocking, overlapIssues, profileIssues, termIssues, yearUnavailableMessage, type Profile, type ScopeIssue, type WorkLocation, type WorkType } from './scope.ts'
import { runPayroll, type PayrollResult } from './withholding/periodic.ts'
import { ZERO_YTD, type EmployerYtd, type PayFrequency, type Td1 } from './withholding/types.ts'

export interface WorkTermInput {
  id: string
  employer: string
  start: IsoDate
  end: IsoDate
  frequency: PayFrequency
  pay: PayRate
  vacationPayPercent?: number | string
  firstPayDate?: IsoDate
  numberOfPays?: number
  td1: Td1
  location: WorkLocation
  workType: WorkType
}

export interface OtherEmployment {
  gross: Cents
  cpp: Cents
  cpp2: Cents
  ei: Cents
  incomeTax: Cents
}

export interface CalculatorInput {
  taxYear: number
  profile: Profile
  terms: readonly WorkTermInput[]
  otherEmployment: OtherEmployment
  tuition: { currentYear: Cents; carryforward: Cents }
}

export interface TermResult {
  id: string
  employer: string
  frequency: PayFrequency
  schedule: TermSchedule
  payroll: PayrollResult
}

export interface Td1Advice {
  /** Total employment income expected for the year (all terms + other). */
  yearIncome: Cents
  federalClaim: Cents
  ontarioClaim: Cents
  /** Ticking "income less than claim" is consistent with this year's numbers. */
  federalBoxReasonable: boolean
  ontarioBoxReasonable: boolean
}

export interface CalculatorResult {
  taxYear: number
  terms: TermResult[]
  annual: AnnualResult | null
  issues: ScopeIssue[]
  /** T4127 editions that produced at least one paycheque. */
  editionsUsed: string[]
  td1: Record<string, Td1Advice>
}

export const employerKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export function calculate(input: CalculatorInput, registry: ParamRegistry = defaultRegistry): CalculatorResult {
  const { taxYear } = input
  const issues: ScopeIssue[] = []
  const years = supportedTaxYears(registry)
  if (!years.includes(taxYear))
    issues.push({ code: 'unsupported-tax-year', severity: 'block', message: yearUnavailableMessage(taxYear, years) })
  issues.push(...profileIssues(input.profile, taxYear))

  const sorted = [...input.terms].sort((a, b) => a.start.localeCompare(b.start))
  const terms: TermResult[] = []
  const ytdByEmployer = new Map<string, EmployerYtd>()
  const editions = new Set<string>()

  // Without parameters for the year nothing can be calculated; report it, don't throw.
  for (const t of years.includes(taxYear) ? sorted : []) {
    const own = termIssues({ id: t.id, label: t.employer, location: t.location, workType: t.workType, start: t.start, end: t.end }, taxYear, years)
    issues.push(...own)
    if (isBlocking(own)) continue
    let schedule: TermSchedule
    try {
      schedule = buildTermSchedule(t)
    } catch (e) {
      issues.push({ code: 'invalid-term', severity: 'block', termId: t.id, message: `${t.employer || 'A term'}: ${(e as Error).message}` })
      continue
    }
    const outside = schedule.payDates.filter((d) => Number(d.slice(0, 4)) !== taxYear)
    if (outside.length) {
      issues.push({
        code: 'pay-date-outside-tax-year',
        severity: 'block',
        termId: t.id,
        message: `${t.employer || 'A term'}: a paycheque would land on ${outside[0]}, outside ${taxYear}. Set the first pay date or the number of paycheques so they all fall in ${taxYear}.`,
      })
      continue
    }
    const key = employerKey(t.employer)
    const payroll = runPayroll({
      schedule: schedule.payDates.map((payDate, i) => ({ payDate, gross: schedule.cheques[i]! })),
      frequency: t.frequency,
      td1: t.td1,
      startingYtd: ytdByEmployer.get(key) ?? ZERO_YTD,
      registry,
    })
    ytdByEmployer.set(key, payroll.endingYtd)
    for (const s of payroll.slips) editions.add(s.edition)
    terms.push({ id: t.id, employer: t.employer, frequency: t.frequency, schedule, payroll })
  }

  issues.push(
    ...overlapIssues(sorted.map((t) => ({ id: t.id, employerKey: employerKey(t.employer), label: t.employer, start: t.start, end: t.end }))),
  )

  const slips: EmploymentSlip[] = terms.map((t) => ({
    label: t.employer,
    gross: t.payroll.totals.gross,
    cpp: t.payroll.totals.cpp,
    cpp2: t.payroll.totals.cpp2,
    ei: t.payroll.totals.ei,
    incomeTax: t.payroll.totals.federalTax + t.payroll.totals.ontarioTax,
  }))
  const o = input.otherEmployment
  if (o.gross > 0 || o.incomeTax > 0) slips.push({ label: 'Other employment', ...o })

  let annual: AnnualResult | null = null
  if (!isBlocking(issues)) {
    annual = computeAnnual({ taxYear, slips, tuition: input.tuition }, registry)
    for (const w of annual.warnings)
      issues.push({
        code: w,
        severity: 'caution',
        message:
          'Your credits exceed the first federal bracket, where the proposed federal Top-Up Tax Credit may give you a little more back than shown. That credit is not modelled yet.',
      })
  }

  const yearIncome = slips.reduce((a, s) => a + s.gross, 0)
  const td1: Record<string, Td1Advice> = {}
  for (const t of input.terms)
    td1[t.id] = {
      yearIncome,
      federalClaim: t.td1.federalClaim,
      ontarioClaim: t.td1.ontarioClaim,
      federalBoxReasonable: yearIncome <= t.td1.federalClaim,
      ontarioBoxReasonable: yearIncome <= t.td1.ontarioClaim,
    }

  return {
    taxYear,
    terms,
    annual,
    issues,
    editionsUsed: [...editions].sort(),
    td1,
  }
}

const wholeCents = (x: { n: bigint; d: bigint }): Cents => Number(x.n / x.d)

/** Headline amounts for explanations, read from the annual parameters (cents). */
export function keyAmounts(taxYear: number, registry: ParamRegistry = defaultRegistry) {
  const a = annualParamsFor(taxYear, registry)
  return {
    federalBasicPersonalAmount: wholeCents(a.federal.basicPersonalAmount.max),
    ontarioBasicPersonalAmount: wholeCents(a.ontario.basicPersonalAmount),
    cppBasicExemption: wholeCents(a.cpp.basicExemption),
  }
}

/** Default TD1 claims for a tax year: the basic personal amounts (plus optional tuition on the federal TD1). */
export function defaultTd1(taxYear: number, federalTuition: Cents = 0, registry: ParamRegistry = defaultRegistry): Td1 {
  const e = editionForPayDate(`${taxYear}-01-01`, registry)
  return {
    federalClaim: wholeCents(e.federal.basicPersonalAmount.max) + federalTuition,
    ontarioClaim: wholeCents(e.ontario.basicPersonalAmount),
    exempt: false,
  }
}
