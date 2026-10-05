import { rawAnnualParams, rawWithholdingEditions } from '../../../params/index.ts'
import {
  parseAnnualParams,
  parseWithholdingEdition,
  type AnnualParams,
  type RawAnnualParams,
  type RawWithholdingEdition,
  type WithholdingParams,
} from './types.ts'

/** An ISO calendar date, "YYYY-MM-DD". */
export type IsoDate = string

export class UnsupportedYearError extends Error {}

export interface ParamRegistry {
  /** All withholding editions, sorted by effective date. */
  editions: readonly WithholdingParams[]
  annual: readonly AnnualParams[]
}

export function buildRegistry(
  rawEditions: readonly RawWithholdingEdition[],
  rawAnnual: readonly RawAnnualParams[],
): ParamRegistry {
  const editions = rawEditions.map(parseWithholdingEdition).sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
  return { editions, annual: rawAnnual.map(parseAnnualParams) }
}

export const defaultRegistry: ParamRegistry = buildRegistry(rawWithholdingEditions, rawAnnualParams)

export const supportedTaxYears = (reg: ParamRegistry = defaultRegistry): number[] =>
  [...new Set(reg.annual.map((a) => a.taxYear))].sort()

/**
 * The T4127 edition in force on a pay date: the latest edition of the pay
 * date's calendar year whose effective date is on or before the pay date.
 */
export function editionForPayDate(payDate: IsoDate, reg: ParamRegistry = defaultRegistry): WithholdingParams {
  const year = Number(payDate.slice(0, 4))
  let found: WithholdingParams | undefined
  for (const e of reg.editions) {
    if (e.taxYear === year && e.effectiveFrom <= payDate) found = e
  }
  if (!found) throw new UnsupportedYearError(`No T4127 edition covers pay date ${payDate}`)
  return found
}

export function annualParamsFor(taxYear: number, reg: ParamRegistry = defaultRegistry): AnnualParams {
  const a = reg.annual.find((p) => p.taxYear === taxYear)
  if (!a) throw new UnsupportedYearError(`No annual tax parameters for ${taxYear}`)
  return a
}
