/**
 * T4127 Chapter 6 (CPP) and Chapter 7 (EI), salary or wages, outside Quebec.
 * PM is fixed at 12: the employee is assumed to be 18-69 all year with no CPT30
 * election (out-of-scope otherwise; see scope.ts).
 */
import { exactCents, floor0, fromCents, max, min, mul, q, r2, sub, toCents, truncate, type Cents } from '../money.ts'
import type { CppParams, EiParams } from '../params/types.ts'

/**
 * Basic exemption for the pay period: 3,500 / P, "drop the third digit after
 * the decimal point" (T4127 Ch. 1 rounding; Table 6.1).
 */
export function cppBasicExemption(cpp: CppParams, periodsPerYear: number): Cents {
  return Number(truncate(mul(cpp.basicExemption, q(1, periodsPerYear))))
}

/**
 * C = lesser of (i) max contribution - D, (ii) 0.0595 x [PI - 3,500/P],
 * rounded to the cent; negative -> 0.
 */
export function cppContribution(
  cpp: CppParams,
  p: { gross: Cents; periodsPerYear: number; ytdCpp: Cents },
): Cents {
  const remaining = floor0(sub(cpp.maxContribution, fromCents(p.ytdCpp)))
  const exemption = fromCents(cppBasicExemption(cpp, p.periodsPerYear))
  const onPay = floor0(r2(mul(cpp.totalRate, sub(fromCents(p.gross), exemption))))
  return exactCents(min(remaining, onPay))
}

/**
 * C2 = lesser of (i) $416 - D2, (ii) (PIYTD + PI - W) x 0.04, where
 * W = greater of PIYTD and YMPE. Negative -> 0.
 */
export function cpp2Contribution(
  cpp: CppParams,
  p: { gross: Cents; ytdPensionable: Cents; ytdCpp2: Cents },
): Cents {
  const remaining = floor0(sub(cpp.maxSecondContribution, fromCents(p.ytdCpp2)))
  const ytd = fromCents(p.ytdPensionable)
  const W = max(ytd, cpp.ympe)
  const onPay = floor0(r2(mul(sub(fromCents(p.ytdPensionable + p.gross), W), cpp.secondAdditionalRate)))
  return exactCents(min(remaining, onPay))
}

/** EI = lesser of (i) max premium - D1, (ii) 0.0163 x IE, rounded to the cent. */
export function eiPremium(ei: EiParams, p: { insurable: Cents; ytdEi: Cents }): Cents {
  const remaining = floor0(sub(ei.maxPremium, fromCents(p.ytdEi)))
  const onPay = r2(mul(ei.rate, fromCents(p.insurable)))
  return toCents(min(remaining, onPay))
}
