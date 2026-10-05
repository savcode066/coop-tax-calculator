/**
 * T4127 Option 1 for one periodic paycheque, and a payroll run that carries
 * year-to-date amounts with ONE employer across paycheques.
 */
import { div, exactCents, floor0, fromCents, gte, min, mul, q, r2, toCents, type Cents, type Q } from '../money.ts'
import { defaultRegistry, editionForPayDate, type IsoDate, type ParamRegistry } from '../params/select.ts'
import type { WithholdingParams } from '../params/types.ts'
import { cpp2Contribution, cppBasicExemption, cppContribution, eiPremium } from './cpp-ei.ts'
import { federalAnnualTax } from './federal.ts'
import { ontarioAnnualTax } from './ontario.ts'
import {
  PERIODS_PER_YEAR,
  ZERO_YTD,
  type DeductionTotals,
  type EmployerYtd,
  type PayFrequency,
  type PaySlip,
  type PeriodInput,
  type PeriodResult,
  type Td1,
} from './types.ts'

export function computePeriod(params: WithholdingParams, input: PeriodInput): PeriodResult {
  const { cpp: cppP, ei: eiP } = params
  const P = input.periodsPerYear
  const { gross, ytd } = input

  // --- CPP, CPP2, EI (Chapters 6 and 7) -----------------------------------
  const C = cppContribution(cppP, { gross, periodsPerYear: P, ytdCpp: ytd.cpp })
  const C2 = cpp2Contribution(cppP, { gross, ytdPensionable: ytd.pensionable, ytdCpp2: ytd.cpp2 })
  const EI = eiPremium(eiP, { insurable: gross, ytdEi: ytd.ei })

  // --- Step 1: annual taxable income A --------------------------------------
  // F5 = C x (0.0100/0.0595) + C2, rounded; F5A = F5 for a periodic payment (B = 0).
  const F5 = exactCents(r2(mul(fromCents(C), div(cppP.firstAdditionalRate, cppP.totalRate)))) + C2
  // A = P x (I - F - F2 - F5A - U1) - HD - F1; F, F2, U1, HD, F1 are 0 here.
  const A: Q = floor0(q(P * (gross - F5)))

  // --- Credits for CPP and EI (K2 / K2P) ------------------------------------
  // Once the employee reaches the maximum with this employer, T4127 recommends
  // using the annual maximum for the rest of the year.
  const cppMaxed = gte(fromCents(ytd.cpp + C), cppP.maxContribution)
  const eiMaxed = gte(fromCents(ytd.ei + EI), eiP.maxPremium)
  const credit = {
    cpp: cppMaxed
      ? cppP.maxBaseContribution
      : min(r2(mul(q(P * C), div(cppP.baseRate, cppP.totalRate))), cppP.maxBaseContribution),
    ei: eiMaxed ? eiP.maxPremium : min(q(P * EI), eiP.maxPremium),
  }

  // --- Steps 2-5 ------------------------------------------------------------
  const fed = federalAnnualTax(params.federal, {
    A,
    annualGross: q(P * gross),
    TC: fromCents(input.td1.federalClaim),
    credit,
  })
  const on = ontarioAnnualTax(params.ontario, { A, TCP: fromCents(input.td1.ontarioClaim), credit })

  // Claim code E: T = 0, except Ontario still withholds the Health Premium.
  const T1 = input.td1.exempt ? q(0) : fed.T1
  const T2 = input.td1.exempt ? on.V2 : on.T2

  // --- Step 6: per-period deductions ---------------------------------------
  // Federal and Ontario are rounded separately, as PDOC reports them.
  const federalTax = toCents(div(T1, q(P)))
  const ontarioTax = toCents(div(T2, q(P)))

  const c = exactCents
  return {
    gross,
    cpp: C,
    cpp2: C2,
    ei: EI,
    federalTax,
    ontarioTax,
    net: gross - C - C2 - EI - federalTax - ontarioTax,
    factors: {
      cppExemption: cppBasicExemption(cppP, P),
      F5,
      A: c(A),
      K1: c(fed.K1),
      K2: c(fed.K2),
      K4: c(fed.K4),
      T3: c(fed.T3),
      T1: c(T1),
      K1P: c(on.K1P),
      K2P: c(on.K2P),
      T4: c(on.T4),
      V1: c(on.V1),
      V2: c(on.V2),
      S: c(on.S),
      T2: c(T2),
    },
  }
}

export interface ScheduledPay {
  payDate: IsoDate
  gross: Cents
}

export interface PayrollInput {
  schedule: readonly ScheduledPay[]
  frequency: PayFrequency
  td1: Td1
  /** Year-to-date with this employer before the first paycheque. */
  startingYtd?: EmployerYtd
  registry?: ParamRegistry
}

export interface PayrollResult {
  slips: PaySlip[]
  totals: DeductionTotals
  endingYtd: EmployerYtd
}

/** Run a sequence of paycheques with one employer, tracking the annual maximums. */
export function runPayroll(input: PayrollInput): PayrollResult {
  const P = PERIODS_PER_YEAR[input.frequency]
  const registry = input.registry ?? defaultRegistry
  let ytd: EmployerYtd = input.startingYtd ?? ZERO_YTD
  let year: number | undefined
  const slips: PaySlip[] = []

  for (const pay of input.schedule) {
    const payYear = Number(pay.payDate.slice(0, 4))
    // CPP/EI maximums reset with the calendar year.
    if (year !== undefined && payYear !== year) ytd = ZERO_YTD
    year = payYear
    const params = editionForPayDate(pay.payDate, registry)
    const r = computePeriod(params, { gross: pay.gross, periodsPerYear: P, td1: input.td1, ytd })
    slips.push({ ...r, payDate: pay.payDate, edition: params.edition })
    ytd = {
      pensionable: ytd.pensionable + pay.gross,
      cpp: ytd.cpp + r.cpp,
      cpp2: ytd.cpp2 + r.cpp2,
      ei: ytd.ei + r.ei,
    }
  }

  return { slips, totals: totalDeductions(slips), endingYtd: ytd }
}

export function totalDeductions(slips: readonly PeriodResult[]): DeductionTotals {
  const t: DeductionTotals = { gross: 0, cpp: 0, cpp2: 0, ei: 0, federalTax: 0, ontarioTax: 0, net: 0 }
  for (const s of slips) {
    t.gross += s.gross
    t.cpp += s.cpp
    t.cpp2 += s.cpp2
    t.ei += s.ei
    t.federalTax += s.federalTax
    t.ontarioTax += s.ontarioTax
    t.net += s.net
  }
  return t
}
