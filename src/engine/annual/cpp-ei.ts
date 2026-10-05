/**
 * Actual CPP and EI owed for the year by an employee (no self-employment),
 * resident outside Quebec, 12 contributory months.
 *   CPP: Schedule 8, Part 3 (and Part 3a / 3b).
 *   EI:  Form T2204.
 */
import { add, exactCents, floor0, fromCents, gt, lt, min, mul, r2, sub, ZERO, type Cents } from '../money.ts'
import type { AnnualParams } from '../params/types.ts'
import type { CppAnnual, EiAnnual, EmploymentSlip } from './types.ts'

type Amount = 'gross' | 'cpp' | 'cpp2' | 'ei' | 'incomeTax'
export const sumSlips = (slips: readonly EmploymentSlip[], k: Amount): Cents => slips.reduce((a, s) => a + s[k], 0)

export function annualCpp(p: AnnualParams['cpp'], slips: readonly EmploymentSlip[]): CppAnnual {
  const earnings = fromCents(sumSlips(slips, 'gross')) // line 1
  const line2 = min(earnings, p.yampe)
  const line4 = floor0(sub(line2, p.ympe)) // earnings subject to second additional
  const line5 = floor0(sub(line2, line4))
  const line7 = floor0(sub(line5, p.basicExemption)) // ONE exemption for the year
  const line8 = fromCents(sumSlips(slips, 'cpp'))
  const line9 = r2(mul(line8, p.actualBaseShare)) // actual base
  const line10 = sub(line8, line9) // actual first additional
  const line11 = min(r2(mul(line7, p.baseRate)), p.maxBaseContribution) // required base
  const line12 = min(r2(mul(line7, p.firstAdditionalRate)), sub(p.maxContribution, p.maxBaseContribution))
  const line21 = fromCents(sumSlips(slips, 'cpp2'))
  const line22 = min(r2(mul(line4, p.secondAdditionalRate)), p.maxSecondContribution)
  // line 24 = (line 9 - line 11) + (line 10 - line 12) + (line 21 - line 22)
  const line24 = add(sub(line9, line11), sub(line10, line12), sub(line21, line22))

  const over = gt(line24, ZERO)
  // Part 3a: credit and deduction use the REQUIRED amounts; the excess is refunded.
  // Part 3b (simplified): credit what was actually paid, up to what was required.
  const baseCredit = over ? line11 : min(line9, line11)
  const enhancedDeduction = over ? add(line12, line22) : add(min(line10, line12), min(line21, line22))

  const c = exactCents
  return {
    contributoryEarnings: c(line7),
    requiredBase: c(line11),
    requiredFirstAdditional: c(line12),
    requiredSecondAdditional: c(line22),
    deducted: c(line8),
    deductedSecond: c(line21),
    baseCredit: c(baseCredit),
    enhancedDeduction: c(enhancedDeduction),
    overpayment: over ? c(line24) : 0,
  }
}

export function annualEi(p: AnnualParams['ei'], slips: readonly EmploymentSlip[]): EiAnnual {
  const insurable = fromCents(sumSlips(slips, 'gross'))
  // T2204 line 1: enter 0 if insurable earnings are less than $2,000.
  const line1 = lt(insurable, p.refundAllIfInsurableBelow) ? ZERO : insurable
  const line9 = fromCents(sumSlips(slips, 'ei'))
  const line12 = min(r2(mul(min(line1, p.maxInsurableEarnings), p.rate)), p.maxPremium)
  const overpayment = floor0(sub(line9, line12))
  const c = exactCents
  return {
    insurable: c(insurable),
    required: c(line12),
    deducted: c(line9),
    credit: c(min(line9, line12)),
    overpayment: c(overpayment),
    // T2204 line 15: refunded only if more than $1.
    refunded: gt(overpayment, p.minimumRefund) ? c(overpayment) : 0,
  }
}
