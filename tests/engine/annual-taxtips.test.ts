/**
 * Independent cross-check of Engine 2 against the TaxTips.ca "2025 and 2026
 * Canadian Tax Calculator" (spreadsheet version "tax calculator 2026 08 25"),
 * retrieved 2026-10-05. Inputs: Ontario, 2026, single, born 2000, no Canada
 * Workers Benefit, all employment income pensionable and insurable, and CPP /
 * CPP2 / EI deducted exactly as required.
 *
 * TaxTips displays whole dollars, so each line is compared within $1. (PDOC
 * fixtures, by contrast, are exact to the cent.)
 */
import { describe, expect, it } from 'vitest'
import { computeAnnual } from '../../src/engine/annual/annual.ts'

const TAXTIPS = [
  { id: "t10k", income: 10000, tuition: 0, carryforward: 0, taxable: 9935, fedTax: 0, reduction: 0, lift: 0, ohp: 0, tuitionClaimed: 0, total: 0 },
  { id: "t20k", income: 20000, tuition: 0, carryforward: 0, taxable: 19835, fedTax: 103, reduction: 288, lift: 0, ohp: 0, tuitionClaimed: 0, total: 103 },
  { id: "t30k", income: 30000, tuition: 0, carryforward: 0, taxable: 29735, fedTax: 1397, reduction: 0, lift: 755, ohp: 300, tuitionClaimed: 0, total: 1697 },
  { id: "t45k", income: 45000, tuition: 0, carryforward: 0, taxable: 44585, fedTax: 3338, reduction: 0, lift: 271, ohp: 450, tuitionClaimed: 0, total: 4972 },
  { id: "t60k", income: 60000, tuition: 0, carryforward: 0, taxable: 59435, fedTax: 5338, reduction: 0, lift: 0, ohp: 600, tuitionClaimed: 0, total: 8321 },
  { id: "t80k", income: 80000, tuition: 0, carryforward: 0, taxable: 79073, fedTax: 9243, reduction: 0, lift: 0, ohp: 750, tuitionClaimed: 0, total: 14128 },
  { id: "t20k-14k-tuition", income: 20000, tuition: 14000, carryforward: 0, taxable: 19835, fedTax: 0, reduction: 288, lift: 0, ohp: 0, tuitionClaimed: 739, total: 0 },
  { id: "t35k-15k-tuition", income: 35000, tuition: 15000, carryforward: 0, taxable: 34685, fedTax: 0, reduction: 0, lift: 766, ohp: 300, tuitionClaimed: 14602, total: 522 },
  { id: "t50k-cf5k-tuition7k", income: 50000, tuition: 7000, carryforward: 5000, taxable: 49535, fedTax: 2305, reduction: 0, lift: 23, ohp: 600, tuitionClaimed: 12000, total: 4570 },
  { id: "t25k-cf20k", income: 25000, tuition: 0, carryforward: 20000, taxable: 24785, fedTax: 0, reduction: 79, lift: 443, ohp: 287, tuitionClaimed: 5360, total: 287 },
]

const dollars = (c: number) => Math.round(c / 100)

describe('annual tax agrees with TaxTips.ca 2026 (to the dollar)', () => {
  for (const t of TAXTIPS) {
    it(t.id, () => {
      const E = t.income * 100
      const X = Math.max(0, Math.min(E, 7460000) - 350000)
      const slip = {
        label: t.id,
        gross: E,
        cpp: Math.round(X * 0.0495) + Math.round(X * 0.01),
        cpp2: Math.round(Math.max(0, Math.min(E, 8500000) - 7460000) * 0.04),
        ei: Math.round(Math.min(E, 6890000) * 0.0163),
        incomeTax: 0,
      }
      const a = computeAnnual({ taxYear: 2026, slips: [slip], tuition: { currentYear: t.tuition * 100, carryforward: t.carryforward * 100 } })
      const ours = {
        taxable: dollars(a.taxableIncome),
        fedTax: dollars(a.federal.tax),
        reduction: dollars(a.ontario.taxReduction),
        lift: dollars(a.ontario.liftCredit),
        ohp: dollars(a.ontario.healthPremium),
        tuitionClaimed: dollars(a.federal.tuitionUsedFromCarryforward + a.federal.tuitionUsedFromCurrentYear),
        total: dollars(a.totalTax),
      }
      for (const [k, v] of Object.entries(ours)) expect(Math.abs(v - t[k as keyof typeof ours]), k).toBeLessThanOrEqual(1)
    })
  }
})
