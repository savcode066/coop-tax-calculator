import type { Cents } from '../money.ts'
import type { IsoDate } from '../params/select.ts'

export type PayFrequency = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'

/** T4127 factor P. 53/27-period years are not modelled in v1. */
export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
}

/** What the employee put on their TD1 and TD1ON forms. */
export interface Td1 {
  /** Federal TD1 total claim amount (factor TC), in cents. */
  federalClaim: Cents
  /** TD1ON total claim amount (factor TCP), in cents. */
  ontarioClaim: Cents
  /**
   * The TD1 box "my total income from all sources will be less than or equal
   * to my total claim amount" (claim code E). No income tax is withheld, except
   * the Ontario Health Premium on annualized income over $20,000. CPP and EI
   * still apply.
   */
  exempt: boolean
}

/** Year-to-date amounts with ONE employer, before the current pay period. */
export interface EmployerYtd {
  /** PIYTD: pensionable earnings */
  pensionable: Cents
  /** D: CPP (base + first additional) contributions */
  cpp: Cents
  /** D2: second additional CPP contributions */
  cpp2: Cents
  /** D1: EI premiums */
  ei: Cents
}

export const ZERO_YTD: EmployerYtd = { pensionable: 0, cpp: 0, cpp2: 0, ei: 0 }

export interface PeriodInput {
  /** Gross regular pay for the period (factors I, PI and IE), in cents. */
  gross: Cents
  /** Factor P. */
  periodsPerYear: number
  td1: Td1
  ytd: EmployerYtd
}

/** Intermediate T4127 factors, kept for explanations and debugging. All cents. */
export interface PeriodFactors {
  cppExemption: Cents
  F5: Cents
  A: Cents
  K1: Cents
  K2: Cents
  K4: Cents
  T3: Cents
  T1: Cents
  K1P: Cents
  K2P: Cents
  T4: Cents
  V1: Cents
  V2: Cents
  S: Cents
  T2: Cents
}

export interface PeriodResult {
  gross: Cents
  cpp: Cents
  cpp2: Cents
  ei: Cents
  federalTax: Cents
  ontarioTax: Cents
  net: Cents
  factors: PeriodFactors
}

export interface PaySlip extends PeriodResult {
  payDate: IsoDate
  /** Which T4127 edition produced this paycheque. */
  edition: string
}

export interface DeductionTotals {
  gross: Cents
  cpp: Cents
  cpp2: Cents
  ei: Cents
  federalTax: Cents
  ontarioTax: Cents
  net: Cents
}
