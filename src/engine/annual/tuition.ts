/**
 * Federal tuition amount (Schedule 11). Only as much tuition as is needed to
 * bring federal tax to zero is claimed; carryforward from earlier years is
 * used first, then this year's amount. Whatever is left carries forward
 * (no transfer to a parent in v1).
 */
import { add, div, floor0, lte, min, r2, sub, type Q } from '../money.ts'

export interface TuitionClaim {
  /** Schedule 11 line 13: the most tuition that can be used this year. */
  room: Q
  fromCarryforward: Q
  fromCurrentYear: Q
  /** Unused amount carried forward to next year. */
  remaining: Q
}

export function claimTuition(p: {
  taxableIncome: Q
  /** Federal tax on taxable income, before credits. */
  taxOnIncome: Q
  firstBracketThreshold: Q
  lowestRate: Q
  /** Credit amounts claimed before tuition (Schedule 11 line 12). */
  otherCreditAmounts: Q
  currentYear: Q
  carryforward: Q
}): TuitionClaim {
  // Line 11: taxable income if within the first bracket, otherwise tax / lowest rate.
  const line11 = lte(p.taxableIncome, p.firstBracketThreshold) ? p.taxableIncome : r2(div(p.taxOnIncome, p.lowestRate))
  const room = floor0(sub(line11, p.otherCreditAmounts))
  const fromCarryforward = min(p.carryforward, room) // line 14
  const fromCurrentYear = min(p.currentYear, sub(room, fromCarryforward)) // line 16
  const remaining = add(sub(p.carryforward, fromCarryforward), sub(p.currentYear, fromCurrentYear))
  return { room, fromCarryforward, fromCurrentYear, remaining }
}
