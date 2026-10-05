/**
 * Phase 2: non-periodic payments (signing bonuses, relocation allowances,
 * retroactive pay) using the T4127 "Tax calculation formulas for bonuses"
 * method: TB = (T1 + T2 with the bonus) - (T1 + T2 without it), with the
 * bonus excluded from the CPP basic exemption (factor B).
 *
 * Only the interface is defined in v1 so the UI and annual engine can be
 * wired for it later without reshaping their inputs.
 */
import type { Cents } from '../money.ts'
import type { IsoDate } from '../params/select.ts'
import type { WithholdingParams } from '../params/types.ts'
import type { EmployerYtd, Td1 } from './types.ts'

export type NonPeriodicKind = 'signing-bonus' | 'relocation' | 'retroactive-pay' | 'other'

export interface NonPeriodicPayment {
  payDate: IsoDate
  kind: NonPeriodicKind
  /** Gross amount, cents (factor B). */
  amount: Cents
  /** Some relocation reimbursements are not taxable; the caller decides. */
  taxable: boolean
}

export interface NonPeriodicInput {
  payment: NonPeriodicPayment
  /** Regular gross pay for the period (factor I), cents. */
  regularGross: Cents
  periodsPerYear: number
  td1: Td1
  ytd: EmployerYtd
  /** Non-periodic payments already made this year with this employer (factor B1), cents. */
  ytdNonPeriodic: Cents
}

export interface NonPeriodicResult {
  cpp: Cents
  cpp2: Cents
  ei: Cents
  federalTax: Cents
  ontarioTax: Cents
  net: Cents
}

export class NotImplementedError extends Error {}

export function computeNonPeriodic(_params: WithholdingParams, _input: NonPeriodicInput): NonPeriodicResult {
  throw new NotImplementedError('Bonus / non-periodic withholding (T4127 bonus method) is planned for phase 2.')
}
