/**
 * Engine 2: the "real" annual tax. Hand-worked cases with the arithmetic in
 * comments, following the T1 / Schedule 8 / T2204 / Schedule 11 / ON428 /
 * ON428-A line order with 2026 values. Withheld amounts on the slips are what
 * Engine 1 produces for those paycheques (checked in the integration test at
 * the bottom).
 */
import { describe, expect, it } from 'vitest'
import { computeAnnual } from '../../src/engine/annual/annual.ts'
import type { EmploymentSlip } from '../../src/engine/annual/types.ts'
import { runPayroll } from '../../src/engine/withholding/periodic.ts'

// One summer term: 8 biweekly cheques of $2,500 = $20,000.
// Per cheque (Engine 1): CPP 140.74, EI 40.75, federal 242.58, Ontario 131.46.
const TERM_20K: EmploymentSlip = { label: 'Summer', gross: 2000000, cpp: 112592, cpp2: 0, ei: 32600, incomeTax: 194064 + 105168 }
// Winter: 8 x $2,800 = $22,400. Per cheque: CPP 158.59, EI 45.64, federal 301.04, Ontario 158.80.
const WINTER: EmploymentSlip = { label: 'Winter', gross: 2240000, cpp: 126872, cpp2: 0, ei: 36512, incomeTax: 240832 + 127040 }
// Fall: 8 x $2,825 = $22,600. Per cheque: CPP 160.08, EI 46.05, federal 305.94, Ontario 165.74.
const FALL: EmploymentSlip = { label: 'Fall', gross: 2260000, cpp: 128064, cpp2: 0, ei: 36840, incomeTax: 244752 + 132592 }

const NO_TUITION = { currentYear: 0, carryforward: 0 }

describe('case 1: one $20,000 term, no tuition', () => {
  // Employment income (10100)                      = 20,000.00
  // --- Schedule 8, Part 3 ---
  // line 7  earnings for base + first additional   = 20,000 - 3,500 = 16,500.00
  // line 8  CPP deducted (box 16)                  = 1,125.92
  // line 9  actual base = r2(1,125.92 x 83.1933%)  = 936.69 ; line 10 = 189.23
  // line 11 required base = 16,500 x 4.95%         = 816.75
  // line 12 required first add. = 16,500 x 1%      = 165.00
  // line 24 overpayment = (936.69-816.75) + (189.23-165.00) = 144.17
  //   (= 5.95% x (3,500 - 8 x 134.61): the employer only allowed 8/26 of the exemption)
  // line 30800 = 816.75 ; line 22215 = 165.00 ; line 44800 = 144.17
  // --- T2204 ---  required EI = 20,000 x 1.63% = 326.00 = deducted -> no overpayment
  // Net income = taxable income = 20,000 - 165.00 = 19,835.00
  // --- Federal ---
  // tax on 19,835.00 at 14%                        = 2,776.90
  // credit amounts = 16,452 + 816.75 + 326.00 + 1,501 = 19,095.75
  // credits = r2(14% x 19,095.75)                  = 2,673.41
  // federal tax = 2,776.90 - 2,673.41              = 103.49
  // --- Ontario ---
  // tax on 19,835.00 at 5.05%                      = 1,001.67
  // credits = r2(5.05% x (12,989 + 816.75 + 326.00 = 14,131.75)) = 713.65
  // basic Ontario tax = 1,001.67 - 713.65          = 288.02 ; surtax 0
  // tax reduction = min(288.02, 2 x 300 - 288.02)  = 288.02 -> Ontario tax 0 (LIFT and OHP 0)
  // --- Result ---
  // total tax = 103.49 ; withheld = 1,940.64 + 1,051.68 = 2,992.32
  // refund = 2,992.32 - 103.49 + 144.17 (CPP) + 0 (EI) = 3,033.00
  const r = computeAnnual({ taxYear: 2026, slips: [TERM_20K], tuition: NO_TUITION })

  it('CPP: Schedule 8', () => {
    expect(r.cpp.contributoryEarnings).toBe(1650000)
    expect(r.cpp.requiredBase).toBe(81675)
    expect(r.cpp.requiredFirstAdditional).toBe(16500)
    expect(r.cpp.baseCredit).toBe(81675)
    expect(r.cpp.enhancedDeduction).toBe(16500)
    expect(r.cpp.overpayment).toBe(14417)
  })
  it('EI: T2204', () => {
    expect(r.ei.required).toBe(32600)
    expect(r.ei.credit).toBe(32600)
    expect(r.ei.overpayment).toBe(0)
  })
  it('income', () => {
    expect(r.employmentIncome).toBe(2000000)
    expect(r.taxableIncome).toBe(1983500)
  })
  it('federal', () => {
    expect(r.federal.taxOnIncome).toBe(277690)
    expect(r.federal.creditAmountsBeforeTuition).toBe(1909575)
    expect(r.federal.nonRefundableCredits).toBe(267341)
    expect(r.federal.tax).toBe(10349)
  })
  it('Ontario', () => {
    expect(r.ontario.taxOnIncome).toBe(100167)
    expect(r.ontario.nonRefundableCredits).toBe(71365)
    expect(r.ontario.basicTax).toBe(28802)
    expect(r.ontario.taxReduction).toBe(28802)
    expect(r.ontario.liftCredit).toBe(0)
    expect(r.ontario.healthPremium).toBe(0)
    expect(r.ontario.tax).toBe(0)
  })
  it('refund', () => {
    expect(r.totalTax).toBe(10349)
    expect(r.totalWithheld).toBe(299232)
    expect(r.refund).toBe(303300)
    expect(r.tuitionCarryforwardRemaining).toBe(0)
  })
})

describe('case 2: two terms, two employers, $45,000 total', () => {
  // Employment income = 22,400 + 22,600            = 45,000.00
  // --- Schedule 8 ---
  // line 7 = 45,000 - 3,500                        = 41,500.00 (one $3,500 exemption for the year)
  // line 8 = 1,268.72 + 1,280.64                   = 2,549.36 ; line 9 = r2(2,549.36 x 83.1933%) = 2,120.90 ; line 10 = 428.46
  // line 11 = 41,500 x 4.95% = 2,054.25 ; line 12 = 41,500 x 1% = 415.00
  // overpayment = (2,120.90 - 2,054.25) + (428.46 - 415.00) = 80.11
  // --- T2204 ---
  // required = 45,000 x 1.63% = 733.50 ; deducted = 365.12 + 368.40 = 733.52
  // overpayment 0.02 is not refunded (must be more than $1) ; line 31200 = 733.50
  // Net income = taxable income = 45,000 - 415.00  = 44,585.00
  // --- Federal ---
  // tax on 44,585.00 at 14%                        = 6,241.90
  // credit amounts = 16,452 + 2,054.25 + 733.50 + 1,501 = 20,740.75 ; credits = r2(14% x 20,740.75) = 2,903.71
  // federal tax = 6,241.90 - 2,903.71              = 3,338.19
  // --- Ontario ---
  // tax on 44,585.00 at 5.05%                      = 2,251.54
  // credits = r2(5.05% x (12,989 + 2,054.25 + 733.50 = 15,776.75)) = 796.73
  // basic = 2,251.54 - 796.73 = 1,454.81 ; surtax 0 ; reduction = 600 - 1,454.81 < 0 -> 0
  // LIFT = min(875, 5.05% x 45,000 = 2,272.50) - 5% x (44,585 - 32,500) = 875 - 604.25 = 270.75
  // OHP on 44,585 (36,000-48,000 tier)             = min(450, 300 + 6% x 8,585) = 450.00
  // Ontario tax = 1,454.81 - 270.75 + 450.00       = 1,634.06
  // --- Result ---
  // total tax = 3,338.19 + 1,634.06                = 4,972.25
  // withheld = 3,678.72 + 3,773.44                 = 7,452.16
  // refund = 7,452.16 - 4,972.25 + 80.11 + 0       = 2,560.02
  const r = computeAnnual({ taxYear: 2026, slips: [WINTER, FALL], tuition: NO_TUITION })

  it('CPP: one exemption for the year, over-contribution refunded', () => {
    expect(r.cpp.deducted).toBe(254936)
    expect(r.cpp.requiredBase).toBe(205425)
    expect(r.cpp.requiredFirstAdditional).toBe(41500)
    expect(r.cpp.overpayment).toBe(8011)
  })
  it('EI: 2-cent overpayment is below the $1 refund threshold', () => {
    expect(r.ei.deducted).toBe(73352)
    expect(r.ei.required).toBe(73350)
    expect(r.ei.overpayment).toBe(2)
    expect(r.ei.refunded).toBe(0)
    expect(r.ei.credit).toBe(73350)
  })
  it('federal', () => {
    expect(r.taxableIncome).toBe(4458500)
    expect(r.federal.taxOnIncome).toBe(624190)
    expect(r.federal.nonRefundableCredits).toBe(290371)
    expect(r.federal.tax).toBe(333819)
  })
  it('Ontario', () => {
    expect(r.ontario.taxOnIncome).toBe(225154)
    expect(r.ontario.nonRefundableCredits).toBe(79673)
    expect(r.ontario.basicTax).toBe(145481)
    expect(r.ontario.surtax).toBe(0)
    expect(r.ontario.taxReduction).toBe(0)
    expect(r.ontario.liftCredit).toBe(27075)
    expect(r.ontario.healthPremium).toBe(45000)
    expect(r.ontario.tax).toBe(163406)
  })
  it('refund', () => {
    expect(r.totalTax).toBe(497225)
    expect(r.totalWithheld).toBe(745216)
    expect(r.refund).toBe(256002)
  })
})

describe('case 3: one $20,000 term plus $14,000 current-year tuition', () => {
  // Same as case 1 up to the federal credits.
  // Schedule 11: taxable income 19,835.00 <= 58,523, so line 11 = 19,835.00
  // line 13 tuition room = 19,835.00 - 19,095.75   = 739.25
  // carryforward used = 0 ; current-year used = min(14,000, 739.25) = 739.25
  // carried forward to next year = 14,000 - 739.25 = 13,260.75
  // credits = r2(14% x (19,095.75 + 739.25 = 19,835.00)) = 2,776.90 -> federal tax 0
  // Ontario tax 0 as in case 1 (Ontario has no tuition credit since 2017).
  // refund = 2,992.32 - 0 + 144.17                 = 3,136.49
  const r = computeAnnual({ taxYear: 2026, slips: [TERM_20K], tuition: { currentYear: 1400000, carryforward: 0 } })

  it('uses only the tuition needed and carries the rest forward', () => {
    expect(r.federal.tuitionRoom).toBe(73925)
    expect(r.federal.tuitionUsedFromCarryforward).toBe(0)
    expect(r.federal.tuitionUsedFromCurrentYear).toBe(73925)
    expect(r.tuitionCarryforwardRemaining).toBe(1326075)
    expect(r.federal.tax).toBe(0)
    expect(r.ontario.tax).toBe(0)
    expect(r.refund).toBe(313649)
  })

  it('claims carryforward before current-year tuition', () => {
    const r2 = computeAnnual({ taxYear: 2026, slips: [TERM_20K], tuition: { currentYear: 1400000, carryforward: 50000 } })
    expect(r2.federal.tuitionUsedFromCarryforward).toBe(50000)
    expect(r2.federal.tuitionUsedFromCurrentYear).toBe(23925)
    expect(r2.tuitionCarryforwardRemaining).toBe(1400000 - 23925)
  })
})

describe('edge cases', () => {
  it('no income at all: nothing owed, nothing withheld, tuition all carried forward', () => {
    const r = computeAnnual({ taxYear: 2026, slips: [], tuition: { currentYear: 700000, carryforward: 100000 } })
    expect(r.totalTax).toBe(0)
    expect(r.refund).toBe(0)
    expect(r.tuitionCarryforwardRemaining).toBe(800000)
  })

  it('insurable earnings under $2,000: all EI refunded', () => {
    const slip: EmploymentSlip = { label: 'Tiny', gross: 190000, cpp: 0, cpp2: 0, ei: 3097, incomeTax: 0 }
    const r = computeAnnual({ taxYear: 2026, slips: [slip], tuition: NO_TUITION })
    expect(r.ei.required).toBe(0)
    expect(r.ei.refunded).toBe(3097)
    expect(r.ei.credit).toBe(0)
  })

  it('under-contributed CPP (e.g. other income with nothing deducted) is credited as actually paid', () => {
    const slip: EmploymentSlip = { label: 'Other', gross: 1000000, cpp: 0, cpp2: 0, ei: 0, incomeTax: 0 }
    const r = computeAnnual({ taxYear: 2026, slips: [slip], tuition: NO_TUITION })
    expect(r.cpp.overpayment).toBe(0)
    expect(r.cpp.baseCredit).toBe(0)
    expect(r.cpp.enhancedDeduction).toBe(0)
  })

  it('a high income pays CPP2 and has nothing to refund when withholding was exact', () => {
    // 90,000 with one employer for the whole year: CPP 4,230.45 and CPP2 416.00 deducted, which is exactly required.
    const slip: EmploymentSlip = { label: 'FT', gross: 9000000, cpp: 423045, cpp2: 41600, ei: 112307, incomeTax: 0 }
    const r = computeAnnual({ taxYear: 2026, slips: [slip], tuition: NO_TUITION })
    expect(r.cpp.requiredBase).toBe(351945)
    expect(r.cpp.requiredFirstAdditional).toBe(71100)
    expect(r.cpp.requiredSecondAdditional).toBe(41600)
    expect(r.cpp.overpayment).toBe(0)
    expect(r.cpp.enhancedDeduction).toBe(71100 + 41600)
    expect(r.ei.overpayment).toBe(0)
  })

  it('warns when credit amounts exceed the first bracket (federal top-up credit not modelled)', () => {
    const r = computeAnnual({ taxYear: 2026, slips: [{ ...TERM_20K, gross: 9000000 }], tuition: { currentYear: 0, carryforward: 6000000 } })
    expect(r.warnings).toContain('federal-top-up-credit-not-modelled')
  })
})

describe('integration: Engine 1 paycheques feed Engine 2', () => {
  it('reproduces the withheld amounts used in the hand-worked slips', () => {
    const td1 = { federalClaim: 1645200, ontarioClaim: 1298900, exempt: false }
    const run = (month: number, gross: number) =>
      runPayroll({
        schedule: Array.from({ length: 8 }, (_, i) => ({ payDate: new Date(Date.UTC(2026, month, 16 + 14 * i)).toISOString().slice(0, 10), gross })),
        frequency: 'biweekly',
        td1,
      }).totals
    for (const [slip, month, gross] of [
      [TERM_20K, 0, 250000],
      [WINTER, 0, 280000],
      [FALL, 8, 282500],
    ] as const) {
      const t = run(month, gross)
      expect({ gross: t.gross, cpp: t.cpp, cpp2: t.cpp2, ei: t.ei, incomeTax: t.federalTax + t.ontarioTax }).toEqual({
        gross: slip.gross,
        cpp: slip.cpp,
        cpp2: slip.cpp2,
        ei: slip.ei,
        incomeTax: slip.incomeTax,
      })
    }
  })
})
