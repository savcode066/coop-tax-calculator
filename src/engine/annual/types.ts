import type { Cents } from '../money.ts'

/** What one employer reports for the year (a T4 slip, in effect). All cents. */
export interface EmploymentSlip {
  label: string
  /** Box 14: employment income (also used as pensionable and insurable earnings). */
  gross: Cents
  /** Box 16: base + first additional CPP contributions deducted. */
  cpp: Cents
  /** Box 16A: second additional CPP contributions deducted. */
  cpp2: Cents
  /** Box 18: EI premiums deducted. */
  ei: Cents
  /** Box 22: income tax deducted (federal + Ontario). */
  incomeTax: Cents
}

export interface AnnualInput {
  taxYear: number
  slips: readonly EmploymentSlip[]
  tuition: {
    /** This year's eligible tuition (T2202 box 23), cents. */
    currentYear: Cents
    /** Unused federal tuition carried forward from earlier years (notice of assessment), cents. */
    carryforward: Cents
  }
}

export interface CppAnnual {
  /** Schedule 8 line 7: earnings subject to base + first additional contributions. */
  contributoryEarnings: Cents
  requiredBase: Cents
  requiredFirstAdditional: Cents
  requiredSecondAdditional: Cents
  deducted: Cents
  deductedSecond: Cents
  /** Line 30800 (and ON428 line 58240). */
  baseCredit: Cents
  /** Line 22215. */
  enhancedDeduction: Cents
  /** Line 44800. */
  overpayment: Cents
}

export interface EiAnnual {
  insurable: Cents
  required: Cents
  deducted: Cents
  /** Line 31200 (and ON428 line 58300). */
  credit: Cents
  overpayment: Cents
  /** Line 45000: only refunded when more than $1. */
  refunded: Cents
}

export interface FederalAnnual {
  taxOnIncome: Cents
  basicPersonalAmount: Cents
  canadaEmploymentAmount: Cents
  /** Credit amounts claimed before tuition (BPA + CPP + EI + CEA). */
  creditAmountsBeforeTuition: Cents
  /** Schedule 11 line 13: most tuition that can be used this year. */
  tuitionRoom: Cents
  tuitionUsedFromCarryforward: Cents
  tuitionUsedFromCurrentYear: Cents
  nonRefundableCredits: Cents
  tax: Cents
}

export interface OntarioAnnual {
  taxOnIncome: Cents
  nonRefundableCredits: Cents
  basicTax: Cents
  surtax: Cents
  taxReduction: Cents
  liftCredit: Cents
  healthPremium: Cents
  tax: Cents
}

export type AnnualWarning = 'federal-top-up-credit-not-modelled'

export interface AnnualResult {
  taxYear: number
  employmentIncome: Cents
  netIncome: Cents
  taxableIncome: Cents
  cpp: CppAnnual
  ei: EiAnnual
  federal: FederalAnnual
  ontario: OntarioAnnual
  /** Federal + Ontario income tax actually owed for the year. */
  totalTax: Cents
  /** Income tax deducted at source across all slips. */
  totalWithheld: Cents
  /** Positive = refund; negative = balance owing. Includes CPP and EI overpayments. */
  refund: Cents
  /** Unused federal tuition carried to next year. */
  tuitionCarryforwardRemaining: Cents
  warnings: AnnualWarning[]
}
