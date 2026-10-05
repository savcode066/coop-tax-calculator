/**
 * Two kinds of checks on the parameter files:
 *  1. The 2026 sanity figures from the project brief.
 *  2. Every withholding value cross-checked against the CRA's own CSV files,
 *     vendored unmodified in params/sources/.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import annualRaw from '../../params/annual/2026.json'
import { rawAnnualParams, rawWithholdingEditions } from '../../params/index.ts'
import janRaw from '../../params/withholding/2026-01-01.json'
import julRaw from '../../params/withholding/2026-07-01.json'
import { parseDecimal, type Q } from '../../src/engine/money.ts'
import { annualParamsFor, editionForPayDate, UnsupportedYearError } from '../../src/engine/params/select.ts'
import type { RawWithholdingEdition, Sourced } from '../../src/engine/params/types.ts'

const ROOT = join(import.meta.dirname, '..', '..')

/** Minimal RFC-4180 CSV reader (the CRA files are Windows-1252). */
function readCsv(rel: string): string[][] {
  const text = readFileSync(join(ROOT, rel), 'latin1')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) rows.push([...row, cell])
  return rows
}

const num = (s: string): Q => parseDecimal(s.replace(/[^\d.,-]/g, ''))
const same = (json: Sourced, csvCell: string | undefined) => {
  expect(csvCell, `CSV cell for ${json.source}`).toBeDefined()
  expect(num(json.value), json.source).toEqual(num(csvCell!))
}

/** Find the row whose first cell is `label`, then the row of `factor` within that block. */
function blockRow(rows: string[][], label: string, factor: string): string[] {
  const start = rows.findIndex((r) => r[0] === label)
  expect(start, `block ${label}`).toBeGreaterThanOrEqual(0)
  for (let i = start; i < rows.length; i++) {
    if (i > start && rows[i]![0] !== '') break
    if (rows[i]![1] === factor) return rows[i]!
  }
  throw new Error(`No ${label}/${factor} row`)
}

const DIR = { jan: 'params/sources/t4127-2026-01', jul: 'params/sources/t4127-2026-07' }
const editions: [string, RawWithholdingEdition, string, string][] = [
  ['January', janRaw, `${DIR.jan}/rtsncmtrshldcnstnt-01-26e.csv`, `${DIR.jan}/thrrtsmnts-01-26e.csv`],
  ['July', julRaw, `${DIR.jul}/rates-income-thresholds-constants-26e.csv`, `${DIR.jul}/other-rates-amounts-26e.csv`],
]

describe('2026 sanity figures from the brief', () => {
  for (const [name, raw] of editions) {
    it(`${name} edition matches`, () => {
      const v = (s: Sourced) => s.value
      expect(v(raw.federal.brackets[0]!.rate)).toBe('0.14')
      expect(v(raw.federal.brackets[1]!.threshold)).toBe('58523')
      expect(v(raw.federal.basicPersonalAmount.max)).toBe('16452')
      expect(v(raw.federal.canadaEmploymentAmount)).toBe('1501')
      expect(v(raw.cpp.totalRate)).toBe('0.0595')
      expect(v(raw.cpp.basicExemption)).toBe('3500.00')
      expect(v(raw.cpp.ympe)).toBe('74600.00')
      expect(v(raw.cpp.secondAdditionalRate)).toBe('0.04')
      expect(v(raw.cpp.yampe)).toBe('85000.00')
      expect(v(raw.ei.rate)).toBe('0.0163')
      expect(v(raw.ei.maxInsurableEarnings)).toBe('68900.00')
      expect(v(raw.ontario.brackets[0]!.rate)).toBe('0.0505')
      expect(v(raw.ontario.brackets[1]!.threshold)).toBe('53891')
      expect(v(raw.ontario.basicPersonalAmount)).toBe('12989')
    })
  }
})

describe('withholding JSON matches the CRA CSV files', () => {
  for (const [name, raw, ratesCsv, otherCsv] of editions) {
    describe(`${name} edition`, () => {
      const rates = readCsv(ratesCsv)
      const other = readCsv(otherCsv)

      it('federal and Ontario brackets (Table 8.1)', () => {
        const fa = blockRow(rates, 'Federal', 'A')
        const fr = blockRow(rates, 'Federal', 'R')
        const fk = blockRow(rates, 'Federal', 'K')
        raw.federal.brackets.forEach((b, i) => {
          same(b.threshold, fa[2 + i])
          same(b.rate, fr[2 + i])
          same(b.constant!, fk[2 + i])
        })
        expect(fa[2 + raw.federal.brackets.length]).toBe('')
        const oa = blockRow(rates, 'ON', 'A')
        const ov = blockRow(rates, 'ON', 'V')
        const ok = blockRow(rates, 'ON', 'KP')
        raw.ontario.brackets.forEach((b, i) => {
          same(b.threshold, oa[2 + i])
          same(b.rate, ov[2 + i])
          same(b.constant!, ok[2 + i])
        })
        expect(oa[2 + raw.ontario.brackets.length]).toBe('')
      })

      it('other rates and amounts (Table 8.2)', () => {
        const header = other[1]!
        const col = (h: string) => header.indexOf(h)
        const fed = other.find((r) => r[0] === 'Federal')!
        same(raw.federal.canadaEmploymentAmount, fed[col('CEA')])
        const onIdx = other.findIndex((r) => r[0] === 'ON')
        const on = other[onIdx]!
        same(raw.ontario.basicPersonalAmount, on[col('Basic amount')])
        same(raw.ontario.taxReduction.basicAmount, on[col('S2')])
        raw.ontario.surtax.forEach((s, i) => {
          const r = other[onIdx + 1 + i]!
          same(s.threshold, r[col('T4 to V1')])
          same(s.rate, r[col('V1 rate')])
        })
      })
    })
  }

  // CPP/EI and claim-code tables are only published with the January edition.
  const cppEi = (raw: RawWithholdingEdition) => {
    const ttl = readCsv(`${DIR.jan}/cpp-qpp-ttl-01-26e.csv`).find((r) => r[0]?.startsWith('CPP ('))!
    same(raw.cpp.ympe, ttl[1])
    same(raw.cpp.basicExemption, ttl[2])
    same(raw.cpp.totalRate, ttl[4])
    same(raw.cpp.maxContribution, ttl[5])
    const br = readCsv(`${DIR.jan}/cpp-qpp-br-01-26e.csv`).find((r) => r[0]?.startsWith('CPP ('))!
    same(raw.cpp.baseRate, br[2])
    same(raw.cpp.maxBaseContribution, br[3])
    const add1 = readCsv(`${DIR.jan}/cpp-qpp-addntl-01-26e.csv`).find((r) => r[0]?.startsWith('CPP ('))!
    same(raw.cpp.firstAdditionalRate, add1[2])
    const add2 = readCsv(`${DIR.jan}/cpp-qpp-scnd-addntl-01-26e.csv`).find((r) => r[0]?.startsWith('CPP ('))!
    same(raw.cpp.yampe, add2[2])
    same(raw.cpp.secondAdditionalRate, add2[4])
    same(raw.cpp.maxSecondContribution, add2[5])
    const ei = readCsv(`${DIR.jan}/ei-01-26e.csv`).find((r) => r[0] === 'Canada except QC')!
    same(raw.ei.maxInsurableEarnings, ei[1])
    same(raw.ei.rate, ei[2])
    same(raw.ei.maxPremium, ei[4])
    const fcc = readCsv(`${DIR.jan}/cc-fd-01-26e.csv`).find((r) => r[0] === '1')!
    same(raw.federal.basicPersonalAmount.max, fcc[3])
    const occ = readCsv(`${DIR.jan}/cc-on-01-26e.csv`).find((r) => r[0] === '1')!
    same(raw.ontario.basicPersonalAmount, occ[3])
  }
  it('CPP, EI and claim codes (Tables 8.3–8.7, 8.9, 8.18), January', () => cppEi(janRaw))
  it('CPP, EI and claim codes, July (unchanged)', () => cppEi(julRaw))

  it('every value records a source', () => {
    const walk = (o: unknown, path: string) => {
      if (o && typeof o === 'object') {
        if ('value' in o) {
          expect((o as Sourced).source, path).toMatch(/\S{3,}/)
          return
        }
        for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`)
      }
    }
    for (const e of rawWithholdingEditions) walk({ federal: e.federal, ontario: e.ontario, cpp: e.cpp, ei: e.ei }, e.edition)
    for (const a of rawAnnualParams) walk({ federal: a.federal, ontario: a.ontario, cpp: a.cpp, ei: a.ei }, `annual ${a.taxYear}`)
  })
})

describe('annual 2026 params agree with T4127-JAN-2026 where they overlap', () => {
  it('brackets, BPAs, CEA, CPP and EI', () => {
    const v = (s: Sourced) => s.value
    expect(annualRaw.federal.brackets.map((b) => [v(b.threshold), v(b.rate)])).toEqual(
      janRaw.federal.brackets.map((b) => [v(b.threshold), v(b.rate)]),
    )
    expect(annualRaw.ontario.brackets.map((b) => [v(b.threshold), v(b.rate)])).toEqual(
      janRaw.ontario.brackets.map((b) => [v(b.threshold), v(b.rate)]),
    )
    expect(v(annualRaw.federal.basicPersonalAmount.max)).toBe(v(janRaw.federal.basicPersonalAmount.max))
    expect(v(annualRaw.federal.canadaEmploymentAmount)).toBe(v(janRaw.federal.canadaEmploymentAmount))
    expect(v(annualRaw.ontario.basicPersonalAmount)).toBe(v(janRaw.ontario.basicPersonalAmount))
    expect(v(annualRaw.ontario.taxReduction.basicAmount)).toBe(v(janRaw.ontario.taxReduction.basicAmount))
    for (const k of Object.keys(janRaw.cpp) as (keyof typeof janRaw.cpp)[]) expect(v(annualRaw.cpp[k])).toBe(v(janRaw.cpp[k]))
    for (const k of Object.keys(janRaw.ei) as (keyof typeof janRaw.ei)[]) expect(v(annualRaw.ei[k])).toBe(v(janRaw.ei[k]))
  })
})

describe('edition selection by pay date', () => {
  it('uses January through June 30 and July from July 1', () => {
    expect(editionForPayDate('2026-01-01').effectiveFrom).toBe('2026-01-01')
    expect(editionForPayDate('2026-06-30').effectiveFrom).toBe('2026-01-01')
    expect(editionForPayDate('2026-07-01').effectiveFrom).toBe('2026-07-01')
    expect(editionForPayDate('2026-12-31').effectiveFrom).toBe('2026-07-01')
  })
  it('refuses years it has no data for', () => {
    expect(() => editionForPayDate('2025-12-31')).toThrow(UnsupportedYearError)
    expect(() => editionForPayDate('2027-01-01')).toThrow(UnsupportedYearError)
    expect(() => annualParamsFor(2027)).toThrow(UnsupportedYearError)
    expect(annualParamsFor(2026).taxYear).toBe(2026)
  })
})
