/**
 * T4127 Option 1, Steps 2-3: annual federal tax deduction T1 for periodic pay,
 * outside Quebec, no labour-sponsored funds credit (LCF = 0), no K3.
 *
 * Rounding: T4127 Appendix 1 says "results from formulas are rounded as each
 * parenthesis is resolved"; each named factor is rounded to the cent.
 */
import { add, floor0, min, mul, r2, sub, type Q } from '../money.ts'
import type { FederalParams } from '../params/types.ts'
import { bracketFor } from '../tax-tables.ts'

/** Annualized base CPP contributions and EI premiums used for the K2/K2P credits. */
export interface CreditBase {
  cpp: Q
  ei: Q
}

export interface FederalFactors {
  K1: Q
  K2: Q
  K4: Q
  T3: Q
  T1: Q
}

export function federalAnnualTax(
  fed: FederalParams,
  p: {
    /** Factor A: annual taxable income, cents. */
    A: Q
    /** Annual gross employment income for K4 (T4 box 14 equivalent), cents. */
    annualGross: Q
    /** Factor TC, cents. */
    TC: Q
    credit: CreditBase
  },
): FederalFactors {
  const rate = fed.lowestRate
  const { rate: R, constant: K } = bracketFor(fed.brackets, p.A)
  // K1 = 0.14 x TC
  const K1 = r2(mul(rate, p.TC))
  // K2 = [(0.14 x (P x C x base/total, max)) + (0.14 x (P x EI, max))]
  const K2 = add(r2(mul(rate, p.credit.cpp)), r2(mul(rate, p.credit.ei)))
  // K4 = lesser of 0.14 x annual employment income and 0.14 x CEA
  const K4 = min(r2(mul(rate, p.annualGross)), r2(mul(rate, fed.canadaEmploymentAmount)))
  // T3 = (R x A) - K - K1 - K2 - K3 - K4; negative -> 0
  const T3 = floor0(sub(r2(mul(R, p.A)), add(K, K1, K2, K4)))
  // T1 = T3 - (P x LCF), LCF = 0
  return { K1, K2, K4, T3, T1: T3 }
}
