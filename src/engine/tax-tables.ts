/**
 * Table lookups shared by the withholding and annual engines. Every function
 * takes its rates and thresholds as arguments; nothing here hardcodes a value.
 */
import { add, div, floor0, gt, gte, lt, lte, max, min, mul, q, r2, sub, ZERO, type Q } from './money.ts'
import type { BpaParams, Bracket, HealthPremiumTier } from './params/types.ts'

/** The bracket whose threshold is the largest one at or below `income`. */
export function bracketFor(brackets: readonly Bracket[], income: Q): Bracket {
  let found = brackets[0]!
  for (const b of brackets) if (gte(income, b.threshold)) found = b
  return found
}

/** Progressive tax on `income` (cents), unrounded: sum of rate x slice. */
export function progressiveTax(brackets: readonly Bracket[], income: Q): Q {
  let tax = ZERO
  brackets.forEach((b, i) => {
    const upper = brackets[i + 1]?.threshold
    if (lte(income, b.threshold)) return
    const top = upper && lt(upper, income) ? upper : income
    tax = add(tax, mul(b.rate, sub(top, b.threshold)))
  })
  return tax
}

/**
 * Ontario Health Premium (T4127 factor V2; ON428 line 89). The highest tier
 * whose floor the income exceeds: lesser of the tier maximum and
 * base + rate x (income - floor).
 */
export function ontarioHealthPremium(tiers: readonly HealthPremiumTier[], income: Q): Q {
  let premium = ZERO
  for (const t of tiers) {
    if (gt(income, t.over)) premium = min(t.max, add(t.base, r2(mul(t.rate, sub(income, t.over)))))
  }
  return premium
}

/** Ontario surtax (T4127 factor V1; ON428 lines 66-68) on basic Ontario tax. */
export function ontarioSurtax(surtax: readonly { threshold: Q; rate: Q }[], basicTax: Q): Q {
  return add(...surtax.map((s) => r2(mul(s.rate, floor0(sub(basicTax, s.threshold))))))
}

/**
 * Ontario tax reduction (T4127 factor S; ON428 lines 74-80):
 * lesser of the tax and [2 x (basic + dependants)] - tax; negative -> 0.
 */
export function ontarioTaxReduction(reductionAmount: Q, tax: Q): Q {
  return floor0(min(tax, sub(mul(q(2), reductionAmount), tax)))
}

/**
 * Federal basic personal amount for a net income (T4127 Ch. 2 BPAF formula,
 * which mirrors T1 line 30000). Phase-out is linear between the two
 * thresholds and rounded to the cent.
 */
export function federalBasicPersonalAmount(bpa: BpaParams, netIncome: Q): Q {
  if (lte(netIncome, bpa.phaseOutStart)) return bpa.max
  if (gte(netIncome, bpa.phaseOutEnd)) return bpa.min
  const reduction = mul(sub(netIncome, bpa.phaseOutStart), div(sub(bpa.max, bpa.min), sub(bpa.phaseOutEnd, bpa.phaseOutStart)))
  return max(bpa.min, r2(sub(bpa.max, reduction)))
}
