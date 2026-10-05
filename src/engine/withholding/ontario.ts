/**
 * T4127 Option 1, Steps 4-5 for Ontario: basic provincial tax T4, surtax V1,
 * Ontario Health Premium V2, tax reduction S, and annual deduction T2.
 * No dependants (Y = 0), no LCP.
 */
import { add, floor0, mul, r2, sub, type Q } from '../money.ts'
import type { OntarioParams } from '../params/types.ts'
import { bracketFor, ontarioHealthPremium, ontarioSurtax, ontarioTaxReduction } from '../tax-tables.ts'
import type { CreditBase } from './federal.ts'

export interface OntarioFactors {
  K1P: Q
  K2P: Q
  T4: Q
  V1: Q
  V2: Q
  S: Q
  T2: Q
}

export function ontarioAnnualTax(
  on: OntarioParams,
  p: {
    A: Q
    /** Factor TCP, cents. */
    TCP: Q
    credit: CreditBase
  },
): OntarioFactors {
  const rate = on.lowestRate
  const { rate: V, constant: KP } = bracketFor(on.brackets, p.A)
  const K1P = r2(mul(rate, p.TCP))
  const K2P = add(r2(mul(rate, p.credit.cpp)), r2(mul(rate, p.credit.ei)))
  // T4 = (V x A) - KP - K1P - K2P - K3P - K4P - K5P; negative -> 0
  const T4 = floor0(sub(r2(mul(V, p.A)), add(KP, K1P, K2P)))
  const V1 = ontarioSurtax(on.surtax, T4)
  const V2 = ontarioHealthPremium(on.healthPremium, p.A)
  // Y = 0: no dependants claimed on TD1ON.
  const S = ontarioTaxReduction(on.taxReduction.basicAmount, add(T4, V1))
  // T2 = T4 + V1 + V2 - S - (P x LCP); negative -> 0
  const T2 = floor0(sub(add(T4, V1, V2), S))
  return { K1P, K2P, T4, V1, V2, S, T2 }
}
