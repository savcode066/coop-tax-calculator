import { describe, expect, it } from 'vitest'
import { editionForPayDate } from '../../src/engine/params/select.ts'
import { cppBasicExemption, cppContribution, cpp2Contribution, eiPremium } from '../../src/engine/withholding/cpp-ei.ts'
import { computePeriod, runPayroll } from '../../src/engine/withholding/periodic.ts'
import { ZERO_YTD, type Td1 } from '../../src/engine/withholding/types.ts'

const JAN = editionForPayDate('2026-03-01')
const BASIC_TD1: Td1 = { federalClaim: 1645200, ontarioClaim: 1298900, federalExempt: false, ontarioExempt: false }

describe('CPP basic exemption per period (T4127 Table 6.1, truncated)', () => {
  it.each([
    [52, 6730],
    [26, 13461],
    [24, 14583],
    [12, 29166],
  ])('P=%i -> %i cents', (P, cents) => {
    expect(cppBasicExemption(JAN.cpp, P)).toBe(cents)
  })
})

describe('T4127 worked examples', () => {
  it('weekly $1,000 (bonus example): C = $55.50, EI = $16.30, K1 = $2,303.28, K4 = $210.14', () => {
    expect(cppContribution(JAN.cpp, { gross: 100000, periodsPerYear: 52, ytdCpp: 0 })).toBe(5550)
    expect(eiPremium(JAN.ei, { insurable: 100000, ytdEi: 0 })).toBe(1630)
    const r = computePeriod(JAN, { gross: 100000, periodsPerYear: 52, td1: BASIC_TD1, ytd: ZERO_YTD })
    expect(r.factors.K1).toBe(230328)
    expect(r.factors.K4).toBe(21014)
  })

  it('Appendix 1, Scenario 1: semi-monthly $4,200 for a full year (C, C2 and F5 per period)', () => {
    // Expected values transcribed from T4127-JAN-2026 Appendix 1, Table 1.
    const C = [...Array(17).fill(24122), 12971, 0, 0, 0, 0, 0, 0]
    const C2 = [...Array(17).fill(0), 4000, 16800, 16800, 4000, 0, 0, 0]
    const F5 = [...Array(17).fill(4054), 6180, 16800, 16800, 4000, 0, 0, 0]
    const schedule = Array.from({ length: 24 }, (_, i) => {
      const month = String(Math.floor(i / 2) + 1).padStart(2, '0')
      return { payDate: `2026-${month}-${i % 2 === 0 ? '15' : '28'}`, gross: 420000 }
    })
    const { slips, totals } = runPayroll({ schedule, frequency: 'semimonthly', td1: BASIC_TD1 })
    expect(slips.map((s) => s.cpp)).toEqual(C)
    expect(slips.map((s) => s.cpp2)).toEqual(C2)
    expect(slips.map((s) => s.factors.F5)).toEqual(F5)
    expect(totals.cpp).toBe(423045)
    expect(totals.cpp2).toBe(41600)
  })

  it('Appendix 1, Scenario 1, period 18 in isolation (W = YMPE)', () => {
    const c2 = cpp2Contribution(JAN.cpp, { gross: 420000, ytdPensionable: 7140000, ytdCpp2: 0 })
    expect(c2).toBe(4000)
  })
})

describe('hand-worked: $20/hr x 40 h, biweekly ($1,600), January edition, basic TD1', () => {
  // P = 26
  // CPP exemption     = trunc(3500 / 26)                         = 134.61
  // C                 = round(0.0595 x (1600 - 134.61))          = round(87.190705)   = 87.19
  // EI                = round(0.0163 x 1600)                     = 26.08
  // F5                = round(87.19 x 0.01/0.0595)               = round(14.653782)   = 14.65
  // A                 = 26 x (1600 - 14.65)                      = 41,219.10
  // R x A             = round(0.14 x 41,219.10)                  = round(5770.674)    = 5,770.67
  // K1                = round(0.14 x 16,452)                     = 2,303.28
  // CPP for credit    = round(26 x 87.19 x 0.0495/0.0595)        = round(1885.94168)  = 1,885.94
  // EI for credit     = 26 x 26.08                               = 678.08
  // K2                = round(0.14 x 1,885.94) + round(0.14 x 678.08) = 264.03 + 94.93 = 358.96
  // K4                = min(0.14 x 41,600, 0.14 x 1,501)         = 210.14
  // T3 = T1           = 5,770.67 - 0 - 2,303.28 - 358.96 - 210.14 = 2,898.29
  // Federal / period  = round(2,898.29 / 26)                     = round(111.47269)   = 111.47
  // V x A             = round(0.0505 x 41,219.10)                = round(2081.56455)  = 2,081.56
  // K1P               = round(0.0505 x 12,989)                   = round(655.9445)    = 655.94
  // K2P               = round(0.0505 x 1,885.94) + round(0.0505 x 678.08) = 95.24 + 34.24 = 129.48
  // T4                = 2,081.56 - 0 - 655.94 - 129.48           = 1,296.14
  // V1 (surtax)       = 0 (T4 <= 5,818)
  // V2 (OHP)          = A in (36,000, 48,000]: min(450, 300 + 0.06 x 5,219.10) = 450.00
  // S                 = max(0, min(1,296.14, 2 x 300 - 1,296.14)) = 0
  // T2                = 1,296.14 + 0 + 450 - 0                   = 1,746.14
  // Ontario / period  = round(1,746.14 / 26)                     = round(67.15923)    = 67.16
  // Net               = 1600 - 87.19 - 26.08 - 111.47 - 67.16    = 1,308.10
  const r = computePeriod(JAN, { gross: 160000, periodsPerYear: 26, td1: BASIC_TD1, ytd: ZERO_YTD })

  it('CPP, CPP2 and EI', () => {
    expect(r.factors.cppExemption).toBe(13461)
    expect(r.cpp).toBe(8719)
    expect(r.cpp2).toBe(0)
    expect(r.ei).toBe(2608)
  })
  it('federal factors', () => {
    expect(r.factors.F5).toBe(1465)
    expect(r.factors.A).toBe(4121910)
    expect(r.factors.K1).toBe(230328)
    expect(r.factors.K2).toBe(35896)
    expect(r.factors.K4).toBe(21014)
    expect(r.factors.T3).toBe(289829)
    expect(r.factors.T1).toBe(289829)
    expect(r.federalTax).toBe(11147)
  })
  it('Ontario factors', () => {
    expect(r.factors.K1P).toBe(65594)
    expect(r.factors.K2P).toBe(12948)
    expect(r.factors.T4).toBe(129614)
    expect(r.factors.V1).toBe(0)
    expect(r.factors.V2).toBe(45000)
    expect(r.factors.S).toBe(0)
    expect(r.factors.T2).toBe(174614)
    expect(r.ontarioTax).toBe(6716)
  })
  it('net', () => {
    expect(r.net).toBe(130810)
  })
})

describe('TD1 "total income less than total claim amount" box (claim code E)', () => {
  it('withholds no federal tax, but CPP, EI and the Ontario Health Premium still apply', () => {
    const r = computePeriod(JAN, { gross: 160000, periodsPerYear: 26, td1: { ...BASIC_TD1, federalExempt: true, ontarioExempt: true }, ytd: ZERO_YTD })
    expect(r.cpp).toBe(8719)
    expect(r.ei).toBe(2608)
    expect(r.federalTax).toBe(0)
    // OHP on A = 41,219.10 is $450 a year; 450 / 26 = 17.3077 -> 17.31
    expect(r.ontarioTax).toBe(1731)
  })
  it('withholds nothing at all when annualized income is $20,000 or less', () => {
    const r = computePeriod(JAN, { gross: 70000, periodsPerYear: 26, td1: { ...BASIC_TD1, federalExempt: true, ontarioExempt: true }, ytd: ZERO_YTD })
    expect(r.federalTax).toBe(0)
    expect(r.ontarioTax).toBe(0)
    expect(r.cpp).toBeGreaterThan(0)
  })
})

describe('the box can be ticked on one form only', () => {
  // Same $1,600 biweekly cheque as the hand-worked case: federal 111.47, Ontario 67.16 (OHP alone 17.31).
  it('federal TD1 only: no federal tax, Ontario withheld as normal', () => {
    const r = computePeriod(JAN, { gross: 160000, periodsPerYear: 26, td1: { ...BASIC_TD1, federalExempt: true }, ytd: ZERO_YTD })
    expect(r.federalTax).toBe(0)
    expect(r.ontarioTax).toBe(6716)
  })
  it('TD1ON only: federal withheld as normal, Ontario only the health premium', () => {
    const r = computePeriod(JAN, { gross: 160000, periodsPerYear: 26, td1: { ...BASIC_TD1, ontarioExempt: true }, ytd: ZERO_YTD })
    expect(r.federalTax).toBe(11147)
    expect(r.ontarioTax).toBe(1731)
  })
})

describe('Ontario surtax, health premium and tax reduction', () => {
  it('a low earner gets the Ontario tax reduction (S) and no OHP', () => {
    // $700 biweekly -> A about 18,000: T4 is small, so S wipes it out.
    const r = computePeriod(JAN, { gross: 70000, periodsPerYear: 26, td1: BASIC_TD1, ytd: ZERO_YTD })
    expect(r.factors.V2).toBe(0)
    expect(r.factors.S).toBe(r.factors.T4 + r.factors.V1)
    expect(r.ontarioTax).toBe(0)
  })
  it('a high earner pays surtax (V1) and the $900 OHP cap is reached above $200,600', () => {
    const r = computePeriod(JAN, { gross: 2000000, periodsPerYear: 12, td1: BASIC_TD1, ytd: ZERO_YTD })
    expect(r.factors.V1).toBeGreaterThan(0)
    expect(r.factors.V2).toBe(90000)
    expect(r.factors.S).toBe(0)
  })
})

describe('per-employer annual maximums', () => {
  it('stops EI at the $1,123.07 maximum and switches the K2 EI credit to the maximum', () => {
    const schedule = Array.from({ length: 52 }, (_, i) => ({
      payDate: new Date(Date.UTC(2026, 0, 2 + 7 * i)).toISOString().slice(0, 10),
      gross: 400000,
    }))
    const { slips, totals } = runPayroll({ schedule, frequency: 'weekly', td1: BASIC_TD1 })
    // 0.0163 x 4000 = 65.20 a week; 17 x 65.20 = 1108.40; the 18th week takes the last 14.67.
    expect(slips[16]!.ei).toBe(6520)
    expect(slips[17]!.ei).toBe(1467)
    expect(slips[18]!.ei).toBe(0)
    expect(totals.ei).toBe(112307)
    expect(totals.cpp).toBe(423045)
    expect(totals.cpp2).toBe(41600)
  })

  it('a second employer starts again from zero (that is why students over-contribute)', () => {
    const term = (start: number) =>
      Array.from({ length: 8 }, (_, i) => ({
        payDate: new Date(Date.UTC(2026, start, 9 + 14 * i)).toISOString().slice(0, 10),
        gross: 160000,
      }))
    const a = runPayroll({ schedule: term(0), frequency: 'biweekly', td1: BASIC_TD1 })
    const b = runPayroll({ schedule: term(4), frequency: 'biweekly', td1: BASIC_TD1 })
    expect(a.slips[0]!.cpp).toBe(b.slips[0]!.cpp)
    // Each employer allowed 8 x 134.61 of exemption = 1,076.88, not 3,500.
    expect(a.totals.cpp).toBe(8 * 8719)
  })

  it('carries year-to-date with the same employer between calls', () => {
    const schedule = [{ payDate: '2026-05-08', gross: 160000 }]
    const first = runPayroll({ schedule, frequency: 'biweekly', td1: BASIC_TD1 })
    const second = runPayroll({ schedule, frequency: 'biweekly', td1: BASIC_TD1, startingYtd: first.endingYtd })
    expect(second.endingYtd.cpp).toBe(2 * 8719)
    expect(second.endingYtd.pensionable).toBe(320000)
  })
})

describe('edition switching inside one term', () => {
  it('labels each paycheque with the edition in force on its pay date', () => {
    const schedule = [
      { payDate: '2026-06-26', gross: 160000 },
      { payDate: '2026-07-10', gross: 160000 },
    ]
    const { slips } = runPayroll({ schedule, frequency: 'biweekly', td1: BASIC_TD1 })
    expect(slips[0]!.edition).toMatch(/JAN/)
    expect(slips[1]!.edition).toMatch(/JUL/)
    // No federal or Ontario changes in July 2026, so the amounts are identical.
    expect(slips[1]!.federalTax).toBe(slips[0]!.federalTax)
    expect(slips[1]!.ontarioTax).toBe(slips[0]!.ontarioTax)
  })
})

describe('invariants across a range of pay', () => {
  const td1 = BASIC_TD1
  for (const P of [52, 26, 24, 12]) {
    it(`P=${P}: deductions never exceed gross and tax is monotonic in gross`, () => {
      let prevTax = -1
      for (let gross = 0; gross <= 1500000; gross += 2500) {
        const r = computePeriod(JAN, { gross, periodsPerYear: P, td1, ytd: ZERO_YTD })
        const tax = r.federalTax + r.ontarioTax
        expect(r.net).toBe(gross - r.cpp - r.cpp2 - r.ei - tax)
        expect(r.net).toBeGreaterThanOrEqual(0)
        expect(tax).toBeGreaterThanOrEqual(prevTax - 1) // allow a 1-cent rounding wobble
        prevTax = tax
        for (const v of Object.values(r.factors)) expect(Number.isInteger(v)).toBe(true)
      }
    })
  }
})
